import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================
// ROLES are TENANT-WIDE.
//
// The schema enforces @@unique([tenantId, name]) — a role name is unique across the
// whole tenant, not per branch — so the `branchId` column on Role is effectively
// vestigial. We scope roles by tenant only (the Prisma middleware injects tenantId
// automatically) and IGNORE branchId on reads/edits.
//
// Why: previously roles were queried by branchId. Any role whose branchId didn't
// match the caller's active branch silently vanished — e.g. the signup-created Admin
// role (branchId NULL) or roles created while the UI treated the branch as '__main__'
// (also NULL). When roles came back empty, EMPLOYEES disappeared too, because the
// employee list is filtered client-side by the loaded role ids. Tenant-wide scoping
// removes that entire class of bug for every workspace, past and future.
// =============================================

// Kept only for create(): map the legacy '__main__' / empty sentinel to NULL.
function normalizeBranch(branchId?: string | null): string | null {
  if (!branchId || branchId === '__main__') return null;
  return branchId;
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  // `branchId` is accepted for backward-compat with existing clients but ignored —
  // roles are returned tenant-wide.
  async findAll(_branchId?: string) {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, _branchId?: string) {
    const role = await this.prisma.role.findFirst({ where: { id } });
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
    // branchId no longer affects visibility; we still persist whatever the client
    // sends (normalized) so the column stays consistent with the active branch.
    safe.branchId = normalizeBranch(safe.branchId);
    return this.prisma.role.create({ data: safe });
  }

  async update(id: string, data: any, _branchId?: string) {
    const existing = await this.prisma.role.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Lavozim topilmadi');

    const safe = this.sanitizeRoleData(data);
    // branchId hech qachon update orqali o'zgartirilmasin (cross-branch xavfsizlik)
    delete safe.branchId;
    return this.prisma.role.update({ where: { id }, data: safe });
  }

  async remove(id: string, _branchId?: string) {
    const existing = await this.prisma.role.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Lavozim topilmadi');
    return this.prisma.role.delete({ where: { id } });
  }
}
