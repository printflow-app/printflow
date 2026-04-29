import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.customer.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        transactions: {
          include: { paymentType: true },
          orderBy: { date: 'desc' },
        },
        tasks: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: { tasks: true, transactions: true },
    });
  }

  async create(data: any) {
    return this.prisma.customer.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.customer.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  async findByName(name: string) {
    return this.prisma.customer.findFirst({ where: { name } });
  }

  async getCustomerTasks(id: string) {
    if (!id) return [];
    return this.prisma.task.findMany({
      where: { customerId: id },
      include: {
        column: { select: { title: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Top 10 customers by total orders amount and order count
   */
  async getTopCustomers(limit = 10) {
    const customers = await this.prisma.customer.findMany({
      include: {
        _count: { select: { tasks: true } },
      },
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

  /**
   * Full order history for a specific customer (with detailed task info)
   */
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
