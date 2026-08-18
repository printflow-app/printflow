import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs } from 'ai';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { AiService } from './ai.service';
import { buildAiSdkTools, describeConfirmTools } from './tools/registry';
import { fonTopshiriqYarat } from './agent-job.util';
import { xotiraBlokini } from './agent-memory.util';

// =============================================
// FON TOPSHIRIQ RUNNER'I — Faza 3 (AaaS transformatsiya).
//
// NEGA ALOHIDA XIZMAT: chat javobi HTTP so'rovi ichida tugashi kerak —
// brauzer ham, Railway ham cheksiz kutmaydi. "Qarzdorlarga eslatma yubor va
// hisobot ber" kabi topshiriq esa o'nlab tool chaqiruvi va daqiqalar talab
// qiladi. Shuning uchun topshiriq DB'ga yoziladi va shu cron uni so'rovdan
// mustaqil bajaradi.
//
// AVTONOM XIZMATLARDAN FARQI (autonomous.service.ts): u AI O'ZI topgan
// xavflarga reaksiya qiladi. Bu esa FOYDALANUVCHI BERGAN ishni bajaradi.
// Ikkalasi bir-birini almashtirmaydi.
// =============================================

const MODEL = 'claude-sonnet-5';

// Bir topshiriqdagi eng ko'p agentik qadam. Har qadam = alohida API
// chaqiruvi, ya'ni to'g'ridan-to'g'ri pul. 20 — "reja tuz → ma'lumot yig'
// → bajar → tekshir → hisobot yoz" zanjiri bemalol sig'adigan chegara.
const MAX_QADAM = 20;

// Ikkinchi qo'riqchi — chiqish tokeni bo'yicha. Qadam soni yetarli emas:
// bitta qadam ham juda uzun javob yozib pulni yeb qo'yishi mumkin. Chiqish
// tokeni asosiy xarajat manbai (kirish katta qismi keshdan o'qiladi).
// 25 000 chiqish tokeni ≈ $0.25 — bitta topshiriqning yuqori chegarasi.
const MAX_CHIQISH_TOKEN = 25_000;

// Kunlik topshiriq chegarasi `agent-job.util.ts` da — uni tool ham,
// controller ham ishlatadi, shuning uchun bitta joyda turishi kerak.

@Injectable()
export class AgentJobService {
  private readonly logger = new Logger(AgentJobService.name);
  private readonly anthropic: any;

  /**
   * Shu jarayonda topshiriq bajarilyaptimi. Cron har daqiqada uyg'onadi,
   * topshiriq esa bir necha daqiqa davom etishi mumkin — bayroqsiz ikkinchi
   * tick birinchisi tugamasdan yana ish olib, xarajatni ikkilantirardi.
   */
  private band = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly ai: AiService,
  ) {
    this.anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  }

  // ──────────────────────────────────────────────────────────────────
  // NAVBAT
  // ──────────────────────────────────────────────────────────────────

  /**
   * Navbatdagi topshiriqni "band qiladi".
   *
   * `updateMany` + `status: 'queued'` sharti ATOMAR: bir nechta instans
   * (rolling deploy paytida ikkitasi bir vaqtda ishlaydi) bir xil topshiriqni
   * olmaydi — faqat bittasida `count === 1` chiqadi. Avval o'qib, keyin
   * yangilash bu kafolatni bermasdi.
   */
  private async navbatdanOl() {
    const nomzod = await this.prisma.agentJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!nomzod) return null;

    const claim = await this.prisma.agentJob.updateMany({
      where: { id: nomzod.id, status: 'queued' },
      data: { status: 'running', startedAt: new Date() },
    });
    if (claim.count !== 1) return null; // boshqa instans oldin ulgurdi

    return this.prisma.agentJob.findUnique({ where: { id: nomzod.id } });
  }

  @Cron('* * * * *')
  async tick() {
    if (this.band) return;
    this.band = true;
    try {
      const job = await this.navbatdanOl();
      if (job) await this.bajar(job);
    } catch (err) {
      this.logger.error('Fon topshiriq tick xatosi:', err);
    } finally {
      this.band = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // BAJARISH
  // ──────────────────────────────────────────────────────────────────

  private async qadamYoz(jobId: string, matn: string, oldingi: any[]) {
    const yangi = [...oldingi, { vaqt: new Date().toISOString(), matn }];
    await this.prisma.agentJob
      .update({ where: { id: jobId }, data: { progress: yangi } })
      .catch(() => undefined); // progress yozilmasa topshiriqni to'xtatmaymiz
    return yangi;
  }

  private async bajar(job: any) {
    const bosqichlar: any[] = Array.isArray(job.progress) ? job.progress : [];
    let progress = bosqichlar;
    let narx = 0;

    try {
      // Ruxsatlar topshiriqni BERGAN odamdan olinadi va DB'dan yangi
      // o'qiladi. Fon rejimi hech qachon ruxsat darajasini oshirmaydi:
      // xodim qo'lda qila olmaydigan ishni agent ham qila olmaydi.
      const ctx = await this.ai.buildToolContext(job.tenantId, job.userId);

      const tools = buildAiSdkTools(ctx);
      // FON TOPSHIRIG'I YANA TOPSHIRIQ YARATA OLMAYDI.
      //
      // `startJob` chat agenti uchun — uzoq ishni fonga uzatish vositasi.
      // Fon agentida u qolsa, topshiriq o'zini qayta-qayta navbatga qo'yib,
      // to'xtamaydigan zanjir hosil qilishi mumkin edi: har biri pul turadi
      // va qadam chegarasi bunday rekursiyani ushlamaydi (har topshiriq
      // o'z chegarasi bilan yangidan boshlanadi).
      delete tools.startJob;

      progress = await this.qadamYoz(job.id, 'Topshiriq qabul qilindi, reja tuzilyapti…', progress);

      // Fon agenti ham chat agenti biladigan narsani bilishi kerak — aks
      // holda u tashkilot qoidalarini buzgan holda ish qilib qo'yardi
      // ("Zoxidga qo'shimcha ish berma" kabi).
      const xotira = await xotiraBlokini(this.prisma, job.tenantId, job.userId);

      const system = [
        "Sen PrintFlow ERP tizimining fon agentisan. Senga topshiriq berildi va uni OXIRIGACHA o'zing bajarasan.",
        '',
        'MUHIM — SEN FON REJIMIDASAN:',
        "- Foydalanuvchi ekran oldida YO'Q. Savol berma, tasdiq so'rama, \"xohlaysizmi?\" deb so'rama.",
        "  Aniqlik yetmasa, eng oqilona taxminni qabul qil va buni hisobotda yozib qo'y.",
        `- Tasdiq talab qiladigan amallar (${describeConfirmTools(ctx)}) DARHOL BAJARILMAYDI —`,
        '  ular tasdiqlash navbatiga tushadi va rahbar keyin ko\'rib chiqadi. Bunday amalni',
        '  chaqirganingdan keyin uni "bajarildi" deb hisoblama, "tasdiqqa yuborildi" deb yoz.',
        '- Ma\'lumotni TAXMIN QILMA. Har raqamni tool orqali ol. Tool bermagan narsani hisobotda yozma.',
        '',
        "YAKUNIY HISOBOT — oxirgi javobing shu bo'ladi va foydalanuvchi FAQAT shuni o'qiydi:",
        '- Nima qilinganini aniq yoz (raqamlar bilan).',
        "- Tasdiq kutayotgan amallar bo'lsa alohida ayt.",
        "- Bajarib bo'lmagan qism bo'lsa, nimaga bo'lmaganini yoz — jimgina tashlab ketma.",
        "- Sof matn. Markdown ishlatma (**, ##, - belgilarisiz). O'zbek lotin yozuvida.",
        ...(xotira ? ['', xotira] : []),
      ].join('\n');

      const res = await generateText({
        model: this.anthropic(MODEL),
        system,
        prompt: job.topshiriq,
        tools,
        providerOptions: {
          anthropic: {
            thinking: { type: 'adaptive' as const, display: 'summarized' as const },
            // Fon ishi shoshilinch emas — bu yerda sifat tezlikdan muhimroq.
            effort: 'high' as const,
          },
        },
        stopWhen: [
          stepCountIs(MAX_QADAM),
          // Chiqish tokeni chegarasi. Model buni "bilmaydi" — bu qattiq
          // to'siq, ya'ni topshiriq chala qolishi mumkin. Shuning uchun
          // chegaraga yetgani hisobotda alohida qayd etiladi.
          ({ steps }) =>
            steps.reduce((s: number, st: any) => s + (st.usage?.outputTokens ?? 0), 0) >=
            MAX_CHIQISH_TOKEN,
        ],
        onStepFinish: async (step: any) => {
          narx += await this.ai.recordCost(job.tenantId, step.usage).catch(() => 0);

          const toolNomlari = (step.toolCalls || []).map((t: any) => t.toolName).filter(Boolean);
          if (toolNomlari.length) {
            progress = await this.qadamYoz(job.id, `Bajarildi: ${toolNomlari.join(', ')}`, progress);
          }
        },
      });

      const qadamlar = res.steps?.length ?? 0;
      const chegaraga_yetdi = qadamlar >= MAX_QADAM;

      let natija = (res.text || '').trim();
      if (!natija) {
        natija =
          "Agent topshiriqni yakunladi, lekin yozma hisobot qaytarmadi. " +
          "Bajarilgan amallarni agent lentasidan ko'rishingiz mumkin.";
      }
      if (chegaraga_yetdi) {
        natija +=
          `\n\nEslatma: topshiriq qadam chegarasiga (${MAX_QADAM}) yetdi. ` +
          "Agar ish chala qolgan bo'lsa, qolgan qismini alohida topshiriq qilib bering.";
      }

      await this.prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: 'done',
          natija,
          qadamlar,
          narxUsd: narx,
          finishedAt: new Date(),
          progress: [
            ...progress,
            { vaqt: new Date().toISOString(), matn: 'Topshiriq yakunlandi.' },
          ],
        },
      });

      this.logger.log(
        `Fon topshiriq tugadi: ${job.id} — ${qadamlar} qadam, $${narx.toFixed(4)}`,
      );
      await this.xabarBer(job, natija);
    } catch (err: any) {
      const sabab = err?.message || 'Nomaʼlum xatolik';
      this.logger.error(`Fon topshiriq xatosi (${job.id}): ${sabab}`);

      await this.prisma.agentJob
        .update({
          where: { id: job.id },
          data: { status: 'failed', error: sabab, narxUsd: narx, finishedAt: new Date() },
        })
        .catch(() => undefined);

      await this.xabarBer(job, `Topshiriq bajarilmadi.\n\nSabab: ${sabab}`);
    }
  }

  /**
   * Natijani topshiriq bergan odamga Telegram orqali yetkazadi.
   *
   * Nega Telegram: fon topshirig'i daqiqalar davom etadi va foydalanuvchi
   * o'sha paytda chat oynasini yopib ketgan bo'ladi. Telegram'i ulanmagan
   * bo'lsa natija baribir DB'da turadi va topshiriqlar ro'yxatida ko'rinadi.
   */
  private async xabarBer(job: any, matn: string) {
    try {
      const [emp, admin] = await Promise.all([
        this.prisma.employee.findFirst({
          where: { id: job.userId, tenantId: job.tenantId },
          select: { telegramId: true },
        }),
        this.prisma.workspaceAdmin.findFirst({
          where: { id: job.userId, tenantId: job.tenantId },
          select: { telegramId: true },
        }),
      ]);
      const chatId = emp?.telegramId || admin?.telegramId;
      if (!chatId) return;

      await this.telegram.sendMessage(
        chatId,
        [`TOPSHIRIQ: ${job.sarlavha}`, '', matn, '', '_Girgitton fon agenti._'].join('\n'),
      );
    } catch (err) {
      this.logger.error('Topshiriq natijasini yuborishda xato:', err);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // TASHQI API (tool va controller uchun)
  // ──────────────────────────────────────────────────────────────────

  /** Yangi topshiriq navbatga qo'yadi (kunlik chegara util ichida tekshiriladi). */
  async yarat(tenantId: string, userId: string, topshiriq: string, sarlavha: string) {
    return fonTopshiriqYarat(this.prisma, tenantId, userId, topshiriq, sarlavha);
  }

  /** Foydalanuvchi topshiriqlari. Admin butun tenantni ko'radi. */
  async royxat(tenantId: string, userId: string, limit = 20) {
    const ctx = await this.ai.buildToolContext(tenantId, userId);
    return this.prisma.agentJob.findMany({
      where: { tenantId, ...(ctx.isAdmin ? {} : { userId }) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true, sarlavha: true, status: true, natija: true, error: true,
        progress: true, qadamlar: true, narxUsd: true,
        createdAt: true, startedAt: true, finishedAt: true, userId: true,
      },
    });
  }

  /** Bitta topshiriq — progress'ni kuzatish uchun (frontend poll qiladi). */
  async bitta(tenantId: string, userId: string, jobId: string) {
    const ctx = await this.ai.buildToolContext(tenantId, userId);
    return this.prisma.agentJob.findFirst({
      where: { id: jobId, tenantId, ...(ctx.isAdmin ? {} : { userId }) },
      select: {
        id: true, sarlavha: true, topshiriq: true, status: true, natija: true,
        error: true, progress: true, qadamlar: true, narxUsd: true,
        createdAt: true, startedAt: true, finishedAt: true,
      },
    });
  }

  /**
   * Navbatdagi topshiriqni bekor qilish.
   *
   * Faqat `queued` holatida — ishlab turgan topshiriqni yarim yo'lda to'xtatish
   * uni nomuvofiq holatda qoldirardi (bir qism amal bajarilgan, bir qismi yo'q).
   */
  async bekorQil(tenantId: string, userId: string, jobId: string) {
    const ctx = await this.ai.buildToolContext(tenantId, userId);
    const res = await this.prisma.agentJob.updateMany({
      where: {
        id: jobId, tenantId, status: 'queued',
        ...(ctx.isAdmin ? {} : { userId }),
      },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
    return res.count === 1
      ? { success: true }
      : { success: false, error: "Topshiriq topilmadi yoki allaqachon boshlangan" };
  }
}
