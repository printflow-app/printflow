import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BUILTIN_METRICS,
  MetricKey,
  MetricValues,
  emptyMetricValues,
  isValidMetric,
} from './kpi-metrics';

// =============================================
// KPI PLANS SERVICE
// - Reja (KpiPlan) CRUD: lavozim shabloni + xodim override
// - Metrika qiymatlarini bir davr uchun hisoblash (computeMetricValues)
// - Progress: har xodim uchun resolved rejalar + joriy qiymat + foiz
// Davr: oylik (periodKey = 'YYYY-MM').
// =============================================

export interface GoalProgress {
  planId: string;
  scope: 'role' | 'employee';
  metricKey: MetricKey;
  label: string;
  unit: string;
  target: number;
  current: number;
  percent: number; // 0..100+ (oshib ketishi mumkin)
}

export interface EmployeeProgress {
  employeeId: string;
  fullName: string;
  roleName: string | null;
  goals: GoalProgress[];
}

@Injectable()
export class KpiPlansService {
  constructor(private prisma: PrismaService) {}

  getMetrics() {
    return BUILTIN_METRICS;
  }

  // ── Davr chegaralari (oylik) ─────────────────────────────────────
  // month: 'YYYY-MM' (ixtiyoriy) → o'sha oy; bo'lmasa joriy oy.
  private monthRange(month?: string): { from: Date; to: Date; periodKey: string } {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth(); // 0-based
    const match = month && /^(\d{4})-(\d{2})$/.exec(month);
    if (match) {
      y = Number(match[1]);
      m = Number(match[2]) - 1;
    }
    const from = new Date(y, m, 1, 0, 0, 0, 0);
    const to = new Date(y, m + 1, 0, 23, 59, 59, 999); // oyning oxirgi kuni
    const periodKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    return { from, to, periodKey };
  }

  // ── CRUD ─────────────────────────────────────────────────────────
  async listPlans() {
    return this.prisma.kpiPlan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPlan(data: any, createdBy?: string) {
    const scope = data.scope === 'employee' ? 'employee' : 'role';
    if (!isValidMetric(data.metricKey)) {
      throw new BadRequestException("Noto'g'ri metrika");
    }
    if (scope === 'role' && !data.roleId) {
      throw new BadRequestException('Lavozim tanlanmagan');
    }
    if (scope === 'employee' && !data.employeeId) {
      throw new BadRequestException('Xodim tanlanmagan');
    }
    const target = Number(data.targetValue);
    if (!isFinite(target) || target < 0) {
      throw new BadRequestException("Target noto'g'ri");
    }
    return this.prisma.kpiPlan.create({
      data: {
        scope,
        roleId: scope === 'role' ? data.roleId : null,
        employeeId: scope === 'employee' ? data.employeeId : null,
        metricKey: data.metricKey,
        targetValue: target,
        periodType: 'monthly',
        branchId: data.branchId || null,
        isActive: data.isActive !== false,
        createdBy: createdBy || null,
      } as any,
    });
  }

  async updatePlan(id: string, data: any) {
    const patch: any = {};
    if (data.targetValue !== undefined) {
      const target = Number(data.targetValue);
      if (!isFinite(target) || target < 0) throw new BadRequestException("Target noto'g'ri");
      patch.targetValue = target;
    }
    if (data.isActive !== undefined) patch.isActive = !!data.isActive;
    if (data.metricKey !== undefined) {
      if (!isValidMetric(data.metricKey)) throw new BadRequestException("Noto'g'ri metrika");
      patch.metricKey = data.metricKey;
    }
    return this.prisma.kpiPlan.update({ where: { id }, data: patch });
  }

  async removePlan(id: string) {
    return this.prisma.kpiPlan.delete({ where: { id } });
  }

  // ── Metrika qiymatlarini hisoblash ───────────────────────────────
  // employeeId -> { orders_taken, orders_completed, revenue, on_time_days, activity }
  async computeMetricValues(from: Date, to: Date): Promise<Map<string, MetricValues>> {
    const [employees, columns, histories, recentTasks, attendance] = await Promise.all([
      this.prisma.employee.findMany({ select: { id: true } }),
      this.prisma.kanbanColumn.findMany({ orderBy: { orderIdx: 'asc' }, select: { id: true } }),
      this.prisma.taskHistory.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { employeeId: true, taskId: true, action: true },
      }),
      this.prisma.task.findMany({
        where: { updatedAt: { gte: from, lte: to } },
        select: { id: true, assignees: true, columnId: true, totalAmount: true, quantity: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { createdAt: { gte: from, lte: to } },
        select: { employeeId: true, lateMinutes: true, checkIn: true },
      }),
    ]);

    const finalColumnId = columns.length ? columns[columns.length - 1].id : null;

    const result = new Map<string, MetricValues>();
    const get = (id: string): MetricValues => {
      let r = result.get(id);
      if (!r) {
        r = emptyMetricValues();
        result.set(id, r);
      }
      return r;
    };
    for (const e of employees) get(e.id); // hammasi 0 dan ko'rinsin

    // "Olingan" buyurtmalarning summasini topish uchun yaratilgan tasklar amount'i
    const createdHist = histories.filter((h) => h.action === 'yaratildi' && h.employeeId);
    const createdTaskIds = [...new Set(createdHist.map((h) => h.taskId).filter(Boolean) as string[])];
    const createdTasks = createdTaskIds.length
      ? await this.prisma.task.findMany({
          where: { id: { in: createdTaskIds } },
          select: { id: true, totalAmount: true },
        })
      : [];
    const amountByTask = new Map(createdTasks.map((t) => [t.id, Number(t.totalAmount || 0)]));

    // Activity + orders_taken + revenue(taken)
    for (const h of histories) {
      if (!h.employeeId || !result.has(h.employeeId)) continue;
      const r = get(h.employeeId);
      r.activity += 1;
      if (h.action === 'yaratildi') {
        r.orders_taken += 1;
        r.revenue += amountByTask.get(h.taskId as string) || 0;
      }
    }

    // orders_completed — assignee + oxirgi ustun
    if (finalColumnId) {
      for (const t of recentTasks) {
        if (t.columnId !== finalColumnId) continue;
        let assignees: string[] = [];
        try {
          assignees = JSON.parse(t.assignees || '[]');
        } catch {
          /* noop */
        }
        const qty = Number((t as any).quantity || 0);
        for (const id of assignees) {
          const r = result.get(id);
          if (r) {
            r.orders_completed += 1;
            r.units_produced += qty;
          }
        }
      }
    }

    // on_time_days — kechikmasdan kelgan kunlar
    for (const a of attendance) {
      if (!a.employeeId || !result.has(a.employeeId)) continue;
      if (a.checkIn && (a.lateMinutes || 0) === 0) get(a.employeeId).on_time_days += 1;
    }

    return result;
  }

  // ── Progress: har xodim uchun resolved rejalar ───────────────────
  async getProgress(month?: string, branchId?: string): Promise<{
    periodKey: string;
    employees: EmployeeProgress[];
  }> {
    const { from, to, periodKey } = this.monthRange(month);
    const [plans, employees] = await Promise.all([
      this.prisma.kpiPlan.findMany({ where: { isActive: true } }),
      this.prisma.employee.findMany({ include: { role: true } }),
    ]);
    const values = await this.computeMetricValues(from, to);

    const labelOf = new Map(BUILTIN_METRICS.map((m) => [m.key, m]));
    const rolePlans = plans.filter((p) => p.scope === 'role');
    const empPlans = plans.filter((p) => p.scope === 'employee');

    const dispEmployees =
      branchId && branchId !== '__main__'
        ? employees.filter((e) => e.branchId === branchId)
        : employees;

    const out: EmployeeProgress[] = dispEmployees.map((emp) => {
      const vals = values.get(emp.id) || emptyMetricValues();
      // metricKey -> plan (xodim override lavozim shablonini bosadi)
      const byMetric = new Map<string, any>();
      for (const p of rolePlans) {
        if (p.roleId && emp.roleId === p.roleId) byMetric.set(p.metricKey, p);
      }
      for (const p of empPlans) {
        if (p.employeeId === emp.id) byMetric.set(p.metricKey, p);
      }
      const goals: GoalProgress[] = [...byMetric.values()].map((p) => {
        const def = labelOf.get(p.metricKey as MetricKey);
        const current = Number((vals as any)[p.metricKey] || 0);
        const target = Number(p.targetValue || 0);
        return {
          planId: p.id,
          scope: p.scope,
          metricKey: p.metricKey,
          label: def?.label || p.metricKey,
          unit: def?.unit || '',
          target,
          current,
          percent: target > 0 ? Math.round((current / target) * 100) : 0,
        };
      });
      // Eng past progressli maqsadlar oldinga
      goals.sort((a, b) => a.percent - b.percent);
      return {
        employeeId: emp.id,
        fullName: emp.fullName,
        roleName: emp.role?.name || null,
        goals,
      };
    });

    return { periodKey, employees: out };
  }

  // Bitta xodim uchun (Dashboard "Mening rejalarim")
  async getMyProgress(employeeId: string, month?: string): Promise<EmployeeProgress | null> {
    const { employees } = await this.getProgress(month);
    return employees.find((e) => e.employeeId === employeeId) || null;
  }
}
