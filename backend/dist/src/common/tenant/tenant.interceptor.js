"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const tenant_context_1 = require("../tenant/tenant.context");
const prisma_service_1 = require("../../prisma/prisma.service");
const public_decorator_1 = require("../decorators/public.decorator");
const core_1 = require("@nestjs/core");
let TenantInterceptor = class TenantInterceptor {
    constructor(prisma, reflector) {
        this.prisma = prisma;
        this.reflector = reflector;
    }
    async intercept(ctx, next) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (isPublic)
            return next.handle();
        const req = ctx.switchToHttp().getRequest();
        const tenantPayload = req._tenantPayload;
        if (!tenantPayload) {
            return next.handle();
        }
        const { tenantId, userId, userRole } = tenantPayload;
        const employee = await this.prisma.employee.findFirst({
            where: { id: userId, tenantId },
            include: { tenant: true },
        });
        if (!employee || !employee.tenant) {
            throw new common_1.ForbiddenException('Bu workspace\'ga kirish taqiqlangan');
        }
        const tenant = employee.tenant;
        const isBillingRoute = req.url.includes('/api/billing') || req.url.includes('/api/auth/logout') || req.url.includes('/api/auth/me');
        if (!isBillingRoute) {
            const now = new Date();
            let isExpired = false;
            if (tenant.status === 'TRIAL' && tenant.trialEndsAt && now > tenant.trialEndsAt) {
                await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'EXPIRED' } });
                isExpired = true;
            }
            else if (tenant.status === 'ACTIVE' && tenant.subscriptionEndsAt && now > tenant.subscriptionEndsAt) {
                await this.prisma.tenant.update({ where: { id: tenant.id }, data: { status: 'EXPIRED' } });
                isExpired = true;
            }
            else if (tenant.status === 'EXPIRED' || tenant.status === 'PENDING_PAYMENT') {
                isExpired = true;
            }
            if (isExpired) {
                throw new common_1.ForbiddenException('SUBSCRIPTION_EXPIRED');
            }
        }
        return new rxjs_1.Observable((observer) => {
            tenant_context_1.tenantStorage.run({ tenantId, userId, userRole }, () => {
                next.handle().subscribe({
                    next: (value) => observer.next(value),
                    error: (err) => observer.error(err),
                    complete: () => observer.complete(),
                });
            });
        });
    }
};
exports.TenantInterceptor = TenantInterceptor;
exports.TenantInterceptor = TenantInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        core_1.Reflector])
], TenantInterceptor);
//# sourceMappingURL=tenant.interceptor.js.map