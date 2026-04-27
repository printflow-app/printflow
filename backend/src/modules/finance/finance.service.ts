import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  private getDateRange(start?: string, end?: string) {
    if (!start && !end) return {};
    
    const where: any = {};
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        where.date = { gte: startDate, lte: endDate };
      }
    } else if (start) {
      const startDate = new Date(start);
      if (!isNaN(startDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        where.date = { gte: startDate };
      }
    }
    return where;
  }

  async findAll(start?: string, end?: string) {
    const where = this.getDateRange(start, end);

    return this.prisma.transaction.findMany({
      where,
      include: {
        paymentType: true,
        customer: true,
        expenseType: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getDashboard(start?: string, end?: string) {
    const where = this.getDateRange(start, end);

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

    return {
      totalKirim: incomes._sum.amount || 0,
      totalChiqim: expenses._sum.amount || 0,
      balance: (incomes._sum.amount || 0) - (expenses._sum.amount || 0),
    };
  }

  async createTransaction(data: any) {
    const { type, amount, paymentTypeId, customerId, customerName, serviceType, expenseReason, expenseTypeId, employeeId, forExistingDebt } = data;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          type,
          amount: Number(amount),
          paymentTypeId,
          customerId: customerId || null,
          customerName: !customerId ? (customerName || null) : null,
          serviceType,
          expenseReason,
          expenseTypeId,
          employeeId,
        } as any,
      });

      if (type === 'kirim' && customerId) {
        const updateData: any = {
          totalPaid: { increment: Number(amount) },
        };
        if (forExistingDebt) {
          updateData.totalDebt = { decrement: Number(amount) };
        }

        await tx.customer.update({
          where: { id: customerId },
          data: updateData,
        });
      }

      if (type === 'chiqim' && employeeId) {
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            givenAmount: { increment: Number(amount) },
          },
        });
      }

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

  async getDinamika(start?: string, end?: string) {
    let startDate = start ? new Date(start) : null;
    if (!startDate || isNaN(startDate.getTime())) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);

    let endDate = end ? new Date(end) : null;
    if (!endDate || isNaN(endDate.getTime())) {
      endDate = new Date();
    }
    endDate.setHours(23, 59, 59, 999);
    
    const where: any = { date: { gte: startDate, lte: endDate } };

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const data: Record<string, any> = {};
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const day = current.toISOString().split('T')[0];
      data[day] = { name: day, kirim: 0, chiqim: 0, balance: 0 };
      current.setDate(current.getDate() + 1);
    }

    transactions.forEach(t => {
      const day = t.date.toISOString().split('T')[0];
      if (data[day]) {
        if (t.type === 'kirim') {
          data[day].kirim += t.amount;
        } else {
          data[day].chiqim += t.amount;
        }
      }
    });

    let cumulative = 0;
    const sortedDays = Object.keys(data).sort();
    sortedDays.forEach(day => {
      cumulative += (data[day].kirim - data[day].chiqim);
      data[day].balance = cumulative;
    });

    return Object.values(data);
  }

  async getStatsByPaymentType(start?: string, end?: string) {
    const where = this.getDateRange(start, end);

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
}
