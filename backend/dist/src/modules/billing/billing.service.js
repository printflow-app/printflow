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
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const tenant_context_1 = require("../../common/tenant/tenant.context");
const telegram_service_1 = require("../telegram/telegram.service");
let BillingService = class BillingService {
    constructor(prisma, telegramService) {
        this.prisma = prisma;
        this.telegramService = telegramService;
    }
    async submitPayment(data) {
        const tenantId = tenant_context_1.TenantContext.getTenantId();
        if (!tenantId)
            throw new common_1.BadRequestException('Tenant not found');
        const payment = await this.prisma.payment.create({
            data: {
                tenantId,
                planName: data.planName,
                duration: data.duration,
                amount: data.amount,
                sender: data.sender,
                receiptUrl: data.receiptUrl,
                notes: data.notes,
                status: 'PENDING',
            },
        });
        const tenant = await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { status: 'PENDING_PAYMENT' },
        });
        try {
            await this.telegramService.notifyAdmins(`💸 *Yangi To'lov So'rovi!*\n\n` +
                `🏢 *Workspace:* ${tenant.name}\n` +
                `📦 *Ta'rif:* ${data.planName}\n` +
                `⏳ *Muddat:* ${data.duration} oy\n` +
                `💰 *Summa:* ${data.amount.toLocaleString()} UZS\n` +
                `👤 *Yuboruvchi:* ${data.sender}`);
        }
        catch (err) {
        }
        return payment;
    }
    async getMyPayments() {
        const tenantId = tenant_context_1.TenantContext.getTenantId();
        return this.prisma.payment.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getTenantBillingStatus() {
        const tenantId = tenant_context_1.TenantContext.getTenantId();
        return this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                name: true,
                status: true,
                planId: true,
                plan: true,
                trialEndsAt: true,
                subscriptionEndsAt: true,
            },
        });
    }
    async getSetting(key) {
        const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
        return setting ? JSON.parse(setting.value) : null;
    }
    async updateSetting(key, value) {
        return this.prisma.platformSetting.upsert({
            where: { key },
            update: { value: JSON.stringify(value) },
            create: { key, value: JSON.stringify(value) },
        });
    }
};
exports.BillingService = BillingService;
exports.BillingService = BillingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_service_1.TelegramService])
], BillingService);
//# sourceMappingURL=billing.service.js.map