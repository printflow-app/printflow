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
exports.TenantsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const tenant_context_1 = require("../../common/tenant/tenant.context");
const bcrypt = require("bcrypt");
let TenantsService = class TenantsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                plan: true,
                _count: {
                    select: { employees: true, tasks: true, customers: true },
                },
            },
        });
    }
    async findOne(id) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id },
            include: {
                plan: true,
                payments: { orderBy: { createdAt: 'desc' } },
                _count: {
                    select: {
                        employees: true,
                        tasks: true,
                        customers: true,
                        transactions: true,
                    },
                },
            },
        });
        if (!tenant)
            throw new common_1.NotFoundException('Workspace topilmadi');
        const totalPaid = tenant.payments
            .filter(p => p.status === 'APPROVED')
            .reduce((sum, p) => sum + p.amount, 0);
        return { ...tenant, totalPaid };
    }
    async createWithAdmin(data) {
        const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
        if (existing)
            throw new common_1.BadRequestException('Bu slug allaqachon mavjud');
        const trialDays = data.trialDays || 7;
        const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
        const tenant = await this.prisma.tenant.create({
            data: {
                name: data.name,
                slug: data.slug,
                planId: data.planId || null,
                status: 'TRIAL',
                trialEndsAt,
            },
        });
        await tenant_context_1.TenantContext.run({ tenantId: tenant.id, userId: '', userRole: '' }, async () => {
            const adminRole = await this.prisma.role.create({
                data: {
                    name: 'Admin',
                    canViewFinance: true,
                    canAddIncome: true,
                    canAddExpense: true,
                    canViewTotalBalance: true,
                    canManagePaymentTypes: true,
                    canViewTasks: true,
                    canCreateTask: true,
                    canEditTask: true,
                    canDeleteTask: true,
                    canMoveTask: true,
                    canManageColumns: true,
                    canViewCustomers: true,
                    canManageCustomers: true,
                    canViewInventory: true,
                    canManageInventory: true,
                    canViewAttendance: true,
                    canManageAttendance: true,
                    canViewServices: true,
                    canManageServices: true,
                    canViewEmployees: true,
                    canManageEmployees: true,
                    canManageRoles: true,
                    canViewSalary: true,
                },
            });
            const passwordHash = await bcrypt.hash(data.adminPassword, 12);
            await this.prisma.employee.create({
                data: {
                    fullName: data.adminName || 'Administrator',
                    phone: data.adminPhone || null,
                    login: data.adminEmail,
                    passwordHash,
                    roleId: adminRole.id,
                    isFirstLogin: true,
                },
            });
        });
        return tenant;
    }
    async createFromLead(data) {
        const lead = await this.prisma.demoRequest.findUnique({ where: { id: data.leadId } });
        if (!lead)
            throw new common_1.NotFoundException('So\'rov topilmadi');
        const password = Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-2).toUpperCase() + (Math.floor(Math.random() * 90) + 10);
        const login = `${data.slug}_admin`;
        const tenant = await this.createWithAdmin({
            name: lead.companyName,
            slug: data.slug,
            planId: data.planId || undefined,
            adminEmail: login,
            adminPassword: password,
            adminName: `${lead.firstName} ${lead.lastName}`,
            adminPhone: lead.phone,
        });
        await this.prisma.demoRequest.update({
            where: { id: data.leadId },
            data: { status: 'closed' },
        });
        return {
            tenant,
            credentials: { slug: data.slug, login, password },
            lead,
        };
    }
    update(id, data) {
        return this.prisma.tenant.update({ where: { id }, data: data });
    }
    remove(id) {
        return this.prisma.tenant.delete({ where: { id } });
    }
    async getStats() {
        const [totalTenants, activeTenants, totalEmployees, totalTasks] = await Promise.all([
            this.prisma.tenant.count(),
            this.prisma.tenant.count({ where: { isActive: true } }),
            this.prisma.employee.count(),
            this.prisma.task.count(),
        ]);
        const trialsExpiringSoon = await this.prisma.tenant.count({
            where: {
                status: 'TRIAL',
                trialEndsAt: {
                    gte: new Date(),
                    lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            },
        });
        const approvedPayments = await this.prisma.payment.aggregate({
            where: { status: 'APPROVED' },
            _sum: { amount: true },
            _count: true,
        });
        const pendingPayments = await this.prisma.payment.count({
            where: { status: 'PENDING' },
        });
        const statusCounts = await Promise.all([
            this.prisma.tenant.count({ where: { status: 'TRIAL' } }),
            this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
            this.prisma.tenant.count({ where: { status: 'EXPIRED' } }),
            this.prisma.tenant.count({ where: { status: 'PENDING_PAYMENT' } }),
        ]);
        const statusDistribution = [
            { name: 'Trial', value: statusCounts[0], color: '#3b82f6' },
            { name: 'Faol', value: statusCounts[1], color: '#10b981' },
            { name: 'Muddati tugagan', value: statusCounts[2], color: '#ef4444' },
            { name: 'To\'lov kutilmoqda', value: statusCounts[3], color: '#f59e0b' },
        ].filter(s => s.value > 0);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentPayments = await this.prisma.payment.findMany({
            where: { status: 'APPROVED', approvedAt: { gte: sixMonthsAgo } },
            select: { amount: true, approvedAt: true },
            orderBy: { approvedAt: 'asc' },
        });
        const monthlyRevenue = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyRevenue[key] = 0;
        }
        for (const p of recentPayments) {
            if (p.approvedAt) {
                const d = new Date(p.approvedAt);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (key in monthlyRevenue)
                    monthlyRevenue[key] += p.amount;
            }
        }
        const revenueChart = Object.entries(monthlyRevenue).map(([month, amount]) => ({
            month,
            amount: Math.round(amount),
        }));
        const recentLeads = await this.prisma.demoRequest.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true },
        });
        const monthlyLeads = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyLeads[key] = 0;
        }
        for (const l of recentLeads) {
            const d = new Date(l.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (key in monthlyLeads)
                monthlyLeads[key]++;
        }
        const leadsChart = Object.entries(monthlyLeads).map(([month, count]) => ({
            month,
            count,
        }));
        const recentTenants = await this.prisma.tenant.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            select: { createdAt: true },
        });
        const monthlyTenants = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyTenants[key] = 0;
        }
        for (const t of recentTenants) {
            const d = new Date(t.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (key in monthlyTenants)
                monthlyTenants[key]++;
        }
        const tenantGrowthChart = Object.entries(monthlyTenants).map(([month, count]) => ({
            month,
            count,
        }));
        const totalLeads = await this.prisma.demoRequest.count();
        return {
            totalTenants,
            activeTenants,
            inactiveTenants: totalTenants - activeTenants,
            trialsExpiringSoon,
            totalEmployees,
            totalTasks,
            totalRevenue: approvedPayments._sum.amount || 0,
            approvedPaymentsCount: approvedPayments._count,
            pendingPayments,
            totalLeads,
            statusDistribution,
            revenueChart,
            leadsChart,
            tenantGrowthChart,
        };
    }
    getPendingPayments() {
        return this.prisma.payment.findMany({
            where: { status: 'PENDING' },
            include: { tenant: { include: { plan: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    getAllPayments() {
        return this.prisma.payment.findMany({
            include: { tenant: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async approvePayment(paymentId, superAdminId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        const durationMonths = payment.duration;
        const subscriptionEndsAt = new Date();
        subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + durationMonths);
        const plan = await this.prisma.plan.findUnique({
            where: { name: payment.planName },
        });
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: 'APPROVED', approvedBy: superAdminId, approvedAt: new Date() },
        });
        return this.prisma.tenant.update({
            where: { id: payment.tenantId },
            data: {
                status: 'ACTIVE',
                planId: plan?.id || null,
                subscriptionEndsAt,
            },
        });
    }
    async rejectPayment(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: 'REJECTED' },
        });
        return this.prisma.tenant.update({
            where: { id: payment.tenantId },
            data: { status: 'EXPIRED' },
        });
    }
};
exports.TenantsService = TenantsService;
exports.TenantsService = TenantsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantsService);
//# sourceMappingURL=tenants.service.js.map