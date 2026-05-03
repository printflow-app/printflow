import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// =============================================
// PERMISSIONS GUARD — Role-Based Access Control
// Runs after JwtAuthGuard. Reads the `permissions` object embedded in JWT.
// WorkspaceAdmins (isAdmin=true) bypass all permission checks.
// Use @RequirePermissions('canViewFinance') to protect endpoints.
// =============================================

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() routes skip this guard
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req['user'];

    if (!user) {
      throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
    }

    // WorkspaceAdmin has all permissions
    if (user.isAdmin) {
      return true;
    }

    const perms = user.permissions;
    if (!perms) {
      throw new ForbiddenException('Rol ruxsatlari topilmadi');
    }

    const hasAll = requiredPermissions.every((perm) => perms[perm] === true);
    if (!hasAll) {
      throw new ForbiddenException('Bu amalni bajarish uchun ruxsatingiz yo\'q');
    }

    return true;
  }
}
