import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  // Short-lived in-memory cache: userId -> { perms, expiresAt }
  // Avoids hitting DB on every request while still picking up role changes within a few seconds.
  private cache = new Map<string, { perms: Record<string, boolean>; expiresAt: number }>();
  private readonly TTL_MS = 5_000;

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    if (user.isAdmin) {
      return true;
    }

    const perms = await this.getFreshPermissions(user.sub, user.permissions);
    if (!perms) {
      throw new ForbiddenException('Rol ruxsatlari topilmadi');
    }

    const hasAll = requiredPermissions.every((perm) => perms[perm] === true);
    if (!hasAll) {
      throw new ForbiddenException('Bu amalni bajarish uchun ruxsatingiz yo\'q');
    }

    return true;
  }

  private async getFreshPermissions(
    userId: string,
    fallback: Record<string, boolean> | undefined,
  ): Promise<Record<string, boolean> | null> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) {
      return cached.perms;
    }

    try {
      const employee = await this.prisma.employee.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (employee?.role) {
        const perms = employee.role as unknown as Record<string, boolean>;
        this.cache.set(userId, { perms, expiresAt: now + this.TTL_MS });
        return perms;
      }
    } catch {
      // Fall through to JWT fallback on DB failure
    }

    return fallback ?? null;
  }
}
