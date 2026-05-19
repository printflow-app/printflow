import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from '../tenant/tenant.context';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';

// =============================================
// TENANT INTERCEPTOR — Global interceptor
// AsyncLocalStorage orqali barcha Prisma so'rovlari avtomatik tenant bilan
// cheklanadi. JwtAuthGuard dan keyin ishlaydi — payload tayyor bo'ladi.
//
// PERFORMANCE: avval har HTTP so'rov uchun 1-2 DB query qilinardi (employee
// findFirst + workspaceAdmin findFirst). Buni 60 sekundlik in-memory cache
// bilan keskin kamaytirdik. Tenant status (TRIAL/EXPIRED) ham cache'lanadi,
// shuning uchun expired bo'lib qolgan tenant 60 sekungacha ko'rib turadi —
// bu accept qilinadigan trade-off (oldin 5-6 daqiqa kutish bor edi).
// =============================================

interface CacheEntry {
  userEntity: any; // employee yoki workspaceAdmin
  tenant: any;
  expiresAt: number; // Date.now() + TTL_MS
}

const TTL_MS = 60_000;

// Process-wide cache. Kalit: `${userId}|${tenantId}`.
// Bu cache replicalar orasida sinxron emas — har replica o'z cache'iga ega.
// Stale data risk: max 60 sekund. Status o'zgarsa (suspension, account lock)
// 60 sekungacha ta'sir qilmaydi. Bu fast-path; xavfsizlik uchun yetarli.
const cache = new Map<string, CacheEntry>();

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async intercept(
    ctx: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const tenantPayload = req._tenantPayload;

    if (!tenantPayload) {
      return next.handle();
    }

    const { tenantId, userId, userRole } = tenantPayload;
    const cacheKey = `${userId}|${tenantId}`;

    // Cache hit — DB ga ummuman tegmaymiz.
    const cached = cache.get(cacheKey);
    let userEntity: any;
    let tenant: any;

    if (cached && cached.expiresAt > Date.now()) {
      userEntity = cached.userEntity;
      tenant = cached.tenant;
    } else {
      // Cache miss yoki expired — DB'dan o'qiymiz va cache'ga yozamiz.
      userEntity = await this.prisma.employee.findFirst({
        where: { id: userId, tenantId },
        include: { tenant: true },
      });

      if (!userEntity) {
        userEntity = await this.prisma.workspaceAdmin.findFirst({
          where: { id: userId, tenantId },
          include: { tenant: true },
        });
      }

      if (!userEntity || !userEntity.tenant) {
        // Negative result'ni ham cache qilamiz (qisqaroq TTL bilan emas, asosiy
        // bilan birga) — chunki bo'lmagan/o'chirilgan userlar takror so'raydi.
        cache.set(cacheKey, { userEntity: null, tenant: null, expiresAt: Date.now() + 10_000 });
        throw new ForbiddenException('Bu workspace\'ga kirish taqiqlangan');
      }

      tenant = userEntity.tenant;
      cache.set(cacheKey, { userEntity, tenant, expiresAt: Date.now() + TTL_MS });
    }

    if (!userEntity || !tenant) {
      throw new ForbiddenException('Bu workspace\'ga kirish taqiqlangan');
    }

    // Billing route exemption
    const isBillingRoute = req.url.includes('/api/billing') || req.url.includes('/api/auth/logout') || req.url.includes('/api/auth/me');

    if (!isBillingRoute) {
      const now = new Date();
      let isExpired = false;

      if (tenant.status === 'TRIAL' && tenant.trialEndsAt && now > tenant.trialEndsAt) {
        // Trial muddati tugagan — status'ni yangilash uchun cache'ni invalidate qilamiz
        // va DB'ni yangilaymiz. Bu rare path.
        await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'EXPIRED' } });
        cache.delete(cacheKey);
        isExpired = true;
      } else if (tenant.status === 'ACTIVE' && tenant.subscriptionEndsAt && now > tenant.subscriptionEndsAt) {
        await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'EXPIRED' } });
        cache.delete(cacheKey);
        isExpired = true;
      } else if (tenant.status === 'EXPIRED' || tenant.status === 'PENDING_PAYMENT') {
        isExpired = true;
      }

      if (isExpired) {
        throw new ForbiddenException('SUBSCRIPTION_EXPIRED');
      }
    }

    // Wrap the entire handler execution in AsyncLocalStorage.run()
    return new Observable((observer) => {
      tenantStorage.run({ tenantId, userId, userRole }, () => {
        next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      });
    });
  }
}

// Tashqi exportga — agar kerak bo'lsa (masalan, user logout qilganida cache'ni tozalash uchun)
export function invalidateTenantCache(userId: string, tenantId: string) {
  cache.delete(`${userId}|${tenantId}`);
}

// Test/admin uchun — barcha cache'ni tozalash
export function clearTenantCache() {
  cache.clear();
}
