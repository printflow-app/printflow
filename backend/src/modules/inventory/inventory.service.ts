import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAllMaterials(branchId?: string) {
    const where: any = {};
    if (branchId === '__main__') where.branchId = null;
    else if (branchId) where.branchId = branchId;
    return this.prisma.material.findMany({
      where: Object.keys(where).length ? where : undefined,
      include: {
        movements: { orderBy: { createdAt: 'desc' }, take: 5 },
        bom: { include: { service: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneMaterial(id: string) {
    return this.prisma.material.findUnique({
      where: { id },
      include: {
        movements: { orderBy: { createdAt: 'desc' } },
        bom: { include: { service: true } },
      },
    });
  }

  async createMaterial(data: any) {
    return this.prisma.material.create({ data });
  }

  async updateMaterial(id: string, data: any) {
    return this.prisma.material.update({ where: { id }, data });
  }

  async removeMaterial(id: string) {
    return this.prisma.material.delete({ where: { id } });
  }

  // Kirim
  async stockIn(materialId: string, quantity: number, note?: string, taskId?: string) {
    const [material] = await this.prisma.$transaction([
      this.prisma.material.update({
        where: { id: materialId },
        data: { currentStock: { increment: quantity } },
      }),
      this.prisma.stockMovement.create({
        data: { materialId, type: 'kirim', quantity, note, taskId } as any,
      }),
    ]);
    return material;
  }

  // Chiqim
  async stockOut(materialId: string, quantity: number, note?: string, taskId?: string) {
    const [material] = await this.prisma.$transaction([
      this.prisma.material.update({
        where: { id: materialId },
        data: { currentStock: { decrement: quantity } },
      }),
      this.prisma.stockMovement.create({
        data: { materialId, type: 'chiqim', quantity, note, taskId } as any,
      }),
    ]);
    return material;
  }

  // Brak
  async writeOff(materialId: string, quantity: number, note?: string, taskId?: string) {
    const [material] = await this.prisma.$transaction([
      this.prisma.material.update({
        where: { id: materialId },
        data: { currentStock: { decrement: quantity } },
      }),
      this.prisma.stockMovement.create({
        data: { materialId, type: 'brak', quantity, note, taskId } as any,
      }),
    ]);
    return material;
  }

  // Harakatlar tarixi
  async getMovements(materialId?: string) {
    return this.prisma.stockMovement.findMany({
      where: materialId ? { materialId } : undefined,
      include: { material: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // Buyurtma bitganda materiallarni avtomatik chiqim qilish (BOM)
  async deductByTask(taskId: string, serviceId: string, quantity: number, wasteQty: number = 0) {
    const bom = await this.prisma.serviceMaterial.findMany({
      where: { serviceId },
      include: { material: true },
    });

    const results: any[] = [];
    for (const item of bom) {
      const totalDeduct = (quantity + wasteQty) * item.normPerUnit;
      const result = await this.stockOut(item.materialId, totalDeduct, `Buyurtma #${taskId} sarfi`, taskId);
      results.push(result);
    }
    return results;
  }
}
