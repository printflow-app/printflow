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
    return this.prisma.customer.findMany({
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
          id: true, title: true, totalAmount: true, createdAt: true,
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
    const customers = await this.prisma.customer.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { totalPaid: 'desc' },
      take: limit,
    });
    return customers.map(c => ({
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
