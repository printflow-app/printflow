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
    // Dastur ishga tushganda (boot bo'lganda) tranzaksiya va ulanishlar puli (pool 10)
    // band bo'lib qolmasligi va frontend so'rovlari taymautga uchramasligi uchun,
    // self-healing jarayonini NestJS to'liq yongandan so'ng 5 soniyadan keyin asinxron ishga tushiramiz.
    setTimeout(async () => {
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
    }, 5000);
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

  /**
   * Department filtering must be transitive: a transaction belongs to a department
   * either directly (transaction.departmentId) OR through its linked task
   * (task.departmentId). Most chiqim records (salary/vendor/material) have no
   * direct departmentId — without this widening, the filter returns 0.
   */
  private async resolveDeptScope(departmentId?: string): Promise<Record<string, any>> {
    if (!departmentId) return {};
    const tasks = await this.prisma.task.findMany({
      where: { departmentId },
      select: { id: true },
    });
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length === 0) return { departmentId };
    return { OR: [{ departmentId }, { taskId: { in: taskIds } }] };
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

  async findAll(start?: string, end?: string, branchId?: string, page: number = 1, limit: number = 20, departmentId?: string, vendorId?: string) {
    const deptScope = await this.resolveDeptScope(departmentId);
    const where: any = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...deptScope };
    if (vendorId) where.vendorId = vendorId;

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
    const deptScope = await this.resolveDeptScope(departmentId);
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...deptScope };

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

    // Bajarilgan buyurtmalar — "Bajarilgan" deb belgilangan ustun(lar)dagi tasklar.
    // Hech biri belgilanmagan bo'lsa, eski xulq uchun oxirgi ustunga qaytamiz.
    const doneCols = await this.prisma.kanbanColumn.findMany({
      where: { isDone: true } as any,
      select: { id: true },
    });
    let doneColumnIds = doneCols.map((c) => c.id);
    if (doneColumnIds.length === 0) {
      const all = await this.prisma.kanbanColumn.findMany({
        orderBy: { orderIdx: 'asc' },
        select: { id: true },
      });
      if (all.length) doneColumnIds = [all[all.length - 1].id];
    }

    let completedTasksCount = 0;
    if (doneColumnIds.length > 0) {
      // Sana filtri uchun updatedAt — buyurtma shu bosqichga ko'chirilgan vaqt.
      const taskWhere: any = { columnId: { in: doneColumnIds }, ...this.branchFilter(branchId), ...(departmentId ? { departmentId } : {}) };
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
    const { type, amount, paymentTypeId, customerId, customerName, serviceType, expenseReason, expenseTypeId, employeeId, vendorId, departmentId, branchId, taskId } = data;

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
          taskId: taskId || null,
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
        await this.syncCustomerTasksDebt(tx, customerId);
      } else if (type === 'kirim' && taskId && !customerId) {
        const t = await tx.task.findUnique({ where: { id: taskId }, select: { customerId: true } });
        if (t?.customerId) {
          await tx.customer.update({
            where: { id: t.customerId },
            data: { totalPaid: { increment: Number(amount) } },
          });
          await this.syncCustomerTasksDebt(tx, t.customerId);
        }
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

  /**
   * Deterministically synchronize depositAmount and remainingAmount across all active tasks
   * of a customer based on their totalPaid balance.
   */
  private async syncCustomerTasksDebt(tx: any, customerId: string) {
    if (!customerId) return;
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { totalPaid: true },
    });
    if (!customer) return;

    // Barcha aktiv (arxivlanmagan) topshiriqlarni yaratilgan vaqti bo'yicha olamiz
    const tasks = await tx.task.findMany({
      where: { customerId, isArchived: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, totalAmount: true },
    });

    let availablePaid = Number(customer.totalPaid || 0);

    for (const task of tasks) {
      const taskTotal = Number(task.totalAmount || 0);
      const allocatedDeposit = Math.min(taskTotal, availablePaid);
      const remainingAmount = Math.max(0, Math.round(taskTotal - allocatedDeposit));

      await tx.task.update({
        where: { id: task.id },
        data: {
          depositAmount: Math.round(allocatedDeposit),
          remainingAmount,
        },
      });

      availablePaid = Math.max(0, availablePaid - allocatedDeposit);
    }
  }

  /**
   * Revert the side effects of a transaction inside a Prisma tx.
   * Used by both delete and update flows (update = revert old, then apply new).
   */
  private async revertTransactionSideEffects(tx: any, t: any) {
    let cid = t.customerId;
    if (!cid && t.taskId) {
      const task = await tx.task.findUnique({ where: { id: t.taskId }, select: { customerId: true } });
      if (task?.customerId) cid = task.customerId;
    }

    if (t.type === 'kirim' && cid) {
      await tx.customer.update({
        where: { id: cid },
        data: { totalPaid: { decrement: Number(t.amount) } },
      });
      await this.syncCustomerTasksDebt(tx, cid);
    }
    if (t.type === 'chiqim' && t.employeeId && !t.vendorId) {
      await tx.employee.update({
        where: { id: t.employeeId },
        data: { givenAmount: { decrement: Number(t.amount) } },
      });
    }
  }

  /**
   * Apply the side effects of a transaction inside a Prisma tx.
   * Mirrors the side-effect logic from createTransaction.
   */
  private async applyTransactionSideEffects(tx: any, t: {
    type: string; amount: number; customerId?: string | null;
    taskId?: string | null; employeeId?: string | null; vendorId?: string | null;
  }) {
    let cid = t.customerId;
    if (!cid && t.taskId) {
      const task = await tx.task.findUnique({ where: { id: t.taskId }, select: { customerId: true } });
      if (task?.customerId) cid = task.customerId;
    }

    if (t.type === 'kirim' && cid) {
      await tx.customer.update({
        where: { id: cid },
        data: { totalPaid: { increment: Number(t.amount) } },
      });
      await this.syncCustomerTasksDebt(tx, cid);
    }
    if (t.type === 'chiqim' && t.employeeId && !t.vendorId) {
      await tx.employee.update({
        where: { id: t.employeeId },
        data: { givenAmount: { increment: Number(t.amount) } },
      });
    }
  }

  async deleteTransaction(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) {
        return { success: false, message: 'Tranzaksiya topilmadi' };
      }
      await this.revertTransactionSideEffects(tx, existing);
      await tx.transaction.delete({ where: { id } });
      return { success: true, id };
    });
  }

  /**
   * Full-field edit: revert old side effects, apply new ones, then persist the new row.
   * Treat undefined fields as "keep existing"; allow explicit null to clear links
   * (e.g. detaching a customer or task).
   */
  async updateTransaction(id: string, data: any) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) {
        return { success: false, message: 'Tranzaksiya topilmadi' };
      }

      const pick = <T>(value: T | undefined, fallback: T): T =>
        value === undefined ? fallback : value;

      const nextType = pick(data.type, existing.type);
      const nextAmount = data.amount !== undefined ? Number(data.amount) : Number(existing.amount);
      const nextCustomerId = pick(data.customerId, existing.customerId);
      const nextVendorId = pick(data.vendorId, existing.vendorId);
      const nextEmployeeId = pick(data.employeeId, existing.employeeId);
      const nextTaskId = pick(data.taskId, existing.taskId);
      const nextExpenseTypeId = pick(data.expenseTypeId, existing.expenseTypeId);
      const nextPaymentTypeId = pick(data.paymentTypeId, existing.paymentTypeId);
      const nextDepartmentId = pick(data.departmentId, existing.departmentId);
      const nextBranchId = pick(data.branchId, existing.branchId);
      const nextServiceType = pick(data.serviceType, existing.serviceType);
      const nextExpenseReason = pick(data.expenseReason, existing.expenseReason);
      const nextCustomerName = pick(data.customerName, existing.customerName);
      const nextDate = data.date !== undefined ? new Date(data.date) : existing.date;

      // Vendor-linked transactions can't simultaneously be employee/expense-type expenses.
      // Mirror create logic: when vendorId is set, null out employeeId and expenseTypeId.
      const finalEmployeeId = nextVendorId ? null : nextEmployeeId;
      const finalExpenseTypeId = nextVendorId ? null : nextExpenseTypeId;
      // customerName is only used for unknown walk-in customers (no customerId, no vendorId).
      const finalCustomerName = !nextCustomerId && !nextVendorId ? nextCustomerName : null;

      await this.revertTransactionSideEffects(tx, existing);

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          type: nextType,
          amount: nextAmount,
          paymentTypeId: nextPaymentTypeId,
          customerId: nextCustomerId,
          customerName: finalCustomerName,
          serviceType: nextServiceType,
          expenseReason: nextExpenseReason,
          expenseTypeId: finalExpenseTypeId,
          employeeId: finalEmployeeId,
          vendorId: nextVendorId,
          departmentId: nextDepartmentId,
          taskId: nextTaskId,
          branchId: nextBranchId,
          date: nextDate,
        } as any,
      });

      await this.applyTransactionSideEffects(tx, {
        type: nextType,
        amount: nextAmount,
        customerId: nextCustomerId,
        taskId: nextTaskId,
        employeeId: finalEmployeeId,
        vendorId: nextVendorId,
      });

      return updated;
    });
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

    const deptScope = await this.resolveDeptScope(departmentId);
    const where: any = { date: { gte: startDate, lte: endDate }, ...this.branchFilter(branchId), ...deptScope };

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
    const deptScope = await this.resolveDeptScope(departmentId);
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...deptScope };

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
  async getExpenseBreakdown(start?: string, end?: string, branchId?: string, departmentId?: string) {
    const deptScope = await this.resolveDeptScope(departmentId);
    const where = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...deptScope };

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

  async getDailySummary(start?: string, end?: string, branchId?: string, departmentId?: string, vendorId?: string) {
    const deptScope = await this.resolveDeptScope(departmentId);
    const where: any = { ...this.getDateRange(start, end), ...this.branchFilter(branchId), ...deptScope };
    if (vendorId) where.vendorId = vendorId;

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
