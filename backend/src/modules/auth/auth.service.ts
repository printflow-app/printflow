import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

// Trial duration for self-serve signups. Keep in sync with createWithAdmin (tenants.service.ts).
const TRIAL_DAYS = 7;
const BCRYPT_ROUNDS = 12;
const DEFAULT_BRANCH_NAME = 'Bosh Ofis (Asosiy)';

// Reserved slugs that must never become a tenant subdomain/path segment.
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'billing', 'dashboard', 'login', 'logout',
  'register', 'super-admin', 'superadmin', 't', 'tenant', 'www',
]);

// Builds the feature map the frontend uses to gate modules. The plan stores
// access in two places — legacy `features` JSON and the newer `allowedModules`
// array (admin UI source of truth). FeatureGuard already checks both; we
// surface the union here so UI gates stay in sync with backend enforcement.
function buildTenantFeatures(plan: any): Record<string, any> {
  const features: Record<string, any> = {};
  if (plan?.features) {
    try {
      const parsed = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
      Object.assign(features, parsed);
    } catch {}
  }
  const allowedModules: string[] = Array.isArray(plan?.allowedModules) ? plan.allowedModules : [];
  for (const m of allowedModules) {
    if (features[m] === undefined) features[m] = true;
  }
  return features;
}

// Full permission shape for a workspace owner/admin. Shared by register() and
// telegramAuth() so an owner who connects via Telegram gets the identical
// permission set the signup flow returns.
const OWNER_ADMIN_ROLE = {
  name: 'Admin',
  canViewFinance: true, canAddIncome: true, canAddExpense: true, canViewTotalBalance: true,
  canManagePaymentTypes: true, canViewTasks: true, canCreateTask: true, canEditTask: true,
  canDeleteTask: true, canMoveTask: true, canManageColumns: true, canViewCustomers: true,
  canManageCustomers: true, canViewInventory: true, canManageInventory: true,
  canViewAttendance: true, canManageAttendance: true, canViewServices: true,
  canManageServices: true, canViewEmployees: true, canManageEmployees: true,
  canViewRoles: true, canManageRoles: true, canViewSalary: true, canManageAdmins: true,
  canViewKpi: true, canManageBranches: true, canManageNotifications: true,
  canViewExpenseCharts: true, canViewSettings: true, canAssignToOtherBranches: true,
  canManageBilling: true, canViewVendors: true, canViewStatistics: true,
  canViewFinanceReports: true, canViewServiceReports: true, canManageExpenseTypes: true,
  canManageKanbanColumns: true, canManageGeneralSettings: true,
  canViewAllTasks: true, canViewOwnTasks: false, canViewAllAttendance: true,
  canViewGrowthCards: true, canViewIncomeByType: true, canViewExpenseByType: true,
  canViewCostCalculator: true, canAddCustomer: true, canEditCustomer: true,
  canDeleteCustomer: true, canAddEmployee: true, canEditEmployee: true,
  canDeleteEmployee: true, canResetEmployeePassword: true, canAddInventoryItem: true,
  canReceiveInventory: true, canUseInventory: true, canWriteOffInventory: true,
  canManageVendors: true, canViewBranches: true, canViewBillingStatus: true,
} as const;

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
  async login(workspaceSlug: string, login: string, password: string, telegramId?: string) {
    // Step 1: Find tenant (not tenant-scoped — platform-level query)
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: workspaceSlug },
      include: { plan: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Workspace topilmadi yoki faol emas');
    }

    // Subscription status check (based on status field, not just trialEndsAt)
    const now = new Date();
    if (tenant.status === 'EXPIRED') {
      throw new UnauthorizedException('Obuna muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'TRIAL' && tenant.trialEndsAt && now > tenant.trialEndsAt) {
      throw new UnauthorizedException('Sinov muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'ACTIVE' && tenant.subscriptionEndsAt && now > tenant.subscriptionEndsAt) {
      throw new UnauthorizedException('Obuna muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'PENDING_PAYMENT') {
      throw new UnauthorizedException("To'lov tasdiqlanishi kutilmoqda");
    }

    // Step 2: Temporarily set TenantContext to query this tenant's users
    let roleObj: any = null;
    let isWorkspaceAdmin = false;

    const userEntity = await TenantContext.run(
      { tenantId: tenant.id, userId: '', userRole: '' },
      async () => {
        const admin = await this.prisma.workspaceAdmin.findFirst({
          where: { login },
        });
        if (admin) {
          isWorkspaceAdmin = true;
          roleObj = {
            name: 'Admin',
            canViewFinance: true, canAddIncome: true, canAddExpense: true, canViewTotalBalance: true,
            canManagePaymentTypes: true, canViewTasks: true, canCreateTask: true, canEditTask: true,
            canDeleteTask: true, canMoveTask: true, canManageColumns: true, canViewCustomers: true,
            canManageCustomers: true, canViewInventory: true, canManageInventory: true,
            canViewAttendance: true, canManageAttendance: true, canViewServices: true,
            canManageServices: true,
            canViewEmployees: true, canManageEmployees: true, canViewRoles: true, canManageRoles: true, canViewSalary: true,
            canManageAdmins: true, canViewKpi: true, canManageBranches: true, canManageNotifications: true,
            canViewExpenseCharts: true, canViewSettings: true, canAssignToOtherBranches: true,
            canManageBilling: true, canViewVendors: true, canViewStatistics: true,
            canViewFinanceReports: true, canViewServiceReports: true, canManageExpenseTypes: true,
            canManageKanbanColumns: true, canManageGeneralSettings: true,
            canViewAllTasks: true, canViewOwnTasks: false,
            canViewAllAttendance: true,
            canViewGrowthCards: true, canViewIncomeByType: true, canViewExpenseByType: true, canViewCostCalculator: true,
            canAddCustomer: true, canEditCustomer: true, canDeleteCustomer: true,
            canAddEmployee: true, canEditEmployee: true, canDeleteEmployee: true, canResetEmployeePassword: true,
            canAddInventoryItem: true, canReceiveInventory: true, canUseInventory: true, canWriteOffInventory: true,
            canManageVendors: true, canViewBranches: true, canViewBillingStatus: true,
          };
          return admin;
        }

        const emp = await this.prisma.employee.findFirst({
          where: { login },
          include: { role: true },
        });
        if (emp) {
          roleObj = emp.role;
          return emp;
        }
        return null;
      },
    );

    if (!userEntity) {
      // Generic error — don't reveal if user exists or not
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    // Step 3: Verify password with bcrypt
    const isValid = await bcrypt.compare(password, userEntity.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    // Step 4: Sign JWT
    const token = this.jwt.sign(
      {
        sub: userEntity.id,
        tenantId: tenant.id,
        workspaceSlug: tenant.slug,
        role: roleObj.name,
        isAdmin: isWorkspaceAdmin,
        permissions: roleObj,
        passwordVersion: userEntity.passwordVersion,
      },
      {
        secret: process.env.JWT_SECRET || 'printflow_super_secret_key_2024',
        expiresIn: '30d',
      },
    );

    // Telegram WebApp ichida login qilingan bo'lsa — hisobni Telegram'ga bog'laymiz.
    // Shundan keyin botda alohida login qilish shart emas; bildirishnomalar ishlaydi.
    await this.linkTelegram({
      telegramId,
      isWorkspaceAdmin,
      userId: userEntity.id,
      tenantId: tenant.id,
    });

    // Return user info (no password hash exposed)
    return {
      token,
      user: {
        id: userEntity.id,
        fullName: userEntity.fullName,
        login: userEntity.login,
        phone: userEntity.phone,
        telegramId: userEntity.telegramId,
        passwordVersion: userEntity.passwordVersion,
        isFirstLogin: isWorkspaceAdmin ? false : (userEntity as any).isFirstLogin, // Return flag for frontend onboarding
        role: roleObj,
        permissions: roleObj,
        baseSalary: isWorkspaceAdmin ? 0 : (userEntity as any).baseSalary,
        givenAmount: isWorkspaceAdmin ? 0 : (userEntity as any).givenAmount,
        workDebt: isWorkspaceAdmin ? 0 : (userEntity as any).workDebt,
        tenantFeatures: buildTenantFeatures(tenant.plan),
      },
    };
  }

  /**
   * Self-serve tenant registration.
   *
   * Atomically creates:
   *   1. Tenant (TRIAL, 7-day)
   *   2. Admin Role (all permissions)
   *   3. WorkspaceAdmin (bcrypt-hashed password)
   *   4. Default Branch "Bosh Ofis (Asosiy)"
   *
   * Wrapped in $transaction — if ANY step fails, the whole signup rolls back
   * (no orphaned tenants/roles/branches).
   *
   * Returns a signed JWT identical in shape to the workspace login flow,
   * so the frontend can drop the user straight into the dashboard.
   */
  async register(dto: RegisterDto, telegramId?: string) {
    // Refuse to sign tokens without a real secret — never fall back to a
    // committed string. (Pre-existing fallbacks in login()/telegramAuth()
    // should also be removed; tracked separately.)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new InternalServerErrorException(
        'Server konfiguratsiyasi xato: JWT_SECRET o\'rnatilmagan',
      );
    }

    if (RESERVED_SLUGS.has(dto.workspaceSlug)) {
      throw new ConflictException('Bu workspace nomi band, boshqa nom tanlang');
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let tenant;
    let admin;
    try {
      // Interactive transaction — all writes commit together or not at all.
      // We pass tenantId explicitly into each create; Prisma middleware skips
      // injection here because no TenantContext is active during signup.
      const result = await this.prisma.$transaction(async (tx) => {
        const t = await tx.tenant.create({
          data: {
            name: dto.tenantName,
            slug: dto.workspaceSlug,
            status: 'TRIAL',
            trialEndsAt,
          },
        });

        await tx.role.create({
          data: {
            tenantId: t.id,
            name: 'Admin',
            // Full permission set — mirrors tenants.service.ts createWithAdmin.
            canViewFinance: true,
            canAddIncome: true,
            canAddExpense: true,
            canViewTotalBalance: true,
            canManagePaymentTypes: true,
            canViewTasks: true,
            canCreateTask: true,
            canEditTask: true,
            canDeleteTask: true,
            canMoveTask: true,
            canManageColumns: true,
            canViewCustomers: true,
            canManageCustomers: true,
            canViewInventory: true,
            canManageInventory: true,
            canViewAttendance: true,
            canManageAttendance: true,
            canViewServices: true,
            canManageServices: true,
            canViewEmployees: true,
            canManageEmployees: true,
            canManageRoles: true,
            canViewSalary: true,
          },
        });

        const wsAdmin = await tx.workspaceAdmin.create({
          data: {
            tenantId: t.id,
            fullName: dto.fullName,
            phone: dto.phone ?? null,
            login: dto.login,
            passwordHash,
          },
        });

        await tx.branch.create({
          data: {
            tenantId: t.id,
            name: DEFAULT_BRANCH_NAME,
            isActive: true,
          },
        });

        return { tenant: t, admin: wsAdmin };
      });
      tenant = result.tenant;
      admin = result.admin;
    } catch (err) {
      // P2002 = unique constraint violation. Slug or login collided with an
      // existing row — return a 409 with a human-readable message instead of
      // leaking Prisma internals.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | string | undefined);
        const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (fields.includes('slug')) {
          throw new ConflictException('Bu workspace nomi allaqachon band');
        }
        if (fields.includes('login')) {
          throw new ConflictException('Bu login band, boshqa login tanlang');
        }
        throw new ConflictException('Ushbu ma\'lumotlar bilan workspace mavjud');
      }
      throw err;
    }

    // Admin role permission shape — same object the login flow returns,
    // so the frontend's permission gating works identically post-register.
    const adminRoleShape = OWNER_ADMIN_ROLE;

    // Telegram WebApp ichida ro'yxatdan o'tilgan bo'lsa — egani Telegram'ga bog'laymiz.
    await this.linkTelegram({
      telegramId,
      isWorkspaceAdmin: true,
      userId: admin.id,
      tenantId: tenant.id,
    });

    const token = this.jwt.sign(
      {
        sub: admin.id,
        tenantId: tenant.id,
        workspaceSlug: tenant.slug,
        role: 'Admin',
        isAdmin: true,
        permissions: adminRoleShape,
        passwordVersion: admin.passwordVersion,
      },
      { secret: jwtSecret, expiresIn: '30d' },
    );

    return {
      token,
      workspaceSlug: tenant.slug,
      user: {
        id: admin.id,
        fullName: admin.fullName,
        login: admin.login,
        phone: admin.phone,
        telegramId: admin.telegramId,
        passwordVersion: admin.passwordVersion,
        isFirstLogin: false, // Self-serve registrant filled the form themselves
        role: adminRoleShape,
        permissions: adminRoleShape,
        tenantId: tenant.id,
        tenantName: tenant.name,
        workspaceSlug: tenant.slug,
        tenantFeatures: {},
      },
    };
  }

  /**
   * Telegram WebApp ichida login/register qilingan foydalanuvchining hisobini
   * uning Telegram akkauntiga bog'laydi. Shundan so'ng botda alohida login
   * qilish shart emas va bildirishnomalar/overtime oqimi ishlaydi.
   *
   * Bitta telegramId = bitta hisob: avval shu telegramId bog'langan boshqa
   * hisoblardan uzamiz, keyin joriy foydalanuvchiga biriktiramiz.
   *
   * Xatolik bo'lsa jim o'tadi — bu login/register'ni hech qachon buzmasligi kerak.
   *
   * XAVFSIZLIK ESLATMASI: telegramId hozircha frontend'da initDataUnsafe'dan
   * keladi (kriptografik tasdiqlanmagan). Kelajakda backend'da initData HMAC
   * tekshiruvini qo'shish kerak (Telegram bot token bilan).
   */
  private async linkTelegram(opts: {
    telegramId?: string;
    isWorkspaceAdmin: boolean;
    userId: string;
    tenantId: string;
  }) {
    const { telegramId, isWorkspaceAdmin, userId, tenantId } = opts;
    if (!telegramId) return;
    const tgId = telegramId.toString();
    try {
      // Bitta telegram = bitta hisob: eski bog'lanishlarni tozalaymiz.
      await this.prisma.employee.updateMany({
        where: { telegramId: tgId, id: { not: userId } },
        data: { telegramId: null },
      });
      await this.prisma.workspaceAdmin.updateMany({
        where: { telegramId: tgId, id: { not: userId } },
        data: { telegramId: null },
      });

      if (isWorkspaceAdmin) {
        await this.prisma.workspaceAdmin.update({
          where: { id: userId },
          data: { telegramId: tgId },
        });
      } else {
        await this.prisma.employee.update({
          where: { id: userId },
          data: { telegramId: tgId },
        });
      }

      // BotSession — bot bildirishnoma va overtime oqimi uchun kerak.
      // employeeId faqat employee uchun; workspace admin uchun null qoldiriladi.
      await this.prisma.botSession.upsert({
        where: { chatId: tgId },
        update: {
          tenantId,
          employeeId: isWorkspaceAdmin ? null : userId,
          step: 'IDLE',
          loginAttempt: null,
        },
        create: {
          chatId: tgId,
          tenantId,
          employeeId: isWorkspaceAdmin ? null : userId,
          step: 'IDLE',
        },
      });
    } catch (err: any) {
      console.warn('linkTelegram xatosi (e\'tiborsiz):', err?.message || err);
    }
  }

  /**
   * Telegram WebApp auto-login.
   * Bot orqali (yoki WebApp ichida login qilib) telegramId bog'langan bo'lsa,
   * shu identifikator orqali to'liq JWT auth flow'i bajariladi.
   * Parol tekshirilmaydi — Telegram'ning o'zi shaxsni tasdiqlaydi.
   * Employee ham, workspace admin ham qo'llab-quvvatlanadi.
   */
  async telegramAuth(telegramId: string) {
    if (!telegramId) {
      throw new UnauthorizedException('Telegram ID kerak');
    }
    const tgId = telegramId.toString();

    // Tenant context yo'q — employee'ni telegramId orqali to'g'ridan-to'g'ri topamiz.
    // Prisma middleware tryGetTenantId() = null bo'lsa scope qo'shmaydi.
    const employee = await this.prisma.employee.findFirst({
      where: { telegramId: tgId },
      include: { role: true },
    });

    if (!employee) {
      // Employee topilmadi — workspace admin (egasi) sifatida urinamiz.
      const admin = await this.prisma.workspaceAdmin.findFirst({
        where: { telegramId: tgId },
      });
      if (admin) {
        return this.buildAdminTelegramSession(admin);
      }
      throw new UnauthorizedException(
        "Telegram hisobi tizimda bog'lanmagan. Avval platformaga bir marta kiring.",
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: employee.tenantId },
      include: { plan: true },
    });

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException("Workspace faol emas");
    }

    const now2 = new Date();
    if (tenant.status === 'EXPIRED') {
      throw new UnauthorizedException('Obuna muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'TRIAL' && tenant.trialEndsAt && now2 > tenant.trialEndsAt) {
      throw new UnauthorizedException('Sinov muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'ACTIVE' && tenant.subscriptionEndsAt && now2 > tenant.subscriptionEndsAt) {
      throw new UnauthorizedException('Obuna muddati tugagan. Obuna xarid qiling');
    }

    const roleObj = employee.role;

    const token = this.jwt.sign(
      {
        sub: employee.id,
        tenantId: tenant.id,
        workspaceSlug: tenant.slug,
        role: roleObj?.name,
        isAdmin: false,
        permissions: roleObj,
        passwordVersion: employee.passwordVersion,
      },
      {
        secret: process.env.JWT_SECRET || 'printflow_super_secret_key_2024',
        expiresIn: '30d',
      },
    );

    return {
      token,
      workspaceSlug: tenant.slug,
      user: {
        id: employee.id,
        fullName: employee.fullName,
        login: employee.login,
        phone: employee.phone,
        telegramId: employee.telegramId,
        passwordVersion: employee.passwordVersion,
        isFirstLogin: (employee as any).isFirstLogin,
        role: roleObj,
        permissions: roleObj,
        baseSalary: (employee as any).baseSalary,
        givenAmount: (employee as any).givenAmount,
        workDebt: (employee as any).workDebt,
        tenantFeatures: buildTenantFeatures(tenant.plan),
      },
    };
  }

  /**
   * Telegram orqali bog'langan workspace admin (egasi) uchun sessiya quradi.
   * login() ning admin tarmog'i bilan bir xil token/permission shaklini qaytaradi.
   */
  private async buildAdminTelegramSession(admin: { id: string; tenantId: string; fullName: string; login: string; phone: string | null; telegramId: string | null; passwordVersion: number }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: admin.tenantId },
      include: { plan: true },
    });
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Workspace faol emas');
    }
    const now = new Date();
    if (tenant.status === 'EXPIRED') {
      throw new UnauthorizedException('Obuna muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'TRIAL' && tenant.trialEndsAt && now > tenant.trialEndsAt) {
      throw new UnauthorizedException('Sinov muddati tugagan. Obuna xarid qiling');
    }
    if (tenant.status === 'ACTIVE' && tenant.subscriptionEndsAt && now > tenant.subscriptionEndsAt) {
      throw new UnauthorizedException('Obuna muddati tugagan. Obuna xarid qiling');
    }

    const token = this.jwt.sign(
      {
        sub: admin.id,
        tenantId: tenant.id,
        workspaceSlug: tenant.slug,
        role: 'Admin',
        isAdmin: true,
        permissions: OWNER_ADMIN_ROLE,
        passwordVersion: admin.passwordVersion,
      },
      {
        secret: process.env.JWT_SECRET || 'printflow_super_secret_key_2024',
        expiresIn: '30d',
      },
    );

    return {
      token,
      workspaceSlug: tenant.slug,
      user: {
        id: admin.id,
        fullName: admin.fullName,
        login: admin.login,
        phone: admin.phone,
        telegramId: admin.telegramId,
        passwordVersion: admin.passwordVersion,
        isFirstLogin: false,
        role: OWNER_ADMIN_ROLE,
        permissions: OWNER_ADMIN_ROLE,
        tenantId: tenant.id,
        tenantName: tenant.name,
        workspaceSlug: tenant.slug,
        tenantFeatures: buildTenantFeatures(tenant.plan),
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
    userId: string,
    passwordVersion: number,
  ): Promise<boolean> {
    return TenantContext.run(
      { tenantId, userId, userRole: '' },
      async () => {
        // Try workspace admin first
        const admin = await this.prisma.workspaceAdmin.findFirst({ where: { id: userId } });
        if (admin) {
          return (admin.passwordVersion || 1) === (passwordVersion || 1);
        }
        const employee = await this.prisma.employee.findFirst({ where: { id: userId } });
        if (!employee) return false;
        return (employee.passwordVersion || 1) === (passwordVersion || 1);
      },
    );
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
