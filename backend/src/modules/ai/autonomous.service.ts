import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

// =============================================
// AVTONOM FON AGENTLAR — Faza 4 (AaaS transformatsiya).
// Tenant o'zi policy belgilaydi (SystemSetting AGENT_POLICIES, Sozlamalar
// sahifasidan boshqariladi); agent foydalanuvchi so'ramasdan ishlaydi,
// lekin HAR amal AgentAction(executed) sifatida jurnalga yoziladi —
// "kim nima qildi" doim ko'rinadi.
//
// Routine'lar (LLM ISHLATILMAYDI — deterministik, xabar limitiga tegmaydi):
//   weeklyReport      — dushanba 08:30 (Toshkent) haftalik biznes hisobot
//                       Telegram'da adminlar/moliyachilarga
//   deadlineWatchdog  — har kuni 11:00 (Toshkent): muddati graceDays'dan
//                       ko'proq o'tgan buyurtmalar bo'yicha MAS'UL XODIMga
//                       shaxsiy Telegram eslatma (3 kunda bir marta / buyurtma)
// Kunlik brifing (briefing.service) ham shu policy'dan boshqariladi.
// =============================================

export interface AgentPolicies {
  dailyBriefing: { enabled: boolean };
  weeklyReport: { enabled: boolean };
  deadlineWatchdog: { enabled: boolean; graceDays: number };
}

export const DEFAULT_POLICIES: AgentPolicies = {
  dailyBriefing: { enabled: true },
  weeklyReport: { enabled: true },
  deadlineWatchdog: { enabled: true, graceDays: 1 },
};

const fm = (n: number) => Math.round(n ?? 0).toLocaleString('en-US').replace(/,/g, ' ');

/** Bir buyurtma uchun bir eslatmadan keyingi sukut davri */
const WATCHDOG_SILENCE_DAYS = 3;

@Injectable()
export class AutonomousService {
  private readonly logger = new Logger(AutonomousService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Tenant policy'sini defaults bilan birlashtirib qaytaradi */
  async readPolicies(tenantId: string): Promise<AgentPolicies> {
    try {
      const row = await this.prisma.systemSetting.findFirst({
        where: { tenantId, key: 'AGENT_POLICIES' },
      });
      if (!row) return DEFAULT_POLICIES;
      const saved = JSON.parse(row.value) || {};
      return {
        dailyBriefing: { ...DEFAULT_POLICIES.dailyBriefing, ...saved.dailyBriefing },
        weeklyReport: { ...DEFAULT_POLICIES.weeklyReport, ...saved.weeklyReport },
        deadlineWatchdog: { ...DEFAULT_POLICIES.deadlineWatchdog, ...saved.deadlineWatchdog },
      };
    } catch {
      return DEFAULT_POLICIES;
    }
  }

  /** Tarifda AI/telegram bormi — briefing.service bilan bir xil union mantiq */
  planHasAgent(plan: any): boolean {
    if (!plan) return false;
    let features: Record<string, any> = {};
    try {
      features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features || {};
    } catch {}
    const modules: string[] = Array.isArray(plan.allowedModules) ? plan.allowedModules : [];
    const has = (f: string) => !!features[f] || modules.includes(f);
    return has('ai_chat') || has('telegram_bot') || has('advancedBot');
  }

  /** Avtonom amal jurnal yozuvi — userId='autonomous' (odam emas, agent qildi) */
  private async logAction(
    tenantId: string,
    toolName: string,
    summary: string,
    input: any,
    result: any,
  ) {
    try {
      await this.prisma.agentAction.create({
        data: {
          tenantId,
          userId: 'autonomous',
          toolName,
          summary,
          input,
          result,
          status: 'executed',
          executedAt: new Date(),
        },
      });
    } catch {
      // Jurnal yozilmasa routine buzilmaydi
    }
  }

  private async agentTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      include: { plan: true },
    });
    return tenants.filter((t) => this.planHasAgent(t.plan));
  }

  /** Telegram bog'langan rahbariyat (workspace adminlar + canViewFinance xodimlar) */
  private async managementTelegramIds(tenantId: string): Promise<string[]> {
    const [admins, managers] = await Promise.all([
      this.prisma.workspaceAdmin.findMany({
        where: { tenantId, isActive: true, telegramId: { not: null } },
        select: { telegramId: true },
      }),
      this.prisma.employee.findMany({
        where: { tenantId, telegramId: { not: null }, role: { canViewFinance: true } },
        select: { telegramId: true },
      }),
    ]);
    const ids = new Set<string>();
    for (const a of admins) if (a.telegramId) ids.add(a.telegramId);
    for (const m of managers) if (m.telegramId) ids.add(m.telegramId);
    return [...ids];
  }

  // ──────────────────────────────────────────────────────────────────
  // HAFTALIK HISOBOT — dushanba 03:30 UTC (=08:30 Toshkent)
  // ──────────────────────────────────────────────────────────────────
  @Cron('30 3 * * 1')
  async sendWeeklyReports() {
    const tenants = await this.agentTenants();
    const dateStr = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

    for (const t of tenants) {
      try {
        const policies = await this.readPolicies(t.id);
        if (!policies.weeklyReport.enabled) continue;

        const gotLock = await this.telegram.acquireCronLock(t.id, `cron_lock:agent_weekly:${dateStr}`);
        if (!gotLock) continue;

        const text = await this.buildWeeklyReportText(t.id, t.name);
        const ids = await this.managementTelegramIds(t.id);
        for (const id of ids) await this.telegram.sendMessage(id, text);

        await this.logAction(
          t.id,
          'weeklyReport',
          `Haftalik hisobot ${ids.length} ta rahbarga yuborildi`,
          { dateStr },
          { recipients: ids.length },
        );
        if (ids.length > 0) this.logger.log(`Haftalik hisobot: tenant=${t.slug ?? t.id} qabul=${ids.length}`);
      } catch (e: any) {
        this.logger.warn(`Haftalik hisobot xatosi tenant=${t.id}: ${e?.message}`);
      }
    }
  }

  /** Oxirgi 7 kun bo'yicha biznes xulosa (sof aggregation) */
  async buildWeeklyReportText(tenantId: string, tenantName: string): Promise<string> {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const now = new Date();

    const [kirim, chiqim, newOrders, newOrdersSum, doneOrders, debtAgg, overdue] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'kirim', date: { gte: weekAgo } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { tenantId, type: 'chiqim', date: { gte: weekAgo } },
        _sum: { amount: true },
      }),
      this.prisma.task.count({ where: { tenantId, isArchived: false, createdAt: { gte: weekAgo } } }),
      this.prisma.task.aggregate({
        where: { tenantId, isArchived: false, createdAt: { gte: weekAgo } },
        _sum: { totalAmount: true },
      }),
      // Taxminiy: "Bajarilgan" ustunga shu hafta ko'chirilganlar (updatedAt bo'yicha)
      this.prisma.task.count({
        where: { tenantId, isArchived: false, column: { isDone: true }, updatedAt: { gte: weekAgo } },
      }),
      this.prisma.customer.aggregate({
        where: { tenantId, totalDebt: { gt: 0 } },
        _sum: { totalDebt: true },
        _count: true,
      }),
      this.prisma.task.count({
        where: {
          tenantId,
          isArchived: false,
          column: { isDone: false },
          deadlineAt: { not: null, lt: now },
        },
      }),
    ]);

    const k = kirim._sum.amount || 0;
    const c = chiqim._sum.amount || 0;
    const lines = [
      `📊 *${tenantName} — haftalik hisobot*`,
      `_${weekAgo.toLocaleDateString('uz-UZ')} — ${now.toLocaleDateString('uz-UZ')}_`,
      '',
      `💰 Kirim: *${fm(k)} so'm* | Chiqim: ${fm(c)} so'm | Farq: ${fm(k - c)} so'm`,
      `📥 Yangi buyurtmalar: ${newOrders} ta (${fm(newOrdersSum._sum.totalAmount || 0)} so'm)`,
      `✅ Bajarilgan: ~${doneOrders} ta`,
    ];
    if (overdue > 0) lines.push(`🔴 Muddati o'tgan (hozir): ${overdue} ta`);
    if (debtAgg._count > 0)
      lines.push(`💳 Qarzdorlar: ${debtAgg._count} ta, jami ${fm(debtAgg._sum.totalDebt || 0)} so'm`);
    lines.push('', "_Girgitton avtonom hisoboti. Sozlamalar → Girgitton Agent bo'limidan boshqariladi._");
    return lines.join('\n');
  }

  // ──────────────────────────────────────────────────────────────────
  // MUDDAT QO'RIQCHISI — har kuni 06:00 UTC (=11:00 Toshkent)
  // Muddati o'tgan buyurtma bo'yicha mas'ul xodimga shaxsiy eslatma.
  // Bir buyurtma uchun 3 kunda bir martadan ko'p yozilmaydi.
  // ──────────────────────────────────────────────────────────────────
  @Cron('0 6 * * *')
  async runDeadlineWatchdog() {
    const tenants = await this.agentTenants();
    const dateStr = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

    for (const t of tenants) {
      try {
        const policies = await this.readPolicies(t.id);
        if (!policies.deadlineWatchdog.enabled) continue;

        const gotLock = await this.telegram.acquireCronLock(t.id, `cron_lock:agent_watchdog:${dateStr}`);
        if (!gotLock) continue;

        const res = await this.watchdogForTenant(t.id, policies.deadlineWatchdog.graceDays);
        if (res.notified > 0) {
          await this.logAction(
            t.id,
            'deadlineWatchdog',
            `${res.taskCount} ta muddati o'tgan buyurtma bo'yicha ${res.notified} ta xodimga eslatma yuborildi`,
            { graceDays: policies.deadlineWatchdog.graceDays },
            { taskIds: res.taskIds, notified: res.notified },
          );
          this.logger.log(`Watchdog: tenant=${t.slug ?? t.id} tasks=${res.taskCount} notified=${res.notified}`);
        }
      } catch (e: any) {
        this.logger.warn(`Watchdog xatosi tenant=${t.id}: ${e?.message}`);
      }
    }
  }

  /** Bitta tenant uchun watchdog mantiqi — sinov uchun alohida metod */
  async watchdogForTenant(
    tenantId: string,
    graceDays: number,
  ): Promise<{ taskCount: number; notified: number; taskIds: string[] }> {
    const cutoff = new Date(Date.now() - Math.max(0, graceDays) * 86400000);

    // Yaqinda eslatilgan buyurtmalar — qayta yozmaymiz (spam himoyasi)
    const recent = await this.prisma.agentAction.findMany({
      where: {
        tenantId,
        toolName: 'deadlineWatchdog',
        createdAt: { gte: new Date(Date.now() - WATCHDOG_SILENCE_DAYS * 86400000) },
      },
      select: { result: true },
    });
    const alreadyReminded = new Set<string>();
    for (const r of recent) {
      const ids = (r.result as any)?.taskIds;
      if (Array.isArray(ids)) ids.forEach((id: string) => alreadyReminded.add(id));
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        tenantId,
        isArchived: false,
        column: { isDone: false },
        deadlineAt: { not: null, lt: cutoff },
      },
      select: {
        id: true,
        displayId: true,
        orderName: true,
        title: true,
        deadlineAt: true,
        assignees: true,
        customerName: true,
        customer: { select: { name: true } },
        column: { select: { title: true } },
      },
      orderBy: { deadlineAt: 'asc' },
      take: 100,
    });
    const fresh = tasks.filter((t) => !alreadyReminded.has(t.id));
    if (fresh.length === 0) return { taskCount: 0, notified: 0, taskIds: [] };

    // Xodim → uning buyurtmalari; mas'ulsizlar rahbariyatga boradi
    const byEmployee = new Map<string, typeof fresh>();
    const unassigned: typeof fresh = [];
    for (const task of fresh) {
      let ids: string[] = [];
      try {
        ids = JSON.parse(task.assignees || '[]');
      } catch {}
      if (!Array.isArray(ids) || ids.length === 0) {
        unassigned.push(task);
        continue;
      }
      for (const id of ids) {
        if (!byEmployee.has(id)) byEmployee.set(id, []);
        byEmployee.get(id)!.push(task);
      }
    }

    const taskLine = (t: (typeof fresh)[number]) => {
      const days = Math.floor((Date.now() - new Date(t.deadlineAt!).getTime()) / 86400000);
      const mijoz = t.customer?.name || t.customerName;
      return `• ${t.displayId ? t.displayId + ' ' : ''}${t.orderName || t.title}${mijoz ? ` (${mijoz})` : ''} — *${days} kun kechikdi*, holat: ${t.column.title}`;
    };

    let notified = 0;

    if (byEmployee.size > 0) {
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: [...byEmployee.keys()] }, telegramId: { not: null } },
        select: { id: true, telegramId: true, fullName: true },
      });
      for (const emp of employees) {
        const list = byEmployee.get(emp.id) || [];
        if (list.length === 0 || !emp.telegramId) continue;
        const text = [
          `⏰ *Muddat eslatmasi* — ${emp.fullName}`,
          '',
          ...list.slice(0, 5).map(taskLine),
          list.length > 5 ? `_...va yana ${list.length - 5} ta_` : '',
          '',
          '_Girgitton avtonom eslatmasi._',
        ]
          .filter(Boolean)
          .join('\n');
        await this.telegram.sendMessage(emp.telegramId, text);
        notified++;
      }
    }

    if (unassigned.length > 0) {
      const ids = await this.managementTelegramIds(tenantId);
      if (ids.length > 0) {
        const text = [
          `⚠️ *Mas'ul biriktirilmagan, muddati o'tgan buyurtmalar:*`,
          '',
          ...unassigned.slice(0, 7).map(taskLine),
          unassigned.length > 7 ? `_...va yana ${unassigned.length - 7} ta_` : '',
          '',
          '_Girgitton avtonom eslatmasi._',
        ]
          .filter(Boolean)
          .join('\n');
        for (const id of ids) await this.telegram.sendMessage(id, text);
        notified += ids.length;
      }
    }

    return { taskCount: fresh.length, notified, taskIds: fresh.map((t) => t.id) };
  }
}
