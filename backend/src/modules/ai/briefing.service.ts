import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

// =============================================
// KUNLIK BRIFING — Faza 3 (proaktivlik).
// Agent kunni "nima muhim" bilan boshlaydi: bugungi kassa, muddati
// o'tgan/yaqin buyurtmalar, eng katta qarzdorlar, kam qoldiq materiallar.
// LLM ISHLATILMAYDI — sof aggregation, AI xabar limitiga tegmaydi.
//
// Ikki iste'molchi:
//   GET /ai/briefing        — frontend (AICopilot bo'sh holati kartasi)
//   @Cron 03:00 UTC (=08:00 Toshkent) — Telegram push adminlarga
//     (tenant SystemSetting AGENT_BRIEFING_DISABLED=true bilan o'chira oladi)
// =============================================

const DEADLINE_SOON_DAYS = 3;

export interface Briefing {
  sana: string;
  moliya: { kirim: number; chiqim: number; balans: number };
  buyurtmalar: {
    otgan_soni: number;
    otganlar: Array<{ displayId: string | null; nom: string; mijoz: string | null; muddat: Date | null }>;
    yaqin_soni: number;
    yaqinlar: Array<{ displayId: string | null; nom: string; mijoz: string | null; muddat: Date | null }>;
  };
  qarzdorlar: { soni: number; jami: number; royxat: Array<{ name: string; totalDebt: number }> };
  ombor: { soni: number; royxat: Array<{ nom: string; qoldiq: number; minimal: number; birlik: string }> };
}

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Toshkent (UTC+5) bo'yicha bugungi kun boshlanishi (UTC instant) */
  private tashkentDayStart(): Date {
    const utc5 = new Date(Date.now() + 5 * 3600000);
    return new Date(Date.UTC(utc5.getUTCFullYear(), utc5.getUTCMonth(), utc5.getUTCDate()) - 5 * 3600000);
  }

  async buildBriefing(tenantId: string): Promise<Briefing> {
    const now = new Date();
    const dayStart = this.tashkentDayStart();
    const soonUntil = new Date(now.getTime() + DEADLINE_SOON_DAYS * 86400000);

    const taskSelect = {
      displayId: true,
      orderName: true,
      title: true,
      deadlineAt: true,
      customerName: true,
      customer: { select: { name: true } },
    } as const;
    const activeTask = { tenantId, isArchived: false, column: { isDone: false } } as const;

    const [kirim, chiqim, otganlar, otganSoni, yaqinlar, yaqinSoni, debtors, debtAgg, materials] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: { tenantId, type: 'kirim', date: { gte: dayStart } },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { tenantId, type: 'chiqim', date: { gte: dayStart } },
          _sum: { amount: true },
        }),
        this.prisma.task.findMany({
          where: { ...activeTask, deadlineAt: { not: null, lt: now } },
          select: taskSelect,
          orderBy: { deadlineAt: 'asc' },
          take: 5,
        }),
        this.prisma.task.count({ where: { ...activeTask, deadlineAt: { not: null, lt: now } } }),
        this.prisma.task.findMany({
          where: { ...activeTask, deadlineAt: { gte: now, lte: soonUntil } },
          select: taskSelect,
          orderBy: { deadlineAt: 'asc' },
          take: 5,
        }),
        this.prisma.task.count({ where: { ...activeTask, deadlineAt: { gte: now, lte: soonUntil } } }),
        this.prisma.customer.findMany({
          where: { tenantId, totalDebt: { gt: 0 } },
          select: { name: true, totalDebt: true },
          orderBy: { totalDebt: 'desc' },
          take: 5,
        }),
        this.prisma.customer.aggregate({
          where: { tenantId, totalDebt: { gt: 0 } },
          _sum: { totalDebt: true },
          _count: true,
        }),
        this.prisma.material.findMany({
          where: { tenantId },
          select: { name: true, unit: true, currentStock: true, minStock: true },
        }),
      ]);

    const low = materials.filter((m) => m.minStock > 0 && m.currentStock <= m.minStock);
    const k = kirim._sum.amount || 0;
    const c = chiqim._sum.amount || 0;
    const mapTask = (t: any) => ({
      displayId: t.displayId,
      nom: t.orderName || t.title,
      mijoz: t.customer?.name || t.customerName || null,
      muddat: t.deadlineAt,
    });

    return {
      sana: new Date().toISOString(),
      moliya: { kirim: k, chiqim: c, balans: k - c },
      buyurtmalar: {
        otgan_soni: otganSoni,
        otganlar: otganlar.map(mapTask),
        yaqin_soni: yaqinSoni,
        yaqinlar: yaqinlar.map(mapTask),
      },
      qarzdorlar: {
        soni: debtAgg._count,
        jami: debtAgg._sum.totalDebt || 0,
        royxat: debtors,
      },
      ombor: {
        soni: low.length,
        royxat: low
          .slice(0, 5)
          .map((m) => ({ nom: m.name, qoldiq: m.currentStock, minimal: m.minStock, birlik: m.unit })),
      },
    };
  }

  /** Telegram uchun qisqa matn (uz-latin, Markdown) */
  private formatText(b: Briefing, tenantName: string): string {
    const fm = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
    const lines: string[] = [`🌅 *${tenantName} — kunlik brifing*`, ''];

    lines.push(`💰 Bugun: kirim ${fm(b.moliya.kirim)}, chiqim ${fm(b.moliya.chiqim)} so'm`);

    if (b.buyurtmalar.otgan_soni > 0) {
      lines.push(`🔴 Muddati o'tgan: *${b.buyurtmalar.otgan_soni} ta buyurtma*`);
      for (const t of b.buyurtmalar.otganlar.slice(0, 3)) {
        lines.push(`   • ${t.displayId ? t.displayId + ' ' : ''}${t.nom}${t.mijoz ? ` (${t.mijoz})` : ''}`);
      }
    }
    if (b.buyurtmalar.yaqin_soni > 0) {
      lines.push(`⏳ ${DEADLINE_SOON_DAYS} kun ichida muddat: ${b.buyurtmalar.yaqin_soni} ta`);
    }
    if (b.qarzdorlar.soni > 0) {
      lines.push(`💳 Qarzdorlar: ${b.qarzdorlar.soni} ta, jami *${fm(b.qarzdorlar.jami)} so'm*`);
      const top = b.qarzdorlar.royxat[0];
      if (top) lines.push(`   • Eng katta: ${top.name} — ${fm(top.totalDebt)} so'm`);
    }
    if (b.ombor.soni > 0) {
      lines.push(`📦 Kam qoldiq: ${b.ombor.soni} ta material`);
    }
    if (
      b.buyurtmalar.otgan_soni === 0 &&
      b.buyurtmalar.yaqin_soni === 0 &&
      b.qarzdorlar.soni === 0 &&
      b.ombor.soni === 0
    ) {
      lines.push('✅ Hammasi joyida — shoshilinch e\'tibor talab qiladigan narsa yo\'q.');
    }

    lines.push('', "_Batafsil: platformada Ctrl+K → Girgitton'dan so'rang._");
    return lines.join('\n');
  }

  /** Tenant tarifida AI/telegram bormi — FeatureGuard union mantiqiga mos */
  private planHasAgent(plan: any): boolean {
    if (!plan) return false;
    let features: Record<string, any> = {};
    try {
      features =
        typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features || {};
    } catch {}
    const modules: string[] = Array.isArray(plan.allowedModules) ? plan.allowedModules : [];
    const has = (f: string) => !!features[f] || modules.includes(f);
    return has('ai_chat') || has('telegram_bot') || has('advancedBot');
  }

  // 03:00 UTC = 08:00 Toshkent. Railway UTC'da ishlaydi; lokal dev'da vaqt
  // farq qiladi, lekin cron lock baribir kuniga bir marta yuborilishini kafolatlaydi.
  @Cron('0 3 * * *')
  async sendDailyBriefings() {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      include: { plan: true },
    });
    const dateStr = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

    for (const t of tenants) {
      try {
        if (!this.planHasAgent(t.plan)) continue;

        // Tenant o'chirib qo'ygan bo'lsa hurmat qilamiz
        const disabled = await this.prisma.systemSetting.findFirst({
          where: { tenantId: t.id, key: 'AGENT_BRIEFING_DISABLED' },
        });
        if (disabled && JSON.parse(disabled.value) === true) continue;

        // Multi-instance dedupe — telegram.service'dagi pattern bilan bir xil
        const gotLock = await this.telegram.acquireCronLock(t.id, `cron_lock:agent_briefing:${dateStr}`);
        if (!gotLock) continue;

        const briefing = await this.buildBriefing(t.id);
        const text = this.formatText(briefing, t.name);

        // Qabul qiluvchilar: telegram bog'langan workspace adminlar + moliya
        // ko'ra oladigan xodimlar (rahbariyat)
        const [admins, managers] = await Promise.all([
          this.prisma.workspaceAdmin.findMany({
            where: { tenantId: t.id, isActive: true, telegramId: { not: null } },
            select: { telegramId: true },
          }),
          this.prisma.employee.findMany({
            where: { tenantId: t.id, telegramId: { not: null }, role: { canViewFinance: true } },
            select: { telegramId: true },
          }),
        ]);
        const ids = new Set<string>();
        for (const a of admins) if (a.telegramId) ids.add(a.telegramId);
        for (const m of managers) if (m.telegramId) ids.add(m.telegramId);

        for (const id of ids) {
          await this.telegram.sendMessage(id, text);
        }
        if (ids.size > 0) {
          this.logger.log(`Brifing yuborildi: tenant=${t.slug ?? t.id} qabul=${ids.size}`);
        }
      } catch (e: any) {
        this.logger.warn(`Brifing xatosi tenant=${t.id}: ${e?.message}`);
      }
    }
  }
}
