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

  // Ikki yo'nalishli balansni hisoblaydi.
  //   weOwe   = Σ task.vendorCost (subpudrat) + Σ ledger("we_owe")  (xomashyo/xizmat xaridi)
  //   theyOwe = Σ ledger("they_owe")                                (hamkorga sotuv)
  //   paidByUs   = Σ chiqim (vendorId)   — biz to'laganimiz
  //   paidToUs   = Σ kirim  (vendorId)   — hamkor to'laganı
  //   balance = (weOwe − paidByUs) − (theyOwe − paidToUs)
  // balance > 0 → biz qarzdormiz; balance < 0 → hamkor bizga qarzdor.
  private computeTotals(v: any) {
    const tasksCost = (v.tasks || []).reduce((s: number, t: any) => s + (Number(t.vendorCost) || 0), 0);
    const ledger = v.ledgerEntries || [];
    const purchases = ledger.filter((l: any) => l.direction === 'we_owe').reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
    const sales = ledger.filter((l: any) => l.direction === 'they_owe').reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
    const txns = v.transactions || [];
    const paidByUs = txns.filter((t: any) => t.type === 'chiqim').reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);
    const paidToUs = txns.filter((t: any) => t.type === 'kirim').reduce((s: number, t: any) => s + (Number(t.amount) || 0), 0);

    const weOwe = tasksCost + purchases;
    const theyOwe = sales;
    const balance = (weOwe - paidByUs) - (theyOwe - paidToUs);

    return {
      totalAssignedCost: tasksCost,   // subpudrat (eski nom — backward compat)
      totalPurchases: purchases,      // xomashyo/xizmat xaridi (qarzga)
      totalSales: sales,              // hamkorga sotuv (qarzga)
      totalPaid: paidByUs,            // biz to'laganimiz (eski nom — backward compat)
      totalReceived: paidToUs,        // hamkor to'laganı
      balance,
    };
  }

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
          where: { type: { in: ['chiqim', 'kirim'] } },
          select: { amount: true, type: true, date: true, expenseReason: true },
        },
        ledgerEntries: {
          select: { amount: true, direction: true },
        },
      },
    });

    return vendors.map((v: any) => ({ ...v, ...this.computeTotals(v) }));
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
          where: { type: { in: ['chiqim', 'kirim'] } },
          orderBy: { date: 'desc' },
          select: { id: true, amount: true, type: true, date: true, expenseReason: true, serviceType: true },
        },
        ledgerEntries: {
          orderBy: { date: 'desc' },
          select: { id: true, direction: true, amount: true, description: true, date: true },
        },
      },
    });

    if (!vendor) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');

    return { ...vendor, ...this.computeTotals(vendor) };
  }

  // Naqdsiz qarz/haq yozuvi yaratish (Xarid yoki Sotuv).
  async createLedgerEntry(data: any, branchId?: string) {
    const bId = requireBranchId(branchId, 'POST /vendors/:id/ledger');
    const direction = data.direction === 'they_owe' ? 'they_owe' : 'we_owe';
    const amount = Number(data.amount);
    if (!amount || amount <= 0) throw new BadRequestException('Summa musbat bo\'lishi kerak');

    const vendor = await this.prisma.vendor.findFirst({ where: { id: data.vendorId, branchId: bId } });
    if (!vendor) throw new NotFoundException('Hamkor topilmadi yoki ushbu filialga tegishli emas');

    return (this.prisma as any).vendorLedgerEntry.create({
      data: {
        vendorId: data.vendorId,
        branchId: bId,
        direction,
        amount,
        description: data.description || null,
        ...(data.date ? { date: new Date(data.date) } : {}),
      },
    });
  }

  async removeLedgerEntry(id: string, branchId?: string) {
    const bId = requireBranchId(branchId, 'DELETE /vendors/ledger/:id');
    const entry = await (this.prisma as any).vendorLedgerEntry.findFirst({ where: { id, branchId: bId } });
    if (!entry) throw new NotFoundException('Yozuv topilmadi yoki ushbu filialga tegishli emas');
    return (this.prisma as any).vendorLedgerEntry.delete({ where: { id } });
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
