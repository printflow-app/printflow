// =============================================
// MAOSH SXEMASI — turlar, metrika katalogi va hisoblash dvigateli.
//
// Bu fayl ATAYLAB sof (pure): bazaga ham, Nest DI'ga ham bog'liq emas.
// Metrikalar tashqarida o'lchanadi va tayyor raqam bo'lib kiradi, bu yerda
// faqat arifmetika bo'ladi — shuning uchun uni test bilan qotirish oson.
//
// TIL QOIDASI: bu formula PARSERI emas. Sxema — qatorlar ro'yxati, har qator
// uch turdan biri (fixed / per_unit / percent) va ixtiyoriy bitta shart.
// Shu sodda tuzilma amaliy holatlarni qoplaydi, jumladan fiksaning o'zi bir
// necha shartli qismdan yig'ilishini:
//     1 000 000  — asosiy (shartsiz)
//   + 1 000 000  — agar ish kunlari >= 22
//   + 1 000 000  — agar kechikish daqiqasi = 0
// =============================================

/** Tizim haqiqatan o'lchay oladigan metrikalar (hammasi bazada mavjud). */
export const METRICS = {
  ish_kunlari: 'Ish kunlari (davomat belgilangan kunlar)',
  ish_soatlari: 'Ish soatlari (kelish–ketish yig\'indisi)',
  kechikish_daqiqa: 'Kechikish (daqiqa)',
  overtime_daqiqa: 'Qo\'shimcha ish (daqiqa)',
  bajarilgan_buyurtma_soni: 'Bajarilgan buyurtmalar soni',
  bajarilgan_buyurtma_summasi: 'Bajarilgan buyurtmalar summasi',
  bajarilgan_buyurtma_miqdori: 'Bajarilgan buyurtmalar miqdori (dona)',
  kirim_summasi: 'Xodim orqali tushgan kirim',
} as const;

export type MetricKey = keyof typeof METRICS;

export type ComponentKind = 'fixed' | 'per_unit' | 'percent';

/** Qator qaysi bo'limga tegishli — payslip shu bo'yicha guruhlanadi. */
export type ComponentGroup = 'fiksa' | 'kpi' | 'jarima';

export interface ComponentCondition {
  metric: MetricKey;
  op: 'gte' | 'lte' | 'eq';
  value: number;
}

export interface SalaryComponent {
  id: string;
  label: string;
  group: ComponentGroup;
  kind: ComponentKind;

  /** kind='fixed' uchun summa. */
  amount?: number;

  /** kind='per_unit' | 'percent' uchun qaysi metrika olinadi. */
  metric?: MetricKey;

  /** per_unit: bir birlik narxi. percent: foiz (3 = 3%). */
  rate?: number;

  /** Ixtiyoriy shart — bajarilmasa qator hisoblanmaydi. */
  condition?: ComponentCondition;

  /**
   * Bir nechta shart — HAMMASI bajarilishi kerak.
   *
   * Nega kerak: "vaqtida kelgani uchun 1 mln" degan qatorni yolg'iz
   * `kechikish_daqiqa = 0` sharti bilan yozib bo'lmaydi — umuman ishga
   * kelmagan xodimda ham kechikish nolga teng bo'ladi va bonus berilib
   * ketadi. To'g'ri shart: "kechikish = 0 VA ish kunlari ≥ 22".
   */
  conditions?: ComponentCondition[];

  /**
   * Shart to'liq bajarilmasa nisbatan hisoblansinmi.
   * Masalan "ish kunlari >= 22 bo'lsa 1 000 000": xodim 20 kun kelgan bo'lsa
   *   false (default) → 0 (hammasi yoki hech nima)
   *   true            → 1 000 000 × 20/22 = 909 091
   * Faqat 'gte' shartida va 'fixed' turida ma'noga ega.
   */
  proportional?: boolean;
}

export type MetricValues = Record<MetricKey, number>;

export interface ComponentResult {
  id: string;
  label: string;
  group: ComponentGroup;
  /** Hisoblangan summa (jarima guruhida ham MUSBAT saqlanadi). */
  amount: number;
  /** Odam o'qiydigan izoh: "18 × 15 000" yoki "shart bajarilmadi (20 < 22)". */
  note: string;
  /** Shart bor edi-yu bajarilmadimi. */
  skipped: boolean;
}

export interface SalaryComputation {
  fiksa: number;
  kpi: number;
  jarima: number;
  /** fiksa + kpi (jarima AYIRILMAYDI — u alohida, tasdiq bilan qo'llanadi). */
  hisoblangan: number;
  rows: ComponentResult[];
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('uz-UZ');
}

/** Shartni tekshiradi va (proporsional bo'lsa) koeffitsient qaytaradi. */
function evalCondition(
  cond: ComponentCondition,
  metrics: MetricValues,
  proportional: boolean,
): { pass: boolean; ratio: number; note: string } {
  const actual = metrics[cond.metric] ?? 0;
  const label = METRICS[cond.metric];

  let pass: boolean;
  switch (cond.op) {
    case 'gte': pass = actual >= cond.value; break;
    case 'lte': pass = actual <= cond.value; break;
    case 'eq': pass = actual === cond.value; break;
  }

  if (pass) return { pass: true, ratio: 1, note: `${label}: ${fmt(actual)}` };

  // Nisbatan hisoblash faqat "kamida shuncha bo'lsin" shartida mantiqiy.
  if (proportional && cond.op === 'gte' && cond.value > 0) {
    const ratio = Math.max(0, Math.min(1, actual / cond.value));
    return {
      pass: true,
      ratio,
      note: `${label}: ${fmt(actual)} / ${fmt(cond.value)} — nisbatan`,
    };
  }

  const opText = cond.op === 'gte' ? '≥' : cond.op === 'lte' ? '≤' : '=';
  return {
    pass: false,
    ratio: 0,
    note: `shart bajarilmadi (${label}: ${fmt(actual)}, kerak ${opText} ${fmt(cond.value)})`,
  };
}

/** Bitta qatorni hisoblaydi. */
function computeComponent(c: SalaryComponent, metrics: MetricValues): ComponentResult {
  const base: Omit<ComponentResult, 'amount' | 'note' | 'skipped'> = {
    id: c.id,
    label: c.label,
    group: c.group,
  };

  // `condition` (bitta) va `conditions` (ro'yxat) — ikkalasi ham qo'llab
  // quvvatlanadi, hammasi bajarilishi shart.
  const allConditions: ComponentCondition[] = [
    ...(c.condition ? [c.condition] : []),
    ...(c.conditions || []),
  ];

  let ratio = 1;
  const condNotes: string[] = [];
  for (const cond of allConditions) {
    const r = evalCondition(cond, metrics, !!c.proportional);
    if (!r.pass) return { ...base, amount: 0, note: r.note, skipped: true };
    // Bir nechta shartda eng kichik koeffitsient olinadi — eng zaif bo'g'in.
    ratio = Math.min(ratio, r.ratio);
    condNotes.push(r.note);
  }
  const condNote = condNotes.join('; ');

  let amount = 0;
  let note = '';

  switch (c.kind) {
    case 'fixed': {
      amount = (c.amount || 0) * ratio;
      note = ratio === 1 ? (condNote || 'qat\'iy summa') : condNote;
      break;
    }
    case 'per_unit': {
      const value = c.metric ? metrics[c.metric] ?? 0 : 0;
      amount = value * (c.rate || 0) * ratio;
      note = `${fmt(value)} × ${fmt(c.rate || 0)}`;
      break;
    }
    case 'percent': {
      const value = c.metric ? metrics[c.metric] ?? 0 : 0;
      amount = (value * (c.rate || 0)) / 100 * ratio;
      note = `${fmt(value)} ning ${c.rate || 0}%`;
      break;
    }
  }

  return { ...base, amount: Math.round(amount), note, skipped: false };
}

/**
 * Butun sxemani hisoblaydi.
 *
 * DIQQAT: jarima natijadan AYIRILMAYDI. Foydalanuvchi qarori bo'yicha jarima
 * "hisoblab ko'rsatiladi, tasdiqlansa qo'llanadi" — shuning uchun bu yerda
 * faqat taklif sifatida qaytariladi, ayirishni buxgalter tasdiqlaganda
 * payroll servisi bajaradi.
 */
export function computeSalary(
  components: SalaryComponent[],
  metrics: MetricValues,
): SalaryComputation {
  const rows = (components || []).map((c) => computeComponent(c, metrics));

  let fiksa = 0;
  let kpi = 0;
  let jarima = 0;
  for (const r of rows) {
    if (r.group === 'fiksa') fiksa += r.amount;
    else if (r.group === 'kpi') kpi += r.amount;
    else jarima += r.amount;
  }

  return {
    fiksa: Math.round(fiksa),
    kpi: Math.round(kpi),
    jarima: Math.round(jarima),
    hisoblangan: Math.round(fiksa + kpi),
    rows,
  };
}

/** Bo'sh metrika to'plami — o'lchash xizmati shu qolipni to'ldiradi. */
export function emptyMetrics(): MetricValues {
  return Object.keys(METRICS).reduce((acc, k) => {
    acc[k as MetricKey] = 0;
    return acc;
  }, {} as MetricValues);
}
