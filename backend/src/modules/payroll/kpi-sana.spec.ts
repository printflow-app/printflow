import { kpiSanasiniOqi, tashkentKuni } from './salary-metrics.service';

describe('kpiSanasiniOqi', () => {
  // Toshkent (UTC+5) bo'yicha kun — kesish shu taqvim bilan solishtiriladi.
  const kun = (d: Date | null) => (d ? tashkentKuni(d) : null);

  it("to'g'ri ko'rinishni o'qiydi", () => {
    expect(kun(kpiSanasiniOqi({ value: '2026-08-01' }))).toBe('2026-08-01');
  });

  it("sof satrni o'qiydi", () => {
    expect(kun(kpiSanasiniOqi('2026-08-01'))).toBe('2026-08-01');
  });

  // Prodda topilgan haqiqiy buzuq yozuv: sana kalit bo'lib saqlanib qolgan.
  // Eski kod buni o'qiy olmasdi va kesish jimgina o'chib qolardi.
  it('buzuq ko\'rinishni ham tushunadi: {"2026-08-01":""}', () => {
    expect(kun(kpiSanasiniOqi({ '2026-08-01': '' }))).toBe('2026-08-01');
  });

  it("sana yo'q bo'lsa null qaytaradi", () => {
    expect(kpiSanasiniOqi(null)).toBeNull();
    expect(kpiSanasiniOqi({})).toBeNull();
    expect(kpiSanasiniOqi({ value: '' })).toBeNull();
    expect(kpiSanasiniOqi({ value: null })).toBeNull();
  });

  // Muhim: sana o'rniga axlat kelsa, uni sana deb o'ylab qolmasin —
  // aks holda butun arxiv tasodifiy kesilib ketardi.
  it("sanaga o'xshamagan qiymatni qabul qilmaydi", () => {
    expect(kpiSanasiniOqi({ salom: '' })).toBeNull();
    expect(kpiSanasiniOqi({ value: 'ha' })).toBeNull();
  });

  // ASOSIY XATO: chegara UTC yarim tuni bo'lsa, Toshkentda 1-avgust
  // ertalab (00:00–05:00) qabul qilingan buyurtma "KPI'dan oldingi" deb
  // kesib tashlanardi. Chegara Toshkent yarim tuni bo'lishi shart.
  it('sanani Toshkent yarim tuni deb oladi, UTC emas', () => {
    const chegara = kpiSanasiniOqi('2026-08-01')!;
    expect(chegara.toISOString()).toBe('2026-07-31T19:00:00.000Z');

    // 1-avgust, Toshkent vaqti bilan 03:00 da yaratilgan buyurtma.
    const buyurtma = new Date('2026-07-31T22:00:00.000Z');
    expect(buyurtma < chegara).toBe(false); // kesilmaydi

    // 31-iyul, Toshkent vaqti bilan 23:00 — bu rostdan ham oldin.
    const eski = new Date('2026-07-31T18:00:00.000Z');
    expect(eski < chegara).toBe(true);
  });

  // Sozlamada to'liq vaqt belgisi bo'lsa u aniq instant — tegilmaydi.
  it("to'liq ISO vaqt belgisini o'zgartirmaydi", () => {
    const d = kpiSanasiniOqi('2026-08-01T09:30:00.000Z')!;
    expect(d.toISOString()).toBe('2026-08-01T09:30:00.000Z');
  });
});

describe('tashkentKuni', () => {
  it('UTC instantni Toshkent taqvimidagi kunga aylantiradi', () => {
    // Oy boshi: Toshkentda 1-avgust, UTC'da hali 31-iyul.
    expect(tashkentKuni(new Date('2026-07-31T19:00:00.000Z'))).toBe('2026-08-01');
    // Oy oxiri: Toshkentda 31-avgust 23:59, UTC'da 18:59.
    expect(tashkentKuni(new Date('2026-08-31T18:59:59.999Z'))).toBe('2026-08-31');
  });
});
