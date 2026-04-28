import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  findAllAdmin() {
    return this.prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tenants: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.plan.findUnique({ where: { id } });
  }

  findByName(name: string) {
    return this.prisma.plan.findUnique({ where: { name } });
  }

  create(data: {
    name: string;
    displayName: string;
    price3m: number;
    price6m: number;
    price12m: number;
    maxEmployees: number;
    features: string;
    description?: string;
    isPopular?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.plan.create({ data });
  }

  update(id: string, data: Partial<{
    name: string;
    displayName: string;
    price3m: number;
    price6m: number;
    price12m: number;
    maxEmployees: number;
    features: string;
    description: string;
    isPopular: boolean;
    isActive: boolean;
    sortOrder: number;
  }>) {
    return this.prisma.plan.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.plan.delete({ where: { id } });
  }
}
