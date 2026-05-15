import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    if (!branchId) throw new BadRequestException('branchId majburiy');
    const scope = branchId === '__main__' ? null : branchId;
    return (this.prisma as any).department.findMany({
      where: scope ? { branchId: scope } : { branchId: null },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; branchId: string }) {
    if (!data.name?.trim()) throw new BadRequestException('name majburiy');
    if (!data.branchId) throw new BadRequestException('branchId majburiy');
    // '__main__' = synthetic "Bosh ofis" card → null branchId in DB.
    const scope = data.branchId === '__main__' ? null : data.branchId;
    return (this.prisma as any).department.create({
      data: { name: data.name.trim(), branchId: scope },
    });
  }

  async update(id: string, data: { name: string }, branchId: string) {
    if (!branchId) throw new BadRequestException('branchId majburiy');
    const scope = branchId === '__main__' ? null : branchId;
    const existing = await (this.prisma as any).department.findFirst({
      where: { id, branchId: scope },
    });
    if (!existing) throw new NotFoundException("Bo'lim topilmadi");
    return (this.prisma as any).department.update({
      where: { id },
      data: { name: data.name.trim() },
    });
  }

  async remove(id: string, branchId: string) {
    if (!branchId) throw new BadRequestException('branchId majburiy');
    const scope = branchId === '__main__' ? null : branchId;
    const existing = await (this.prisma as any).department.findFirst({
      where: { id, branchId: scope },
    });
    if (!existing) throw new NotFoundException("Bo'lim topilmadi");
    return (this.prisma as any).department.delete({ where: { id } });
  }
}
