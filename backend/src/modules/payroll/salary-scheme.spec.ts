import { computeSalary, emptyMetrics, MetricValues, SalaryComponent } from './salary-scheme';

// =============================================
// Maosh hisobi — pul bilan bog'liq mantiq, shuning uchun test bilan qotirilgan.
// Ayniqsa muhimi: jarima natijadan AYIRILMAYDI (tasdiq bilan qo'llanadi) va
// shart bajarilmasa qator butunlay tushib qoladi.
// =============================================

const m = (over: Partial<MetricValues>): MetricValues => ({ ...emptyMetrics(), ...over });

/** Foydalanuvchi tasvirlagan sxema: 3 mln fiksa uch shartli qismdan iborat. */
const dizayner: SalaryComponent[] = [
  { id: 'a', label: 'Asosiy fiksa', group: 'fiksa', kind: 'fixed', amount: 1_000_000 },
  {
    id: 'b', label: "To'liq davomat", group: 'fiksa', kind: 'fixed', amount: 1_000_000,
    condition: { metric: 'ish_kunlari', op: 'gte', value: 22 },
  },
  {
    id: 'c', label: 'Vaqtida kelish', group: 'fiksa', kind: 'fixed', amount: 1_000_000,
    condition: { metric: 'kechikish_daqiqa', op: 'eq', value: 0 },
  },
  {
    id: 'd', label: 'Bajarilgan buyurtma', group: 'kpi', kind: 'per_unit',
    metric: 'bajarilgan_buyurtma_soni', rate: 15_000,
  },
  {
    id: 'e', label: 'Kechikish jarimasi', group: 'jarima', kind: 'per_unit',
    metric: 'kechikish_daqiqa', rate: 5_000,
  },
];

describe('computeSalary', () => {
  it('barcha shartlar bajarilsa fiksa to\'liq chiqadi', () => {
    const r = computeSalary(dizayner, m({ ish_kunlari: 22, kechikish_daqiqa: 0, bajarilgan_buyurtma_soni: 18 }));
    expect(r.fiksa).toBe(3_000_000);
    expect(r.kpi).toBe(270_000);
    expect(r.jarima).toBe(0);
    expect(r.hisoblangan).toBe(3_270_000);
  });

  it('shart bajarilmasa o\'sha qator tushib qoladi', () => {
    const r = computeSalary(dizayner, m({ ish_kunlari: 20, kechikish_daqiqa: 35, bajarilgan_buyurtma_soni: 12 }));
    expect(r.fiksa).toBe(1_000_000); // faqat shartsiz qism
    expect(r.rows.filter((x) => x.skipped).map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('jarima hisoblanadi, lekin natijadan AYIRILMAYDI', () => {
    const r = computeSalary(dizayner, m({ ish_kunlari: 22, kechikish_daqiqa: 35 }));
    expect(r.jarima).toBe(175_000);
    // hisoblangan = fiksa + kpi, jarima ichida yo'q
    expect(r.hisoblangan).toBe(r.fiksa + r.kpi);
  });

  it('proportional yoqilganda qisman hisoblanadi', () => {
    const withProp = dizayner.map((c) => (c.id === 'b' ? { ...c, proportional: true } : c));
    const r = computeSalary(withProp, m({ ish_kunlari: 20 }));
    // 1 000 000 × 20/22
    expect(r.rows.find((x) => x.id === 'b')!.amount).toBe(909_091);
  });

  it('proportional faqat "kamida" (gte) shartida ishlaydi', () => {
    const withProp = dizayner.map((c) => (c.id === 'c' ? { ...c, proportional: true } : c));
    const r = computeSalary(withProp, m({ kechikish_daqiqa: 35 }));
    // 'eq' shartida nisbatan hisoblash mantiqsiz — qator tushib qoladi
    expect(r.rows.find((x) => x.id === 'c')!.skipped).toBe(true);
  });

  it('statik lavozim: bitta shartsiz qator', () => {
    const r = computeSalary(
      [{ id: 's', label: 'Oylik', group: 'fiksa', kind: 'fixed', amount: 4_000_000 }],
      m({ ish_kunlari: 5 }),
    );
    expect(r.hisoblangan).toBe(4_000_000);
  });

  it('foiz turi: metrikaning ulushi', () => {
    const r = computeSalary(
      [{ id: 'p', label: 'Sotuvdan', group: 'kpi', kind: 'percent', metric: 'kirim_summasi', rate: 3 }],
      m({ kirim_summasi: 40_000_000 }),
    );
    expect(r.kpi).toBe(1_200_000);
  });

  it('bir nechta shart: hammasi bajarilishi kerak', () => {
    // "Vaqtida kelish" bonusi faqat ishga kelgan xodimga tegishli bo'lishi
    // kerak. Yolg'iz "kechikish = 0" sharti yetarli emas: umuman kelmagan
    // xodimda ham kechikish nolga teng bo'ladi va bonus berilib ketardi.
    const comp: SalaryComponent[] = [{
      id: 'c', label: 'Vaqtida kelish', group: 'fiksa', kind: 'fixed', amount: 1_000_000,
      conditions: [
        { metric: 'kechikish_daqiqa', op: 'eq', value: 0 },
        { metric: 'ish_kunlari', op: 'gte', value: 22 },
      ],
    }];

    // Umuman kelmagan — bonus BERILMASLIGI kerak
    expect(computeSalary(comp, m({ ish_kunlari: 0, kechikish_daqiqa: 0 })).fiksa).toBe(0);
    // To'liq kelgan va kechikmagan — beriladi
    expect(computeSalary(comp, m({ ish_kunlari: 22, kechikish_daqiqa: 0 })).fiksa).toBe(1_000_000);
    // Kelgan, lekin kechikkan — berilmaydi
    expect(computeSalary(comp, m({ ish_kunlari: 22, kechikish_daqiqa: 10 })).fiksa).toBe(0);
  });

  it('bo\'sh sxema nolga teng', () => {
    const r = computeSalary([], emptyMetrics());
    expect(r.hisoblangan).toBe(0);
    expect(r.rows).toHaveLength(0);
  });
});
