import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TenantContext } from '../../common/tenant/tenant.context';

@Injectable()
export class FinanceService implements OnApplicationBootstrap {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  async onApplicationBootstrap() {
    try {
      // Self-healing routine: If a tenant has branches, ensure any orphaned records
      // (Transactions, Tasks, Customers) created from "Barcha filiallar" (branchId: null)
      // are assigned to the tenant's primary branch so they don't disappear from Kassa/Mijozlar.
      const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
      for (const t of tenants) {
        const branches = await this.prisma.branch.findMany({
          where: { tenantId: t.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });

        if (branches.length > 0) {
          const primaryBranchId = branches[0].id;

          // 1. Transactions
          await this.prisma.transaction.updateMany({
            where: { tenantId: t.id, branchId: null },
            data: { branchId: primaryBranchId },
          });

          // 2. Tasks
          await this.prisma.task.updateMany({
            where: { tenantId: t.id, branchId: null },
            data: { branchId: primaryBranchId },
          });

          // 3. Customers
          await this.prisma.customer.updateMany({
            where: { tenantId: t.id, branchId: null },
            data: { branchId: primaryBranchId },
          });
        }
      }
      console.log('[FinanceService] Self-healing branch backfill completed successfully.');
    } catch (e) {
      console.error('[FinanceService] Self-healing branch backfill failed:', e);
    }
  }

  /**
   * Treat date-only strings (YYYY-MM-DD) as a calendar day in the SERVER's local
   * timezone, not as UTC midnight. `new Date('YYYY-MM-DD')` in Node parses to UTC,
   * so a client in UZ (UTC+5) clicking "Today" loses the first 5 hours of records.
   * We rebuild the bounds explicitly to avoid that drift.
   */
  private parseDayBoundary(input: string, end: boolean): Date | null {
    if (!input) return null;
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      // Use UTC so date keys stay consistent with toISOString() in getDinamika loop
      return new Date(
        end
          ? Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999)
          : Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0),
      );
    }
    const dt = new Date(input);
    if (isNaN(dt.getTime())) return null;
    if (end) dt.setUTCHours(23, 59, 59, 999);
    else dt.setUTCHours(0, 0, 0, 0);
    return dt;
  }

  private branchFilter(branchId?: string): Record<string, any> {
    if (branchId === '__main__') return { branchId: null };
    if (branchId) return { branchId };
    return {};
  }

  private deptFilter(departmentId?: string): Record<string, any> {
    if (departmentId) return { departmentId };
    return {};
  }

  private getDateRange(start?: string, end?: string) {
    if (!start && !end) return {};

    const where: any = {};
    const startDate = start ? this.parseDayBoundary(start, false) : null;
    const endDate = end ? this.parseDayBoundary(end, true) : null;

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.date = { gte: startDate };
    } else if (endDate) {
      where.date = { lte: endDate };
    }
    return where;
  }

  async findAll(start?: string, end?: string, branchId?: string, page: number = 1, limit: number = 20, departmentId?: string) {
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...this.deptFilter(departmentId) };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          paymentType: true,
          customer: true,
          expenseType: true,
          vendor: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      }
    };
  }

  async getDashboard(start?: string, end?: string, branchId?: string, departmentId?: string) {
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...this.deptFilter(departmentId) };

    const [incomes, expenses] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'kirim' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { ...where, type: 'chiqim' },
        _sum: { amount: true },
      })
    ]);

    // Calculate completed tasks
    const columns = await this.prisma.kanbanColumn.findMany({
      orderBy: { orderIdx: 'asc' },
    });
    let completedTasksCount = 0;
    if (columns.length > 0) {
      const finalColumnId = columns[columns.length - 1].id;
      // For tasks, we use updatedAt for the date filter since that's when it was moved
      const taskWhere: any = { columnId: finalColumnId, ...this.branchFilter(branchId) };
      const range = this.getDateRange(start, end);
      if (range.date) {
        taskWhere.updatedAt = range.date; // reusing the gte/lte from getDateRange
      }
      completedTasksCount = await this.prisma.task.count({ where: taskWhere });
    }

    return {
      totalKirim: incomes._sum.amount || 0,
      totalChiqim: expenses._sum.amount || 0,
      balance: (incomes._sum.amount || 0) - (expenses._sum.amount || 0),
      completedTasks: completedTasksCount,
    };
  }

  async createTransaction(data: any) {
    const { type, amount, paymentTypeId, customerId, customerName, serviceType, expenseReason, expenseTypeId, employeeId, vendorId, departmentId, branchId } = data;

    let finalBranchId = branchId || null;

    if (!finalBranchId) {
      const tenantId = TenantContext.tryGetTenantId();
      if (tenantId) {
        if (customerId) {
          const c = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { branchId: true } });
          if (c?.branchId) finalBranchId = c.branchId;
        }
        if (!finalBranchId && vendorId) {
          const v = await this.prisma.vendor.findUnique({ where: { id: vendorId }, select: { branchId: true } });
          if (v?.branchId) finalBranchId = v.branchId;
        }
        if (!finalBranchId && employeeId) {
          const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
          if (e?.branchId) finalBranchId = e.branchId;
        }
        if (!finalBranchId) {
          const b = await this.prisma.branch.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
          if (b) finalBranchId = b.id;
        }
      }
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          type,
          amount: Number(amount),
          paymentTypeId,
          customerId: customerId || null,
          customerName: !customerId && !vendorId ? (customerName || null) : null,
          serviceType,
          expenseReason,
          expenseTypeId: vendorId ? null : expenseTypeId,
          employeeId: vendorId ? null : employeeId,
          vendorId: vendorId || null,
          departmentId: departmentId || null,
          // Filial scope — bo'lmasa Kassa filiali filtri tranzaksiyani yashiradi.
          branchId: finalBranchId,
          ...(data.date ? { date: new Date(data.date) } : {}),
        } as any,
      });

      if (type === 'kirim' && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { totalPaid: { increment: Number(amount) } },
        });
      }

      if (type === 'chiqim' && employeeId && !vendorId) {
        await tx.employee.update({
          where: { id: employeeId },
          data: { givenAmount: { increment: Number(amount) } },
        });
      }

      // Vendor payout/income is just a transaction linked to vendorId.
      // Balance is calculated dynamically.
      return createdTransaction;
    });

    // Telegram Notification for Expenses to Employee
    if (type === 'chiqim' && employeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
      const exType = expenseTypeId ? await this.prisma.expenseType.findUnique({ where: { id: expenseTypeId } }) : null;
      const message = `💸 *Sizning hisobingizga chiqim qilindi*\n\n💰 *Summa:* ${amount.toLocaleString()} UZS\n🗂 *Tur:* ${exType?.name || 'Boshqa'}\n📝 *Sabab:* ${expenseReason || 'Ko\'rsatilmagan'}\n\nIltimos, platformaga kirib hisobingizni tekshiring.`;
      if (emp?.telegramId) {
        this.telegramService.sendNotification(emp.id, message);
      }
    }

    return transaction;
  }

  async getDinamika(start?: string, end?: string, branchId?: string, departmentId?: string) {
    let startDate = start ? this.parseDayBoundary(start, false) : null;
    if (!startDate) {
      startDate = new Date();
      startDate.setUTCDate(startDate.getUTCDate() - 30);
      startDate.setUTCHours(0, 0, 0, 0);
    }

    let endDate = end ? this.parseDayBoundary(end, true) : null;
    if (!endDate) {
      endDate = new Date();
      endDate.setUTCHours(23, 59, 59, 999);
    }

    const where: any = { date: { gte: startDate, lte: endDate }, ...this.branchFilter(branchId), ...this.deptFilter(departmentId) };

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const data: Record<string, any> = {};
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const day = current.toISOString().split('T')[0];
      data[day] = { name: day, kirim: 0, chiqim: 0, hamkorlar: 0, balance: 0 };
      current.setDate(current.getDate() + 1);
    }

    transactions.forEach(t => {
      const day = t.date.toISOString().split('T')[0];
      if (data[day]) {
        if (t.type === 'kirim') {
          data[day].kirim += t.amount;
        } else {
          if (t.vendorId) {
            data[day].hamkorlar += t.amount;
          } else {
            data[day].chiqim += t.amount;
          }
        }
      }
    });

    let cumulative = 0;
    const sortedDays = Object.keys(data).sort();
    sortedDays.forEach(day => {
      cumulative += (data[day].kirim - data[day].chiqim - data[day].hamkorlar);
      data[day].balance = cumulative;
    });

    return Object.values(data);
  }

  async getStatsByPaymentType(start?: string, end?: string, branchId?: string, departmentId?: string) {
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...this.deptFilter(departmentId) };

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: { paymentType: true },
    });

    const stats = {
      kirim: {} as Record<string, number>,
      chiqim: {} as Record<string, number>,
    };

    transactions.forEach(t => {
      const pName = t.paymentType?.name || 'Noma\'lum';
      if (t.type === 'kirim') {
        stats.kirim[pName] = (stats.kirim[pName] || 0) + t.amount;
      } else {
        stats.chiqim[pName] = (stats.chiqim[pName] || 0) + t.amount;
      }
    });

    const formatForChart = (obj: Record<string, number>) => 
      Object.entries(obj).map(([name, value]) => ({ name, value }));

    return {
      kirim: formatForChart(stats.kirim).sort((a, b) => b.value - a.value),
      chiqim: formatForChart(stats.chiqim).sort((a, b) => b.value - a.value),
    };
  }

  /**
   * Expense Breakdown by ExpenseType — for Pie/Bar chart on Dashboard
   */
  async getExpenseBreakdown(start?: string, end?: string) {
    const where = this.getDateRange(start, end);

    const expenses = await this.prisma.transaction.findMany({
      where: { ...where, type: 'chiqim' },
      include: { expenseType: true },
    });

    const breakdown: Record<string, number> = {};

    expenses.forEach(t => {
      const category = t.expenseType?.name || t.expenseReason || 'Boshqa';
      breakdown[category] = (breakdown[category] || 0) + t.amount;
    });

    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 categories
  }

  async getDailySummary(start?: string, end?: string, branchId?: string, departmentId?: string) {
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...this.deptFilter(departmentId) };

    const [transactions, dashboard, allPaymentTypes] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          paymentType: true,
          expenseType: true,
        },
      }),
      this.getDashboard(start, end, branchId),
      this.prisma.paymentType.findMany(),
    ]);

    const kirimByPaymentType: Record<string, number> = {};
    const chiqimByPaymentType: Record<string, number> = {};
    const chiqimByExpenseType: Record<string, number> = {};

    // Initialize with all payment types
    allPaymentTypes.forEach(pt => {
      kirimByPaymentType[pt.name] = 0;
      chiqimByPaymentType[pt.name] = 0;
    });

    transactions.forEach(t => {
      const pName = t.paymentType?.name || 'Noma\'lum';
      if (t.type === 'kirim') {
        kirimByPaymentType[pName] = (kirimByPaymentType[pName] || 0) + t.amount;
      } else {
        chiqimByPaymentType[pName] = (chiqimByPaymentType[pName] || 0) + t.amount;
        const eName = t.expenseType?.name || (t.employeeId ? 'Xodim' : 'Boshqa');
        chiqimByExpenseType[eName] = (chiqimByExpenseType[eName] || 0) + t.amount;
      }
    });

    return {
      ...dashboard,
      kirimBreakdown: Object.entries(kirimByPaymentType).map(([name, amount]) => ({ name, amount })),
      chiqimBreakdown: Object.entries(chiqimByPaymentType).map(([name, amount]) => ({ name, amount })),
      expenseBreakdown: Object.entries(chiqimByExpenseType).map(([name, amount]) => ({ name, amount })),
    };
  }
}
