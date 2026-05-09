import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [tenants, todayAtt, activeTsk] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          _count: { select: { employees: true, tasks: true, customers: true } },
        },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['tenantId'],
        where: { date: todayStr },
        _count: { id: true },
      }),
      this.prisma.task.groupBy({
        by: ['tenantId'],
        where: { isArchived: false },
        _count: { id: true },
      }),
    ]);
    const attMap: Record<string, number> = {};
    for (const a of todayAtt) attMap[a.tenantId] = a._count.id;
    const tskMap: Record<string, number> = {};
    for (const t of activeTsk) tskMap[t.tenantId] = t._count.id;
    return tenants.map(t => ({
      ...t,
      attendanceTodayCount: attMap[t.id] ?? 0,
      activeTasksCount: tskMap[t.id] ?? 0,
    }));
  }

  async findOne(id: string) {
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
    if (!tenant) throw new NotFoundException('Workspace topilmadi');

    // Calculate total paid
    const totalPaid = tenant.payments
      .filter(p => p.status === 'APPROVED')
      .reduce((sum, p) => sum + p.amount, 0);

    return { ...tenant, totalPaid };
  }

  /**
   * Creates a new tenant workspace with:
   * - Default Admin role (all permissions)
   * - Initial admin employee (credentials provided)
   * - Default Kanban columns
   * - Default payment types
   * - 7-day free trial
   */
  async createWithAdmin(data: {
    name: string;
    slug: string;
    planId?: string;
    trialDays?: number;
    adminEmail: string;
    adminPassword: string;
    adminName?: string;
    adminPhone?: string;
  }) {
    // Check for duplicate slug
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new BadRequestException('Bu slug allaqachon mavjud');

    const trialDays = data.trialDays || 7;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    // Create the tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        planId: data.planId || null,
        status: 'TRIAL',
        trialEndsAt,
      },
    });

    // All subsequent operations must run within tenant context
    await TenantContext.run(
      { tenantId: tenant.id, userId: '', userRole: '' },
      async () => {
        // Create Admin role with all permissions
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
          } as any,
        });

        // Hash admin password
        const passwordHash = await bcrypt.hash(data.adminPassword, 12);

        // Create admin employee
        await this.prisma.employee.create({
          data: {
            fullName: data.adminName || 'Administrator',
            phone: data.adminPhone || null,
            login: data.adminEmail,
            passwordHash,
            roleId: adminRole.id,
            isFirstLogin: true, // Mark as first login for onboarding
          } as any,
        });

        // Skip default columns and payment types - user wants blank state
        /*
        const defaultColumns = [
          { title: 'Buyurtma olindi', orderIdx: 0 },
          { title: 'Dizayn', orderIdx: 1 },
          { title: 'Bosma', orderIdx: 2 },
          { title: 'Tayyor', orderIdx: 3 },
          { title: 'Yetkazildi', orderIdx: 4 },
        ];

        for (const col of defaultColumns) {
          await this.prisma.kanbanColumn.create({ data: col as any });
        }

        const defaultPaymentTypes = ['Naqd', 'Karta', "Click/Payme"];
        for (const name of defaultPaymentTypes) {
          await this.prisma.paymentType.create({ data: { name } as any });
        }
        */
      },
    );

    return tenant;
  }

  /**
   * Create workspace from a Lead (So'rov → Workspace)
   */
  async createFromLead(data: {
    leadId: string;
    slug: string;
    planId?: string;
  }) {
    const lead = await this.prisma.demoRequest.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new NotFoundException('So\'rov topilmadi');

    // Generate random 8-char password
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

    // Update lead status to 'closed'
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

  update(id: string, data: {
    name?: string;
    planId?: string;
    isActive?: boolean;
    status?: string;
    subscriptionEndsAt?: string | null;
    trialEndsAt?: string | null;
  }) {
    const payload: any = { ...data };
    if (data.subscriptionEndsAt !== undefined) {
      payload.subscriptionEndsAt = data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : null;
    }
    if (data.trialEndsAt !== undefined) {
      payload.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
    }
    return this.prisma.tenant.update({ where: { id }, data: payload });
  }

  remove(id: string) {
    return this.prisma.tenant.delete({ where: { id } });
  }

  /**
   * Platform stats for Super-Admin dashboard — includes chart data
   */
  async getStats() {
    const [totalTenants, activeTenants, totalEmployees, totalTasks] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
        this.prisma.employee.count(),
        this.prisma.task.count(),
      ]);

    // Trial tenants expiring in next 7 days
    const trialsExpiringSoon = await this.prisma.tenant.count({
      where: {
        status: 'TRIAL',
        trialEndsAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // Total revenue from approved payments
    const approvedPayments = await this.prisma.payment.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: true,
    });

    // Pending payments count
    const pendingPayments = await this.prisma.payment.count({
      where: { status: 'PENDING' },
    });

    // Status distribution for pie chart
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

    // Monthly revenue chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentPayments = await this.prisma.payment.findMany({
      where: { status: 'APPROVED', approvedAt: { gte: sixMonthsAgo } },
      select: { amount: true, approvedAt: true },
      orderBy: { approvedAt: 'asc' },
    });

    const monthlyRevenue: Record<string, number> = {};
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
        if (key in monthlyRevenue) monthlyRevenue[key] += p.amount;
      }
    }
    const revenueChart = Object.entries(monthlyRevenue).map(([month, amount]) => ({
      month,
      amount: Math.round(amount),
    }));

    // Leads over time (last 6 months)
    const recentLeads = await this.prisma.demoRequest.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });

    const monthlyLeads: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyLeads[key] = 0;
    }
    for (const l of recentLeads) {
      const d = new Date(l.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyLeads) monthlyLeads[key]++;
    }
    const leadsChart = Object.entries(monthlyLeads).map(([month, count]) => ({
      month,
      count,
    }));

    // Tenant growth chart (last 6 months)
    const recentTenants = await this.prisma.tenant.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });
    const monthlyTenants: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTenants[key] = 0;
    }
    for (const t of recentTenants) {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyTenants) monthlyTenants[key]++;
    }
    const tenantGrowthChart = Object.entries(monthlyTenants).map(([month, count]) => ({
      month,
      count,
    }));

    // Total leads
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
      // Chart data
      statusDistribution,
      revenueChart,
      leadsChart,
      tenantGrowthChart,
    };
  }

  // Payment Management (Super-Admin)
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

  async approvePayment(paymentId: string, superAdminId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const durationMonths = payment.duration;
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + durationMonths);

    // Find plan by name to get planId
    const plan = await this.prisma.plan.findUnique({
      where: { name: payment.planName },
    });

    // Update payment
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'APPROVED', approvedBy: superAdminId, approvedAt: new Date() },
    });

    // Update tenant
    return this.prisma.tenant.update({
      where: { id: payment.tenantId },
      data: {
        status: 'ACTIVE',
        planId: plan?.id || null,
        subscriptionEndsAt,
      },
    });
  }

  async rejectPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'REJECTED' },
    });

    // Revert tenant status to EXPIRED
    return this.prisma.tenant.update({
      where: { id: payment.tenantId },
      data: { status: 'EXPIRED' },
    });
  }
}
