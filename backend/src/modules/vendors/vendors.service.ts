import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// '__main__' or empty → branchId IS NULL (shared/legacy vendors)
// real UUID           → branchId = <UUID> (branch-specific vendor)
function normalizeBranch(branchId?: string | null): string | null {
  if (!branchId || branchId === '__main__') return null;
  return branchId;
}

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const scope = normalizeBranch(branchId);
    const vendors = await (this.prisma as any).vendor.findMany({
      where: { branchId: scope },
      orderBy: { name: 'asc' },
      include: {
        tasks: {
          select: {
            id: true,
            title: true,
            vendorCost: true,
            createdAt: true,
            column: { select: { title: true } },
          },
        },
        transactions: {
          where: { type: 'chiqim' },
          select: { amount: true, date: true, expenseReason: true },
        },
      },
    });

    return vendors.map((v: any) => {
      const totalCost = v.tasks.reduce((sum: number, t: any) => sum + (Number(t.vendorCost) || 0), 0);
      const totalPaid = v.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      return { ...v, totalAssignedCost: totalCost, totalPaid, balance: totalCost - totalPaid };
    });
  }

  async findOne(id: string, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const vendor = await (this.prisma as any).vendor.findFirst({
      where: { id, branchId: scope },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, orderName: true, vendorCost: true, createdAt: true },
        },
        transactions: {
          where: { type: 'chiqim' },
          orderBy: { date: 'desc' },
          select: { id: true, amount: true, date: true, expenseReason: true },
        },
      },
    });

    if (!vendor) throw new NotFoundException('Hamkor topilmadi');

    const totalCost = vendor.tasks.reduce((sum: number, t: any) => sum + (Number(t.vendorCost) || 0), 0);
    const totalPaid = vendor.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    return { ...vendor, totalAssignedCost: totalCost, totalPaid, balance: totalCost - totalPaid };
  }

  async create(data: any) {
    if (data.branchId === undefined) {
      throw new BadRequestException('branchId majburiy: hamkor qaysi filialga tegishli ekanini ko\'rsating');
    }
    const { branch: _b, ...rest } = data;
    rest.branchId = normalizeBranch(rest.branchId);
    return (this.prisma as any).vendor.create({ data: rest });
  }

  async update(id: string, data: any, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const existing = await (this.prisma as any).vendor.findFirst({ where: { id, branchId: scope } });
    if (!existing) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');

    const { branchId: _bi, branch: _b, tenantId: _t, ...rest } = data;
    return (this.prisma as any).vendor.update({ where: { id }, data: rest });
  }

  async remove(id: string, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const existing = await (this.prisma as any).vendor.findFirst({ where: { id, branchId: scope } });
    if (!existing) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');
    return (this.prisma as any).vendor.delete({ where: { id } });
  }
}
