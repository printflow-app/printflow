import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// Joriy foydalanuvchining kassaga oid ruxsat profili — controller JWT'dan quradi.
export interface CashUser {
  userId: string;
  isAdmin: boolean;
  canViewAll: boolean; // canViewAllCashBoxes
  canManage: boolean; // canManageCashBoxes
  canTransfer: boolean; // canTransferCash
}

@Injectable()
export class CashboxService {
  constructor(private prisma: PrismaService) {}

  // =============================================
  // ACCESS HELPERS
  // =============================================

  /** Ko'rish qamrovi: null = hamma kassa, aks holda ruxsat etilgan kassa id'lari. */
  private async visibleCashBoxIds(u: CashUser): Promise<string[] | null> {
    if (u.isAdmin || u.canViewAll) return null;
    const boxes = await this.prisma.cashBox.findMany({
      where: { assignedUserId: u.userId },
      select: { id: true },
    });
    return boxes.map((b) => b.id);
  }

  /** Qabul/rad qilish qamrovi: null = istalgan kassa, aks holda o'ziga biriktirilgan. */
  private async respondableCashBoxIds(u: CashUser): Promise<string[] | null> {
    if (u.isAdmin || u.canManage) return null;
    const boxes = await this.prisma.cashBox.findMany({
      where: { assignedUserId: u.userId },
      select: { id: true },
    });
    return boxes.map((b) => b.id);
  }

  /** Employee + WorkspaceAdmin ismlarini id bo'yicha yechadi (assignedUserId ko'rsatish uchun). */
  private async resolveUserNames(ids: string[]): Promise<Record<string, string>> {
    const uniq = [...new Set(ids.filter(Boolean))];
    if (!uniq.length) return {};
    const tenantId = TenantContext.tryGetTenantId() || undefined;
    const [emps, admins] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: uniq } },
        select: { id: true, fullName: true },
      }),
      this.prisma.workspaceAdmin.findMany({
        where: { id: { in: uniq }, ...(tenantId ? { tenantId } : {}) },
        select: { id: true, fullName: true },
      }),
    ]);
    const map: Record<string, string> = {};
    for (const e of emps) map[e.id] = e.fullName;
    for (const a of admins) map[a.id] = a.fullName;
    return map;
  }

  // =============================================
  // CASHBOX CRUD
  // =============================================

  async list(u: CashUser, branchId?: string) {
    const where: any = {};
    if (branchId && branchId !== '__main__' && branchId !== '__all__') {
      where.branchId = branchId;
    }
    const visible = await this.visibleCashBoxIds(u);
    if (visible !== null) {
      where.id = { in: visible.length ? visible : ['__none__'] };
    }

    const boxes = await this.prisma.cashBox.findMany({
      where,
      orderBy: [{ type: 'desc' }, { createdAt: 'asc' }], // 'personal' < 'main' alfabetda; desc → main birinchi
    });

    const ids = boxes.map((b) => b.id);
    const balanceMap: Record<string, number> = {};
    if (ids.length) {
      const grouped = await this.prisma.transaction.groupBy({
        by: ['cashBoxId', 'type'],
        where: { cashBoxId: { in: ids } },
        _sum: { amount: true },
      });
      for (const g of grouped) {
        if (!g.cashBoxId) continue;
        const sum = g._sum.amount || 0;
        balanceMap[g.cashBoxId] =
          (balanceMap[g.cashBoxId] || 0) + (g.type === 'kirim' ? sum : -sum);
      }
    }

    const nameMap = await this.resolveUserNames(
      boxes.map((b) => b.assignedUserId).filter(Boolean) as string[],
    );

    return boxes.map((b) => ({
      ...b,
      balance: Math.round(balanceMap[b.id] || 0),
      assignedUserName: b.assignedUserId ? nameMap[b.assignedUserId] || null : null,
    }));
  }

  async create(
    u: CashUser,
    data: { name: string; type?: string; branchId?: string | null; assignedUserId?: string | null },
  ) {
    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Kassa nomi kerak');
    }
    return this.prisma.cashBox.create({
      data: {
        name: data.name.trim(),
        type: data.type === 'main' ? 'main' : 'personal',
        branchId: data.branchId || null,
        assignedUserId: data.assignedUserId || null,
      } as any,
    });
  }

  async update(u: CashUser, id: string, data: any) {
    const box = await this.prisma.cashBox.findUnique({ where: { id } });
    if (!box) throw new NotFoundException('Kassa topilmadi');

    const patch: any = {};
    if (data.name !== undefined) patch.name = String(data.name).trim();
    if (data.assignedUserId !== undefined) patch.assignedUserId = data.assignedUserId || null;
    if (data.branchId !== undefined) patch.branchId = data.branchId || null;
    if (data.isActive !== undefined) patch.isActive = !!data.isActive;
    // 'main' kassa turini o'zgartirib bo'lmaydi.
    if (data.type !== undefined && box.type !== 'main') {
      patch.type = data.type === 'main' ? 'main' : 'personal';
    }
    return this.prisma.cashBox.update({ where: { id }, data: patch });
  }

  async remove(u: CashUser, id: string) {
    const box = await this.prisma.cashBox.findUnique({ where: { id } });
    if (!box) throw new NotFoundException('Kassa topilmadi');
    if (box.type === 'main') {
      throw new BadRequestException("Asosiy kassani o'chirib bo'lmaydi");
    }
    const txCount = await this.prisma.transaction.count({ where: { cashBoxId: id } });
    if (txCount > 0) {
      throw new BadRequestException(
        "Bu kassada tranzaksiyalar bor — avval ularni bo'shating yoki boshqa kassaga o'tkazing",
      );
    }
    const pending = await this.prisma.cashTransfer.count({
      where: { status: 'pending', OR: [{ fromCashBoxId: id }, { toCashBoxId: id }] },
    });
    if (pending > 0) {
      throw new BadRequestException('Bu kassada kutilayotgan topshirishlar bor');
    }
    await this.prisma.cashBox.delete({ where: { id } });
    return { success: true, id };
  }

  // =============================================
  // TRANSFERS (kassalararo topshirish)
  // =============================================

  async createTransfer(
    u: CashUser,
    data: { fromCashBoxId: string; toCashBoxId: string; amount: number; note?: string; paymentTypeId?: string },
  ) {
    const amount = Number(data.amount);
    if (!amount || amount <= 0) throw new BadRequestException("Summa noto'g'ri");
    if (!data.fromCashBoxId || !data.toCashBoxId) throw new BadRequestException('Kassa tanlanmagan');
    if (data.fromCashBoxId === data.toCashBoxId) {
      throw new BadRequestException("Bir xil kassaga topshirib bo'lmaydi");
    }

    const [from, to] = await Promise.all([
      this.prisma.cashBox.findUnique({ where: { id: data.fromCashBoxId } }),
      this.prisma.cashBox.findUnique({ where: { id: data.toCashBoxId } }),
    ]);
    if (!from || !to) throw new NotFoundException('Kassa topilmadi');

    // Source kassa foydalanuvchiga ko'rinishi (o'ziniki yoki canViewAll/admin) kerak.
    const visible = await this.visibleCashBoxIds(u);
    if (visible !== null && !visible.includes(from.id)) {
      throw new ForbiddenException("Bu kassadan pul topshirishga ruxsatingiz yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      const sourceTx = await tx.transaction.create({
        data: {
          type: 'chiqim',
          amount,
          paymentTypeId: data.paymentTypeId || null,
          expenseReason: `Kassaga topshirildi: ${to.name}`,
          branchId: from.branchId,
          cashBoxId: from.id,
          createdById: u.userId,
        } as any,
      });
      return tx.cashTransfer.create({
        data: {
          fromCashBoxId: from.id,
          toCashBoxId: to.id,
          amount,
          note: data.note || null,
          paymentTypeId: data.paymentTypeId || null,
          status: 'pending',
          initiatedById: u.userId,
          sourceTxId: sourceTx.id,
        } as any,
      });
    });
  }

  private canRespond(u: CashUser, toBox: { assignedUserId: string | null }): boolean {
    return !!(
      u.isAdmin ||
      u.canManage ||
      (toBox.assignedUserId && toBox.assignedUserId === u.userId)
    );
  }

  async accept(u: CashUser, id: string) {
    const transfer = await this.prisma.cashTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Topshirish topilmadi');
    if (transfer.status !== 'pending') {
      throw new BadRequestException('Bu topshirish allaqachon yakunlangan');
    }
    const to = await this.prisma.cashBox.findUnique({ where: { id: transfer.toCashBoxId } });
    if (!to) throw new NotFoundException('Qabul qiluvchi kassa topilmadi');
    if (!this.canRespond(u, to)) throw new ForbiddenException("Qabul qilishga ruxsatingiz yo'q");

    const from = await this.prisma.cashBox.findUnique({ where: { id: transfer.fromCashBoxId } });

    return this.prisma.$transaction(async (tx) => {
      const destTx = await tx.transaction.create({
        data: {
          type: 'kirim',
          amount: transfer.amount,
          paymentTypeId: transfer.paymentTypeId || null,
          serviceType: `Kassadan qabul qilindi: ${from?.name || ''}`,
          branchId: to.branchId,
          cashBoxId: to.id,
          createdById: u.userId,
        } as any,
      });
      return tx.cashTransfer.update({
        where: { id },
        data: {
          status: 'accepted',
          destTxId: destTx.id,
          respondedById: u.userId,
          respondedAt: new Date(),
        },
      });
    });
  }

  async reject(u: CashUser, id: string) {
    const transfer = await this.prisma.cashTransfer.findUnique({ where: { id } });
    if (!transfer) throw new NotFoundException('Topshirish topilmadi');
    if (transfer.status !== 'pending') {
      throw new BadRequestException('Bu topshirish allaqachon yakunlangan');
    }
    const to = await this.prisma.cashBox.findUnique({ where: { id: transfer.toCashBoxId } });
    if (!to) throw new NotFoundException('Qabul qiluvchi kassa topilmadi');
    if (!this.canRespond(u, to)) throw new ForbiddenException("Rad etishga ruxsatingiz yo'q");

    return this.prisma.$transaction(async (tx) => {
      // Pul source kassaga qaytadi — yuborishdagi chiqimni o'chiramiz.
      if (transfer.sourceTxId) {
        await tx.transaction.deleteMany({ where: { id: transfer.sourceTxId } });
      }
      return tx.cashTransfer.update({
        where: { id },
        data: { status: 'rejected', respondedById: u.userId, respondedAt: new Date() },
      });
    });
  }

  async listTransfers(u: CashUser, opts: { direction?: string; status?: string }) {
    const where: any = {};
    if (opts.status) where.status = opts.status;

    if (opts.direction === 'incoming') {
      const respondable = await this.respondableCashBoxIds(u);
      if (respondable !== null) {
        where.toCashBoxId = { in: respondable.length ? respondable : ['__none__'] };
      }
    } else if (opts.direction === 'outgoing') {
      const visible = await this.visibleCashBoxIds(u);
      if (visible !== null) {
        where.fromCashBoxId = { in: visible.length ? visible : ['__none__'] };
      }
    } else {
      // Yo'nalish ko'rsatilmagan — ko'rinadigan kassalarga oid barchasi.
      const visible = await this.visibleCashBoxIds(u);
      if (visible !== null) {
        const idset = visible.length ? visible : ['__none__'];
        where.OR = [{ toCashBoxId: { in: idset } }, { fromCashBoxId: { in: idset } }];
      }
    }

    const transfers = await this.prisma.cashTransfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const boxIds = [...new Set(transfers.flatMap((t) => [t.fromCashBoxId, t.toCashBoxId]))];
    const boxes = boxIds.length
      ? await this.prisma.cashBox.findMany({
          where: { id: { in: boxIds } },
          select: { id: true, name: true },
        })
      : [];
    const boxMap: Record<string, string> = {};
    for (const b of boxes) boxMap[b.id] = b.name;

    const nameMap = await this.resolveUserNames([
      ...transfers.map((t) => t.initiatedById),
      ...(transfers.map((t) => t.respondedById).filter(Boolean) as string[]),
    ]);

    return transfers.map((t) => ({
      ...t,
      fromCashBoxName: boxMap[t.fromCashBoxId] || null,
      toCashBoxName: boxMap[t.toCashBoxId] || null,
      initiatedByName: nameMap[t.initiatedById] || null,
      respondedByName: t.respondedById ? nameMap[t.respondedById] || null : null,
    }));
  }

  async pendingCount(u: CashUser): Promise<number> {
    const respondable = await this.respondableCashBoxIds(u);
    const where: any = { status: 'pending' };
    if (respondable !== null) {
      where.toCashBoxId = { in: respondable.length ? respondable : ['__none__'] };
    }
    const count = await this.prisma.cashTransfer.count({ where });
    return count;
  }
}
