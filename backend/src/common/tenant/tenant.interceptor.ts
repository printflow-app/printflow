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
// AsyncLocalStorage orqali barcha Prisma so'rovlari
// avtomatik tenant bilan cheklanadi.
// JwtAuthGuard dan keyin ishlaydi — payload tayyor bo'ladi.
// =============================================

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
    // Skip tenant scoping for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const tenantPayload = req._tenantPayload;

    if (!tenantPayload) {
      // Super-admin routes or public routes — skip tenant scoping
      return next.handle();
    }

    const { tenantId, userId, userRole } = tenantPayload;

    // CRITICAL SECURITY CHECK: Verify the user actually belongs to this tenant.
    // Cross-tenant attack prevention — even if a valid JWT is stolen from
    // another tenant, it cannot access this tenant's data.
    const employee = await this.prisma.employee.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });

    if (!employee || !employee.tenant) {
      throw new ForbiddenException('Bu workspace\'ga kirish taqiqlangan');
    }

    const tenant = employee.tenant;

    // Billing route exemption
    const isBillingRoute = req.url.includes('/api/billing') || req.url.includes('/api/auth/logout') || req.url.includes('/api/auth/me');

    if (!isBillingRoute) {
      const now = new Date();
      let isExpired = false;

      if (tenant.status === 'TRIAL' && tenant.trialEndsAt && now > tenant.trialEndsAt) {
        // Trial expired! Automatically update status to EXPIRED
        await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'EXPIRED' } });
        isExpired = true;
      } else if (tenant.status === 'ACTIVE' && tenant.subscriptionEndsAt && now > tenant.subscriptionEndsAt) {
        // Subscription expired!
        await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'EXPIRED' } });
        isExpired = true;
      } else if (tenant.status === 'EXPIRED' || tenant.status === 'PENDING_PAYMENT') {
        isExpired = true;
      }

      if (isExpired) {
        throw new ForbiddenException('SUBSCRIPTION_EXPIRED');
      }
    }

    // Wrap the entire handler execution in AsyncLocalStorage.run()
    // This makes TenantContext.getTenantId() work in all downstream services.
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
