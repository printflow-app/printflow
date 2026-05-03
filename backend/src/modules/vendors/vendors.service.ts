import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return (this.prisma as any).vendor.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { orderCosts: true } } },
    });
  }

  async findOne(id: string) {
    return (this.prisma as any).vendor.findUnique({
      where: { id },
      include: {
        orderCosts: {
          include: { task: { select: { id: true, title: true, orderName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
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

  // =============================================
  // OrderVendorCost (subpudrat xarajatlari)
  // =============================================

  async addOrderCost(taskId: string, data: { vendorId: string; amount: number; description?: string }) {
    const cost = await (this.prisma as any).orderVendorCost.create({
      data: { ...data, taskId },
    });
    // Update vendor balance (negative = we owe them)
    await (this.prisma as any).vendor.update({
      where: { id: data.vendorId },
      data: { balance: { decrement: data.amount } },
    });
    return cost;
  }

  async payVendor(id: string, amount: number) {
    return (this.prisma as any).vendor.update({
      where: { id },
      data: { balance: { increment: amount } },
    });
  }

  async removeOrderCost(costId: string) {
    const cost = await (this.prisma as any).orderVendorCost.findUnique({ where: { id: costId } });
    if (cost) {
      await (this.prisma as any).vendor.update({
        where: { id: cost.vendorId },
        data: { balance: { increment: cost.amount } },
      });
    }
    return (this.prisma as any).orderVendorCost.delete({ where: { id: costId } });
  }

  async getOrderCosts(taskId: string) {
    return (this.prisma as any).orderVendorCost.findMany({
      where: { taskId },
      include: { vendor: { select: { id: true, name: true, specialty: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
