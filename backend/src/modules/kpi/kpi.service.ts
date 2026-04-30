import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================
// KPI SERVICE — Xodimlar samaradorligi (Velocity & Activity)
// Manbalar:
//  - TaskHistory: harakatlar (yaratdi, ko'chirdi, tahrirladi) — activity score
//  - Task.assignees + columnId (oxirgi ustun) — bajarilgan buyurtmalar soni
//  - AttendanceRecord.lateMinutes — punktuallik
// Hisob-kitob har bir xodim uchun bitta {periodStart, periodEnd} oralig'ida.
// =============================================

export interface KpiRow {
  employeeId: string;
  fullName: string;
  roleName: string | null;
  completedTasks: number;
  movedTasks: number;
  createdTasks: number;
  totalActivity: number;
  avgVelocityHours: number | null; // Buyurtma yopilish vaqti — soatlarda
  lateMinutes: number;
  presentDays: number;
  velocityScore: number; // Yagona umumiy ball
}

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  private parseDayBoundary(input: string | undefined, end: boolean): Date | null {
    if (!input) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
    if (m) {
      const [, y, mm, d] = m;
      return end
        ? new Date(Number(y), Number(mm) - 1, Number(d), 23, 59, 59, 999)
        : new Date(Number(y), Number(mm) - 1, Number(d), 0, 0, 0, 0);
    }
    const dt = new Date(input);
    if (isNaN(dt.getTime())) return null;
    if (end) dt.setHours(23, 59, 59, 999);
    else dt.setHours(0, 0, 0, 0);
    return dt;
  }

  private resolveRange(start?: string, end?: string): { from: Date; to: Date } {
    let from = start ? this.parseDayBoundary(start, false) : null;
    let to = end ? this.parseDayBoundary(end, true) : null;
    if (!from) {
      from = new Date();
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
    }
    if (!to) {
      to = new Date();
      to.setHours(23, 59, 59, 999);
    }
    return { from, to };
  }

  async getEmployeeKpiList(start?: string, end?: string): Promise<KpiRow[]> {
    const { from, to } = this.resolveRange(start, end);

    // Prisma middleware tenantId'ni avtomatik qo'shadi (TenantInterceptor orqali).
    const employees = await this.prisma.employee.findMany({
      include: { role: true },
    });

    const columns = await this.prisma.kanbanColumn.findMany({
      orderBy: { orderIdx: 'asc' },
    });
    const finalColumnId = columns.length ? columns[columns.length - 1].id : null;

    const histories = await this.prisma.taskHistory.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { task: true },
    });

    const tasks = await this.prisma.task.findMany({
      where: { updatedAt: { gte: from, lte: to } },
    });

    const attendance = await this.prisma.attendanceRecord.findMany({
      where: { createdAt: { gte: from, lte: to } },
    });

    const rows: KpiRow[] = employees.map((emp) => {
      const empHistories = histories.filter((h) => h.employeeId === emp.id);
      const created = empHistories.filter((h) => h.action === 'yaratildi').length;
      const moved = empHistories.filter((h) => h.action === 'ko\'chirildi' || h.action === 'kochirildi').length;

      // Bajarilgan vazifalar — assignees ichida bo'lib, oxirgi columnda turgan tasklar.
      let completed = 0;
      const closeDurations: number[] = [];
      tasks.forEach((t) => {
        try {
          const assignees: string[] = JSON.parse(t.assignees || '[]');
          if (!assignees.includes(emp.id)) return;
          if (finalColumnId && t.columnId === finalColumnId) {
            completed++;
            const created = new Date(t.createdAt).getTime();
            const closed = new Date(t.updatedAt).getTime();
            const hours = Math.max(0, (closed - created) / 3_600_000);
            if (hours > 0 && hours < 24 * 60) closeDurations.push(hours); // 60 kundan ko'pini tashlab yuborish (autlier)
          }
        } catch {
          /* noop */
        }
      });

      const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
      const lateMinutes = empAttendance.reduce((s, a) => s + (a.lateMinutes || 0), 0);
      const presentDays = empAttendance.filter((a) => a.checkIn).length;

      const totalActivity = empHistories.length;
      const avgVelocity = closeDurations.length
        ? closeDurations.reduce((s, n) => s + n, 0) / closeDurations.length
        : null;

      // Velocity skor: bajarilgan vazifa * 10 + harakat * 1 - kechikish penalti.
      // Tezroq yopilgan tasklarni rag'batlantirish uchun avgVelocity'ga teskari koeffitsient.
      const speedBonus = avgVelocity && avgVelocity > 0 ? Math.max(0, 50 - avgVelocity) : 0;
      const velocityScore = Math.round(
        completed * 10 + totalActivity * 1 + speedBonus - lateMinutes * 0.1,
      );

      return {
        employeeId: emp.id,
        fullName: emp.fullName,
        roleName: emp.role?.name || null,
        completedTasks: completed,
        movedTasks: moved,
        createdTasks: created,
        totalActivity,
        avgVelocityHours: avgVelocity ? Math.round(avgVelocity * 10) / 10 : null,
        lateMinutes,
        presentDays,
        velocityScore,
      };
    });

    return rows.sort((a, b) => b.velocityScore - a.velocityScore);
  }

  async getMyKpi(employeeId: string, start?: string, end?: string): Promise<KpiRow | null> {
    const list = await this.getEmployeeKpiList(start, end);
    return list.find((r) => r.employeeId === employeeId) || null;
  }

  async getKpiSummary(start?: string, end?: string) {
    const list = await this.getEmployeeKpiList(start, end);
    const totals = list.reduce(
      (acc, r) => {
        acc.completed += r.completedTasks;
        acc.activity += r.totalActivity;
        acc.lateMinutes += r.lateMinutes;
        return acc;
      },
      { completed: 0, activity: 0, lateMinutes: 0 },
    );
    const top3 = list.slice(0, 3);
    return { totals, top3, employees: list.length };
  }
}
