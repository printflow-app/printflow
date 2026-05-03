import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// NOTE: `as any` casts on new Prisma models/fields (CustomerContact, isArchived)
// are needed because the TypeScript server caches stale Prisma types while
// the dev server is running. The schema + DB are correct; casts are safe.

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    return this.prisma.customer.findMany({
      where: branchId ? { branchId } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        transactions: {
          include: { paymentType: true },
          orderBy: { date: 'desc' },
        },
        tasks: { where: { isArchived: false } as any },
      } as any,
    });
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
}
