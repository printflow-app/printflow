import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AutonomousService } from './autonomous.service';

// =============================================
// XAVF-ANIQLASH XIZMATI — Faza 4 (proaktiv dashboard).
// briefing.service.ts andozasida: LLM ISHLATILMAYDI, sof Prisma
// agregatsiya/korrelyatsiya. AI xabar limitiga (AiUsage) tegmaydi.
//
// BU BITTA DETEKTOR EMAS — umumiy freymvork. Har `RiskDetector` boshqa-boshqa
// modullarni bir-biriga bog'lab tekshiradi (Kanban x Davomat, Kanban x Ombor,
// Kanban x Mijozlar...). Yangi turdagi xavfni qo'shish uchun faqat `DETECTORS`
// massiviga yangi detektor qo'shiladi — umumiy sinxronlash (dedupe/avtomatik
// yopish) mantig'i barcha detektorlar uchun BITTA joyda (`syncDetectorResults`).
//
// Umumiy qoida: detektor har chaqiruvda "hozir to'g'ri" bo'lgan xavflar
// ro'yxatini (dedupeKey bilan) qaytaradi. Shu ro'yxatda YO'Q, lekin bazada
// "open" turgan eski yozuv — shart o'zi yo'qolgan degani, avtomatik
// "resolved" bo'ladi. Foydalanuvchi "bekor qilgan" (dismissed) yozuv hech
// qachon avtomatik "open"ga qaytarilmaydi.
// =============================================

export interface RiskCandidate {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  dedupeKey: string;
  relatedTaskId?: string;
  relatedEmployeeId?: string;
  relatedCustomerId?: string;
  relatedMaterialId?: string;
}

interface RiskDetector {
  type: string;
  run: (ctx: DetectorContext) => Promise<RiskCandidate[]>;
}

interface DetectorContext {
  tenantId: string;
  dayStart: Date;
  dayEnd: Date;
  soonUntil: Date;
  todayStr: string;
}

const DEFAULT_WORK_START = { hour: 9, minute: 0 };
// Yakshanbadan boshqa kunlar — attendance.service.ts bilan bir xil sukut.
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];
const SOON_DAYS = 3; // "yaqinlashib qolgan" oyna — material yetishmovchiligi uchun

// Chegaralar — nima "muammo" hisoblanishini shu yerdan sozlash mumkin.
const OVERDUE_CRITICAL_DAYS = 7;   // shundan ko'p kechikkan buyurtma — jiddiy
const STUCK_DAYS = 10;             // ustunda qimirlamay turgan buyurtma
const STALE_DEBT_DAYS = 45;        // shuncha kundan beri qimirlamagan qarz
// Buyurtma summalari kasrli bo'lishi mumkin, shuning uchun qoldiq nolga
// aniq teng chiqmaydi (0.0000001 kabi). Chegarasiz "0 so'm qarzi bor"
// degan ma'nosiz ogohlantirish chiqardi.
const MIN_DEBT_SOM = 1;
const EXPENSE_SPIKE_RATIO = 2.5;   // o'rtachadan shuncha barobar oshsa
const MIN_DAYS_FOR_AVERAGE = 7;

@Injectable()
export class RiskDetectionService {
  private readonly logger = new Logger(RiskDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly autonomous: AutonomousService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  // Vaqt yordamchilari (briefing.service.ts bilan bir xil konvensiya)
  // ──────────────────────────────────────────────────────────────────

  private tashkentDayStart(): Date {
    const utc5 = new Date(Date.now() + 5 * 3600000);
    return new Date(Date.UTC(utc5.getUTCFullYear(), utc5.getUTCMonth(), utc5.getUTCDate()) - 5 * 3600000);
  }

  private tashkentDateString(): string {
    const utc5 = new Date(Date.now() + 5 * 3600000);
    return utc5.toISOString().slice(0, 10);
  }

  private async isPastWorkStart(): Promise<boolean> {
    const start = (await this.settings.get('workStart')) || DEFAULT_WORK_START;
    const utc5 = new Date(Date.now() + 5 * 3600000);
    const nowMins = utc5.getUTCHours() * 60 + utc5.getUTCMinutes();
    const startMins = start.hour * 60 + start.minute;
    return nowMins >= startMins;
  }

  /**
   * Bugun ish kunimi (tenant'ning `workDays` sozlamasi bo'yicha).
   *
   * Busiz dam olish kunlari "Bugun hech kim ishga kelmagan — KRITIK" degan
   * ogohlantirish chiqib turardi: hech kim kelmagani rost, lekin bu muammo
   * emas. attendance.service.ts va telegram.service.ts bu sozlamani
   * allaqachon hisobga oladi, xavf detektorlari esa e'tiborsiz qoldirardi.
   */
  private async isWorkDay(): Promise<boolean> {
    const days = (await this.settings.get('workDays')) || DEFAULT_WORK_DAYS;
    const utc5 = new Date(Date.now() + 5 * 3600000);
    return Array.isArray(days) ? days.includes(utc5.getUTCDay()) : true;
  }

  /**
   * Mijozlarning HAQIQIY qoldiq qarzi: buyurtmalar summasi − to'langan pul.
   *
   * `Customer.totalDebt` ustunini ISHLATMAYMIZ. U ikki sababga ko'ra noto'g'ri:
   *  1. Ma'nosi "jami buyurtmalar summasi", "qarz" emas — to'liq to'lagan
   *     mijoz ham katta qarzdor bo'lib ko'rinadi.
   *  2. Bu eski saqlanadigan hisoblagich bo'lib, manba yozuvlardan drift
   *     qilgan (customers.service.ts izohiga qarang).
   * Natijada AI qarzi yo'q, hatto ORTIQCHA to'lagan mijozlarni ham qarzdor
   * deb ko'rsatardi. Mijozlar sahifasi qoldiqni aynan shu yerdagidek
   * hisoblaydi — endi AI ham u bilan bir xil raqamni aytadi.
   */
  private async realBalances(tenantId: string): Promise<Map<string, number>> {
    const [orders, paid] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['customerId'],
        where: { tenantId, customerId: { not: null } },
        _sum: { totalAmount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['customerId'],
        where: { tenantId, customerId: { not: null }, type: 'kirim', isInternalTransfer: false },
        _sum: { amount: true },
      }),
    ]);
    const out = new Map<string, number>();
    for (const o of orders as any[]) {
      if (o.customerId) out.set(o.customerId, Number(o._sum.totalAmount || 0));
    }
    for (const p of paid as any[]) {
      if (!p.customerId) continue;
      out.set(p.customerId, (out.get(p.customerId) || 0) - Number(p._sum.amount || 0));
    }
    return out;
  }

  /**
   * Berilgan buyurtmalarning HAQIQIY to'lanmagan qoldig'i.
   *
   * `Task.remainingAmount` ustuni ham ishonchsiz — u ham saqlanadigan
   * hisoblagich va manbadan drift qilgan (sinovda 46 mijozdan 16 tasida
   * noto'g'ri chiqdi; masalan to'liq to'langan buyurtmada 12 500 000 so'm
   * "qoldiq" turardi).
   *
   * To'lovlar mijozning buyurtmalari bo'ylab eskisidan yangisiga qarab
   * taqsimlanadi — finance.service.ts to'lov qabul qilganda aynan shunday
   * qiladi, shuning uchun bu yerda ham xuddi shu tartib takrorlanadi.
   */
  private async realTaskRemaining(
    tenantId: string,
    taskIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (taskIds.length === 0) return out;

    const targets = await this.prisma.task.findMany({
      where: { tenantId, id: { in: taskIds } },
      select: { id: true, customerId: true, totalAmount: true, depositAmount: true },
    });

    // Mijozsiz buyurtmada taqsimlash yo'q — zakolat to'g'ridan-to'g'ri ayriladi.
    const customerIds = [...new Set(targets.map((t) => t.customerId).filter(Boolean) as string[])];
    for (const t of targets) {
      if (!t.customerId) out.set(t.id, Math.max(0, (t.totalAmount || 0) - (t.depositAmount || 0)));
    }
    if (customerIds.length === 0) return out;

    const [allTasks, payments] = await Promise.all([
      // Mijozning BARCHA buyurtmalari kerak: to'lov eskisidan boshlab
      // taqsimlanadi, shuning uchun faqat kechikkanlarini olsak taqsimot
      // noto'g'ri chiqadi.
      this.prisma.task.findMany({
        where: { tenantId, customerId: { in: customerIds } },
        select: { id: true, customerId: true, totalAmount: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.transaction.groupBy({
        by: ['customerId'],
        where: { tenantId, customerId: { in: customerIds }, type: 'kirim', isInternalTransfer: false },
        _sum: { amount: true },
      }),
    ]);

    const paidBy = new Map<string, number>();
    for (const p of payments as any[]) {
      if (p.customerId) paidBy.set(p.customerId, Number(p._sum.amount || 0));
    }
    const wanted = new Set(taskIds);
    const byCustomer = new Map<string, typeof allTasks>();
    for (const t of allTasks) {
      if (!t.customerId) continue;
      const arr = byCustomer.get(t.customerId) || [];
      arr.push(t);
      byCustomer.set(t.customerId, arr);
    }

    for (const [cid, tasks] of byCustomer) {
      let left = paidBy.get(cid) || 0;
      for (const t of tasks) {
        const total = t.totalAmount || 0;
        const applied = Math.min(total, left);
        left -= applied;
        if (wanted.has(t.id)) out.set(t.id, Math.max(0, total - applied));
      }
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 1 — Kanban x Davomat: bugun muddatli buyurtmaga tayinlangan
  // xodim bugun hali ishga kelmagan.
  // ──────────────────────────────────────────────────────────────────
  private async detectTaskAttendance(ctx: DetectorContext): Promise<RiskCandidate[]> {
    // Dam olish kunida "kelmagan" degan xulosa noto'g'ri, ish kuni
    // boshlanmasdan oldin esa erta.
    if (!(await this.isWorkDay())) return [];
    if (!(await this.isPastWorkStart())) return [];

    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        isArchived: false,
        column: { isDone: false },
        deadlineAt: { gte: ctx.dayStart, lt: ctx.dayEnd },
      },
      select: { id: true, displayId: true, orderName: true, title: true, assignees: true },
    });
    if (tasks.length === 0) return [];

    const taskAssignees = new Map<string, string[]>();
    const allEmployeeIds = new Set<string>();
    for (const t of tasks) {
      let ids: string[] = [];
      try { ids = JSON.parse(t.assignees || '[]'); } catch {}
      if (Array.isArray(ids) && ids.length > 0) {
        taskAssignees.set(t.id, ids);
        ids.forEach((id) => allEmployeeIds.add(id));
      }
    }
    if (allEmployeeIds.size === 0) return [];

    const [attendanceToday, employees] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        // `checkIn: not null` SHART: yozuv mavjudligi hali "keldi" degani
        // emas (bo'sh yozuvlar bazada uchraydi). Tizimning qolgan qismi ham
        // aynan shu shartni ishlatadi — bir xil bo'lishi kerak.
        where: {
          tenantId: ctx.tenantId,
          date: ctx.todayStr,
          employeeId: { in: [...allEmployeeIds] },
          checkIn: { not: null },
        },
        select: { employeeId: true },
      }),
      this.prisma.employee.findMany({
        where: { tenantId: ctx.tenantId, id: { in: [...allEmployeeIds] } },
        select: { id: true, fullName: true },
      }),
    ]);
    const checkedIn = new Set(attendanceToday.map((a) => a.employeeId));
    const employeeById = new Map(employees.map((e) => [e.id, e.fullName]));

    const candidates: RiskCandidate[] = [];
    for (const t of tasks) {
      const assigneeIds = taskAssignees.get(t.id) || [];
      for (const empId of assigneeIds) {
        const empName = employeeById.get(empId);
        if (!empName || checkedIn.has(empId)) continue;

        const taskLabel = t.displayId ? `${t.displayId} — ${t.orderName || t.title}` : (t.orderName || t.title);
        candidates.push({
          severity: 'warning',
          title: 'Bugungi buyurtma, xodim hali kelmagan',
          message: `"${taskLabel}" buyurtmasi bugun topshirilishi kerak, lekin unga tayinlangan ${empName} hali ishga kelmagan.`,
          dedupeKey: `task_due_no_checkin:${t.id}:${empId}`,
          relatedTaskId: t.id,
          relatedEmployeeId: empId,
        });
      }
    }
    return candidates;
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 2 — Kanban x Ombor: muddati yaqinlashgan buyurtma uchun
  // kerakli xom-ashyo omborda yetarli emas (BOM normasi bo'yicha).
  // ──────────────────────────────────────────────────────────────────
  private async detectMaterialShortage(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        isArchived: false,
        column: { isDone: false },
        deadlineAt: { gte: new Date(), lte: ctx.soonUntil },
        serviceId: { not: null },
      },
      select: {
        id: true, displayId: true, orderName: true, title: true, quantity: true,
        service: {
          select: {
            materials: {
              select: {
                normPerUnit: true,
                material: { select: { id: true, name: true, unit: true, currentStock: true, reservedStock: true } },
              },
            },
          },
        },
      },
      take: 50,
    });

    const candidates: RiskCandidate[] = [];
    for (const t of tasks) {
      for (const bom of t.service?.materials || []) {
        const needed = bom.normPerUnit * t.quantity;
        const available = bom.material.currentStock - bom.material.reservedStock;
        if (available >= needed) continue;

        const taskLabel = t.displayId ? `${t.displayId} — ${t.orderName || t.title}` : (t.orderName || t.title);
        candidates.push({
          severity: 'critical',
          title: 'Buyurtma uchun material yetarli emas',
          message: `"${taskLabel}" buyurtmasi uchun ${bom.material.name} kerak (${needed.toLocaleString('uz-UZ')} ${bom.material.unit}), lekin omborda ${Math.max(0, available).toLocaleString('uz-UZ')} ${bom.material.unit} qoldi.`,
          dedupeKey: `task_material_shortage:${t.id}:${bom.material.id}`,
          relatedTaskId: t.id,
          relatedMaterialId: bom.material.id,
        });
      }
    }
    return candidates;
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 3 — Kanban x Mijozlar/Moliya: qarzdor mijozga yangi
  // (so'nggi 24 soatda yaratilgan) faol buyurtma berilgan.
  // ──────────────────────────────────────────────────────────────────
  private async detectDebtorNewOrder(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const since = new Date(Date.now() - 24 * 3600000);
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        isArchived: false,
        column: { isDone: false },
        createdAt: { gte: since },
        customerId: { not: null },
      },
      select: {
        id: true, displayId: true, orderName: true, title: true, totalAmount: true,
        customer: { select: { id: true, name: true } },
      },
      take: 50,
    });
    if (tasks.length === 0) return [];

    const balances = await this.realBalances(ctx.tenantId);

    return tasks
      .filter((t) => t.customer)
      .map((t): RiskCandidate | null => {
        // YANGI buyurtmaning o'zi ham qoldiqqa kirgan. Uni ayirmasak har
        // yangi buyurtma avtomatik "qarzdorga buyurtma berildi" bo'lib
        // chiqardi — mijoz avval qarzsiz bo'lsa ham.
        const oldDebt = (balances.get(t.customer!.id) || 0) - (t.totalAmount || 0);
        if (oldDebt < MIN_DEBT_SOM) return null;

        const taskLabel = t.displayId ? `${t.displayId} — ${t.orderName || t.title}` : (t.orderName || t.title);
        return {
          severity: 'info' as const,
          title: 'Qarzdor mijozga yangi buyurtma',
          message: `${t.customer!.name} mijozining oldingi ${Math.round(oldDebt).toLocaleString('uz-UZ')} so'm to'lanmagan qarzi bor, lekin unga yangi "${taskLabel}" buyurtmasi berilgan.`,
          dedupeKey: `debtor_new_order:${t.id}:${t.customer!.id}`,
          relatedTaskId: t.id,
          relatedCustomerId: t.customer!.id,
        };
      })
      .filter((c): c is RiskCandidate => c !== null);
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 4 — Kanban: muddati o'tgan buyurtmalar.
  //
  // Bu ALOHIDA karta emas, YIG'MA karta: 12 ta kechikish 12 ta kartaga
  // bo'linsa dashboard'ni bosib ketadi va hech kim o'qimaydi. Bitta kartada
  // umumiy son + eng eskisi ko'rsatiladi, tafsilotni AI'dan so'rash mumkin.
  // ──────────────────────────────────────────────────────────────────
  private async detectOverdueTasks(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        isArchived: false,
        column: { isDone: false },
        deadlineAt: { lt: ctx.dayStart },
      },
      select: { id: true, displayId: true, orderName: true, title: true, deadlineAt: true, remainingAmount: true },
      orderBy: { deadlineAt: 'asc' },
    });
    if (tasks.length === 0) return [];

    const oldest = tasks[0];
    const daysLate = Math.floor((ctx.dayStart.getTime() - oldest.deadlineAt!.getTime()) / 86400000);
    const remaining = await this.realTaskRemaining(ctx.tenantId, tasks.map((t) => t.id));
    const frozenMoney = tasks.reduce((s, t) => s + (remaining.get(t.id) ?? 0), 0);
    const oldestLabel = oldest.displayId
      ? `${oldest.displayId} — ${oldest.orderName || oldest.title}`
      : oldest.orderName || oldest.title;

    const moneyPart = frozenMoney > 0
      ? ` Ularda jami ${Math.round(frozenMoney).toLocaleString('uz-UZ')} so'm to'lanmagan qoldiq turibdi.`
      : '';

    return [{
      severity: daysLate >= OVERDUE_CRITICAL_DAYS ? 'critical' : 'warning',
      title: `${tasks.length} ta buyurtma muddati o'tgan`,
      message:
        `Eng eskisi — "${oldestLabel}", muddatidan ${daysLate} kun o'tgan va hali "bajarildi" ustuniga ko'chirilmagan.${moneyPart}`,
      // Kalit songa bog'liq emas — holat o'zgarsa xabar yangilanadi, yangi karta ochilmaydi.
      dedupeKey: 'overdue_tasks:summary',
      relatedTaskId: oldest.id,
    }];
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 5 — Davomat: ish kuni boshlangan, lekin hech kim (yoki juda
  // kam odam) kelmagan. Aynan shu holat ilgari umuman aniqlanmasdi.
  // ──────────────────────────────────────────────────────────────────
  private async detectAttendanceGap(ctx: DetectorContext): Promise<RiskCandidate[]> {
    if (!(await this.isWorkDay())) return [];
    if (!(await this.isPastWorkStart())) return [];

    const [total, present] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId: ctx.tenantId } }),
      this.prisma.attendanceRecord.count({
        where: { tenantId: ctx.tenantId, date: ctx.todayStr, checkIn: { not: null } },
      }),
    ]);
    if (total === 0) return [];

    // Faol buyurtmalar bor-yo'qligi muhim: ish yo'q bo'lsa bo'sh ofis muammo emas.
    const activeTasks = await this.prisma.task.count({
      where: { tenantId: ctx.tenantId, isArchived: false, column: { isDone: false } },
    });

    if (present === 0) {
      return [{
        severity: activeTasks > 0 ? 'critical' : 'warning',
        title: 'Bugun hech kim ishga kelmagan',
        message:
          `Ish vaqti boshlandi, lekin ${total} ta xodimdan birortasi ham davomat belgilamagan.` +
          (activeTasks > 0 ? ` Ayni paytda ${activeTasks} ta buyurtma jarayonda turibdi.` : ''),
        dedupeKey: `attendance_nobody:${ctx.todayStr}`,
      }];
    }

    // Yarmidan kami kelgan bo'lsa ham ogohlantiramiz (3 va undan ortiq jamoada).
    if (total >= 3 && present * 2 < total) {
      return [{
        severity: 'warning',
        title: 'Davomat sezilarli past',
        message: `Bugun ${total} ta xodimdan faqat ${present} tasi ishga kelgan.`,
        dedupeKey: `attendance_low:${ctx.todayStr}`,
      }];
    }
    return [];
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 6 — Kanban: buyurtma uzoq vaqtdan beri qimirlamayapti
  // (muddati hali o'tmagan, lekin ustunda qotib qolgan).
  // ──────────────────────────────────────────────────────────────────
  private async detectStuckTasks(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const threshold = new Date(Date.now() - STUCK_DAYS * 86400000);
    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        isArchived: false,
        column: { isDone: false },
        updatedAt: { lt: threshold },
        // Muddati o'tganlar 4-detektorda hisobga olinadi — takrorlamaymiz.
        OR: [{ deadlineAt: null }, { deadlineAt: { gte: ctx.dayStart } }],
      },
      select: {
        id: true, displayId: true, orderName: true, title: true, updatedAt: true,
        column: { select: { title: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
    if (tasks.length === 0) return [];

    const oldest = tasks[0];
    const days = Math.floor((Date.now() - oldest.updatedAt.getTime()) / 86400000);
    const label = oldest.displayId
      ? `${oldest.displayId} — ${oldest.orderName || oldest.title}`
      : oldest.orderName || oldest.title;

    return [{
      severity: 'warning',
      title:
        tasks.length === 1
          ? 'Buyurtma qimirlamayapti'
          : `${tasks.length} ta buyurtma qimirlamayapti`,
      message:
        `"${label}" ${days} kundan beri "${oldest.column?.title || 'ustun'}" ustunida turibdi va hech kim qimirlatmagan.`,
      dedupeKey: 'stuck_tasks:summary',
      relatedTaskId: oldest.id,
    }];
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 7 — Mijozlar x Moliya: uzoq vaqtdan beri qimirlamagan qarz.
  // ──────────────────────────────────────────────────────────────────
  private async detectStaleDebt(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const threshold = new Date(Date.now() - STALE_DEBT_DAYS * 86400000);
    const [rows, balances] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId: ctx.tenantId, updatedAt: { lt: threshold } },
        select: { id: true, name: true, updatedAt: true },
      }),
      this.realBalances(ctx.tenantId),
    ]);

    // Faqat HAQIQATDA qoldiq qarzi borlar. Ilgari bu yerda ham
    // `totalDebt > 0` ishlatilardi — natijada to'liq hisob-kitob qilgan
    // mijozlar ham "eskirgan qarz" ro'yxatiga tushardi.
    const debtors = rows
      .map((c) => ({ ...c, qarz: balances.get(c.id) || 0 }))
      .filter((c) => c.qarz >= MIN_DEBT_SOM)
      .sort((a, b) => b.qarz - a.qarz);
    if (debtors.length === 0) return [];

    const total = debtors.reduce((s, c) => s + c.qarz, 0);
    const top = debtors[0];
    const days = Math.floor((Date.now() - top.updatedAt.getTime()) / 86400000);

    return [{
      severity: 'warning',
      title: `${debtors.length} ta mijozda eskirgan qarz`,
      message:
        `Jami ${Math.round(total).toLocaleString('uz-UZ')} so'm to'lanmagan qarz ${STALE_DEBT_DAYS} kundan beri qimirlamagan. ` +
        `Eng kattasi — ${top.name}, ${Math.round(top.qarz).toLocaleString('uz-UZ')} so'm, ${days} kundan beri o'zgarish yo'q.`,
      dedupeKey: 'stale_debt:summary',
      relatedCustomerId: top.id,
    }];
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 8 — Ombor: minimal chegaradan tushgan materiallar
  // (buyurtmaga bog'liq bo'lmagan holda ham).
  // ──────────────────────────────────────────────────────────────────
  private async detectLowStock(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const materials = await this.prisma.material.findMany({
      where: { tenantId: ctx.tenantId, minStock: { gt: 0 } },
      select: { id: true, name: true, unit: true, currentStock: true, minStock: true },
    });
    const low = materials.filter((m) => m.currentStock <= m.minStock);
    if (low.length === 0) return [];

    const worst = low.reduce((a, b) =>
      a.currentStock / (a.minStock || 1) <= b.currentStock / (b.minStock || 1) ? a : b,
    );

    return [{
      severity: low.some((m) => m.currentStock <= 0) ? 'critical' : 'warning',
      title: low.length === 1 ? 'Material tugab qolyapti' : `${low.length} ta material tugab qolyapti`,
      message:
        `Eng kritigi — ${worst.name}: omborda ${worst.currentStock.toLocaleString('uz-UZ')} ${worst.unit} qoldi, ` +
        `minimal chegara ${worst.minStock.toLocaleString('uz-UZ')} ${worst.unit}.`,
      dedupeKey: 'low_stock:summary',
      relatedMaterialId: worst.id,
    }];
  }

  // ──────────────────────────────────────────────────────────────────
  // DETEKTOR 9 — Moliya: bugungi chiqim odatdagidan keskin oshgan.
  // ──────────────────────────────────────────────────────────────────
  private async detectExpenseSpike(ctx: DetectorContext): Promise<RiskCandidate[]> {
    const since = new Date(ctx.dayStart.getTime() - 30 * 86400000);
    const [todayAgg, history] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId: ctx.tenantId, type: 'chiqim', isInternalTransfer: false, date: { gte: ctx.dayStart, lt: ctx.dayEnd } },
        _sum: { amount: true },
      }),
      // Kunlarni ajratish uchun sanalar kerak — bu 30 kunlik oyna, hajmi kichik.
      this.prisma.transaction.findMany({
        where: { tenantId: ctx.tenantId, type: 'chiqim', isInternalTransfer: false, date: { gte: since, lt: ctx.dayStart } },
        select: { amount: true, date: true },
      }),
    ]);

    const today = todayAgg._sum.amount || 0;
    if (today <= 0) return [];

    // O'rtachani HAQIQIY chiqim bo'lgan kunlar soniga bo'lamiz.
    //
    // Ilgari bu yerda ikki xato bor edi:
    //  1. `_count` tranzaksiyalar sonini qaytaradi, kunlar sonini emas —
    //     bir kunda qilingan 7 ta chiqim "7 kunlik tarix" deb qabul qilinardi.
    //  2. Yig'indi doim 30 ga bo'linardi. Yangi workspace'da (masalan 4 kunlik
    //     tarix) o'rtacha 26 ta bo'sh kun hisobiga sun'iy pasayib, oddiy
    //     chiqim ham "odatdagidan 2.5 barobar ko'p" bo'lib chiqardi.
    const dayTotals = new Map<string, number>();
    for (const tx of history) {
      const key = new Date(tx.date.getTime() + 5 * 3600000).toISOString().slice(0, 10);
      dayTotals.set(key, (dayTotals.get(key) || 0) + (tx.amount || 0));
    }
    if (dayTotals.size < MIN_DAYS_FOR_AVERAGE) return [];

    const sum = [...dayTotals.values()].reduce((a, b) => a + b, 0);
    const dailyAvg = sum / dayTotals.size;
    if (dailyAvg <= 0 || today < dailyAvg * EXPENSE_SPIKE_RATIO) return [];

    return [{
      severity: 'warning',
      title: 'Bugungi chiqim odatdagidan yuqori',
      message:
        `Bugun ${Math.round(today).toLocaleString('uz-UZ')} so'm chiqim bo'ldi — so'nggi ${dayTotals.size} kunlik o'rtacha ` +
        `${Math.round(dailyAvg).toLocaleString('uz-UZ')} so'mdan ${(today / dailyAvg).toFixed(1)} barobar ko'p.`,
      dedupeKey: `expense_spike:${ctx.todayStr}`,
    }];
  }

  private readonly DETECTORS: RiskDetector[] = [
    // Buyurtmalar
    { type: 'overdue_tasks', run: (ctx) => this.detectOverdueTasks(ctx) },
    { type: 'stuck_tasks', run: (ctx) => this.detectStuckTasks(ctx) },
    { type: 'task_due_no_checkin', run: (ctx) => this.detectTaskAttendance(ctx) },
    // Davomat
    { type: 'attendance_gap', run: (ctx) => this.detectAttendanceGap(ctx) },
    // Ombor
    { type: 'low_stock', run: (ctx) => this.detectLowStock(ctx) },
    { type: 'task_material_shortage', run: (ctx) => this.detectMaterialShortage(ctx) },
    // Mijozlar va moliya
    { type: 'debtor_new_order', run: (ctx) => this.detectDebtorNewOrder(ctx) },
    { type: 'stale_debt', run: (ctx) => this.detectStaleDebt(ctx) },
    { type: 'expense_spike', run: (ctx) => this.detectExpenseSpike(ctx) },
  ];

  /** Barcha detektorlarni ishga tushiradi va natijalarni AiInsight bilan sinxronlaydi */
  private async runAllDetectors(tenantId: string): Promise<void> {
    const policies = await this.autonomous.readPolicies(tenantId);
    if (!policies.riskMonitoring.enabled) return;

    const dayStart = this.tashkentDayStart();
    const ctx: DetectorContext = {
      tenantId,
      dayStart,
      dayEnd: new Date(dayStart.getTime() + 86400000),
      soonUntil: new Date(Date.now() + SOON_DAYS * 86400000),
      todayStr: this.tashkentDateString(),
    };

    for (const detector of this.DETECTORS) {
      try {
        const candidates = await detector.run(ctx);
        await this.syncDetectorResults(tenantId, detector.type, candidates);
      } catch (e: any) {
        this.logger.warn(`Detektor xatosi (${detector.type}) tenant=${tenantId}: ${e?.message}`);
      }
    }
  }

  /**
   * Bitta detektor turining natijalarini AiInsight bilan sinxronlaydi:
   * hozir to'g'ri bo'lganlarni yozadi/yangilaydi (dismissed/resolved'ni
   * tiklamasdan), va endi to'g'ri bo'lmay qolganlarini avtomatik yopadi.
   */
  private async syncDetectorResults(tenantId: string, type: string, candidates: RiskCandidate[]): Promise<void> {
    const activeDedupeKeys = candidates.map((c) => c.dedupeKey);

    for (const c of candidates) {
      const existing = await this.prisma.aiInsight.findUnique({
        where: { tenantId_dedupeKey: { tenantId, dedupeKey: c.dedupeKey } },
      });
      if (existing && existing.status !== 'open') continue; // dismissed/resolved — qayta tiklamaymiz

      await this.prisma.aiInsight.upsert({
        where: { tenantId_dedupeKey: { tenantId, dedupeKey: c.dedupeKey } },
        create: {
          tenantId,
          type,
          severity: c.severity,
          title: c.title,
          message: c.message,
          relatedTaskId: c.relatedTaskId,
          relatedEmployeeId: c.relatedEmployeeId,
          relatedCustomerId: c.relatedCustomerId,
          relatedMaterialId: c.relatedMaterialId,
          dedupeKey: c.dedupeKey,
          status: 'open',
        },
        update: {
          severity: c.severity,
          title: c.title,
          message: c.message,
        },
      });
    }

    // Shart endi to'g'ri emas (yoki umuman candidate yo'q) — eski yozuvlarni yopamiz.
    //
    // DIQQAT: bu yerda faqat 'open' emas, 'dismissed' ham 'resolved' ga o'tadi.
    // Sabab: yig'ma kartalar (masalan "muddati o'tgan buyurtmalar") turg'un
    // dedupeKey ishlatadi. Agar dismissed yozuv shundayligicha qolsa, muammo
    // bir marta yo'qolib keyin QAYTA paydo bo'lganda ham yuqoridagi tekshiruv
    // uni "dismissed" deb o'tkazib yuborar va xavf boshqa hech qachon
    // ko'rinmasdi. Endi "e'tiborsiz qoldirish" — "muammo o'tib ketguncha
    // yashir" degani: shart yo'qolsa yozuv yopiladi, qaytsa yangisi ochiladi.
    await this.prisma.aiInsight.updateMany({
      where: {
        tenantId,
        type,
        status: { in: ['open', 'dismissed'] },
        dedupeKey: { notIn: activeDedupeKeys },
      },
      data: { status: 'resolved' },
    });
  }

  /** Tenant uchun ochiq (open) xavflar ro'yxati — dashboard/AICopilot shuni ko'rsatadi */
  async listOpenRisks(tenantId: string) {
    await this.runAllDetectors(tenantId).catch((e) =>
      this.logger.warn(`Xavf-aniqlash xatosi tenant=${tenantId}: ${e?.message}`),
    );
    const rows = await this.prisma.aiInsight.findMany({
      where: { tenantId, status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    // Prisma orderBy severity'ni alifbo bo'yicha saralaydi (critical < info < warning) —
    // haqiqiy ustuvorlik uchun JS'da qayta saralaymiz.
    const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return rows.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
  }

  /** Xavfni bekor qilish (foydalanuvchi "e'tiborsiz qoldirish" bosganda) */
  async dismissRisk(tenantId: string, insightId: string) {
    return this.prisma.aiInsight.updateMany({
      where: { id: insightId, tenantId },
      data: { status: 'dismissed' },
    });
  }
}
