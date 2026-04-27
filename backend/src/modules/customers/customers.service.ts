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
    const tasks = await this.prisma.task.findMany({
      where: { customerId: id },
      select: { title: true },
      distinct: ['title'],
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return tasks.map(t => t.title);
  }
}
