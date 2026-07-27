import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SalaryMetricsService } from './salary-metrics.service';
import {
  computeSalary,
  METRICS,
  MetricKey,
  SalaryComponent,
  SalaryComputation,
} from './salary-scheme';

// =============================================
// SXEMA XIZMATI — sxemalarni saqlash/o'qish va oylik hisobni chiqarish.
//
// Sxema tanlash tartibi: xodimga biriktirilgan sxema → lavozimniki → yo'q.
// Sxema topilmasa hisob umuman qilinmaydi va maosh avvalgidek qo'lda
// yoziladi — ya'ni bu funksiya mavjud ish oqimini BUZMAYDI, faqat ustiga
// qo'shiladi.
// =============================================

@Injectable()
export class SalarySchemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: SalaryMetricsService,
  ) {}

  /** Metrika katalogi — UI sxema muharririda ro'yxat sifatida ko'rsatadi. */
  listMetrics() {
    return Object.entries(METRICS).map(([key, label]) => ({ key, label }));
  }

  async list(tenantId: string) {
    return (this.prisma as any).salaryScheme.findMany({
      where: { tenantId },
      include: {
        role: { select: { id: true, name: true } },
        employee: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private validate(components: SalaryComponent[]) {
    if (!Array.isArray(components)) throw new BadRequestException('components massiv bo\'lishi kerak');
    const metricKeys = new Set(Object.keys(METRICS));
    for (const c of components) {
      if (!c.label?.trim()) throw new BadRequestException('Har qatorda nom bo\'lishi kerak');
      if (!['fiksa', 'kpi', 'jarima'].includes(c.group)) {
        throw new BadRequestException(`Noma'lum guruh: ${c.group}`);
      }
      if (!['fixed', 'per_unit', 'percent'].includes(c.kind)) {
        throw new BadRequestException(`Noma'lum tur: ${c.kind}`);
      }
      if (c.kind === 'fixed' && !(Number(c.amount) > 0)) {
        throw new BadRequestException(`"${c.label}" uchun summa kiritilmagan`);
      }
      if (c.kind !== 'fixed') {
        if (!c.metric || !metricKeys.has(c.metric)) {
          throw new BadRequestException(`"${c.label}" uchun metrika tanlanmagan`);
        }
        if (!(Number(c.rate) > 0)) {
          throw new BadRequestException(`"${c.label}" uchun stavka kiritilmagan`);
        }
      }
      const conds = [...(c.condition ? [c.condition] : []), ...(c.conditions || [])];
      for (const cond of conds) {
        if (!metricKeys.has(cond.metric)) {
          throw new BadRequestException(`"${c.label}" shartida noma'lum metrika`);
        }
        if (!['gte', 'lte', 'eq'].includes(cond.op)) {
          throw new BadRequestException(`"${c.label}" shartida noma'lum amal: ${cond.op}`);
        }
      }
    }
  }

  async save(
    tenantId: string,
    data: { id?: string; name: string; roleId?: string | null; employeeId?: string | null; components: SalaryComponent[]; isActive?: boolean },
  ) {
    if (!data.name?.trim()) throw new BadRequestException('Sxema nomi kerak');
    if (!data.roleId && !data.employeeId) {
      throw new BadRequestException('Sxema lavozimga yoki xodimga biriktirilishi kerak');
    }
    this.validate(data.components);

    const payload = {
      name: data.name.trim(),
      roleId: data.roleId || null,
      employeeId: data.employeeId || null,
      components: data.components as any,
      isActive: data.isActive ?? true,
    };

    if (data.id) {
      return (this.prisma as any).salaryScheme.update({ where: { id: data.id }, data: payload });
    }
    return (this.prisma as any).salaryScheme.create({ data: { tenantId, ...payload } });
  }

  async remove(tenantId: string, id: string) {
    return (this.prisma as any).salaryScheme.deleteMany({ where: { id, tenantId } });
  }

  /**
   * Berilgan xodimlar uchun shu davrdagi hisobni chiqaradi.
   * Sxemasi yo'q xodim natijada UMUMAN bo'lmaydi — chaqiruvchi uni qo'lda
   * kiritiladigan deb qabul qiladi.
   */
  async computeForEmployees(
    tenantId: string,
    employees: Array<{ id: string; roleId: string }>,
    start: Date,
    end: Date,
  ): Promise<Record<string, SalaryComputation>> {
    if (employees.length === 0) return {};

    const schemes = await (this.prisma as any).salaryScheme.findMany({
      where: { tenantId, isActive: true },
      select: { roleId: true, employeeId: true, components: true },
    });
    if (schemes.length === 0) return {};

    const byEmployee = new Map<string, SalaryComponent[]>();
    const byRole = new Map<string, SalaryComponent[]>();
    for (const s of schemes) {
      if (s.employeeId) byEmployee.set(s.employeeId, s.components || []);
      else if (s.roleId) byRole.set(s.roleId, s.components || []);
    }

    // Xodimniki lavozimnikidan ustun.
    const applicable = new Map<string, SalaryComponent[]>();
    for (const e of employees) {
      const comps = byEmployee.get(e.id) ?? byRole.get(e.roleId);
      if (comps && comps.length) applicable.set(e.id, comps);
    }
    if (applicable.size === 0) return {};

    const metricsByEmp = await this.metrics.measureMany([...applicable.keys()], start, end);

    const out: Record<string, SalaryComputation> = {};
    for (const [empId, comps] of applicable) {
      out[empId] = computeSalary(comps, metricsByEmp[empId]);
    }
    return out;
  }
}
