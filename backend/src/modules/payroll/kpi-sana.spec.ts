import { kpiSanasiniOqi } from './salary-metrics.service';

describe('kpiSanasiniOqi', () => {
  const kun = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

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
});
