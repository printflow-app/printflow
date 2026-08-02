import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

// =============================================
// BREAK-EVEN (ZARARSIZLIK NUQTASI)
//
// Savol: "shu oy zararsiz chiqish uchun yana qancha ish kerak?"
//
// Xarajat ikki yo'l bilan aniqlanadi — tashkilot o'zi tanlaydi:
//
//   AVTOMATIK — kassadagi haqiqiy chiqimlardan hisoblanadi. Hech narsa
//     kiritish shart emas, lekin xarajat tarixi kerak. Ustiga qo'lda
//     qo'shimcha qatorlar qo'shish mumkin (masalan hali kassaga
//     tushmagan, lekin ma'lum bo'lgan ijara).
//
//   QO'LDA — faqat qo'lda yozilgan jadval ishlatiladi. Yangi tashkilotda
//     yoki kassada xarajat to'liq yuritilmaganda shu qulay.
//
// Har xarajat BO'LIMGA biriktiriladi — poligrafiya va tashqi reklama
// alohida nolga chiqadi, ularning moliyasi aralashmaydi. Bo'limsizlari
// umumiy hisobga kiradi.
// =============================================

/** Necha oylik tarixga qarab xarajat xulqi aniqlanadi (avtomatik rejim). */
const HISTORY_MONTHS = 6;

/**
 * Xarajat turi shu qancha oyda uchrasa — DOIMIY hisoblanadi.
 *
 * 6 oylik oynada 5+ oyda takrorlangan xarajat (maosh, ijara) doimiy;
 * 1-2 marta chiqqani (jihoz ta'miri) tasodifiy. Chegara tajribadan emas,
 * mantiqdan: doimiy xarajat deyarli har oy bo'ladi.
 */
const REGULAR_MIN_MONTHS = 5;

/** Qo'lda kiritilgan bitta xarajat qatori. */
export interface ManualCost {
  id: string;
  nom: string;
  summa: number;
  /** 'doimiy' — har oy; 'vaqtinchalik' — vaqti-vaqti bilan, oyga taqsimlanadi. */
  tur: 'doimiy' | 'vaqtinchalik';
  /** Necha oyda bir marta (faqat 'vaqtinchalik' uchun). */
  oyda_bir?: number;
  /** null = umumiy (bo'limga tegishli emas). */
  departmentId?: string | null;
}

export interface BreakEvenScope {
  id: string | null;
  nom: string;
  doimiy_xarajat: number;
  vaqtinchalik_ulush: number;
  kerakli_qoplama: number;
  tushum: number;
  foiz: number;
  qolgan_summa: number;
  nolga_chiqdi: boolean;
}

export interface BreakEvenResult {
  oy: string;
  rejim: 'auto' | 'manual';
  malumot_yetarli: boolean;
  izoh: string;
  umumiy: BreakEvenScope;
  bolimlar: BreakEvenScope[];
  xarajat_turlari: Array<{ nom: string; oylik: number; tur: 'doimiy' | 'vaqtinchalik'; manba: 'kassa' | 'qolda' }>;
}

@Injectable()
export class BreakEvenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private tashkentNow(): Date {
    return new Date(Date.now() + 5 * 3600000);
  }

  private monthKey(d: Date): string {
    return d.toISOString().slice(0, 7);
  }

  /** Qo'lda kiritilgan xarajatlar va rejim sozlamasi. */
  async readConfig(): Promise<{ rejim: 'auto' | 'manual'; xarajatlar: ManualCost[] }> {
    try {
      const raw = await this.settings.get('BREAK_EVEN');
      const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        rejim: cfg?.rejim === 'manual' ? 'manual' : 'auto',
        xarajatlar: Array.isArray(cfg?.xarajatlar) ? cfg.xarajatlar : [],
      };
    } catch {
      return { rejim: 'auto', xarajatlar: [] };
    }
  }

  async saveConfig(cfg: { rejim: 'auto' | 'manual'; xarajatlar: ManualCost[] }) {
    await this.settings.set('BREAK_EVEN', {
      rejim: cfg.rejim === 'manual' ? 'manual' : 'auto',
      xarajatlar: (cfg.xarajatlar || []).map((x) => ({
        id: String(x.id || Math.random().toString(36).slice(2)),
        nom: String(x.nom || '').trim(),
        summa: Math.max(0, Number(x.summa) || 0),
        tur: x.tur === 'vaqtinchalik' ? 'vaqtinchalik' : 'doimiy',
        oyda_bir: x.tur === 'vaqtinchalik' ? Math.max(1, Number(x.oyda_bir) || 12) : undefined,
        departmentId: x.departmentId || null,
      })),
    });
    return this.readConfig();
  }

  async compute(tenantId: string): Promise<BreakEvenResult> {
    const now = this.tashkentNow();
    const oy = this.monthKey(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 5 * 3600000);
    const historyStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - HISTORY_MONTHS, 1) - 5 * 3600000,
    );

    const cfg = await this.readConfig();

    const [departments, history, income] = await Promise.all([
      this.prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } }),
      // Tarixiy chiqimlar — avtomatik rejim uchun. Ichki o'tkazma xarajat emas.
      cfg.rejim === 'auto'
        ? this.prisma.transaction.findMany({
            where: {
              tenantId, type: 'chiqim', isInternalTransfer: false,
              date: { gte: historyStart, lt: monthStart },
            },
            select: { amount: true, date: true, departmentId: true, expenseType: { select: { name: true } } },
          })
        : Promise.resolve([] as any[]),
      // Shu oygi sof tushum — bo'lim kesimida.
      this.prisma.transaction.findMany({
        where: { tenantId, type: 'kirim', isInternalTransfer: false, date: { gte: monthStart } },
        select: { amount: true, departmentId: true },
      }),
    ]);

    // ── Xarajatlarni bo'lim bo'yicha yig'amiz ────────────────────────
    // Kalit: departmentId yoki null (umumiy).
    const doimiy = new Map<string | null, number>();
    const vaqtinchalik = new Map<string | null, number>();
    const turlar: BreakEvenResult['xarajat_turlari'] = [];

    if (cfg.rejim === 'auto' && history.length > 0) {
      const byType = new Map<string, { name: string; dept: string | null; months: Set<string>; total: number }>();
      for (const e of history) {
        const name = e.expenseType?.name || 'Boshqa xarajatlar';
        const key = `${e.departmentId || '-'}::${name}`;
        const cur = byType.get(key) || { name, dept: e.departmentId, months: new Set<string>(), total: 0 };
        cur.months.add(this.monthKey(new Date(e.date.getTime() + 5 * 3600000)));
        cur.total += e.amount || 0;
        byType.set(key, cur);
      }
      const observedMonths = new Set(
        history.map((e) => this.monthKey(new Date(e.date.getTime() + 5 * 3600000))),
      ).size;
      const divisor = Math.max(1, observedMonths);

      for (const v of byType.values()) {
        const oylik = v.total / divisor;
        const tur = v.months.size >= Math.min(REGULAR_MIN_MONTHS, divisor) ? 'doimiy' : 'vaqtinchalik';
        const bucket = tur === 'doimiy' ? doimiy : vaqtinchalik;
        bucket.set(v.dept, (bucket.get(v.dept) || 0) + oylik);
        turlar.push({ nom: v.name, oylik: Math.round(oylik), tur, manba: 'kassa' });
      }
    }

    // Qo'lda kiritilganlar HAR IKKI rejimda qo'shiladi: avtomatik rejimda
    // ular kassada hali ko'rinmagan xarajatni to'ldiradi.
    for (const m of cfg.xarajatlar) {
      // Vaqti-vaqti bilan bo'ladigan xarajat oyga taqsimlanadi — aks holda
      // u chiqqan oyda zarar, qolganida soxta foyda ko'rinardi.
      const oylik = m.tur === 'vaqtinchalik' ? m.summa / Math.max(1, m.oyda_bir || 12) : m.summa;
      const bucket = m.tur === 'doimiy' ? doimiy : vaqtinchalik;
      const dept = m.departmentId || null;
      bucket.set(dept, (bucket.get(dept) || 0) + oylik);
      turlar.push({ nom: m.nom || 'Nomsiz', oylik: Math.round(oylik), tur: m.tur, manba: 'qolda' });
    }

    // ── Tushum bo'lim bo'yicha ───────────────────────────────────────
    const tushum = new Map<string | null, number>();
    for (const i of income) {
      const d = i.departmentId || null;
      tushum.set(d, (tushum.get(d) || 0) + (i.amount || 0));
    }

    const build = (id: string | null, nom: string): BreakEvenScope => {
      const d = Math.round(doimiy.get(id) || 0);
      const v = Math.round(vaqtinchalik.get(id) || 0);
      const kerak = d + v;
      const t = Math.round(tushum.get(id) || 0);
      const qolgan = Math.max(0, kerak - t);
      return {
        id, nom,
        doimiy_xarajat: d,
        vaqtinchalik_ulush: v,
        kerakli_qoplama: kerak,
        tushum: t,
        foiz: kerak > 0 ? Math.min(100, Math.round((t / kerak) * 100)) : 100,
        qolgan_summa: qolgan,
        nolga_chiqdi: kerak > 0 && qolgan === 0,
      };
    };

    // Umumiy — hamma bo'lim va bo'limsizlari birga.
    const sum = (m: Map<string | null, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const umumiyKerak = Math.round(sum(doimiy) + sum(vaqtinchalik));
    const umumiyTushum = Math.round(sum(tushum));
    const umumiy: BreakEvenScope = {
      id: null,
      nom: 'Umumiy',
      doimiy_xarajat: Math.round(sum(doimiy)),
      vaqtinchalik_ulush: Math.round(sum(vaqtinchalik)),
      kerakli_qoplama: umumiyKerak,
      tushum: umumiyTushum,
      foiz: umumiyKerak > 0 ? Math.min(100, Math.round((umumiyTushum / umumiyKerak) * 100)) : 100,
      qolgan_summa: Math.max(0, umumiyKerak - umumiyTushum),
      nolga_chiqdi: umumiyKerak > 0 && umumiyTushum >= umumiyKerak,
    };

    const bolimlar = departments.map((d) => build(d.id, d.name));
    // Bo'limga biriktirilmagan pul bo'lsa, uni ham alohida ko'rsatamiz —
    // aks holda bo'limlar yig'indisi umumiyga teng kelmay, raqam "yo'qolgan"
    // bo'lib ko'rinardi.
    const biriktirilmagan = build(null, 'Bo\'limsiz');
    if (biriktirilmagan.kerakli_qoplama > 0 || biriktirilmagan.tushum > 0) {
      bolimlar.push(biriktirilmagan);
    }

    const observed = cfg.rejim === 'auto'
      ? new Set(history.map((e) => this.monthKey(new Date(e.date.getTime() + 5 * 3600000)))).size
      : 0;
    const yetarli = cfg.rejim === 'manual' ? cfg.xarajatlar.length > 0 : observed >= 2;

    return {
      oy,
      rejim: cfg.rejim,
      malumot_yetarli: yetarli,
      izoh: cfg.rejim === 'manual'
        ? (cfg.xarajatlar.length
            ? `Qo'lda kiritilgan ${cfg.xarajatlar.length} ta xarajat asosida.`
            : "Qo'lda rejim tanlangan, lekin hali xarajat kiritilmagan.")
        : (yetarli
            ? `${observed} oylik kassa tarixi asosida${cfg.xarajatlar.length ? ` + ${cfg.xarajatlar.length} ta qo'lda qo'shilgan` : ''}.`
            : `Faqat ${observed} oylik tarix bor — raqamlar taxminiy, oylar o'tgani sari aniqlashadi.`),
      umumiy,
      bolimlar,
      xarajat_turlari: turlar.sort((a, b) => b.oylik - a.oylik).slice(0, 20),
    };
  }
}
