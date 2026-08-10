import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { qarzdorlarRoyxati } from '../../common/customer-debt';

// =============================================
// BOSH SAHIFA — Faza 5 (rol asosidagi, sozlanadigan dashboard).
// TIZIMDAGI BARCHA MODUL bo'yicha holat + chart ma'lumotlari bitta so'rovda.
// Har bo'lim faqat chaqiruvchining ruxsati bo'lsa hisoblanadi — ruxsat
// bo'lmagan bo'lim `null` qaytadi (backend darajasida yashiriladi, frontend
// gate'iga tayanilmaydi).
//
// Bo'limlar: finance, tasks, attendance, customers, inventory, vendors,
// employees. Chartlar: 14 kunlik kirim/chiqim trendi, kanban taqsimoti,
// to'lov turlari bo'yicha kirim.
// =============================================

const TREND_DAYS = 14;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Toshkent (UTC+5) bo'yicha bugungi kun boshlanishi (UTC instant) */
  private tashkentDayStart(offsetDays = 0): Date {
    const utc5 = new Date(Date.now() + 5 * 3600000);
    const base = Date.UTC(utc5.getUTCFullYear(), utc5.getUTCMonth(), utc5.getUTCDate() + offsetDays);
    return new Date(base - 5 * 3600000);
  }

  private tashkentDateString(offsetDays = 0): string {
    const utc5 = new Date(Date.now() + 5 * 3600000 + offsetDays * 86400000);
    return utc5.toISOString().slice(0, 10);
  }

  async getSummary(tenantId: string, perms: Record<string, any>, isAdmin: boolean) {
    const can = (k: string) => isAdmin || !!perms[k];

    const [finance, tasks, attendance, customers, inventory, vendors, employees] = await Promise.all([
      can('canViewFinance') ? this.getFinanceSection(tenantId) : Promise.resolve(null),
      can('canViewTasks') ? this.getTasksSection(tenantId) : Promise.resolve(null),
      can('canViewAttendance') ? this.getAttendanceSection(tenantId) : Promise.resolve(null),
      can('canViewCustomers') ? this.getCustomersSection(tenantId) : Promise.resolve(null),
      can('canViewInventory') ? this.getInventorySection(tenantId) : Promise.resolve(null),
      can('canViewVendors') ? this.getVendorsSection(tenantId) : Promise.resolve(null),
      can('canViewEmployees') ? this.getEmployeesSection(tenantId) : Promise.resolve(null),
    ]);

    return { finance, tasks, attendance, customers, inventory, vendors, employees };
  }

  // ── MOLIYA — bugungi holat + 14 kunlik trend + to'lov turlari ──────
  private async getFinanceSection(tenantId: string) {
    const dayStart = this.tashkentDayStart();
    const trendStart = this.tashkentDayStart(-(TREND_DAYS - 1));

    const [kirim, chiqim, monthKirim, monthChiqim, trendRows, byType] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'kirim', date: { gte: dayStart } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'chiqim', date: { gte: dayStart } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'kirim', date: { gte: this.tashkentDayStart(-29) } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'chiqim', date: { gte: this.tashkentDayStart(-29) } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { tenantId, date: { gte: trendStart } },
        select: { type: true, amount: true, date: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['paymentTypeId'],
        where: { tenantId, type: 'kirim', date: { gte: this.tashkentDayStart(-29) } },
        _sum: { amount: true },
      }),
    ]);

    // 14 kunlik kirim/chiqim trendi — har kun uchun bitta nuqta
    const buckets: Record<string, { kun: string; kirim: number; chiqim: number }> = {};
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const key = this.tashkentDateString(-i);
      buckets[key] = { kun: key.slice(5), kirim: 0, chiqim: 0 };
    }
    for (const t of trendRows) {
      const utc5 = new Date(t.date.getTime() + 5 * 3600000);
      const key = utc5.toISOString().slice(0, 10);
      if (buckets[key]) {
        if (t.type === 'kirim') buckets[key].kirim += t.amount;
        else if (t.type === 'chiqim') buckets[key].chiqim += t.amount;
      }
    }

    // To'lov turlari nomlarini yig'amiz (30 kunlik kirim taqsimoti)
    const typeIds = byType.map((b) => b.paymentTypeId).filter(Boolean) as string[];
    const typeNames = typeIds.length
      ? await this.prisma.paymentType.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(typeNames.map((t) => [t.id, t.name]));
    const tolovTurlari = byType
      .map((b) => ({
        nom: b.paymentTypeId ? nameById.get(b.paymentTypeId) || 'Boshqa' : 'Belgilanmagan',
        summa: b._sum.amount || 0,
      }))
      .filter((x) => x.summa > 0)
      .sort((a, b) => b.summa - a.summa);

    const k = kirim._sum.amount || 0;
    const c = chiqim._sum.amount || 0;
    return {
      kirim: k,
      chiqim: c,
      balans: k - c,
      oylikKirim: monthKirim._sum.amount || 0,
      oylikChiqim: monthChiqim._sum.amount || 0,
      trend: Object.values(buckets),
      tolovTurlari,
    };
  }

  // ── BUYURTMALAR — sonlar + kanban ustunlari bo'yicha taqsimot ──────
  private async getTasksSection(tenantId: string) {
    const dayStart = this.tashkentDayStart();
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const now = new Date();
    const activeTask = { tenantId, isArchived: false, column: { isDone: false } } as const;

    const [yangiBugun, jarayonda, muddatiBugun, kechikkan, columns, byColumn] = await Promise.all([
      this.prisma.task.count({ where: { tenantId, isArchived: false, createdAt: { gte: dayStart } } }),
      this.prisma.task.count({ where: activeTask }),
      this.prisma.task.count({ where: { ...activeTask, deadlineAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.task.count({ where: { ...activeTask, deadlineAt: { not: null, lt: now } } }),
      this.prisma.kanbanColumn.findMany({
        where: { tenantId },
        select: { id: true, title: true, isDone: true },
        orderBy: { orderIdx: 'asc' },
      }),
      this.prisma.task.groupBy({
        by: ['columnId'],
        where: { tenantId, isArchived: false },
        _count: { id: true },
      }),
    ]);

    const countByCol = new Map(byColumn.map((b) => [b.columnId, b._count.id]));
    const bosqichlar = columns.map((c) => ({
      nom: c.title,
      soni: countByCol.get(c.id) || 0,
      tugallangan: c.isDone,
    }));

    return { yangiBugun, jarayonda, muddatiBugun, kechikkan, bosqichlar };
  }

  // ── DAVOMAT — bugungi kelganlar + 7 kunlik trend ───────────────────
  private async getAttendanceSection(tenantId: string) {
    const todayStr = this.tashkentDateString();
    const weekAgoStr = this.tashkentDateString(-6);

    const [totalEmployees, checkedIn, lateToday, weekRows] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.attendanceRecord.count({
        where: { tenantId, date: todayStr, checkIn: { not: null } },
      }),
      this.prisma.attendanceRecord.count({
        where: { tenantId, date: todayStr, lateMinutes: { gt: 0 } },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['date'],
        where: { tenantId, date: { gte: weekAgoStr }, checkIn: { not: null } },
        _count: { id: true },
      }),
    ]);

    const byDate = new Map(weekRows.map((r) => [r.date, r._count.id]));
    const trend: { kun: string; soni: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = this.tashkentDateString(-i);
      trend.push({ kun: key.slice(5), soni: byDate.get(key) || 0 });
    }

    const pct = totalEmployees > 0 ? Math.round((checkedIn / totalEmployees) * 100) : 0;
    return { totalEmployees, checkedIn, lateToday, pct, trend };
  }

  // ── MIJOZLAR — jami + qarzdorlar (eng katta 5 ta) ──────────────────
  //
  // Qarz `common/customer-debt.ts` dan olinadi — Mijozlar sahifasi bilan
  // BIR XIL manba. Ilgari bu yerda `Customer.totalDebt` ustuni yig'ilardi
  // va u to'lovlarni ayirmasdi: Bosh sahifa "33 ta qarzdor, 394 mln" desa,
  // Mijozlar sahifasi "9 ta qarzdor, 37 mln" derdi.
  private async getCustomersSection(tenantId: string) {
    const [total, qarz] = await Promise.all([
      this.prisma.customer.count({ where: { tenantId } }),
      qarzdorlarRoyxati(this.prisma, tenantId, 5),
    ]);
    return {
      total,
      qarzdorSoni: qarz.soni,
      qarzJami: qarz.jami,
      topQarzdorlar: qarz.royxat.map((c) => ({ nom: c.nom, qarz: c.qarz })),
    };
  }

  // ── OMBOR — jami material + kam qoldiq ro'yxati ────────────────────
  private async getInventorySection(tenantId: string) {
    const materials = await this.prisma.material.findMany({
      where: { tenantId },
      select: { id: true, name: true, unit: true, currentStock: true, reservedStock: true, minStock: true },
    });
    const kamQoldiq = materials
      .filter((m) => m.minStock > 0 && m.currentStock <= m.minStock)
      .sort((a, b) => a.currentStock / (a.minStock || 1) - b.currentStock / (b.minStock || 1))
      .slice(0, 5)
      .map((m) => ({ nom: m.name, qoldiq: m.currentStock, minimal: m.minStock, birlik: m.unit }));
    const bandJami = materials.reduce((s, m) => s + (m.reservedStock || 0), 0);
    return { total: materials.length, kamQoldiqSoni: kamQoldiq.length, kamQoldiq, bandJami };
  }

  // ── HAMKORLAR — jami + balans holati ───────────────────────────────
  // Balans formulasi vendors.service.ts computeTotals() bilan AYNAN bir xil:
  //   balance = (weOwe − paidByUs) − (theyOwe − paidToUs)
  //   balance > 0 → biz qarzdormiz; < 0 → hamkor bizga qarzdor.
  // Farqi: bu yerda filial emas, butun tenant bo'yicha hisoblanadi.
  private async getVendorsSection(tenantId: string) {
    const vendors = await this.prisma.vendor.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        tasks: { select: { vendorCost: true } },
        transactions: { where: { type: { in: ['chiqim', 'kirim'] } }, select: { amount: true, type: true } },
        ledgerEntries: { select: { amount: true, direction: true } },
      },
    });

    const withBalance = vendors.map((v) => {
      const tasksCost = v.tasks.reduce((s, t) => s + (Number(t.vendorCost) || 0), 0);
      const purchases = v.ledgerEntries
        .filter((l) => l.direction === 'we_owe')
        .reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const sales = v.ledgerEntries
        .filter((l) => l.direction === 'they_owe')
        .reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const paidByUs = v.transactions
        .filter((t) => t.type === 'chiqim')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const paidToUs = v.transactions
        .filter((t) => t.type === 'kirim')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const balans = (tasksCost + purchases - paidByUs) - (sales - paidToUs);
      return { nom: v.name, balans };
    });

    return {
      total: vendors.length,
      // Biz qarzdor bo'lgan summa (balans > 0 bo'lganlar yig'indisi)
      bizQarzdorJami: withBalance.reduce((s, v) => s + Math.max(0, v.balans), 0),
      // Hamkor bizga qarzdor summa (balans < 0 bo'lganlar, musbat qilib)
      ularQarzdorJami: withBalance.reduce((s, v) => s + Math.max(0, -v.balans), 0),
      qarzdorlar: withBalance
        .filter((v) => Math.round(v.balans) !== 0)
        .sort((a, b) => Math.abs(b.balans) - Math.abs(a.balans))
        .slice(0, 5),
    };
  }

  // ── XODIMLAR — jami + lavozim taqsimoti ────────────────────────────
  private async getEmployeesSection(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, role: { select: { name: true } } },
    });
    const byRole = new Map<string, number>();
    for (const e of employees) {
      const r = e.role?.name || 'Belgilanmagan';
      byRole.set(r, (byRole.get(r) || 0) + 1);
    }
    return {
      total: employees.length,
      lavozimlar: [...byRole.entries()]
        .map(([nom, soni]) => ({ nom, soni }))
        .sort((a, b) => b.soni - a.soni),
    };
  }
}
