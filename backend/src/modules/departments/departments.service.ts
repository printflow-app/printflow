import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, branchId?: string) {
    const where: any = { tenantId };
    if (branchId === '__main__') {
      where.branchId = null;
    } else if (branchId) {
      where.branchId = branchId;
    }
    return this.prisma.department.findMany({
      where,
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, data: { name: string; description?: string; branchId?: string }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    const plan = tenant?.plan as any;
    const maxDepartments: number = plan?.maxDepartments ?? 1;
    if (maxDepartments > 0) {
      const existingCount = await (this.prisma as any).department.count({ where: { tenantId } });
      if (existingCount >= maxDepartments) {
        throw new ForbiddenException(
          `Tarif limiti: maksimal ${maxDepartments} ta bo'lim. Tarifni yangilang.`,
        );
      }
    }

    return this.prisma.department.create({
      data: {
        name: data.name,
        description: data.description,
        branchId: data.branchId || null,
        tenantId,
      },
    });
  }

  async update(tenantId: string, id: string, data: { name?: string; description?: string; isActive?: boolean; branchId?: string }) {
    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException("Bo'lim topilmadi");

    return this.prisma.department.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException("Bo'lim topilmadi");

    return this.prisma.department.delete({ where: { id } });
  }
}
