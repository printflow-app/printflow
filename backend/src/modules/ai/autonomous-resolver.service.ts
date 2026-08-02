import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs } from 'ai';
import { AutonomousService, AgentPolicies, riskArea } from './autonomous.service';
import { RiskDetectionService } from './risk-detection.service';
import { TelegramService } from '../telegram/telegram.service';
import { AGENT_TOOLS, executeConfirmedAction } from './tools/registry';
import { ToolContext } from './tools/types';
import { TasksService } from '../tasks/tasks.service';
import { FinanceService } from '../finance/finance.service';

// =============================================
// AVTONOM HAL QILUVCHI
//
// Xavf-aniqlash muammoni TOPADI, bu xizmat esa uni HAL QILISHNI taklif
// qiladi yoki (siyosat ruxsat bersa) o'zi bajaradi.
//
// QARORNI AI CHIQARADI, KOD EMAS. Kim ishda, kimning muddati zich, kimda
// bo'sh vaqt bor, xodim shu ishni qila oladimi — bularni taroziga solish
// mezoni har tashkilotda boshqacha. Kodga formula yozib qo'yilsa u bitta
// vaziyatga mos kelib, qolganida xato ishlardi. Shuning uchun kod faqat
// FAKTLARNI yig'adi (bir ma'noli, o'qilishi oson ko'rinishda), mezonni esa
// AI va rahbarning o'z qoidalari (autoResolve.instructions) belgilaydi.
// Xavf DETEKTORLARI esa aksincha — LLM'siz, chunki ular faqat hisoblaydi.
//
// XAVFSIZLIK — cheklov kodda emas, RAHBAR SOZLAMASIDA:
//  - Sukut bo'yicha O'CHIQ (autoResolve.enabled = false)
//  - Har soha alohida: 'off' | 'propose' | 'execute' (areas)
//  - Faqat rahbar ruxsat bergan amallar (allowedActions)
//  - Kunlik chegara (maxPerDay) — nazoratdan chiqib ketmasligi uchun
//  - Har qaror AgentAction'ga yoziladi (audit)
// =============================================

const MODEL = 'claude-haiku-4-5';

export interface ResolverDecision {
  /** Model tanlagan amal (siyosatda ruxsat berilganlardan). */
  action: string;
  /** Amal argumentlari. */
  input: Record<string, any>;
  /** Odam o'qiydigan qisqa asos: "Lazizga berdim, chunki..." */
  reasoning: string;
}

@Injectable()
export class AutonomousResolverService {
  private readonly logger = new Logger(AutonomousResolverService.name);
  private readonly anthropic: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly autonomous: AutonomousService,
    private readonly risks: RiskDetectionService,
    private readonly telegram: TelegramService,
    private readonly tasks: TasksService,
    private readonly finance: FinanceService,
  ) {
    this.anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
  }

  private tashkentDateString(d = new Date()): string {
    const utc5 = new Date(d.getTime() + 5 * 3600000);
    return utc5.toISOString().slice(0, 10);
  }

  private tashkentDayStart(): Date {
    const utc5 = new Date(Date.now() + 5 * 3600000);
    return new Date(Date.UTC(utc5.getUTCFullYear(), utc5.getUTCMonth(), utc5.getUTCDate()) - 5 * 3600000);
  }

  /**
   * Qaror uchun zarur manzara: kim bugun ishda, kimda qancha ish bor va
   * eng yaqin muddati qachon.
   *
   * Aynan shu ma'lumot "Shoxrux bugun band, Laziz 3 kundan keyin — demak
   * Lazizga bo'sh vaqt bor" degan xulosani chiqarish imkonini beradi.
   */
  async buildWorkloadPicture(tenantId: string) {
    const today = this.tashkentDateString();
    const dayStart = this.tashkentDayStart();

    const [employees, attendance, activeTasks] = await Promise.all([
      this.prisma.employee.findMany({
        where: { tenantId },
        select: { id: true, fullName: true, role: { select: { name: true } } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { tenantId, date: today, checkIn: { not: null } },
        select: { employeeId: true },
      }),
      this.prisma.task.findMany({
        where: { tenantId, isArchived: false, column: { isDone: false } },
        select: {
          id: true, displayId: true, orderName: true, title: true,
          deadlineAt: true, assignees: true,
        },
      }),
    ]);

    const present = new Set(attendance.map((a) => a.employeeId));

    // Har xodimning yuki.
    //
    // MUHIM: "eng yaqin muddat" ni hisoblashda MUDDATI O'TGANLAR hisobga
    // olinmaydi. Bazada yillar oldingi tugallanmagan buyurtmalar bo'lishi
    // mumkin va ular har bir xodimning "eng yaqin muddat" ini katta manfiy
    // songa aylantirib, bo'sh vaqt signalini butunlay o'chirib yuboradi
    // (sinovda aynan shu bo'ldi: hammada -802 kun chiqib, AI noto'g'ri
    // xodimni tanladi). Shuning uchun ular alohida sanaladi.
    const load = new Map<
      string,
      { count: number; overdue: number; dueToday: number; nextDays: number | null }
    >();
    for (const t of activeTasks) {
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(t.assignees || '[]');
        if (Array.isArray(parsed)) ids = parsed;
      } catch {}
      for (const id of ids) {
        const cur = load.get(id) || { count: 0, overdue: 0, dueToday: 0, nextDays: null };
        cur.count += 1;
        if (t.deadlineAt) {
          const days = Math.floor((t.deadlineAt.getTime() - dayStart.getTime()) / 86400000);
          if (days < 0) cur.overdue += 1;
          else if (days === 0) cur.dueToday += 1;
          // Faqat KELGUSI muddatlar bo'sh vaqtni ko'rsatadi.
          if (days >= 0 && (cur.nextDays === null || days < cur.nextDays)) cur.nextDays = days;
        }
        load.set(id, cur);
      }
    }

    // Har xodim holati ODAM O'QIYDIGAN jumlalar bilan beriladi.
    //
    // Nega raqam emas: sinovda model "keyingi_muddat_kun: 0" ni "eng bo'sh"
    // deb o'qidi, holbuki 0 — "bugun band" degani. Xato modelning fikrlashida
    // emas, maydon nomining ikki xil o'qilishida edi. Qarorni kodga tortib
    // olish o'rniga (u holda mezon bitta qattiq formulaga aylanardi va har
    // tashkilotga to'g'ri kelmasdi) ma'lumotning o'zini bir ma'noli qilamiz —
    // qaror esa AI'da qoladi.
    return employees.map((e) => {
      const l = load.get(e.id) || { count: 0, overdue: 0, dueToday: 0, nextDays: null };
      const bandlik =
        l.dueToday > 0
          ? `BAND — bugun ${l.dueToday} ta ish topshirishi kerak`
          : l.nextDays === null
            ? (l.count === 0 ? "BO'SH — hech qanday faol ishi yo'q" : "BO'SH — muddatli ishi yo'q")
            : l.nextDays === 1
              ? "NISBATAN BO'SH — keyingi muddati ertaga"
              : `BO'SH — keyingi muddati ${l.nextDays} kundan keyin`;

      return {
        id: e.id,
        ism: e.fullName,
        lavozim: e.role?.name || '',
        holati: present.has(e.id) ? 'bugun ishga kelgan' : 'bugun ishga KELMAGAN',
        bandligi: bandlik,
        bugun_topshiriladigan_ishlari: l.dueToday,
        muddati_otgan_ishlari: l.overdue,
        jami_faol_ishlari: l.count,
      };
    });
  }

  /**
   * Rahbar qoidalari qaysi xodimlarni taqiqlashini aniqlaydi.
   *
   * Nega alohida qadam: sinovda qoidalar qaror promptining ichiga qo'yilganda
   * model ularni O'QIDI, TAN OLDI ("Aziz Turdiyev rahbar qoidasi bilan
   * taqiqlangan") va shundan keyin baribir o'sha odamni tanladi. Ya'ni
   * "eng yaxshi nomzod, lekin taqiqlangan" ziddiyatini u ushlab tura olmadi.
   *
   * Shuning uchun taqiq qaror bilan bir vaqtda emas, undan OLDIN hisoblanadi
   * va taqiqlangan xodim ma'lumotdan butunlay olib tashlanadi — model uni
   * tanlay olmaydi, chunki ko'rmaydi. Qoidalarni talqin qilish baribir AI'da
   * qoladi (kodda qattiq ro'yxat yo'q), faqat natija majburiy bajariladi.
   */
  private async excludedByRules(
    rules: string,
    workload: Awaited<ReturnType<AutonomousResolverService['buildWorkloadPicture']>>,
  ): Promise<Set<string>> {
    const out = new Set<string>();
    if (!rules.trim()) return out;

    const roster = workload.map((e) => ({ id: e.id, ism: e.ism, lavozim: e.lavozim }));
    try {
      const res = await generateText({
        model: this.anthropic(MODEL),
        system:
          "Sen qoidalarni o'qib, ularga ko'ra ISH BERISH TAQIQLANGAN xodimlarni ajratasan.\n" +
          "Faqat qoidalar ANIQ taqiqlagan xodimlarni qo'sh. Shubha bo'lsa qo'shma.\n" +
          "Qoida umumiy bo'lsa (masalan \"dizayn ishini ustaga berma\") — lavozimga qarab ajrat.\n" +
          'Javob FAQAT JSON: {"taqiqlangan_idlar":["..."],"sabab":"qisqa izoh"}',
        prompt: `QOIDALAR:\n${rules.trim()}\n\nXODIMLAR:\n${JSON.stringify(roster)}`,
        temperature: 0,
        stopWhen: stepCountIs(1),
      });
      const raw = (res.text || '').trim();
      const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
      for (const id of parsed?.taqiqlangan_idlar || []) {
        if (workload.some((e) => e.id === id)) out.add(id);
      }
      if (out.size > 0) {
        this.logger.log(`Qoidalar bo'yicha chetlatildi: ${out.size} xodim — ${parsed?.sabab || ''}`);
      }
    } catch (e: any) {
      // Filtr ishlamasa qoidalar baribir qaror promptida qoladi — bu
      // qat'iy emas, lekin qarorni butunlay to'xtatishdan afzal.
      this.logger.warn(`Qoida filtri xatosi: ${e?.message}`);
    }
    return out;
  }

  /**
   * Xavf bo'yicha qaror chiqaradi. Hech narsa BAJARMAYDI — faqat taklif
   * qaytaradi. Bajarish/tasdiqlash chaqiruvchi tomonda hal qilinadi.
   *
   * Ruxsat berilgan amallar ro'yxati modelga qattiq beriladi; ro'yxatdan
   * tashqari narsa qaytarsa, natija bekor qilinadi.
   */
  async decide(
    tenantId: string,
    risk: { type: string; title: string; message: string; relatedTaskId?: string | null },
    allowedActions: string[],
    /** Rahbarning sozlamalarda yozgan o'z qoidalari (erkin matn). */
    instructions = '',
  ): Promise<ResolverDecision | null> {
    if (allowedActions.length === 0) return null;

    const fullWorkload = await this.buildWorkloadPicture(tenantId);
    // Qoida taqiqlagan xodimlar modelga umuman ko'rsatilmaydi.
    const banned = await this.excludedByRules(instructions, fullWorkload);
    const workload = fullWorkload.filter((e) => !banned.has(e.id));

    // Buyurtma tafsiloti — qayta tayinlash uchun kerak.
    let taskInfo: any = null;
    if (risk.relatedTaskId) {
      const t = await this.prisma.task.findFirst({
        where: { id: risk.relatedTaskId, tenantId },
        select: {
          id: true, displayId: true, orderName: true, title: true,
          deadlineAt: true, assignees: true,
        },
      });
      if (t) {
        let ids: string[] = [];
        try { const p = JSON.parse(t.assignees || '[]'); if (Array.isArray(p)) ids = p; } catch {}
        taskInfo = {
          id: t.id,
          nom: t.orderName || t.title,
          displayId: t.displayId,
          muddat: t.deadlineAt,
          hozirgi_masullar: ids,
        };
      }
    }

    // Model kalit nomlarini o'zicha yozib yubormasligi uchun tool'ning ANIQ
    // sxemasi beriladi. Sinovda modelni sxemasiz qoldirganda u snake_case
    // ishlatgan (task_id), tool esa camelCase kutadi (taskId) — natijada
    // qaror to'g'ri bo'lsa ham bajarilmasdi.
    const actionSpecs = allowedActions
      .map((name) => {
        const def = AGENT_TOOLS.find((d) => d.name === name);
        if (!def) return null;
        const shape = (def.inputSchema as any)?.shape || {};
        const fields = Object.keys(shape).join(', ');
        return `- ${name}: ${def.description}\n  input maydonlari (AYNAN shu nomlar bilan): ${fields}`;
      })
      .filter(Boolean)
      .join('\n');

    const rules = instructions.trim();

    const system = `Sen PrintFlow bosmaxona tizimining avtonom yordamchisisan.
Vazifang: aniqlangan muammoni ko'rib chiqib, uni hal qilish uchun eng maqbul
amalni O'ZING tanlash. Tayyor javob berilmaydi — vaziyatni o'zing baholaysan.

RUXSAT ETILGAN AMALLAR:
${actionSpecs}

QAT'IY QOIDALAR:
1. RAHBAR QOIDALARI (agar berilgan bo'lsa) HAMMA NARSADAN USTUN. Ular quyida,
   so'rov ichida keladi. Ularga zid qaror — XATO qaror, u qanchalik mantiqli
   ko'rinmasin. Qoida biror xodimni taqiqlasa, u xodim eng yaxshi nomzod bo'lsa
   ham tanlanmaydi: boshqasini tanla yoki "none" qaytar.
2. Faqat yuqoridagi amallardan birini tanla. input maydon nomlarini AYNAN ko'rsatilganidek yoz.
3. Agar hech qaysi amal mos kelmasa, ma'lumot yetarli bo'lmasa yoki eng yaxshi
   yechim odamning aralashuvi bo'lsa — action: "none" qaytar va sababini yoz.
   "Hech nima qilmaslik" ham to'g'ri qaror bo'lishi mumkin.
4. MUAMMONI YASHIRADIGAN amalni tanlama (bajarilmagan ishni "bajarildi" qilish,
   kelmagan xodimning davomatini yozish kabi).
5. Ishni faqat "bugun ishga kelgan" xodimga ber.
6. "bandligi" maydoni tayyor xulosa bilan beriladi ("BAND — bugun 2 ta ish
   topshirishi kerak", "BO'SH — keyingi muddati 3 kundan keyin"). Uni shundayligicha
   o'qi, raqamlarni qayta talqin qilma.
7. Kimni tanlashni o'zing hal qil. Odatda muhim omillar: xodim bugun ishdami,
   lavozimi bu ishga mos keladimi, bo'sh vaqti bormi, muddati o'tgan ishlari ko'pmi.
   Ularni vaziyatga qarab tarozila — qat'iy tartib yo'q.
8. Javobni FAQAT JSON ko'rinishida ber, boshqa matnsiz:
{"action":"<amal nomi yoki none>","input":{...},"qoidalar":"<rahbar qoidalari qanday hisobga olindi; qoida bo'lmasa: 'qoida yo'q'>","reasoning":"<o'zbekcha 1-2 jumla asos>"}

reasoning'ni rahbar o'qiydi. NEGA aynan shunday qaror qilganingni ayt —
masalan "Lazizga berdim: u bugun ishda, xuddi shu lavozimda, keyingi ishi esa
3 kundan keyin, ya'ni bugun vaqti bor. Shoxrux ishda bo'lsa ham bugun o'z ishini
topshirishi kerak."`;

    // Rahbar qoidalari SO'ROV ichida, ma'lumotdan KEYIN va topshiriqdan
    // OLDIN turadi. Sinovda ular system prompt boshida bo'lganda model
    // ularni e'tiborsiz qoldirgan edi — uzoqda qolib, umumiy mulohaza ustun
    // kelgan. Qarorga eng yaqin joyda turgani ancha ishonchli ishlaydi.
    const user = `MUAMMO: ${risk.title}
${risk.message}

${taskInfo ? `TEGISHLI BUYURTMA:\n${JSON.stringify(taskInfo)}\n\n` : ''}XODIMLAR HOLATI:
${JSON.stringify(workload, null, 1)}
${
  rules
    ? `
════════════════════════════════════════
RAHBARNING QOIDALARI — BULAR MAJBURIY:
${rules}
════════════════════════════════════════
Qaror qilishdan OLDIN har bir qoidani o'qib chiq va tanlovingni ularga solishtir.
Qoidaga zid nomzodni TANLAMA.
`
    : ''
}
Endi qaror chiqar.`;

    try {
      const res = await generateText({
        model: this.anthropic(MODEL),
        system,
        prompt: user,
        temperature: 0,
        stopWhen: stepCountIs(1),
      });

      const raw = (res.text || '').trim();
      const jsonText = raw.startsWith('{') ? raw : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonText);

      if (!parsed?.action || parsed.action === 'none') return null;
      // Model ro'yxatdan tashqari amal taklif qilsa — qabul qilmaymiz.
      if (!allowedActions.includes(parsed.action)) {
        this.logger.warn(`Ruxsat etilmagan amal taklif qilindi: ${parsed.action}`);
        return null;
      }

      const input = parsed.input || {};
      // Kimni tanlashga aralashmaymiz — bu AI'ning qarori. Lekin QAYSI
      // buyurtma haqida ketayotgani xavf kartasidan aniq ma'lum, shuning
      // uchun uni tasdiqlab qo'yamiz: model bu yerda adashsa, mutlaqo
      // boshqa buyurtma o'zgarib ketardi.
      if (parsed.action === 'reassignTask' && taskInfo) input.taskId = taskInfo.id;

      // Tanlangan xodim haqiqatan mavjudligini tekshiramiz — model ID'ni
      // o'ylab topib yuborsa, amal shovqinsiz muvaffaqiyatsiz bo'lardi.
      if (input.newAssigneeId && !workload.some((e) => e.id === input.newAssigneeId)) {
        this.logger.warn(`Model mavjud bo'lmagan xodim ID'sini qaytardi: ${input.newAssigneeId}`);
        return null;
      }
      // Vazifani o'sha odamning o'ziga "o'tkazish" — bo'sh amal. Sinovda
      // model buni bir marta qildi. Rahbar dashboardda hech nima o'zgarmagan
      // "bajarildi" yozuvini ko'rmasligi kerak.
      if (
        parsed.action === 'reassignTask' &&
        taskInfo?.hozirgi_masullar?.length === 1 &&
        taskInfo.hozirgi_masullar[0] === input.newAssigneeId
      ) {
        this.logger.log("Qaror o'tkazib yuborildi: xodim allaqachon o'sha");
        return null;
      }

      return {
        action: parsed.action,
        input,
        reasoning: String(parsed.reasoning || '').slice(0, 500),
      };
    } catch (e: any) {
      this.logger.warn(`Qaror chiqarishda xato: ${e?.message}`);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // KUNLIK AVTONOM YURISH — 07:00 UTC (=12:00 Toshkent).
  //
  // Nega tushda: ish kuni boshlangan, davomat allaqachon aniq. Ertalab
  // ishga tushirilsa "hech kim kelmagan" degan xulosa noto'g'ri bo'lardi.
  // ──────────────────────────────────────────────────────────────────
  @Cron('0 7 * * *')
  async runAutoResolve() {
    const dateStr = this.tashkentDateString();
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const t of tenants) {
      try {
        const policies = await this.autonomous.readPolicies(t.id);
        const cfg = policies.autoResolve;
        if (!cfg?.enabled || !cfg.allowedActions?.length) continue;
        // Barcha sohalar 'off' bo'lsa qilinadigan ish yo'q — modelni
        // bekorga chaqirmaymiz.
        if (!Object.values(cfg.areas || {}).some((m) => m === 'propose' || m === 'execute')) continue;

        // Bir kunda bir marta — bir nechta instansiya bo'lsa ham.
        const gotLock = await this.telegram.acquireCronLock(t.id, `cron_lock:auto_resolve:${dateStr}`);
        if (!gotLock) continue;

        await this.resolveForTenant(t.id, t.name, cfg);
      } catch (e: any) {
        this.logger.warn(`Avtonom hal qilish xatosi (${t.id}): ${e?.message}`);
      }
    }
  }

  /** Bitta tenant uchun ochiq xavflarni ko'rib chiqadi va qaror taklif qiladi. */
  async resolveForTenant(
    tenantId: string,
    tenantName: string,
    cfg: AgentPolicies['autoResolve'],
  ): Promise<number> {
    const openRisks = await this.risks.listOpenRisks(tenantId);
    if (openRisks.length === 0) return 0;

    let handled = 0;
    const proposed: string[] = [];
    const executed: string[] = [];

    for (const risk of openRisks) {
      if (handled >= (cfg.maxPerDay ?? 5)) break;

      // Har xavf o'z sohasining erkinlik darajasiga bo'ysunadi. Rahbar ish
      // taqsimotini AI'ga topshirib, moliyaga tegishni taqiqlagan bo'lishi
      // mumkin — shuning uchun rejim global emas, soha bo'yicha o'qiladi.
      const area = riskArea((risk as any).type);
      const mode = area ? cfg.areas?.[area] : undefined;
      if (!mode || mode === 'off') continue;

      const decision = await this.decide(
        tenantId,
        risk as any,
        cfg.allowedActions,
        cfg.instructions,
      );
      if (!decision) continue;

      // Qaror AgentAction'ga yoziladi. 'propose' rejimida `pending` bo'lib
      // qoladi — rahbar tasdiqlagach mavjud confirm oqimi uni bajaradi.
      const action = await this.prisma.agentAction.create({
        data: {
          tenantId,
          userId: 'autonomous',
          toolName: decision.action,
          summary: decision.reasoning,
          input: decision.input as any,
          status: 'pending',
        },
      });

      handled += 1;

      // `execute` rejimida amal DARHOL bajariladi. Aks holda rejim nomi
      // yolg'on bo'lardi: ilgari bu yerda ikkala rejimda ham faqat `pending`
      // yozuv yaratilardi, Telegram esa "AI bajardi" deb xabar berardi.
      if (mode === 'execute') {
        const ok = await this.executeDecision(tenantId, action.id, decision);
        executed.push(ok ? `• ${decision.reasoning}` : `• ⚠️ Bajarilmadi: ${decision.reasoning}`);
      } else {
        proposed.push(`• ${decision.reasoning}`);
      }
      this.logger.log(`Avtonom (${tenantId}/${area}/${mode}): ${decision.action} — ${decision.reasoning}`);

      // Xavf kartasini yopib qo'ymaymiz: keyingi detektor yurishi shartni
      // qayta tekshiradi va muammo haqiqatan yo'qolgan bo'lsa o'zi yopadi.
    }

    // Bajarilgan va taklif qilingan ishlar ALOHIDA ko'rsatiladi — sohalar
    // turli rejimda bo'lishi mumkin, ularni bitta ro'yxatga qo'shsak rahbar
    // nima allaqachon o'zgargan-u nima tasdiq kutayotganini ajrata olmasdi.
    const blocks: string[] = [];
    if (executed.length) blocks.push(`✅ *AI ${executed.length} ta amalni bajardi:*`, ...executed);
    if (proposed.length) {
      if (blocks.length) blocks.push('');
      blocks.push(
        `📋 *AI ${proposed.length} ta taklif tayyorladi:*`,
        ...proposed,
        '',
        '_Tasdiqlash uchun: Dashboard → AI nazorati._',
      );
    }
    if (blocks.length) {
      const text = [`🤖 *${tenantName}*`, '', ...blocks].join('\n');
      const ids = await this.managementTelegramIds(tenantId);
      for (const id of ids) await this.telegram.sendMessage(id, text);
    }

    return handled;
  }

  /**
   * `execute` rejimida qarorni haqiqatan bajaradi.
   *
   * RUXSAT DOIRASI: bu yerda odam roli yo'q — amalni AI o'zi boshlagan.
   * Cheklov roldan emas, SIYOSATDAN keladi: rahbar `allowedActions` da
   * ruxsat bergan amallar ro'yxati `decide()` ga uzatiladi va undan
   * tashqarisi qabul qilinmaydi. Shuning uchun kontekst isAdmin bilan
   * quriladi — tool darajasidagi rol tekshiruvi bu yerda ortiqcha darvoza
   * bo'lardi va siyosatga zid ravishda amalni bloklab qo'yardi.
   */
  private async executeDecision(
    tenantId: string,
    actionId: string,
    decision: ResolverDecision,
  ): Promise<boolean> {
    const ctx: ToolContext = {
      tenantId,
      userId: 'autonomous',
      branchId: null,
      isAdmin: true,
      perms: {},
      services: { prisma: this.prisma, tasks: this.tasks, finance: this.finance, telegram: this.telegram },
    };
    try {
      const res: any = await executeConfirmedAction(ctx, actionId);
      if (res?.success === false) {
        this.logger.warn(`Avtonom amal bajarilmadi (${decision.action}): ${res.error}`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.warn(`Avtonom amal xatosi (${decision.action}): ${e?.message}`);
      return false;
    }
  }

  /** Rahbariyat Telegram ID'lari — taklif/hisobot shularga boradi. */
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
}
