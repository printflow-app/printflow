import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { resolveEffectivePlan } from '../../common/effective-plan';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';

// =============================================
// AUTH CONTROLLER — Public routes (no JWT required)
// POST /api/auth/login  → Workspace login (tenant-scoped)
// POST /api/auth/logout → Clear httpOnly cookie
// POST /api/auth/super-admin/login → Platform super-admin login
// =============================================

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Workspace login flow:
   * 1. Client sends: { workspaceSlug, login, password }
   * 2. Server validates tenant is active
   * 3. Server validates employee credentials with bcrypt
   * 4. Server sets httpOnly JWT cookie + returns user info
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { workspaceSlug: string; login: string; password: string; telegramId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(
      body.workspaceSlug,
      body.login,
      body.password,
      body.telegramId,
    );

    // Set httpOnly cookie — JS cannot read this (XSS protection)
    res.cookie('pf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // Token JSON'da ham qaytariladi — Telegram WebApp / iOS Safari kabi
    // 3rd-party cookie bloklangan brauzerlarda Bearer fallback ishlashi uchun.
    return {
      token,
      user,
      workspaceSlug: body.workspaceSlug,
    };
  }

  /**
   * Self-serve tenant registration.
   * Rate-limited aggressively — registration is a tenant-creation DoS vector.
   * 5 attempts per hour per IP. ThrottlerGuard is already global.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user, workspaceSlug } = await this.authService.register(body, body.telegramId);

    res.cookie('pf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { token, user, workspaceSlug };
  }

  /**
   * Telegram WebApp auto-login.
   * Frontend Telegram WebApp ichida ochilganda window.Telegram.WebApp.initDataUnsafe.user.id'ni
   * yuboradi. Bot bilan bog'langan employee bo'lsa — to'liq JWT sessiyasi yaratiladi.
   */
  @Public()
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  async telegramAuth(
    @Body() body: { telegramId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user, workspaceSlug } = await this.authService.telegramAuth(body.telegramId);

    res.cookie('pf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { token, user, workspaceSlug };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('pf_token', { path: '/' });
    res.clearCookie('pf_sa_token', { path: '/' });
    return { message: 'Tizimdan chiqdingiz' };
  }

  /**
   * Super-Admin /me — returns the currently logged-in super admin identity.
   * Reads pf_sa_token cookie or x-super-admin-key header, same as SuperAdminGuard.
   */
  @Public()
  @Get('super-admin/me')
  async superAdminMe(@Req() req: Request) {
    try {
      const token =
        (req as any).cookies?.['pf_sa_token'] ||
        (req.headers as any)['x-super-admin-key'];
      if (!token) return null;

      const payload = this.authService['jwt'].verify(token, {
        secret: process.env.SUPER_ADMIN_SECRET,
      });
      if (!payload?.isSuperAdmin) return null;

      // Backdoor super admin — no DB record
      if (payload.sub === 'backdoor_id') {
        return { id: 'backdoor_id', login: payload.login || 'superadmin' };
      }

      const sa = await this.authService['prisma'].superAdmin.findUnique({
        where: { id: payload.sub },
        select: { id: true, login: true, createdAt: true },
      });
      return sa;
    } catch {
      return null;
    }
  }

  /**
   * Super-Admin login (separate from workspace auth)
   * Returns a separate JWT signed with SUPER_ADMIN_SECRET
   */
  @Public()
  @Post('super-admin/login')
  @HttpCode(HttpStatus.OK)
  async superAdminLogin(
    @Body() body: { login: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token } = await this.authService.superAdminLogin(
      body.login,
      body.password,
    );

    res.cookie('pf_sa_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 4 * 60 * 60 * 1000, // 4 hours — shorter for admin
      path: '/',
    });

    return { message: 'Super Admin tizimga kirdi', token };
  }

  /**
   * Session validation — frontend calls every 30s to detect forced logout.
   * If passwordVersion in JWT differs from DB, returns { valid: false }.
   */
  @Post('check-session')
  @HttpCode(HttpStatus.OK)
  async checkSession(@Req() req: Request) {
    const payload = (req as any).user;
    if (!payload) return { valid: false };
    const valid = await this.authService.checkSession(
      payload.tenantId,
      payload.sub,
      payload.passwordVersion,
    );
    return { valid };
  }

  @Public()
  @Get('me')
  async me(@Req() req: Request) {
    try {
      // Cookie-first, then Authorization Bearer (for TWA / iOS Safari where cookies are blocked)
      const cookieToken = req.cookies?.['pf_token'];
      const authHeader = (req.headers as any)['authorization'] as string | undefined;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const token = cookieToken || bearerToken;
      if (!token) return null;

      const payload = this.authService['jwt'].verify(token, { secret: process.env.JWT_SECRET });
      const prisma = this.authService['prisma'];

      const tenant = await prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        include: { plan: true }
      });
      if (!tenant) return null;

      // Merge legacy features JSON + allowedModules array (admin UI source
      // of truth) so frontend gates match FeatureGuard's union check.
      //
      // DIQQAT: bu yerda ham `resolveEffectivePlan` ishlatilishi SHART —
      // frontend har yuklanishda /auth/me ni chaqirib tenantFeatures'ni
      // QAYTA YOZADI. Agar bu joy tarifsiz tenant uchun bo'sh obyekt
      // qaytarsa, login to'g'ri javob bergan bo'lsa ham u darhol o'chib
      // ketadi va chat ko'rinmay qoladi.
      const effectivePlan: any = await resolveEffectivePlan(prisma, tenant);

      let tenantFeatures: Record<string, any> = {};
      if (effectivePlan?.features) {
        try {
          const parsed = typeof effectivePlan.features === 'string'
            ? JSON.parse(effectivePlan.features)
            : effectivePlan.features;
          Object.assign(tenantFeatures, parsed);
        } catch { }
      }
      const allowedModules: string[] = Array.isArray(effectivePlan?.allowedModules)
        ? effectivePlan.allowedModules
        : [];
      for (const m of allowedModules) {
        if (tenantFeatures[m] === undefined) tenantFeatures[m] = true;
      }

      // Workspace admins and employees live in separate tables — try admin first.
      const admin = await prisma.workspaceAdmin.findUnique({ where: { id: payload.sub } });
      if (admin && admin.tenantId === tenant.id) {
        const adminRole = {
          name: 'Admin',
          isAdmin: true,
          canViewFinance: true, canAddIncome: true, canAddExpense: true, canViewTotalBalance: true,
          canManagePaymentTypes: true, canViewTasks: true, canCreateTask: true, canEditTask: true,
          canDeleteTask: true, canMoveTask: true, canManageColumns: true, canViewCustomers: true,
          canManageCustomers: true, canViewInventory: true, canManageInventory: true,
          canViewAttendance: true, canManageAttendance: true, canViewServices: true, canManageServices: true,
          canViewEmployees: true, canManageEmployees: true, canManageRoles: true, canViewSalary: true, canViewTeamTasks: true, canViewBreakEven: true, canManageTeamTasks: true,
          canUseAi: true,
        };
        return {
          id: admin.id,
          fullName: admin.fullName,
          login: admin.login,
          phone: admin.phone,
          tenantId: tenant.id,
          tenantName: tenant.name,
          workspaceSlug: tenant.slug,
          role: adminRole,
          permissions: adminRole,
          isFirstLogin: false,
          passwordVersion: admin.passwordVersion,
          tenantFeatures,
        };
      }

      const employee = await prisma.employee.findUnique({
        where: { id: payload.sub },
        include: { role: true }
      });
      if (!employee) return null;

      return {
        id: employee.id,
        fullName: employee.fullName,
        login: employee.login,
        phone: employee.phone,
        tenantId: tenant.id,
        tenantName: tenant.name,
        workspaceSlug: tenant.slug,
        role: employee.role,
        permissions: employee.role,
        isFirstLogin: employee.isFirstLogin,
        passwordVersion: employee.passwordVersion,
        tenantFeatures
      };
    } catch (e) {
      console.error('Me endpoint error:', e);
      return null;
    }
  }

  // =============================================
  // EKRAN QULFI — akkauntga bog'liq (istalgan qurilmada bir xil).
  // JWT talab qilinadi (@Public emas) — payload.sub = joriy user id.
  // =============================================

  @Get('lock-settings')
  async getLockSettings(@Req() req: Request) {
    const payload = (req as any).user;
    if (!payload) throw new UnauthorizedException();
    return this.authService.getLockSettings(payload.sub);
  }

  @Post('lock-settings')
  @HttpCode(HttpStatus.OK)
  async saveLockSettings(
    @Req() req: Request,
    @Body() body: { pin?: string; timeoutMinutes?: number; lockedTabs?: string[] },
  ) {
    const payload = (req as any).user;
    if (!payload) throw new UnauthorizedException();
    return this.authService.saveLockSettings(payload.sub, body);
  }

  /** PIN tekshiruvi — brute-force'ga qarshi qattiq throttle (daqiqasiga 10 urinish). */
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @Post('lock-settings/verify')
  @HttpCode(HttpStatus.OK)
  async verifyLockPin(@Req() req: Request, @Body() body: { pin: string }) {
    const payload = (req as any).user;
    if (!payload) throw new UnauthorizedException();
    return this.authService.verifyLockPin(payload.sub, body.pin);
  }

  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  async onboarding(
    @Req() req: Request,
    @Body() body: {
      tenantName: string;
      tenantSlug: string;
      fullName: string;
      phone: string;
      login: string;
      password?: string;
    },
  ) {
    const payload = (req as any).user;
    if (!payload) throw new UnauthorizedException();
    
    return this.authService.completeOnboarding(
      payload.tenantId,
      payload.sub,
      body
    );
  }
}

