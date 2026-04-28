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
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';

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
    @Body() body: { workspaceSlug: string; login: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(
      body.workspaceSlug,
      body.login,
      body.password,
    );

    // Set httpOnly cookie — JS cannot read this (XSS protection)
    res.cookie('pf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return {
      user,
      workspaceSlug: body.workspaceSlug,
    };
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
      sameSite: 'lax',
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
      const token = req.cookies?.['pf_token'];
      if (!token) return null;
      
      const payload = this.authService['jwt'].verify(token, { secret: process.env.JWT_SECRET });
      
      const [tenant, employee] = await Promise.all([
        this.authService['prisma'].tenant.findUnique({
          where: { id: payload.tenantId },
          include: { plan: true }
        }),
        this.authService['prisma'].employee.findUnique({
          where: { id: payload.sub },
          include: { role: true }
        })
      ]);

      if (!tenant || !employee) return null;

      let tenantFeatures = {};
      if (tenant?.plan?.features) {
        try {
          tenantFeatures = typeof tenant.plan.features === 'string' 
            ? JSON.parse(tenant.plan.features) 
            : tenant.plan.features;
        } catch { }
      }

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
        isFirstLogin: employee.isFirstLogin, // Return flag for frontend onboarding
        passwordVersion: employee.passwordVersion,
        tenantFeatures
      };
    } catch (e) {
      console.error('Me endpoint error:', e);
      return null;
    }
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

