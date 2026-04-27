import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// =============================================
// SUPER ADMIN GUARD
// Platform-level admin (PrintFlow operations team).
// Completely separate from tenant Employees.
// Uses a DIFFERENT JWT secret than tenant JWTs.
// =============================================

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    // Super admin uses a dedicated header to avoid confusion with tenant tokens
    const token = req.headers['x-super-admin-key'];
    if (!token) throw new ForbiddenException('Super Admin access only');

    try {
      const payload = this.jwt.verify(token, {
        secret: process.env.SUPER_ADMIN_SECRET,
      });

      if (payload.isSuperAdmin !== true) {
        throw new ForbiddenException('Super Admin access only');
      }

      // Attach super admin identity to request
      req.superAdmin = payload;
      return true;
    } catch {
      throw new ForbiddenException('Super Admin access only');
    }
  }
}
