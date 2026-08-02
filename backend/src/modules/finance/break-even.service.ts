import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================
// BREAK-EVEN (ZARARSIZLIK NUQTASI)
//
// Savol: "shu oy zararsiz chiqish uchun yana qancha ish qilishim kerak?"
//
// Javob uchun uch narsa kerak:
//   1. Oylik DOIMIY xarajat — maosh, ijara, kommunal. Har oy takrorlanadi.
//   2. Vaqti-vaqti bilan bo'ladigan xarajat — 3-4 oyda, 6-12 oyda bir marta
//      (jihoz ta'miri, litsenziya). Ular oyga TAQSIMLANADI, aks holda
//      chiqqan oyida zarar, qolgan oylarda soxta foyda ko'rinadi.
//   3. Bir buyurtmadagi o'rtacha ustama — necha dona sotish kerakligini
//      shundan hisoblaymiz.
//
// MUHIM: hech narsa taxmin qilinmaydi. Doimiy/tasodifiy ajratish ham,
// o'rtacha summa ham TARIXDAN o'lchanadi — quyidagi izohlarga qarang.
// =============================================

/** Necha oylik tarixga qarab xarajat xulqi aniqlanadi. */
const HISTORY_MONTHS = 6;

/**
 * Xarajat turi shu qancha oyda uchrasa — DOIMIY hisoblanadi.
 *
 * 6 oylik oynada 5+ oyda takrorlangan xarajat (maosh, ijara) doimiy;
 * 1-2 marta chiqqani (jihoz ta'miri) tasodifiy. Chegara tajribadan emas,
 * mantiqdan: doimiy xarajat deyarli har oy bo'ladi.
 */
const REGULAR_MIN_MONTHS = 5;

export interface BreakEvenResult {
  /** Hisob qilingan davr (joriy oy, "YYYY-MM"). */
  oy: string;
  /** Tarix yetarlimi — yo'q bo'lsa qolgan raqamlar ishonchsiz. */
  malumot_yetarli: boolean;
  izoh: string;

  doimiy_xarajat: number;
  /** Vaqti-vaqti bilan bo'ladigan xarajatning oylik ulushi. */
  vaqtinchalik_ulush: number;
  /** Oyiga qoplanishi kerak bo'lgan jami xarajat. */
  kerakli_qoplama: number;

  /** Shu oy allaqachon tushgan sof tushum (ichki o'tkazmasiz). */
  bugungi_tushum: number;
  /** 0 dan 100 gacha — progress bar shuni ko'rsatadi. */
  foiz: number;
  /** Nolga chiqishga qolgan summa (0 bo'lsa — chiqilgan). */
  qolgan_summa: number;
  nolga_chiqdi: boolean;

  /** Eng ko'p sotiladigan xizmatlar bo'yicha "yana nechta kerak". */
  xizmatlar: Array<{
    nom: string;
    ortacha_summa: number;
    sotilgan: number;
    yana_kerak: number;
  }>;

  xarajat_turlari: Array<{ nom: string; oylik: number; tur: 'doimiy' | 'vaqtinchalik' }>;
}

@Injectable()
export class BreakEvenService {
  constructor(private readonly prisma: PrismaService) {}

  private tashkentNow(): Date {
    return new Date(Date.now() + 5 * 3600000);
  }

  private monthKey(d: Date): string {
    return d.toISOString().slice(0, 7);
  }

  async compute(tenantId: string): Promise<BreakEvenResult> {
    const now = this.tashkentNow();
    const oy = this.monthKey(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5 * 3600000);
    const historyStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - HISTORY_MONTHS, 1) - 5 * 3600000,
    );

    const [expenses, monthIncome, doneTasks] = await Promise.all([
      // Tarixiy chiqimlar — turini aniqlash uchun. Ichki o'tkazma xarajat emas.
      this.prisma.transaction.findMany({
        where: {
          tenantId,
          type: 'chiqim',
          isInternalTransfer: false,
          date: { gte: historyStart, lt: monthStart },
        },
        select: { amount: true, date: true, expenseTypeId: true, expenseType: { select: { name: true } } },
      }),
      // Shu oygi sof tushum.
      this.prisma.transaction.aggregate({
        where: {
          tenantId,
          type: 'kirim',
          isInternalTransfer: false,
          date: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      // Shu oy bajarilgan buyurtmalar — xizmat kesimida.
      this.prisma.task.findMany({
        where: { tenantId, isArchived: false, completedAt: { gte: monthStart } },
        select: { totalAmount: true, service: { select: { name: true } }, title: true },
      }),
    ]);

    if (expenses.length === 0) {
      return this.emptyResult(oy, 'Xarajat tarixi yo\'q — avval bir necha oy ishlash kerak.');
    }

    // ── Xarajatlarni turi bo'yicha ajratamiz ──────────────────────────
    // Har xarajat turi qaysi oylarda uchraganini sanaymiz.
    const byType = new Map<string, { name: string; months: Set<string>; total: number }>();
    for (const e of expenses) {
      const key = e.expenseTypeId || `nomsiz:${e.expenseType?.name || 'Boshqa'}`;
      const name = e.expenseType?.name || 'Boshqa xarajatlar';
      const cur = byType.get(key) || { name, months: new Set<string>(), total: 0 };
      cur.months.add(this.monthKey(new Date(e.date.getTime() + 5 * 3600000)));
      cur.total += e.amount || 0;
      byType.set(key, cur);
    }

    // Tarixda nechta ALOHIDA oy bor — o'rtachani shunga bo'lamiz.
    const observedMonths = new Set(
      expenses.map((e) => this.monthKey(new Date(e.date.getTime() + 5 * 3600000))),
    ).size;
    const divisor = Math.max(1, observedMonths);

    let doimiy = 0;
    let vaqtinchalik = 0;
    const turlar: BreakEvenResult['xarajat_turlari'] = [];
    for (const v of byType.values()) {
      const oylik = v.total / divisor;
      // Deyarli har oy uchrasa — doimiy; kamdan-kam bo'lsa — vaqtinchalik,
      // lekin baribir oyga taqsimlanadi (yiliga bir marta chiqadigan
      // xarajat ham har oy pul talab qiladi, faqat keyinroq).
      const tur = v.months.size >= Math.min(REGULAR_MIN_MONTHS, divisor) ? 'doimiy' : 'vaqtinchalik';
      if (tur === 'doimiy') doimiy += oylik;
      else vaqtinchalik += oylik;
      turlar.push({ nom: v.name, oylik: Math.round(oylik), tur });
    }
    turlar.sort((a, b) => b.oylik - a.oylik);

    const kerakli = Math.round(doimiy + vaqtinchalik);
    const tushum = Math.round(monthIncome._sum.amount || 0);
    const qolgan = Math.max(0, kerakli - tushum);
    const foiz = kerakli > 0 ? Math.min(100, Math.round((tushum / kerakli) * 100)) : 100;

    // ── Qolgan summani xizmatlarga aylantiramiz ───────────────────────
    // "Yana 12 ta vizitka kerak" degan javob rahbarga raqamdan foydaliroq.
    const svc = new Map<string, { total: number; count: number }>();
    for (const t of doneTasks) {
      const nom = t.service?.name || t.title || 'Boshqa';
      const cur = svc.get(nom) || { total: 0, count: 0 };
      cur.total += t.totalAmount || 0;
      cur.count += 1;
      svc.set(nom, cur);
    }
    const xizmatlar = [...svc.entries()]
      .map(([nom, v]) => {
        const ortacha = v.count > 0 ? v.total / v.count : 0;
        return {
          nom,
          ortacha_summa: Math.round(ortacha),
          sotilgan: v.count,
          yana_kerak: ortacha > 0 ? Math.ceil(qolgan / ortacha) : 0,
        };
      })
      // Eng ko'p sotilgani birinchi — rahbar odatda shunga tayanadi.
      .sort((a, b) => b.sotilgan - a.sotilgan)
      .slice(0, 5);

    const yetarli = observedMonths >= 2;
    return {
      oy,
      malumot_yetarli: yetarli,
      izoh: yetarli
        ? `${observedMonths} oylik xarajat tarixi asosida hisoblandi.`
        : `Faqat ${observedMonths} oylik tarix bor — raqamlar taxminiy, oylar o'tgani sari aniqlashadi.`,
      doimiy_xarajat: Math.round(doimiy),
      vaqtinchalik_ulush: Math.round(vaqtinchalik),
      kerakli_qoplama: kerakli,
      bugungi_tushum: tushum,
      foiz,
      qolgan_summa: qolgan,
      nolga_chiqdi: qolgan === 0,
      xizmatlar,
      xarajat_turlari: turlar.slice(0, 8),
    };
  }

  private emptyResult(oy: string, izoh: string): BreakEvenResult {
    return {
      oy,
      malumot_yetarli: false,
      izoh,
      doimiy_xarajat: 0,
      vaqtinchalik_ulush: 0,
      kerakli_qoplama: 0,
      bugungi_tushum: 0,
      foiz: 0,
      qolgan_summa: 0,
      nolga_chiqdi: false,
      xizmatlar: [],
      xarajat_turlari: [],
    };
  }
}
