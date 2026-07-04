import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { FinanceService } from '../finance/finance.service';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, stepCountIs } from 'ai';
import { ToolContext } from './tools/types';
import {
  buildAiSdkTools,
  describeTools,
  executeConfirmedAction,
  rejectAction,
} from './tools/registry';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropicClient: any;
  private static readonly PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly financeService: FinanceService,
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

    const limit = tenant.plan?.aiMessagesPerMonth ?? 0;
    const unlimited = limit === 0;
    const periodStart = this.getCurrentPeriodStart(tenant);
    const periodEnd = new Date(periodStart.getTime() + AiService.PERIOD_MS);

    const usage = await this.prisma.aiUsage.findUnique({
      where: { tenantId_periodStart: { tenantId, periodStart } },
    });

    return {
      used: usage?.count ?? 0,
      limit,
      unlimited,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }

  /**
   * Limitni tekshiradi va to'g'ri kelsa hisobni 1 ga oshiradi.
   * Limit oshgan bo'lsa false qaytaradi (xabar yuborilmaydi).
   * Atomik upsert + increment — race condition oldini oladi.
   */
  private async checkAndIncrementUsage(tenantId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
    unlimited: boolean;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    });
    if (!tenant) return { allowed: false, used: 0, limit: 0, unlimited: false };

    const limit = tenant.plan?.aiMessagesPerMonth ?? 0;
    const unlimited = limit === 0;
    const periodStart = this.getCurrentPeriodStart(tenant);

    // Cheksiz bo'lsa ham hisoblab boramiz — keyin analitika uchun foydali.
    const result = await this.prisma.aiUsage.upsert({
      where: { tenantId_periodStart: { tenantId, periodStart } },
      create: { tenantId, periodStart, count: 1 },
      update: { count: { increment: 1 } },
    });

    if (unlimited) return { allowed: true, used: result.count, limit, unlimited };
    if (result.count > limit) {
      // Limitdan oshib ketgan — increment'ni qaytarib olamiz (idempotent rollback).
      await this.prisma.aiUsage.update({
        where: { tenantId_periodStart: { tenantId, periodStart } },
        data: { count: { decrement: 1 } },
      });
      return { allowed: false, used: limit, limit, unlimited };
    }
    return { allowed: true, used: result.count, limit, unlimited };
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

      if (isFreshUserMessage && trimmed.length < 3) {
        return new Response(
          JSON.stringify({
            error: 'MESSAGE_TOO_SHORT',
            message: 'Xabar juda qisqa. Iltimos to\'liqroq yozing yoki gapiring.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (isFreshUserMessage) {
        const gate = await this.checkAndIncrementUsage(tenantId);
        if (!gate.allowed) {
          return new Response(
            JSON.stringify({
              error: 'AI_LIMIT_REACHED',
              message: `Joriy davr uchun AI xabar limiti tugadi (${gate.used}/${gate.limit}). Tarifni yangilang.`,
              used: gate.used,
              limit: gate.limit,
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
      const [employees, customers, servicesRaw, kanbanCols, paymentTypes, departmentsRaw] = await Promise.all([
        this.prisma.employee.findMany({
          where: { tenantId },
          select: { id: true, fullName: true, branchId: true, role: { select: { name: true } } },
        }),
        this.prisma.customer.findMany({
          where: { tenantId },
          select: { id: true, name: true, totalDebt: true },
          orderBy: { updatedAt: 'desc' },
          take: 50,
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
        mijozlar: customers.map(c => ({ id: c.id, ism: c.name, qarz: c.totalDebt })),
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

      const firstColId = kanbanCols[0]?.id || '';

      // Tool konteksti — chaqiruvchining ruxsatlari DB'dan yangi o'qiladi;
      // registry shu asosda faqat ruxsat etilgan tool'larni model'ga beradi.
      const toolCtx = await this.buildToolContext(tenantId, employeeId || '');

      const systemPrompt = `Sen — Girgitton. PrintFlow ERP tizimining yordamchisi. Bugungi sana: ${new Date().toLocaleDateString('uz-UZ')}.

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

SENING TOOL'LARING (faqat shular — ruxsatlaringga qarab berilgan):
${describeTools(toolCtx)}

TOOL ISHLATISH FALSAFASI:
- Savolga javob berishdan OLDIN kerakli ma'lumotni o'qish tool'i bilan ol (qarz — getDebtors/searchCustomers, kassa — getFinanceSummary/getRecentTransactions, buyurtma — searchOrders/getOrdersSummary/getUpcomingDeadlines, ombor — getLowStock/searchMaterials). Taxmin qilma, o'qib kel.
- HECH QACHON "tekshirayapman", "ko'rib chiqaman" deb yozib TO'XTAMA — tool'ni o'sha zahoti, shu javobning o'zida chaqir. Matn yozish tool chaqirishning o'rnini bosmaydi.
- O'qish tool'i natijasi foydalanuvchiga karta shaklida avtomatik ko'rsatiladi — natijadan keyin ro'yxatni QAYTA SANAB BERMA, bitta jumlada xulosa qil (masalan: "9 ta buyurtma muddati o'tgan, eng eskisi 27-iyun").
- [TASDIQ KARTASI] belgili tool chaqirilganda amal DARHOL BAJARILMAYDI — foydalanuvchiga tasdiqlash kartasi chiqadi. Sen qisqa qilib "Kartani tasdiqlasangiz kiritaman" degin va natijani da'vo qilma. Kartadan keyin tizim o'zi bajaradi.
- Tool natijasida success:false kelsa — sababini foydalanuvchiga qisqa tushuntir.

createOrder (buyurtma) uchun kerakli ma'lumotlar:
- orderName (buyurtma nomi, masalan: "Vizitka 3000 ta")
- title (qisqa sarlavha)
- customerName yoki customerId (mijoz)
- serviceId (xizmat ID — contextData.xizmatlar dan tanla)
- quantity (miqdor, default 1)
- totalAmount (jami summa so'mda)
- depositAmount (zakolat, default 0)
- paymentTypeId (to'lov turi ID — contextData.tolov_turlari dan tanla)
- deadlineAt (muddat, ISO sana formatida — optional)
- departmentId (bo'lim ID — optional, agar filialda bo'limlar bo'lsa)
- columnId (default "${firstColId}")
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
5. Tool muvaffaqiyatli ishlasa — "Tayyor, [displayId] buyurtma yaratildi" deb qisqa javob ber. Ortiqcha izoh berma.

TIZIMDAGI MA'LUMOTLAR:
${JSON.stringify(contextData)}`;

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

      // SDK v6: streamText is NOT awaited — it returns StreamTextResult synchronously
      const result = streamText({
        model: this.anthropicClient('claude-haiku-4-5'),
        system: systemPrompt,
        messages: coreMessages,
        temperature: 0.2,
        tools: buildAiSdkTools(toolCtx),
        // Default stepCountIs(1) tool natijasidan keyin modelga so'z bermasdan
        // to'xtatadi — model natijani ko'rib qisqa xulosa yozsin (kartaga qo'shimcha).
        stopWhen: stepCountIs(4),
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
