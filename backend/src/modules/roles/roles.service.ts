import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Multi-Branch isolation:
//   '__main__' (or empty) → branchId IS NULL  (legacy / Bosh ofis data)
//   real UUID             → branchId = <UUID> (specific branch)
function normalizeBranch(branchId?: string | null): string | null {
  if (!branchId || branchId === '__main__') return null;
  return branchId;
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const scope = normalizeBranch(branchId);
    return this.prisma.role.findMany({
      where: { branchId: scope },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const role = await this.prisma.role.findFirst({ where: { id, branchId: scope } });
    if (!role) throw new NotFoundException('Lavozim topilmadi');
    return role;
  }

  private sanitizeRoleData(data: any) {
    const {
      id: _id, tenantId: _t, tenant: _rel, employees: _emp,
      branch: _b, createdAt: _c, updatedAt: _u,
      ...safe
    } = data || {};
    return safe;
  }

  async create(data: any) {
    const safe = this.sanitizeRoleData(data);
    if (!safe.branchId && safe.branchId !== null) {
      throw new BadRequestException('branchId majburiy: lavozim qaysi filialga tegishli ekanini ko\'rsating');
    }
    safe.branchId = normalizeBranch(safe.branchId);
    return this.prisma.role.create({ data: safe });
  }

  async update(id: string, data: any, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const existing = await this.prisma.role.findFirst({ where: { id, branchId: scope } });
    if (!existing) throw new NotFoundException('Lavozim topilmadi yoki ushbu filialga tegishli emas');

    const safe = this.sanitizeRoleData(data);
    // branchId hech qachon update orqali o'zgartirilmasin (cross-branch xavfsizlik)
    delete safe.branchId;
    return this.prisma.role.update({ where: { id }, data: safe });
  }

  async remove(id: string, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const existing = await this.prisma.role.findFirst({ where: { id, branchId: scope } });
    if (!existing) throw new NotFoundException('Lavozim topilmadi yoki ushbu filialga tegishli emas');
    return this.prisma.role.delete({ where: { id } });
  }
}
