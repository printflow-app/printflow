import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// NOTE: `as any` casts on new Prisma models/fields (CustomerContact, isArchived)
// are needed because the TypeScript server caches stale Prisma types while
// the dev server is running. The schema + DB are correct; casts are safe.

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  // `includeDetails` is kept for backwards compat with old clients, but no
  // longer hydrates tasks/transactions in the list payload — those are loaded
  // on-demand via /customers/:id/details when a row is expanded. Returning
  // them per-customer in the list caused multi-MB payloads on Railway/Vercel.
  async findAll(branchId?: string, _includeDetails = false) {
    const customers = await this.prisma.customer.findMany({
      where:
        branchId === '__main__'
          ? { branchId: null }
          : branchId
          ? { branchId }
          : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
      },
    });
    // totalDebt/totalPaid ustunlari saqlanadigan hisoblagich (counter) edi va
    // vaqt o'tib manba yozuvlardan drift qilardi (15/16 mijozda noto'g'ri balans).
    // Endi ularni manbadan — aktiv tasklar va kirim tranzaksiyalardan — hisoblaymiz,
    // shunda balans doim ekrandagi "Buyurtmalar" + "To'lovlar Tarixi" ga mos keladi.
    return this.withDerivedTotals(customers);
  }

  // Bir nechta mijoz uchun totalDebt (aktiv tasklar summasi) va totalPaid
  // (kirim tranzaksiyalar summasi) ni ikkita groupBy bilan hisoblab, qatorlarga
  // qayta yozadi. N+1 emas — har biri bitta so'rov.
  private async withDerivedTotals<T extends { id: string }>(customers: T[]): Promise<T[]> {
    if (customers.length === 0) return customers;
    const ids = customers.map(c => c.id);
    const [taskSums, paidSums] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, isArchived: false } as any,
        _sum: { totalAmount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, type: 'kirim' },
        _sum: { amount: true },
      }),
    ]);
    const debtBy = Object.fromEntries(
      taskSums.map((t: any) => [t.customerId, Number(t._sum.totalAmount || 0)]),
    );
    const paidBy = Object.fromEntries(
      paidSums.map((t: any) => [t.customerId, Number(t._sum.amount || 0)]),
    );
    return customers.map(c => ({
      ...c,
      totalDebt: debtBy[c.id] ?? 0,
      totalPaid: paidBy[c.id] ?? 0,
    }));
  }

  // Lazy-loaded expanded row payload — recent tasks + recent transactions.
  // Caps applied because some customers have hundreds of records and the
  // expanded panel only ever shows the most recent ones.
  async getDetails(id: string) {
    const [tasks, transactions] = await Promise.all([
      this.prisma.task.findMany({
        where: { customerId: id, isArchived: false } as any,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          totalAmount: true,
          createdAt: true,
          service: {
            select: { name: true }
          }
        },
      }),
      this.prisma.transaction.findMany({
        where: { customerId: id },
        orderBy: { date: 'desc' },
        take: 50,
        include: { paymentType: { select: { name: true } } },
      }),
    ]);
    return { tasks, transactions };
  }

  async findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        tasks: { where: { isArchived: false } as any },
        transactions: { include: { paymentType: true }, orderBy: { date: 'desc' } },
      } as any,
    });
  }

  async create(data: any) {
    const { contacts, ...rest } = data;
    const customer = await this.prisma.customer.create({ data: rest });
    if (contacts?.length) {
      await (this.prisma as any).customerContact.createMany({
        data: contacts.map((c: any) => ({ ...c, customerId: customer.id })),
      });
    }
    return this.findOne(customer.id);
  }

  async update(id: string, data: any) {
    const { contacts, ...rest } = data;
    return this.prisma.customer.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  async findByName(name: string) {
    return this.prisma.customer.findFirst({ where: { name } });
  }

  // =============================================
  // B2B: Contact CRUD
  // =============================================

  async createContact(customerId: string, data: any) {
    if (data.isPrimary) {
      await (this.prisma as any).customerContact.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }
    return (this.prisma as any).customerContact.create({
      data: { ...data, customerId },
    });
  }

  async updateContact(contactId: string, data: any) {
    if (data.isPrimary) {
      const contact = await (this.prisma as any).customerContact.findUnique({
        where: { id: contactId },
      });
      if (contact) {
        await (this.prisma as any).customerContact.updateMany({
          where: { customerId: contact.customerId },
          data: { isPrimary: false },
        });
      }
    }
    return (this.prisma as any).customerContact.update({
      where: { id: contactId },
      data,
    });
  }

  async removeContact(contactId: string) {
    return (this.prisma as any).customerContact.delete({ where: { id: contactId } });
  }

  async getContacts(customerId: string) {
    return (this.prisma as any).customerContact.findMany({
      where: { customerId },
      orderBy: { isPrimary: 'desc' },
    });
  }

  // =============================================
  // Business logic
  // =============================================

  async getCustomerTasks(id: string) {
    if (!id) return [];
    return this.prisma.task.findMany({
      where: { customerId: id, isArchived: false } as any,
      include: {
        column: { select: { title: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getTopCustomers(limit = 10) {
    // Saralash hisoblangan totalPaid (kirim tranzaksiyalar) bo'yicha bo'lishi kerak —
    // saqlangan ustun drift qilgani uchun unga ishonmaymiz. Barcha mijozni olib,
    // manbadan hisoblab, keyin saralaymiz (mijozlar soni kichik).
    const customers = await this.prisma.customer.findMany({
      include: { _count: { select: { tasks: true } } },
    });
    const withTotals = await this.withDerivedTotals(customers as any[]);
    return (withTotals as any[])
      .sort((a, b) => Number(b.totalPaid) - Number(a.totalPaid))
      .slice(0, limit)
      .map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalDebt: c.totalDebt,
        totalPaid: c.totalPaid,
        orderCount: c._count.tasks,
      }));
  }

  async getOrderHistory(customerId: string) {
    return this.prisma.task.findMany({
      where: { customerId },
      include: {
        column: { select: { title: true } },
        service: { select: { name: true, unit: true } },
        paymentType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Recalculates totalDebt for all customers from their actual task amounts.
  // Fixes cases where totalDebt was incorrectly decremented on kassa payments.
  async recalculateAllDebts(tenantId: string) {
    const customers = await this.prisma.customer.findMany({ where: { tenantId } });
    const results: { id: string; name: string; old: number; new: number }[] = [];

    for (const c of customers) {
      const agg = await this.prisma.task.aggregate({
        where: { customerId: c.id },
        _sum: { totalAmount: true },
      });
      const correctDebt = agg._sum.totalAmount ?? 0;
      if (Math.abs(c.totalDebt - correctDebt) > 0.01) {
        await this.prisma.customer.update({
          where: { id: c.id },
          data: { totalDebt: correctDebt },
        });
        results.push({ id: c.id, name: c.name, old: c.totalDebt, new: correctDebt });
      }
    }
    return { fixed: results.length, changes: results };
  }
}
