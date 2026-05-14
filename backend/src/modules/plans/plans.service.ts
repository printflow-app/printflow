import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map(p => ({
      ...p,
      allowedModules: p.allowedModules?.length ? p.allowedModules : this.getDefaultModules(p.name),
    }));
  }

  private getDefaultModules(planName: string): string[] {
    const name = planName.toUpperCase();
    if (name.includes('INDUSTRIAL') || name.includes('ENTERPRISE')) {
      return ['finance', 'statistics', 'reports', 'kanban', 'customers', 'employees',
              'administration', 'inventory', 'attendance', 'partners', 'settings',
              'branches', 'subscriptions', 'ai_chat'];
    }
    if (name.includes('STANDARD') || name.includes('PRO')) {
      return ['finance', 'statistics', 'reports', 'kanban', 'customers', 'employees',
              'administration', 'inventory', 'attendance', 'partners', 'settings', 'subscriptions'];
    }
    return ['kanban', 'finance', 'customers', 'employees', 'subscriptions'];
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

  async create(data: {
    name: string;
    displayName: string;
    price3m: number;
    price6m: number;
    price12m: number;
    maxEmployees: number;
    maxBranches?: number;
    maxDepartments?: number;
    allowedModules?: string[];
    features: string;
    description?: string;
    isPopular?: boolean;
    sortOrder?: number;
  }) {
    try {
      console.log('CREATING PLAN:', data);
      return await this.prisma.plan.create({ data });
    } catch (err) {
      console.error('PRISMA CREATE ERROR:', err);
      throw err;
    }
  }

  async update(id: string, data: Partial<{
    name: string;
    displayName: string;
    price3m: number;
    price6m: number;
    price12m: number;
    maxEmployees: number;
    maxBranches: number;
    maxDepartments: number;
    allowedModules: string[];
    features: string;
    description: string;
    isPopular: boolean;
    isActive: boolean;
    sortOrder: number;
  }>) {
    try {
      console.log('UPDATING PLAN ID:', id);
      console.log('DATA TO UPDATE:', JSON.stringify(data, null, 2));
      
      // Agar features kelmasa, uni bo'sh JSON sifatida yuboramiz
      const finalData = { ...data };
      if (finalData.features === undefined) {
        finalData.features = "{}";
      }

      const result = await this.prisma.plan.update({ 
        where: { id }, 
        data: finalData 
      });
      console.log('UPDATE SUCCESSFUL');
      return result;
    } catch (err) {
      console.error('!!! PRISMA UPDATE FATAL ERROR !!!');
      console.error(err);
      throw err;
    }
  }

  remove(id: string) {
    return this.prisma.plan.delete({ where: { id } });
  }
}
