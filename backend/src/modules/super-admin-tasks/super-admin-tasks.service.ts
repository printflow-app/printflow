import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminTasksService {
  constructor(private prisma: PrismaService) {}

  // ── Funnels (Voronka) ────────────────────────────────────────────────────
  async listFunnels() {
    return (this.prisma as any).superAdminFunnel.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        tasks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async createFunnel(data: { name: string; color?: string; sortOrder?: number }) {
    const maxOrder = await (this.prisma as any).superAdminFunnel.aggregate({
      _max: { sortOrder: true },
    });
    return (this.prisma as any).superAdminFunnel.create({
      data: {
        name: data.name,
        color: data.color || '#FF6B00',
        sortOrder: data.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1),
      },
    });
  }

  async updateFunnel(id: string, data: { name?: string; color?: string; sortOrder?: number }) {
    return (this.prisma as any).superAdminFunnel.update({
      where: { id },
      data,
    });
  }

  async deleteFunnel(id: string) {
    return (this.prisma as any).superAdminFunnel.delete({ where: { id } });
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  async createTask(data: {
    funnelId: string;
    title: string;
    description?: string;
    deadlineAt?: string | null;
    status?: string;
  }) {
    const funnel = await (this.prisma as any).superAdminFunnel.findUnique({
      where: { id: data.funnelId },
    });
    if (!funnel) throw new NotFoundException('Varonka topilmadi');

    const maxOrder = await (this.prisma as any).superAdminTaskItem.aggregate({
      where: { funnelId: data.funnelId },
      _max: { sortOrder: true },
    });

    const deadlineAt = data.deadlineAt ? new Date(data.deadlineAt) : null;

    return (this.prisma as any).superAdminTaskItem.create({
      data: {
        funnelId: data.funnelId,
        title: data.title,
        description: data.description || null,
        deadlineAt: deadlineAt && !isNaN(deadlineAt.getTime()) ? deadlineAt : null,
        status: data.status || 'open',
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateTask(
    id: string,
    data: {
      title?: string;
      description?: string;
      deadlineAt?: string | null;
      status?: string;
      funnelId?: string;
      sortOrder?: number;
    },
  ) {
    const patch: any = { ...data };
    if (Object.prototype.hasOwnProperty.call(data, 'deadlineAt')) {
      if (data.deadlineAt === null || data.deadlineAt === '') {
        patch.deadlineAt = null;
      } else {
        const d = new Date(data.deadlineAt as string);
        patch.deadlineAt = isNaN(d.getTime()) ? null : d;
      }
    }
    return (this.prisma as any).superAdminTaskItem.update({
      where: { id },
      data: patch,
    });
  }

  async deleteTask(id: string) {
    return (this.prisma as any).superAdminTaskItem.delete({ where: { id } });
  }
}
