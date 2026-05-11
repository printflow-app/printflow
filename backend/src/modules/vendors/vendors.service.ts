import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const vendors = await (this.prisma as any).vendor.findMany({
      orderBy: { name: 'asc' },
      include: {
        tasks: { 
          select: { 
            id: true, 
            title: true, 
            vendorCost: true, 
            createdAt: true,
            column: { select: { title: true } }
          } 
        },
        transactions: { where: { type: 'chiqim' }, select: { amount: true, date: true, expenseReason: true } }
      },
    });

    return vendors.map((v: any) => {
      const totalCost = v.tasks.reduce((sum: number, t: any) => sum + (Number(t.vendorCost) || 0), 0);
      const totalPaid = v.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      return {
        ...v,
        totalAssignedCost: totalCost,
        totalPaid: totalPaid,
        balance: totalCost - totalPaid // Qarz
      };
    });
  }

  async findOne(id: string) {
    const vendor = await (this.prisma as any).vendor.findUnique({
      where: { id },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, orderName: true, vendorCost: true, createdAt: true }
        },
        transactions: {
          where: { type: 'chiqim' },
          orderBy: { date: 'desc' },
          select: { id: true, amount: true, date: true, expenseReason: true }
        }
      },
    });

    if (!vendor) return null;

    const totalCost = vendor.tasks.reduce((sum: number, t: any) => sum + (Number(t.vendorCost) || 0), 0);
    const totalPaid = vendor.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    return {
      ...vendor,
      totalAssignedCost: totalCost,
      totalPaid: totalPaid,
      balance: totalCost - totalPaid
    };
  }

  async create(data: any) {
    return (this.prisma as any).vendor.create({ data });
  }

  async update(id: string, data: any) {
    return (this.prisma as any).vendor.update({ where: { id }, data });
  }

  async remove(id: string) {
    return (this.prisma as any).vendor.delete({ where: { id } });
  }
}
