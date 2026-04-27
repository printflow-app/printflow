import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpenseTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.expenseType.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async create(data: { name: string }) {
    return this.prisma.expenseType.create({ data: data as any });
  }

  async update(id: string, data: { name: string }) {
    return this.prisma.expenseType.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.expenseType.delete({ where: { id } });
  }
}
