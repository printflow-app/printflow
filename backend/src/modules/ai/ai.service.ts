import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { FinanceService } from '../finance/finance.service';
import { TelegramService } from '../telegram/telegram.service';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { createHash, randomUUID } from 'crypto';
import { resolveEffectivePlan } from '../../common/effective-plan';
import { ToolContext } from './tools/types';
import {
  buildAiSdkTools,
  describeConfirmTools,
  executeConfirmedAction,
  rejectAction,
} from './tools/registry';
import {
  decideKb,
  kbContextText,
  kbIndexText,
  normalizeQuestion,
  KbDecision,
} from './knowledge/guide-kb';

// claude-haiku-4-5 narxi — $/1M token (Anthropic, 2026-07 holatiga ko'ra).
// O'zgarsa shu ikki qiymatni yangilash kifoya.
const HAIKU_PRICE_PER_M_INPUT = 1.0;
const HAIKU_PRICE_PER_M_OUTPUT = 5.0;

// Prompt caching koeffitsientlari (Anthropic): keshdan o'qish 0.1x,
// keshga yozish 5 daqiqalik TTL'da 1.25x, 1 soatlikda 2x.
// SDK ikkala TTL'ni bitta `cacheWriteTokens` raqamiga qo'shib beradi, ularni
// ajratib bo'lmaydi. Shuning uchun QIMMATROG'INI (2x) olamiz — hisob-kitobda
// xarajatni kam ko'rsatgandan ko'ra biroz oshirib ko'rsatgan xavfsizroq.
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 2.0;

// Keshlangan javob shu muddatdan keyin eskiradi. Faqat jonli ma'lumotga
// bog'liq bo'lmagan ("qanday qilaman" turidagi) javoblar keshlangani uchun
// 30 kun xavfsiz — qo'llanma o'zgarsa ham eng ko'pi shuncha kutiladi.
const ANSWER_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Xavf kartasi bosilganda beriladigan YAGONA javob.
//
// AI bu yerda yechim taklif qilmaydi va tahlil ham qilmaydi — xavf tafsiloti
// dashboard'da allaqachon hisoblangan va foydalanuvchi uni ko'rib turibdi.
// Kerak bo'lgani faqat shu savol. Foydalanuvchi nima qilishni o'zi aytadi,
// AI shundan keyingina ishga tushadi (odatdagi chat oqimi bilan).
//
// Shu sababli bu javob uchun model umuman chaqirilmaydi: darhol keladi,
// pul turmaydi va AI so'rov limitidan hisoblanmaydi.
const RISK_QUESTION = "Buning uchun nima qilishimni xohlaysiz?";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropicClient: any;
  private static readonly PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun

  /** Toshkent (UTC+5) bo'yicha bugungi kun "YYYY-MM-DD" ko'rinishida. */
  private tashkentDateString(d: Date = new Date()): string {
    const utc5 = new Date(d.getTime() + 5 * 3600000);
    return utc5.toISOString().slice(0, 10);
  }

  /** Toshkent bo'yicha ertangi kun boshlanishi (UTC instant) — kunlik limit reset vaqti. */
  private nextTashkentMidnight(): Date {
    const utc5 = new Date(Date.now() + 5 * 3600000);
    const nextDayUtc5 = Date.UTC(utc5.getUTCFullYear(), utc5.getUTCMonth(), utc5.getUTCDate() + 1);
    return new Date(nextDayUtc5 - 5 * 3600000);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly financeService: FinanceService,
    private readonly telegramService: TelegramService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      this.logger.error('══ KRITIK: ANTHROPIC_API_KEY topilmadi! ══');
    }
    this.anthropicClient = createAnthropic({ apiKey });
  }

  /**
   * Tenant uchun joriy 30-kunlik AI davrining boshlanish sanasini hisoblaydi.
   * Anchor: agar tenant.subscriptionEndsAt va plan.durationDays mavjud bo'lsa —
   * subscriptionEndsAt - durationDays (obuna boshlangan kun). Aks holda createdAt.
   * Davr har 30 kunda anchor'dan boshlab takrorlanadi.
   */
  /**
   * Platforma bo'ylab YAGONA AI limiti (super admin sozlaydi).
   *
   * PlatformSetting'da `AI_LIMITS` kaliti: { perMonth, perDay }. 0 = cheksiz.
   * Kalit yo'q bo'lsa null qaytadi va eski tarif qiymati ishlaydi — shunda
   * sozlanmagan platformada xulq o'zgarmaydi.
   *
   * 60 soniya keshlanadi: qiymat har AI so'rovda o'qiladi, lekin deyarli
   * hech qachon o'zgarmaydi.
   */
  private aiLimitsCache: { at: number; val: { perMonth: number | null; perDay: number | null } } | null = null;

  private async platformAiLimits(): Promise<{ perMonth: number | null; perDay: number | null }> {
    if (this.aiLimitsCache && Date.now() - this.aiLimitsCache.at < 60_000) {
      return this.aiLimitsCache.val;
    }
    let val: { perMonth: number | null; perDay: number | null } = { perMonth: null, perDay: null };
    try {
      const row = await this.prisma.platformSetting.findUnique({ where: { key: 'AI_LIMITS' } });
      if (row) {
        const parsed = JSON.parse(row.value || '{}');
        val = {
          perMonth: Number.isFinite(Number(parsed.perMonth)) ? Number(parsed.perMonth) : null,
          perDay: Number.isFinite(Number(parsed.perDay)) ? Number(parsed.perDay) : null,
        };
      }
    } catch {
      // Sozlama buzuq bo'lsa tarif qiymatiga qaytamiz — AI to'xtab qolmasin.
    }
    this.aiLimitsCache = { at: Date.now(), val };
    return val;
  }

  private getCurrentPeriodStart(tenant: {
    createdAt: Date;
    subscriptionEndsAt: Date | null;
    plan: { durationDays: number } | null;
  }): Date {
    let anchorMs: number;
    if (tenant.subscriptionEndsAt && tenant.plan?.durationDays) {
      anchorMs = tenant.subscriptionEndsAt.getTime() - tenant.plan.durationDays * 86400000;
    } else {
      anchorMs = tenant.createdAt.getTime();
    }

    // LANGAR KELAJAKDA BO'LSA — uni butun davrlar bilan orqaga suramiz.
    //
    // Langar obuna TUGASH sanasidan hisoblanadi. Obuna qo'lda uzoqqa
    // cho'zilgan bo'lsa (masalan 2030-yil), langar bugundan keyin tushadi:
    // `elapsed` manfiy chiqib 0 ga qisiladi, `periods` doim 0 bo'ladi va
    // davr HECH QACHON almashmaydi. Natijada AI hisoblagichi oylar davomida
    // to'planib, foydalanuvchi shu oy AI ishlatmagan bo'lsa ham "limit
    // tugadi" xabarini oladi. Orqaga surish davr chegaralarini obuna
    // sikliga mos saqlaydi, lekin joriy davr har doim bugunni o'z ichiga
    // oladi.
    if (anchorMs > Date.now()) {
      const back = Math.ceil((anchorMs - Date.now()) / AiService.PERIOD_MS);
      anchorMs -= back * AiService.PERIOD_MS;
    }

    const elapsed = Math.max(0, Date.now() - anchorMs);
    const periods = Math.floor(elapsed / AiService.PERIOD_MS);
    return new Date(anchorMs + periods * AiService.PERIOD_MS);
  }

  /**
   * Tenant'ning joriy davrdagi AI foydalanishini qaytaradi.
   * { used, limit, periodStart, periodEnd, unlimited }
   * unlimited = true bo'lsa limit qo'llanmaydi (0 = cheksiz konvensiya).
   */
  async getUsage(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant) throw new Error('Tenant topilmadi');

    // Tarif biriktirilmagan bo'lsa platformaning standart tarifi olinadi.
    // Aks holda `?? 0` ishlab ketardi, 0 esa "cheksiz" degani — ya'ni
    // tarifsiz workspace cheksiz AI ishlatib yuborardi.
    const plan = await resolveEffectivePlan(this.prisma, tenant);

    // Ko'rsatiladigan limit ham hisobga olinadigani BILAN BIR XIL manbadan
    // bo'lishi kerak — aks holda chatda "0/100" ko'rinib, aslida boshqa son
    // bo'yicha to'sib qo'yilardi.
    const uniform = await this.platformAiLimits();
    const limit = uniform.perMonth ?? plan?.aiMessagesPerMonth ?? 0;
    const unlimited = limit === 0;
    const periodStart = this.getCurrentPeriodStart(tenant);
    const periodEnd = new Date(periodStart.getTime() + AiService.PERIOD_MS);

    const dailyLimit = uniform.perDay ?? plan?.aiMessagesPerDay ?? 0;
    const dailyUnlimited = dailyLimit === 0;
    const today = this.tashkentDateString();

    const [usage, dailyUsage] = await Promise.all([
      this.prisma.aiUsage.findUnique({
        where: { tenantId_periodStart: { tenantId, periodStart } },
      }),
      this.prisma.aiUsageDaily.findUnique({
        where: { tenantId_date: { tenantId, date: today } },
      }),
    ]);

    return {
      used: usage?.count ?? 0,
      limit,
      unlimited,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      daily: {
        used: dailyUsage?.count ?? 0,
        limit: dailyLimit,
        unlimited: dailyUnlimited,
        resetAt: this.nextTashkentMidnight().toISOString(),
      },
      extraCredits: tenant.aiExtraCredits,
    };
  }

  /**
   * Ikkita mustaqil limitni (kunlik + 30-kunlik) tekshiradi va to'g'ri kelsa
   * ikkalasini ham 1 ga oshiradi. Ikkalasidan biri to'lsa — tenant'ning
   * qo'shimcha kredit zaxirasi (aiExtraCredits) bor-yo'qligi tekshiriladi;
   * bor bo'lsa 1 dona sarflab xabar yuboriladi. Yo'q bo'lsa — rad etiladi va
   * ikkala hisoblagich ham orqaga qaytariladi (idempotent rollback).
   * Avtonom/fon jarayonlar (masalan xavf-aniqlash) bu metodni umuman
   * chaqirmaydi — faqat interaktiv chat xabari shu yerdan o'tadi.
   */
  private async checkAndIncrementUsage(tenantId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    unlimited: boolean;
    reason?: 'daily' | 'monthly';
    resetAt?: string;
    viaCredit?: boolean;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant) return { allowed: false, used: 0, limit: 0, unlimited: false };

    const plan = await resolveEffectivePlan(this.prisma, tenant);

    // AI limiti TARIFDAN OLINMAYDI.
    //
    // Endi yagona tarif modeli: hamma workspace bir xil limitda bo'lishi
    // kerak, kerak bo'lsa qo'shimcha paket sotib oladi. Limit tarifga
    // bog'langanda esa har workspace o'zi ulangan tarif qatoriga qarab
    // boshqa-boshqa limit olardi (biriga 100, biriga cheksiz) — bu adolatsiz
    // va tushuntirib bo'lmaydigan holat edi.
    const uniform = await this.platformAiLimits();
    const monthlyLimit = uniform.perMonth ?? plan?.aiMessagesPerMonth ?? 0;
    const monthlyUnlimited = monthlyLimit === 0;
    const periodStart = this.getCurrentPeriodStart(tenant);

    const dailyLimit = uniform.perDay ?? plan?.aiMessagesPerDay ?? 0;
    const dailyUnlimited = dailyLimit === 0;
    const today = this.tashkentDateString();

    // Cheksiz bo'lsa ham hisoblab boramiz — keyin analitika uchun foydali.
    const [monthlyResult, dailyResult] = await Promise.all([
      this.prisma.aiUsage.upsert({
        where: { tenantId_periodStart: { tenantId, periodStart } },
        create: { tenantId, periodStart, count: 1 },
        update: { count: { increment: 1 } },
      }),
      this.prisma.aiUsageDaily.upsert({
        where: { tenantId_date: { tenantId, date: today } },
        create: { tenantId, date: today, count: 1 },
        update: { count: { increment: 1 } },
      }),
    ]);

    const monthlyOk = monthlyUnlimited || monthlyResult.count <= monthlyLimit;
    const dailyOk = dailyUnlimited || dailyResult.count <= dailyLimit;

    if (monthlyOk && dailyOk) {
      return { allowed: true, used: dailyResult.count, limit: dailyLimit, unlimited: dailyUnlimited };
    }

    // Limitlardan biri to'lgan — qo'shimcha kredit bor-yo'qligini tekshiramiz.
    const creditSpend = await this.prisma.tenant.updateMany({
      where: { id: tenantId, aiExtraCredits: { gt: 0 } },
      data: { aiExtraCredits: { decrement: 1 } },
    });
    if (creditSpend.count === 1) {
      return { allowed: true, used: dailyResult.count, limit: dailyLimit, unlimited: dailyUnlimited, viaCredit: true };
    }

    // Kredit ham yo'q — ikkala hisoblagichni ham orqaga qaytaramiz.
    await Promise.all([
      this.prisma.aiUsage.update({
        where: { tenantId_periodStart: { tenantId, periodStart } },
        data: { count: { decrement: 1 } },
      }),
      this.prisma.aiUsageDaily.update({
        where: { tenantId_date: { tenantId, date: today } },
        data: { count: { decrement: 1 } },
      }),
    ]);

    if (!dailyOk) {
      return {
        allowed: false, used: dailyLimit, limit: dailyLimit, unlimited: false,
        reason: 'daily', resetAt: this.nextTashkentMidnight().toISOString(),
      };
    }
    return {
      allowed: false, used: monthlyLimit, limit: monthlyLimit, unlimited: false,
      reason: 'monthly',
      resetAt: new Date(periodStart.getTime() + AiService.PERIOD_MS).toISOString(),
    };
  }

  /**
   * streamText onFinish'dan chaqiriladi — token va $ xarajatni bugungi
   * AiUsageDaily satriga qo'shadi. Fire-and-forget: xato bo'lsa faqat log
   * yoziladi, foydalanuvchi javobiga ta'sir qilmaydi.
   */
  private async recordCost(
    tenantId: string,
    usage:
      | {
          inputTokens?: number;
          outputTokens?: number;
          inputTokenDetails?: {
            noCacheTokens?: number;
            cacheReadTokens?: number;
            cacheWriteTokens?: number;
          };
        }
      | undefined,
  ): Promise<void> {
    if (!usage) return;
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;

    // Prompt caching yoqilgani uchun input tokenlar uch xil narxda:
    // keshdan o'qilgani 10 barobar arzon, keshga yozilgani esa 2 barobar
    // qimmat (1 soatlik TTL). Aralashtirmasak xarajat noto'g'ri chiqadi.
    const d = usage.inputTokenDetails;
    const cacheRead = d?.cacheReadTokens ?? 0;
    const cacheWrite = d?.cacheWriteTokens ?? 0;
    const plainInput = d?.noCacheTokens ?? Math.max(0, inputTokens - cacheRead - cacheWrite);

    const inputCost =
      (plainInput / 1_000_000) * HAIKU_PRICE_PER_M_INPUT +
      (cacheRead / 1_000_000) * HAIKU_PRICE_PER_M_INPUT * CACHE_READ_MULTIPLIER +
      (cacheWrite / 1_000_000) * HAIKU_PRICE_PER_M_INPUT * CACHE_WRITE_MULTIPLIER;

    const costUsd = inputCost + (outputTokens / 1_000_000) * HAIKU_PRICE_PER_M_OUTPUT;

    this.logger.debug(
      `AI usage: yangi=${plainInput} keshdan=${cacheRead} keshga=${cacheWrite} chiqish=${outputTokens} narx=$${costUsd.toFixed(6)}`,
    );
    const today = this.tashkentDateString();
    try {
      await this.prisma.aiUsageDaily.upsert({
        where: { tenantId_date: { tenantId, date: today } },
        create: { tenantId, date: today, count: 0, inputTokens, outputTokens, costUsd },
        update: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
          costUsd: { increment: costUsd },
        },
      });
    } catch (err) {
      this.logger.error('AI cost yozishda xato:', err);
    }
  }

  /**
   * Chaqiruvchining tool kontekstini quradi — ruxsatlar DB'dan YANGI o'qiladi
   * (JWT'dagi eskirgan bo'lishi mumkin). userId = Employee.id yoki WorkspaceAdmin.id.
   */
  async buildToolContext(tenantId: string, userId: string): Promise<ToolContext> {
    const services = {
      prisma: this.prisma,
      tasks: this.tasksService,
      finance: this.financeService,
      telegram: this.telegramService,
    };
    const admin = await this.prisma.workspaceAdmin.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (admin) {
      return { tenantId, userId, branchId: null, isAdmin: true, perms: {}, services };
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: userId, tenantId },
      include: { role: true },
    });
    return {
      tenantId,
      userId,
      branchId: employee?.branchId || null,
      isAdmin: employee?.role?.name?.toLowerCase() === 'admin',
      perms: (employee?.role as any) || {},
      services,
    };
  }

  /** Pending amalni tasdiqlash (confirm karta tugmasi) */
  async confirmAction(tenantId: string, userId: string, actionId: string) {
    const ctx = await this.buildToolContext(tenantId, userId);
    return executeConfirmedAction(ctx, actionId);
  }

  /** Pending amalni rad etish */
  async rejectAction(tenantId: string, userId: string, actionId: string) {
    const ctx = await this.buildToolContext(tenantId, userId);
    return rejectAction(ctx, actionId);
  }

  /** Agent amallari lentasi (audit). Admin — butun tenant, xodim — faqat o'ziniki. */
  async listActions(tenantId: string, userId: string, limit = 20) {
    const ctx = await this.buildToolContext(tenantId, userId);
    return this.prisma.agentAction.findMany({
      where: {
        tenantId,
        ...(ctx.isAdmin ? {} : { userId }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true, toolName: true, summary: true, status: true,
        error: true, createdAt: true, executedAt: true, userId: true,
      },
    });
  }

  /**
   * Agent statistikasi (Faza 5 — AaaS ko'rinish qatlami): joriy AI davri
   * bo'yicha AgentAction aggregation. Admin butun tenantni ko'radi,
   * xodim faqat o'z amallarini. Narx/billing MANTIG'IGA TEGILMAYDI —
   * bu faqat "agent qancha ish qildi" ko'rsatkichi.
   */
  async getAgentStats(tenantId: string, userId: string) {
    const ctx = await this.buildToolContext(tenantId, userId);
    const usage = await this.getUsage(tenantId);
    // Anchor kelajakda bo'lsa (masalan qo'lda uzaytirilgan obuna) davr boshi
    // ham kelajakka tushadi — statistika uchun oxirgi 30 kunga tushiramiz.
    // Billing/limit mantig'iga tegilmaydi, bu faqat ko'rsatkich oynasi.
    let periodStart = new Date(usage.periodStart);
    if (periodStart.getTime() > Date.now()) {
      periodStart = new Date(Date.now() - 30 * 86400000);
    }
    const scope = ctx.isAdmin ? {} : { userId };

    const [byStatus, autonomousCount, totalAllTime] = await Promise.all([
      this.prisma.agentAction.groupBy({
        by: ['status'],
        where: { tenantId, ...scope, createdAt: { gte: periodStart } },
        _count: { id: true },
      }),
      this.prisma.agentAction.count({
        where: { tenantId, ...scope, userId: 'autonomous', createdAt: { gte: periodStart } },
      }),
      this.prisma.agentAction.count({ where: { tenantId, ...scope } }),
    ]);
    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s.status] = (s as any)._count.id;

    return {
      davr: { boshi: usage.periodStart, oxiri: usage.periodEnd },
      xabarlar: { ishlatilgan: usage.used, limit: usage.limit, cheksiz: usage.unlimited },
      amallar: {
        davrda: Object.values(statusMap).reduce((a, b) => a + b, 0),
        bajarilgan: statusMap['executed'] || 0,
        kutilmoqda: statusMap['pending'] || 0,
        rad_etilgan: statusMap['rejected'] || 0,
        xato: statusMap['failed'] || 0,
        avtonom: autonomousCount,
        jami_umumiy: totalAllTime,
      },
      isAdmin: ctx.isAdmin,
    };
  }

  // =============================================
  // Qo'llanma javobi + javob keshi
  //
  // Ikkalasi ham bitta maqsadga xizmat qiladi: bir xil TIZIM savoliga
  // qayta-qayta Anthropic'ga pul to'lamaslik. Ikkalasi ham LLM'ni umuman
  // chaqirmaydi, shuning uchun limitdan ham hisoblanmaydi.
  // =============================================

  /**
   * Xavf xabaridan turini ajratadi: "[XAVF_KARTASI:overdue_tasks] ..." → "overdue_tasks".
   * Xavf xabari bo'lmasa null.
   */
  private parseRiskType(text: string): string | null {
    const m = /^\[XAVF_KARTASI:([a-z_]+)\]/.exec(text);
    return m ? m[1] : null;
  }

  private questionHash(question: string): string {
    return createHash('sha256').update(normalizeQuestion(question)).digest('hex');
  }

  /**
   * Savol keshlanishi mumkinmi? Faqat qo'llanma bilan bog'liq, jonli
   * ma'lumotga tayanmaydigan savollar keshlanadi — aks holda eskirgan
   * ma'lumot qaytarilib qolishi mumkin.
   */
  private isCacheable(decision: KbDecision): boolean {
    return decision.kind === 'answer';
  }

  private async readAnswerCache(tenantId: string, question: string) {
    try {
      const row = await (this.prisma as any).aiAnswerCache.findUnique({
        where: { tenantId_questionHash: { tenantId, questionHash: this.questionHash(question) } },
      });
      if (!row) return null;
      if (row.expiresAt.getTime() < Date.now()) return null;
      // Statistika — fire-and-forget, javobni kutib turmaydi.
      void (this.prisma as any).aiAnswerCache
        .update({ where: { id: row.id }, data: { hits: { increment: 1 } } })
        .catch(() => undefined);
      return row;
    } catch (err: any) {
      this.logger.warn(`Kesh o'qishda xato: ${err.message}`);
      return null;
    }
  }

  private async writeAnswerCache(
    tenantId: string,
    question: string,
    answer: string,
    source: 'guide' | 'llm',
  ) {
    if (!answer.trim()) return;
    const questionHash = this.questionHash(question);
    const expiresAt = new Date(Date.now() + ANSWER_CACHE_TTL_MS);
    try {
      await (this.prisma as any).aiAnswerCache.upsert({
        where: { tenantId_questionHash: { tenantId, questionHash } },
        create: { tenantId, questionHash, question: question.slice(0, 2000), answer, source, expiresAt },
        update: { answer, source, expiresAt },
      });
    } catch (err: any) {
      this.logger.warn(`Keshga yozishda xato: ${err.message}`);
    }
  }

  /**
   * Tayyor matnni chat oqimi (UI message stream) ko'rinishida qaytaradi —
   * frontend uchun oddiy AI javobidan farqi bilinmaydi. LLM chaqirilmaydi.
   */
  private textResponse(text: string): Response {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const id = randomUUID();
        writer.write({ type: 'text-start', id });
        // Bir zarbada emas, bo'laklab yozamiz — jonli yozilayotgandek ko'rinadi.
        const chunks = text.match(/[\s\S]{1,24}/g) || [text];
        for (const delta of chunks) {
          writer.write({ type: 'text-delta', id, delta });
          await new Promise(r => setTimeout(r, 12));
        }
        writer.write({ type: 'text-end', id });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  async streamChat(
    messages: any[],
    tenantId?: string,
    employeeId?: string,
  ): Promise<Response> {
    if (!tenantId) {
      throw new Error('Avtorizatsiya xatosi.');
    }

    try {
      // Limitni faqat haqiqiy foydalanuvchi xabarida hisoblaymiz —
      // tool callback'lar oxirida assistant/tool roli keladi, ularni sanamaymiz.
      // Wake word noto'g'ri tetik bo'lib qisqa xabar yuborishi mumkin —
      // 3 belgidan qisqa matn na hisoblanadi, na Anthropic'ga yuboriladi.
      const last = messages[messages.length - 1];
      const trimmed = typeof last?.content === 'string' ? last.content.trim() : '';
      const isFreshUserMessage = last?.role === 'user' && trimmed.length > 0;

      // Qisqa xabar cheklovi FAQAT suhbatning boshida ishlaydi. Suhbat
      // ichida qisqa javob mutlaqo normal: xavf kartasidan keyin "1" deb
      // variant tanlanadi, tasdiq so'ralganda "ha" deyiladi. Ilgari bu
      // cheklov shundaylarni ham rad etardi — ya'ni tizim "raqamini yozing"
      // deb turib, yozilgan raqamni qabul qilmasdi.
      const hasPriorAssistantTurn = messages.some((m) => m.role === 'assistant');
      if (isFreshUserMessage && trimmed.length < 3 && !hasPriorAssistantTurn) {
        return new Response(
          JSON.stringify({
            error: 'MESSAGE_TOO_SHORT',
            message: 'Xabar juda qisqa. Iltimos to\'liqroq yozing yoki gapiring.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // ── ARZON YO'L: qo'llanma + kesh ────────────────────────────────
      // Suhbatning qaysi joyida so'ralganidan qat'i nazar ishlaydi: decideKb
      // faqat mustaqil, o'zi tushunarli yo'l-yo'riq savollarini o'tkazadi
      // (mavzu so'zi + "qanday/qayerdan" + jonli ma'lumot belgilari yo'q).
      // "Uni o'zgartir" kabi oldingi xabarga tayanadigan gaplar mavzu so'zi
      // yo'qligi uchun bu filtrdan o'tolmaydi va odatdagidek LLM'ga boradi.
      let kbDecision: KbDecision = { kind: 'none' };

      // Xavf kartasi bosildi — bitta savol qaytaramiz, tamom.
      // Tahlil ham, yechim ham bermaymiz: foydalanuvchi nima qilishni o'zi
      // aytadi. Model chaqirilmaydi, shuning uchun javob darhol keladi.
      if (this.parseRiskType(trimmed) !== null) {
        return this.textResponse(RISK_QUESTION);
      }

      if (isFreshUserMessage) {
        kbDecision = decideKb(trimmed);

        if (this.isCacheable(kbDecision)) {
          const cached = await this.readAnswerCache(tenantId, trimmed);
          if (cached) {
            this.logger.log(`AI kesh: "${trimmed.slice(0, 60)}" (${cached.hits + 1}-marta)`);
            return this.textResponse(cached.answer);
          }
        }

        // Qo'llanmada aniq javob bor — LLM'ga umuman bormaymiz.
        if (kbDecision.kind === 'answer') {
          const answer = kbDecision.entry.answer;
          void this.writeAnswerCache(tenantId, trimmed, answer, 'guide');
          this.logger.log(`AI qo'llanma javobi: ${kbDecision.entry.id}`);
          return this.textResponse(answer);
        }
      }

      if (isFreshUserMessage) {
        const gate = await this.checkAndIncrementUsage(tenantId);
        if (!gate.allowed) {
          const resetTime = gate.resetAt
            ? new Date(gate.resetAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
            : '';
          const periodLabel = gate.reason === 'daily' ? 'Kunlik' : 'Oylik';
          return new Response(
            JSON.stringify({
              error: 'AI_LIMIT_REACHED',
              message: `${periodLabel} so'rov limitingiz tugadi (${gate.used}/${gate.limit}), ${resetTime}da tiklanadi. Shu vaqtgacha o'zingiz bajaring yoki qo'shimcha so'rov paketi sotib oling.`,
              used: gate.used,
              limit: gate.limit,
              reason: gate.reason,
              resetAt: gate.resetAt,
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
      // DIQQAT: mijozlar ro'yxati bu yerda ATAYLAB olinmaydi (o'lchandi:
      // ~760 token, har so'rovda). createOrder `customerName` ni qabul qiladi
      // va tasks.create ismi bo'yicha mavjud mijozni topadi, topolmasa
      // yangisini yaratadi. Ro'yxat kerak bo'lsa model searchCustomers
      // tool'ini chaqiradi — u butun bazani qidiradi, ya'ni oldingi 50 talik
      // kesimdan ham to'g'riroq. Ustiga ustak, mijoz ro'yxati tez-tez
      // o'zgargani uchun prompt keshini ham buzardi.
      const [employees, servicesRaw, kanbanCols, paymentTypes, departmentsRaw] = await Promise.all([
        this.prisma.employee.findMany({
          where: { tenantId },
          select: { id: true, fullName: true, branchId: true, role: { select: { name: true } } },
        }),
        this.prisma.service.findMany({ where: { tenantId }, include: { options: true } }),
        this.prisma.kanbanColumn.findMany({
          where: { tenantId },
          orderBy: { orderIdx: 'asc' },
          select: { id: true, title: true },
        }),
        this.prisma.paymentType.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        (this.prisma as any).department.findMany({
          where: { tenantId },
          select: { id: true, name: true, branchId: true },
        }),
      ]);

      const contextData = {
        xodimlar: employees.map(e => ({ id: e.id, ism: e.fullName, rol: e.role.name })),
        xizmatlar: servicesRaw.map(s => ({
          id: s.id,
          nom: s.name,
          narx: s.basePrice,
          birlik: s.unit,
          variant_oqlari: (s as any).variantAxes || [],
          optsiyalar: s.options.map(o => ({
            id: o.id,
            nom: o.name,
            qiymat: o.value,
            qoshimcha_narx: o.priceAdd,
          })),
        })),
        ustunlar: kanbanCols.map(k => ({ id: k.id, nom: k.title })),
        tolov_turlari: paymentTypes.map(p => ({ id: p.id, nom: p.name })),
        bolimlar: departmentsRaw.map((d: any) => ({ id: d.id, nom: d.name, filial_id: d.branchId })),
      };


      // Tool konteksti — chaqiruvchining ruxsatlari DB'dan yangi o'qiladi;
      // registry shu asosda faqat ruxsat etilgan tool'larni model'ga beradi.
      const toolCtx = await this.buildToolContext(tenantId, employeeId || '');

      // Savolga mos qo'llanma parchasi — model tizimni "kashf qilib" o'tirmasdan
      // shu matndan javob beradi. Ilk savol bo'lmasa ham qidiramiz, chunki
      // suhbat o'rtasida ham yo'l-yo'riq so'ralishi mumkin.
      const effectiveKb: KbDecision =
        kbDecision.kind !== 'none' ? kbDecision : trimmed ? decideKb(trimmed) : { kind: 'none' };
      const kbMatches =
        effectiveKb.kind === 'context'
          ? effectiveKb.matches
          : effectiveKb.kind === 'answer'
            ? [{ entry: effectiveKb.entry, score: 0, topicScore: 0 }]
            : [];
      const kbGuideSection = kbMatches.length
        ? `\n\nQO'LLANMADAN TEGISHLI QISM:\n${kbContextText(kbMatches)}`
        : '';

      // ── System prompt IKKI blokka bo'lingan ────────────────────────────
      // A-blok (quyida) — TURG'UN: ko'rsatmalar, qo'llanma mundarijasi,
      //   tasdiq talab qiladigan tool'lar ro'yxati. Kunlar davomida deyarli
      //   o'zgarmaydi, shuning uchun Anthropic keshiga yoziladi (1 soat) va
      //   keyingi so'rovlarda 10 barobar arzon o'qiladi.
      //   MUHIM: bu blokda tenant'ga xos hech narsa BO'LMASLIGI kerak (sana,
      //   ustun ID'lari, ismlar...). Shunda matn barcha workspace'lar uchun
      //   bir xil chiqadi va Anthropic keshi (u API kalit darajasida ishlaydi)
      //   bitta nusxani hammasiga xizmat qiladi — mijoz qancha ko'p bo'lsa,
      //   shuncha ko'p tejaladi.
      // B-blok (pastda) — O'ZGARUVCHAN: tizim ma'lumotlari va savolga mos
      //   qo'llanma parchasi. Keshlanmaydi.
      // Nega ajratilgan: ilgari hammasi bitta keshlanadigan blok edi. Tizim
      //   ma'lumoti o'zgargan zahoti (yangi mijoz, yangi xizmat) butun blok
      //   yaroqsiz bo'lib, ~9400 token qayta yozilardi — yozish narxi esa
      //   oddiy o'qishdan 2 barobar qimmat. Endi o'zgaruvchan qism keshdan
      //   tashqarida, turg'un qism esa buzilmay turaveradi.
      const systemStable = `Sen — Girgitton. PrintFlow ERP tizimining yordamchisi.

TIL QOIDASI (QAT'IY):
- Javob HAR DOIM O'zbek tilida, LOTIN yozuvida bo'ladi. Kirill yozuvi (а, б, в, ё, ы) va boshqa tillar (rus, ingliz) MAN ETILGAN.
- Foydalanuvchi har qanday tilda yozsa yoki gapirsa ham, sen FAQAT O'zbek lotin'da javob berasan.

GAPIRISH USLUBI (QAT'IY):
- Suhbat tarzida, qisqa: 2-3 jumla, ortig'i kerak emas.
- Hech qachon markdown ishlatma: hech qanday **, ##, ###, *, -, ro'yxat, qalin yozuv, sarlavha YO'Q. Faqat tabiiy matn.
- Emojilarni juda ehtiyot ishlat (faqat zarur bo'lsa). "Eslatma:", "Ogohlantirish:", "📊", "⚠️" kabi sarlavhalar yozma.
- Leksiya o'qima, "Tushundim!", "Hisoblayman:" kabi to'ldiruvchi gaplar berma — to'g'ridan to'g'ri natijani ayt.
- Hisoblashda: faqat NATIJA va kerak bo'lsa bitta qisqa eslatma/savol. Bosqichlarni sanama.

NAMUNA (hisoblash uslubi):
User: "3000 ta vizitka 250 so'mdan qil va buyurtma yarat"
Yomon javob (BUNAQA YOZMA): uzun ro'yxat, ** belgilari, 4 ta savol bilan tugaydi.
Yaxshi javob: "3000 ta vizitka × 250 so'm = 750 000 so'm. Tizimda 200 so'm narxda saqlangan ekan — 250 da olamizmi yoki 200 da qoldiramizmi?"

ASOSIY VAZIFALAR:
1. AVTOMATIK ISH: tool'lar yordamida buyurtma yaratish, xizmat va optsiya qo'shish.
2. YO'L-YO'RIQ: avtomatik bajara olmagan ishni qisqa ko'rsatma bilan tushuntirish (qaysi sidebar, qaysi tugma).

NAVIGATSIYA (tezkor):
Kassa — tranzaksiyalar; Statistika — dashboard; Hisobotlar — tahlil; Xizmatlar (Kanban) — buyurtmalar; Mijozlar — CRM; Xodimlar — jamoa; Ma'muriyat — rollar; Ombor — material; Davomat — keldi-ketdi; Hamkorlar — vendorlar; Tizim Sozlamalari — billing va sozlama.

QO'LLANMA (TIZIM SAVOLLARI UCHUN QAT'IY QOIDA):
- "Qanday qilaman", "qayerdan qo'shaman", "qaysi sahifada" turidagi TIZIM savollariga javob FAQAT quyidagi qo'llanmadan olinadi. Tizimni tekshirish uchun tool chaqirma — bu savollar bazadagi ma'lumotga bog'liq emas.
- Qo'llanmada javob bo'lmasa — o'zingdan to'qima, "qo'llanmada bu haqda yo'q, Qo'llanma sahifasini ko'ring" deb ayt.
- Bu qoida faqat YO'L-YO'RIQ savollariga tegishli. Jonli ma'lumot ("bugun qancha tushum") va amal ("buyurtma yarat") uchun avvalgidek tool ishlat.

QO'LLANMA MUNDARIJASI: ${kbIndexText()}

SENING TOOL'LARING: ro'yxat va parametrlar sizga alohida berilgan — faqat o'shalarni ishlata olasan (ruxsatlaringga qarab berilgan).
TASDIQ KARTASI chiqaradigan tool'lar: ${describeConfirmTools(toolCtx)}

TOOL ISHLATISH FALSAFASI:
- Savolga javob berishdan OLDIN kerakli ma'lumotni o'qish tool'i bilan ol (qarz ro'yxati — getDebtors, qarz HISOBOTI/tafsiloti — getDebtorsReport, hamkorlar/vendorlar — getVendorsReport, mijoz — searchCustomers, kassa — getFinanceSummary/getRecentTransactions, buyurtma — searchOrders/getOrdersSummary/getUpcomingDeadlines, ombor — getLowStock/searchMaterials). Taxmin qilma, o'qib kel.
- "Hisobot ber" so'ralganda hech qachon "ma'lumot yo'q" dema — avval tegishli tool'ni chaqir; natija bo'sh bo'lsa "hozircha yozuvlar yo'q" deb aniq ayt.
- HECH QACHON "tekshirayapman", "ko'rib chiqaman" deb yozib TO'XTAMA — tool'ni o'sha zahoti, shu javobning o'zida chaqir. Matn yozish tool chaqirishning o'rnini bosmaydi.
- O'qish tool'i natijasi foydalanuvchiga karta shaklida avtomatik ko'rsatiladi — natijadan keyin ro'yxatni QAYTA SANAB BERMA, bitta jumlada xulosa qil (masalan: "9 ta buyurtma muddati o'tgan, eng eskisi 27-iyun").
- Yuqorida "TASDIQ KARTASI chiqaradigan tool'lar" ro'yxatidagi tool chaqirilganda amal DARHOL BAJARILMAYDI — foydalanuvchiga tasdiqlash kartasi chiqadi. Sen qisqa qilib "Kartani tasdiqlasangiz kiritaman" degin va natijani da'vo qilma. Kartadan keyin tizim o'zi bajaradi.
- Tool natijasida success:false kelsa — sababini foydalanuvchiga qisqa tushuntir.

createOrder (buyurtma) uchun kerakli ma'lumotlar:
- orderName (buyurtma nomi, masalan: "Vizitka 3000 ta")
- title (qisqa sarlavha)
- customerName (mijoz ismi) — contextData'da mijozlar ro'yxati YO'Q, shunchaki ismni yoz. Tizim mavjud mijozni topadi, topolmasa yangisini ochadi. Aniq mijozni tekshirish kerak bo'lsagina searchCustomers chaqir.
- serviceId (xizmat ID — contextData.xizmatlar dan tanla)
- quantity (miqdor, default 1)
- totalAmount (jami summa so'mda)
- depositAmount (zakolat, default 0)
- paymentTypeId (to'lov turi ID — contextData.tolov_turlari dan tanla)
- deadlineAt (muddat, ISO sana formatida — optional)
- departmentId (bo'lim ID — optional, agar filialda bo'limlar bo'lsa)
- columnId (Kanban ustuni — contextData.ustunlar dagi BIRINCHI ustunni ol, boshqasi aytilmagan bo'lsa)
- assigneeId (xodim ID — optional)
- variants (variant qatorlari, optional): agar tanlangan xizmatda variant_oqlari mavjud bo'lsa (masalan ["Rang", "O'lcham"]), foydalanuvchidan rang/o'lcham ajratmasini so'ra va shu formatda yubor:
  variants: [
    { "atributlar": { "Rang": "Oq", "O'lcham": "M" }, "soni": 30 },
    { "atributlar": { "Rang": "Oq", "O'lcham": "L" }, "soni": 40 },
    { "atributlar": { "Rang": "Qora", "O'lcham": "S" }, "soni": 50 }
  ]
  Variantlar berilsa quantity avtomatik hisoblanadi (yig'indi).

createService uchun: name, basePrice, unit (dona/metr/m2), description (optional).

createServiceOption uchun: targetServiceName, optionName, optionValue, oldPrice, newPrice, note (optional).

ISHLASH QOIDASI:
1. Foydalanuvchi so'rovini tahlil qil. Kerakli majburiy ma'lumotlar (mijoz, summa, to'lov turi, muddat) yo'q bo'lsa — bitta qisqa savol bilan so'ra (ro'yxat shaklida emas, bir-ikki jumla).
2. Hammasi yetarli bo'lganda — qisqa xulosa bilan tasdiqlash so'ra: "Vizitka 3000 ta, Akmal Sotvoldiyev, 750 000 so'm, naqd, ertaga soat 15. Yarataymizmi?"
3. Foydalanuvchi "ha", "yarataylik", "tasdiqlayman" yoki shunga o'xshash tasdiq bersa — DARHOL tool'ni chaqir, qaytadan so'rama.
4. Tool ID'larni contextData'dan o'qib to'g'ri yubor. Xizmat yoki to'lov turi nomidan ID topish kerak.
5. Tool muvaffaqiyatli ishlasa — "Tayyor, [displayId] buyurtma yaratildi" deb qisqa javob ber. Ortiqcha izoh berma.`;

      // B-blok — tenant ma'lumotlari. Ular ham keshlanadi, lekin ALOHIDA
      // nuqtada: xizmat yoki xodim o'zgarsa faqat shu blok qayta yoziladi,
      // A-blok esa keshda qolaveradi.
      const systemContext = `Bugungi sana: ${new Date().toLocaleDateString('uz-UZ')}.

TIZIMDAGI MA'LUMOTLAR (contextData):
${JSON.stringify(contextData)}`;

      // C-blok — savolga bog'liq, har so'rovda boshqacha. Keshlanmaydi
      // (keshlansa har savolda yangi yozuv ochilib, foyda o'rniga zarar bo'lardi).
      const systemPerQuestion = kbGuideSection.trim();

      // --- TOKEN DIET: SAFE TRUNCATION LOGIC ---
      const MESSAGE_LIMIT = 6;
      let truncatedMessages = messages.filter(m => 
        (typeof m.content === 'string' ? m.content.trim().length > 0 : true)
      );

      if (truncatedMessages.length > MESSAGE_LIMIT) {
        let sliceIndex = truncatedMessages.length - MESSAGE_LIMIT;
        
        // Ensure we don't start with a 'tool' role (result) or a message that orphans a tool call.
        // If the message at sliceIndex is a tool result, we must include the previous assistant message too.
        while (sliceIndex > 0 && (
          truncatedMessages[sliceIndex].role === 'tool' || 
          (Array.isArray(truncatedMessages[sliceIndex].content) && 
           truncatedMessages[sliceIndex].content.some((c: any) => c.type === 'tool-result'))
        )) {
          sliceIndex--;
        }
        truncatedMessages = truncatedMessages.slice(sliceIndex);
      }

      const coreMessages: any[] = truncatedMessages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
        ...(m.toolResults ? { toolResults: m.toolResults } : {}),
      }));

      // Guard: SDK requires at least one message
      if (coreMessages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Xabar bo\'sh bo\'lishi mumkin emas.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // IKKITA kesh nuqtasi. Anthropic prefiksni keshlaydi, shuning uchun:
      //   nuqta 1 → tool sxemalari + A-blok      (~6200 token, deyarli o'zgarmas)
      //   nuqta 2 → yuqoridagilar + B-blok       (+contextData)
      // Ma'lumot o'zgarmagan bo'lsa 2-nuqta to'liq mos keladi va hammasi
      // keshdan o'qiladi. Xizmat/xodim o'zgarsa 2-nuqta buziladi, ammo
      // 1-nuqta saqlanib qoladi — ya'ni faqat kichik B-blok qayta yoziladi.
      // TTL farqi ataylab: A kamdan-kam o'zgargani uchun 1 soat (yozish 2x,
      // lekin kamdan-kam), B tez-tez o'zgargani uchun 5 daqiqa (yozish 1.25x).
      // Ketma-ket system bloklar bitta "system" massiviga birlashadi.
      const systemMessages: any[] = [
        {
          role: 'system' as const,
          content: systemStable,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' as const, ttl: '1h' as const } },
          },
        },
        {
          role: 'system' as const,
          content: systemContext,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' as const, ttl: '5m' as const } },
          },
        },
      ];
      if (systemPerQuestion) {
        systemMessages.push({ role: 'system' as const, content: systemPerQuestion });
      }

      // SDK v6: streamText is NOT awaited — it returns StreamTextResult synchronously
      const result = streamText({
        model: this.anthropicClient('claude-haiku-4-5'),
        messages: [...systemMessages, ...coreMessages],
        temperature: 0.2,
        tools: buildAiSdkTools(toolCtx),
        // Default stepCountIs(1) tool natijasidan keyin modelga so'z bermasdan
        // to'xtatadi — model natijani ko'rib qisqa xulosa yozsin (kartaga qo'shimcha).
        stopWhen: stepCountIs(4),
        // Stream tugagach token/$ xarajatni bugungi kunga yozadi — javobni
        // sekinlashtirmaydi (fire-and-forget, xato bo'lsa faqat log).
        onFinish: ({ usage, text, steps }) => {
          void this.recordCost(tenantId, usage as any);

          // Javobni keshga faqat quyidagi shartlarda yozamiz:
          //  1) suhbatning ilk savoli — keyingi savollar oldingi xabarlar
          //     kontekstida javob olgan bo'lishi mumkin, ularni keshlash xato,
          //  2) qo'llanma savoli deb aniqlangan,
          //  3) HECH QANDAY tool ishlatilmagan — ya'ni javob jonli ma'lumotga
          //     tayanmaydi, demak ertaga ham o'sha javob to'g'ri bo'ladi.
          const usedTools = (steps || []).some((s: any) => (s.toolCalls?.length ?? 0) > 0);
          const isFirstQuestion = messages.filter(m => m.role === 'user').length === 1;
          if (isFirstQuestion && kbDecision.kind !== 'none' && !usedTools) {
            void this.writeAnswerCache(tenantId, trimmed, text || '', 'llm');
          }
        },
      });

      // SDK v6: toUIMessageStreamResponse() is available on StreamTextResult
      return result.toUIMessageStreamResponse();
    } catch (err: any) {
      this.logger.error('AI Error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
