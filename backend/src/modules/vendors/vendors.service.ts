import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Strict branch isolation — same contract as ServicesService.
function requireBranchId(branchId: string | undefined | null, ctx: string): string {
  if (!branchId || typeof branchId !== 'string' || branchId.trim() === '' || branchId === '__main__') {
    throw new BadRequestException(`branchId majburiy (${ctx}): aktiv filialni tanlang`);
  }
  return branchId;
}

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const bId = requireBranchId(branchId, 'GET /vendors');
    const vendors = await this.prisma.vendor.findMany({
      where: { branchId: bId },
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
    const bId = requireBranchId(branchId, 'GET /vendors/:id');
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, branchId: bId },
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

    if (!vendor) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');

    const totalCost = vendor.tasks.reduce((sum: number, t: any) => sum + (Number(t.vendorCost) || 0), 0);
    const totalPaid = vendor.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    return { ...vendor, totalAssignedCost: totalCost, totalPaid, balance: totalCost - totalPaid };
  }

  async create(data: any) {
    const bId = requireBranchId(data.branchId, 'POST /vendors');
    const { branch: _b, ...rest } = data;
    rest.branchId = bId;
    return this.prisma.vendor.create({ data: rest });
  }

  async update(id: string, data: any, branchId?: string) {
    const bId = requireBranchId(branchId, 'PUT /vendors/:id');
    const existing = await this.prisma.vendor.findFirst({ where: { id, branchId: bId } });
    if (!existing) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');

    const { branchId: _bi, branch: _b, tenantId: _t, ...rest } = data;
    return this.prisma.vendor.update({ where: { id }, data: rest });
  }

  async remove(id: string, branchId?: string) {
    const bId = requireBranchId(branchId, 'DELETE /vendors/:id');
    const existing = await this.prisma.vendor.findFirst({ where: { id, branchId: bId } });
    if (!existing) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');
    return this.prisma.vendor.delete({ where: { id } });
  }
}
