import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.paymentType.findMany();
  }

  async create(data: { name: string }) {
    return this.prisma.paymentType.create({ data: data as any });
  }

  async update(id: string, data: { name: string }) {
    return this.prisma.paymentType.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.paymentType.delete({ where: { id } });
  }
}
