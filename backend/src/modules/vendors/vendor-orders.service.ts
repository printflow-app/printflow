import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorOrdersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return (this.prisma as any).vendorOrder.findMany({
      include: { vendor: { select: { id: true, name: true, specialty: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    vendorId: string;
    title: string;
    amount: number;
    note?: string;
    sourceTaskId?: string;
  }) {
    return (this.prisma as any).vendorOrder.create({ data });
  }

  // Qabul qilish → kanban task yaratish, status = ACCEPTED
  async accept(id: string, columnId: string) {
    const vo = await (this.prisma as any).vendorOrder.findUnique({
      where: { id },
      include: { vendor: { select: { id: true, name: true } } },
    });
    if (!vo) throw new Error('VendorOrder topilmadi');
    if (vo.status !== 'PENDING') throw new Error('Faqat PENDING so\'rovlarni qabul qilish mumkin');

    return this.prisma.$transaction(async (tx: any) => {
      // Kanban task yaratish
      const task = await tx.task.create({
        data: {
          title: vo.title,
          columnId,
          totalAmount: vo.amount,
          depositAmount: 0,
          remainingAmount: vo.amount,
          customerName: `Hamkor: ${vo.vendor.name}`,
          assignees: '[]',
          attachments: '[]',
          serviceOptions: '[]',
          materialOverrides: '[]',
        },
      });

      // Vendor balansi: biz ularga qarzimiz (decrement)
      await tx.vendor.update({
        where: { id: vo.vendorId },
        data: { balance: { decrement: vo.amount } },
      });

      // VendorOrder status yangilash
      return tx.vendorOrder.update({
        where: { id },
        data: { status: 'ACCEPTED', taskId: task.id },
        include: { vendor: { select: { id: true, name: true, specialty: true } } },
      });
    });
  }

  // Yakunlandi — status = COMPLETED (task done kolumniga o'tganda chaqiriladi)
  async complete(id: string) {
    return (this.prisma as any).vendorOrder.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }

  // Task ID bo'yicha VendorOrder topish (task done bo'lganda)
  async completeByTaskId(taskId: string) {
    const vo = await (this.prisma as any).vendorOrder.findFirst({
      where: { taskId, status: 'ACCEPTED' },
    });
    if (!vo) return null;
    return (this.prisma as any).vendorOrder.update({
      where: { id: vo.id },
      data: { status: 'COMPLETED' },
    });
  }

  async remove(id: string) {
    return (this.prisma as any).vendorOrder.delete({ where: { id } });
  }
}
