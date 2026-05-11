import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================
// REPORTS SERVICE — Business Intelligence Aggregations
// Endpoints: services-performance, vendor-profitability,
//            employee-velocity, growth-metrics, monthly-dynamics
// All queries are tenant-scoped via Prisma middleware.
// =============================================

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private parseDayBoundary(input: string | undefined, end: boolean): Date | null {
    if (!input) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m) {
      const [, y, mm, d] = m;
      return end
        ? new Date(Number(y), Number(mm) - 1, Number(d), 23, 59, 59, 999)
        : new Date(Number(y), Number(mm) - 1, Number(d), 0, 0, 0, 0);
    }
    const dt = new Date(input);
    if (isNaN(dt.getTime())) return null;
    if (end) dt.setHours(23, 59, 59, 999);
    else dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private resolveRange(start?: string, end?: string): { from: Date; to: Date } {
    let from = start ? this.parseDayBoundary(start, false) : null;
    let to = end ? this.parseDayBoundary(end, true) : null;
    if (!from) {
      from = new Date();
      from.setDate(from.getDate() - 90);
      from.setHours(0, 0, 0, 0);
    }
    if (!to) {
      to = new Date();
      to.setHours(23, 59, 59, 999);
    }
    return { from, to };
  }

  private growthPct(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  // =============================================
  // 1. Services Performance — revenue & volume per service grouped by month
  // =============================================
  async getServicesPerformance(start?: string, end?: string, branchId?: string) {
    const { from, to } = this.resolveRange(start, end);

    const tasks = await this.prisma.task.findMany({
      where: {
        serviceId: { not: null },
        isArchived: false,
        createdAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: { service: { select: { id: true, name: true } } },
    });

    const serviceMap: Record<string, {
      serviceId: string;
      serviceName: string;
      tasks: typeof tasks;
      monthlyMap: Record<string, { taskCount: number; revenue: number }>;
    }> = {};

    tasks.forEach((task) => {
      const sid = task.serviceId!;
      const sname = (task as any).service?.name || 'Boshqa';
      if (!serviceMap[sid]) {
        serviceMap[sid] = { serviceId: sid, serviceName: sname, tasks: [], monthlyMap: {} };
      }
      serviceMap[sid].tasks.push(task);

      const d = new Date(task.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!serviceMap[sid].monthlyMap[monthKey]) {
        serviceMap[sid].monthlyMap[monthKey] = { taskCount: 0, revenue: 0 };
      }
      serviceMap[sid].monthlyMap[monthKey].taskCount++;
      serviceMap[sid].monthlyMap[monthKey].revenue += task.totalAmount || 0;
    });

    return Object.values(serviceMap)
      .map((s) => {
        const totalTasks = s.tasks.length;
        const totalRevenue = s.tasks.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const avgCheck = totalTasks > 0 ? Math.round(totalRevenue / totalTasks) : 0;
        const monthlyBreakdown = Object.entries(s.monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            taskCount: data.taskCount,
            revenue: data.revenue,
            avgCheck: data.taskCount > 0 ? Math.round(data.revenue / data.taskCount) : 0,
          }));
        return { serviceId: s.serviceId, serviceName: s.serviceName, totalTasks, totalRevenue, avgCheck, monthlyBreakdown };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // =============================================
  // 2. Vendor Profitability — outsourcing cost vs linked task revenue
  // =============================================
  async getVendorProfitability(start?: string, end?: string) {
    const { from, to } = this.resolveRange(start, end);

    const vendors = await (this.prisma as any).vendor.findMany({
      include: {
        orderVendorCosts: {
          where: { createdAt: { gte: from, lte: to } },
          include: { task: { select: { id: true, totalAmount: true } } },
        },
      },
    });

    return vendors
      .map((vendor: any) => {
        const totalCost = vendor.orderVendorCosts.reduce((s: number, c: any) => s + (c.amount || 0), 0);
        const taskMap = new Map<string, number>();
        vendor.orderVendorCosts.forEach((c: any) => {
          if (c.task && !taskMap.has(c.task.id)) {
            taskMap.set(c.task.id, c.task.totalAmount || 0);
          }
        });
        const linkedRevenue = Array.from(taskMap.values()).reduce((s, v) => s + v, 0);
        const margin = linkedRevenue - totalCost;
        const marginPct = linkedRevenue > 0 ? Math.round((margin / linkedRevenue) * 1000) / 10 : 0;
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          totalCost,
          linkedTaskCount: taskMap.size,
          linkedRevenue,
          margin,
          marginPct,
        };
      })
      .sort((a: any, b: any) => b.totalCost - a.totalCost);
  }

  // =============================================
  // 3. Employee Velocity — completed tasks, revenue generated, deadline accuracy
  // =============================================
  async getEmployeeVelocity(start?: string, end?: string) {
    const { from, to } = this.resolveRange(start, end);

    const [employees, columns] = await Promise.all([
      this.prisma.employee.findMany({ include: { role: true } }),
      this.prisma.kanbanColumn.findMany({ orderBy: { orderIdx: 'asc' } }),
    ]);
    const finalColumnId = columns.length ? columns[columns.length - 1].id : null;

    const completedTasks = await this.prisma.task.findMany({
      where: {
        ...(finalColumnId ? { columnId: finalColumnId } : {}),
        updatedAt: { gte: from, lte: to },
        isArchived: false,
      },
    });

    return employees
      .map((emp) => {
        const empTasks = completedTasks.filter((t) => {
          try {
            return (JSON.parse(t.assignees || '[]') as string[]).includes(emp.id);
          } catch { return false; }
        });

        const totalRevenue = empTasks.reduce((s, t) => s + (t.totalAmount || 0), 0);
        const deadlinesMet = empTasks.filter((t) => {
          if (!t.deadlineAt) return false;
          return new Date(t.updatedAt) <= new Date(t.deadlineAt);
        }).length;
        const tasksWithDeadline = empTasks.filter((t) => !!t.deadlineAt).length;
        const deadlineMeetRate = tasksWithDeadline > 0
          ? Math.round((deadlinesMet / tasksWithDeadline) * 100)
          : null;

        const durations = empTasks
          .map((t) => {
            const h = (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3_600_000;
            return h > 0 && h < 24 * 60 ? h : null;
          })
          .filter((h): h is number => h !== null);
        const avgTaskHours = durations.length > 0
          ? Math.round(durations.reduce((s, h) => s + h, 0) / durations.length * 10) / 10
          : null;

        const velocityScore = Math.round(
          empTasks.length * 10 +
          (deadlineMeetRate ?? 50) / 10 +
          totalRevenue / 1_000_000,
        );

        return {
          employeeId: emp.id,
          fullName: emp.fullName,
          roleName: emp.role?.name ?? null,
          completedTasks: empTasks.length,
          deadlinesMet,
          tasksWithDeadline,
          deadlineMeetRate,
          totalRevenue,
          avgTaskHours,
          velocityScore,
        };
      })
      .sort((a, b) => b.velocityScore - a.velocityScore);
  }

  // =============================================
  // 4. Growth Metrics — current month vs previous month
  // =============================================
  async getGrowthMetrics(branchId?: string) {
    const now = new Date();
    const currStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const bFilter = branchId ? { branchId } : {};

    const columns = await this.prisma.kanbanColumn.findMany({ orderBy: { orderIdx: 'asc' } });
    const finalColumnId = columns.length ? columns[columns.length - 1].id : null;
    const colFilter = finalColumnId ? { columnId: finalColumnId } : {};

    const [
      currIncome, prevIncome,
      currCustomers, prevCustomers,
      currTasks, prevTasks,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { type: 'kirim', date: { gte: currStart, lte: currEnd }, ...bFilter },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'kirim', date: { gte: prevStart, lte: prevEnd }, ...bFilter },
        _sum: { amount: true },
      }),
      this.prisma.customer.count({ where: { createdAt: { gte: currStart, lte: currEnd } } }),
      this.prisma.customer.count({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
      this.prisma.task.count({ where: { ...colFilter, updatedAt: { gte: currStart, lte: currEnd }, isArchived: false } }),
      this.prisma.task.count({ where: { ...colFilter, updatedAt: { gte: prevStart, lte: prevEnd }, isArchived: false } }),
    ]);

    const currRev = currIncome._sum.amount || 0;
    const prevRev = prevIncome._sum.amount || 0;

    return {
      revenue: { current: currRev, previous: prevRev, growth: this.growthPct(currRev, prevRev) },
      newCustomers: { current: currCustomers, previous: prevCustomers, growth: this.growthPct(currCustomers, prevCustomers) },
      completedTasks: { current: currTasks, previous: prevTasks, growth: this.growthPct(currTasks, prevTasks) },
      period: {
        current: `${currStart.toISOString().split('T')[0]} — ${now.toISOString().split('T')[0]}`,
        previous: `${prevStart.toISOString().split('T')[0]} — ${prevEnd.toISOString().split('T')[0]}`,
      },
    };
  }

  // =============================================
  // 5. Monthly Dynamics — last N months: income / expense / vendor costs
  // =============================================
  async getMonthlyDynamics(months = 6, branchId?: string) {
    const now = new Date();
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

      const bFilter = branchId ? { branchId } : {};

      const [income, expense, vendorCosts] = await Promise.all([
        this.prisma.transaction.aggregate({
          where: { type: 'kirim', date: { gte: start, lte: end }, ...bFilter },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { type: 'chiqim', vendorId: null, date: { gte: start, lte: end }, ...bFilter },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { 
            type: 'chiqim', 
            vendorId: { not: null },
            date: { gte: start, lte: end }, 
            ...bFilter 
          },
          _sum: { amount: true },
        }),
      ]);

      const kirim = income._sum.amount || 0;
      const chiqim = expense._sum.amount || 0;
      const hamkorlar = vendorCosts._sum.amount || 0;

      result.push({ month: monthKey, kirim, chiqim, hamkorlar, net: kirim - chiqim - hamkorlar });
    }

    return result;
  }
}
