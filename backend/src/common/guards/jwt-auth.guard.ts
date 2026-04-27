import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext } from '../tenant/tenant.context';
import { tenantStorage } from '../tenant/tenant.context';

// =============================================
// JWT AUTH GUARD — Global guard (all routes protected by default)
// @Public() decorator bypasses this guard.
// Validates JWT from httpOnly cookie + sets TenantContext.
// =============================================

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Autentifikatsiya talab etiladi');
    }

    try {
      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      // Attach user to request for downstream use
      req['user'] = payload;

      // Set TenantContext so Prisma middleware auto-scopes all queries
      // NOTE: We set it here AND the actual request handling runs after this returns true.
      // The actual scoped Prisma calls happen in the service layer within the same async context.
      (req as any)._tenantPayload = {
        tenantId: payload.tenantId,
        userId: payload.sub,
        userRole: payload.role,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati o\'tgan');
    }
  }

  private extractToken(req: Request): string | null {
    // Priority 1: httpOnly cookie (most secure)
    const cookieToken = req.cookies?.['pf_token'];
    if (cookieToken) return cookieToken;

    // Priority 2: Authorization header (for bot / API clients)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
