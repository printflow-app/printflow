import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// =============================================
// BRANCHES SERVICE — Multi-Filial boshqaruvi
// Branch model Prisma DB jadvalidan o'qiladi va yoziladi.
// TenantInterceptor + PrismaService middleware orqali
// barcha so'rovlar avtomatik tenant-scoped bo'ladi.
// =============================================

export interface CreateBranchDto {
  name: string;
  address?: string;
  phone?: string;
  managerEmployeeId?: string;
}

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.branch.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { employees: true, tasks: true } },
      },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id } });
    if (!branch) throw new NotFoundException('Filial topilmadi');
    return branch;
  }

  async create(data: CreateBranchDto) {
    // ── Plan limit tekshiruvi ──────────────────────────────────────
    const tenantId = TenantContext.tryGetTenantId();
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });
      const plan = tenant?.plan as any;
      const maxBranches: number = plan?.maxBranches ?? 1;
      if (maxBranches > 0) {
        const existingCount = await this.prisma.branch.count({});
        // Default branch (tenant o'zi) + yaratilgan branchlar >= limit → bloklash
        if (existingCount >= maxBranches) {
          throw new ForbiddenException(
            `Tarif limiti: maksimal ${maxBranches} ta filial. Tarifni yangilang.`,
          );
        }
      }
    }
    // ─────────────────────────────────────────────────────────────

    const existing = await this.prisma.branch.findFirst({
      where: { name: { equals: data.name.trim(), mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Bu nomdagi filial allaqachon mavjud');

    const createData: any = {
      name: data.name.trim(),
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      managerEmployeeId: data.managerEmployeeId || null,
      isActive: true,
    };

    const branch = await this.prisma.branch.create({
      data: createData,
    });

    if (data.managerEmployeeId) {
      await this.prisma.employee.update({
        where: { id: data.managerEmployeeId },
        data: { branchId: branch.id },
      });
    }

    return branch;
  }

  async update(id: string, data: Partial<CreateBranchDto> & { isActive?: boolean }) {
    await this.findOne(id);
    const branch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.address !== undefined && { address: data.address?.trim() || null }),
        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        ...(data.managerEmployeeId !== undefined && { managerEmployeeId: data.managerEmployeeId || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    if (data.managerEmployeeId) {
      await this.prisma.employee.update({
        where: { id: data.managerEmployeeId },
        data: { branchId: branch.id },
      });
    }

    return branch;
  }

  async remove(id: string) {
    await this.findOne(id);

    const totalCount = await this.prisma.branch.count({});
    if (totalCount <= 1) {
      throw new BadRequestException('Kamida bitta filial bo\'lishi shart. O\'chirish mumkin emas.');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id },
      include: {
        _count: { select: { employees: true, tasks: true } },
      },
    });
    const counts = branch!._count;
    if (counts.employees > 0 || counts.tasks > 0) {
      throw new BadRequestException(
        'Ushbu filialda faol ma\'lumotlar borligi sababli o\'chirish mumkin emas.',
      );
    }

    await this.prisma.branch.delete({ where: { id } });
    return { ok: true };
  }
}
