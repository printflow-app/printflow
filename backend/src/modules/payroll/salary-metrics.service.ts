import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { emptyMetrics, MetricValues } from './salary-scheme';
import { SettingsService } from '../settings/settings.service';

// Davomat moduli bilan bir xil sukut — yakshanbadan boshqa kunlar.
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];

// Asia/Tashkent — UTC+5, yozgi vaqt yo'q.
const TZ = 5 * 3600000;

/** Toshkent bo'yicha "YYYY-MM-DD" — UTC instantni mahalliy kunga aylantiradi. */
export function tashkentKuni(d: Date): string {
  return new Date(d.getTime() + TZ).toISOString().slice(0, 10);
}

/**
 * KPI boshlanish sanasini sozlama qiymatidan ajratib oladi.
 *
 * Uch xil ko'rinish qabul qilinadi, chunki prodda uchalasi ham uchraydi:
 *   "2026-08-01"             — sof satr
 *   {"value":"2026-08-01"}   — to'g'ri ko'rinish
 *   {"2026-08-01":""}        — BUZUQ: sana kalit bo'lib saqlanib qolgan
 *
 * Uchinchisi frontend xatosi edi va u jimgina zarar keltirardi: sana
 * o'qilmay `null` bo'lib qolardi, kesish umuman ishlamasdi va KPI'ga
 * o'tishdan oldingi butun arxiv birinchi oyning maoshiga qo'shilib ketardi.
 * Frontend tuzatilgan, lekin bazadagi eski buzuq yozuvlar joyida qolgan —
 * ularni har bir tashkilot uchun alohida tuzatishdan ko'ra shu yerda
 * tushunib olgan xavfsizroq.
 *
 * SANA TOSHKENT BO'YICHA O'QILADI. `new Date("2026-08-01")` Node'da UTC
 * yarim tunini beradi, ya'ni Toshkentda 1-avgust soat 05:00 gacha qabul
 * qilingan buyurtmalar "KPI'dan oldin" deb kesib tashlanardi. Endi
 * chegara 2026-07-31T19:00Z — Toshkentdagi haqiqiy yarim tun.
 */
export function kpiSanasiniOqi(raw: unknown): Date | null {
  const nomzodlar: unknown[] = [];
  if (typeof raw === 'string') {
    nomzodlar.push(raw);
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    nomzodlar.push(o.value);
    // Buzuq ko'rinish: yagona kalitning o'zi sana bo'lib qolgan.
    const kalitlar = Object.keys(o);
    if (kalitlar.length === 1) nomzodlar.push(kalitlar[0]);
  }
  for (const n of nomzodlar) {
    if (typeof n !== 'string' || !n.trim()) continue;
    const s = n.trim();
    // Faqat sana ko'rsatilgan bo'lsa — u Toshkent taqvimidagi kun.
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - TZ);
    }
    // To'liq vaqt belgisi (masalan ISO) — o'zi aniq instant, tegmaymiz.
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// =============================================
// MAOSH METRIKALARI — sxemadagi qatorlar uchun raqamlarni bazadan o'lchaydi.
//
// Hisoblash mantig'i bu yerda EMAS (u salary-scheme.ts da, sof funksiya).
// Bu xizmatning yagona vazifasi — "shu xodim shu oyda nechta buyurtma
// bajardi, necha soat ishladi, necha daqiqa kechikdi" degan savollarga
// javob berish.
//
// Bir buyurtmada bir necha xodim bo'lsa — HAR BIRIGA to'liq yoziladi
// (bo'linmaydi). Bu tashkilot qarori: birgalikda bajarilgan ish har bir
// ishtirokchining hisobiga kiradi.
// =============================================

@Injectable()
export class SalaryMetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Bir necha xodim uchun bir yo'la o'lchaydi (oylik ro'yxat uchun — har
   * xodimga alohida so'rov yubormaslik kerak).
   */
  async measureMany(
    employeeIds: string[],
    start: Date,
    end: Date,
  ): Promise<Record<string, MetricValues>> {
    const out: Record<string, MetricValues> = {};
    for (const id of employeeIds) out[id] = emptyMetrics();
    if (employeeIds.length === 0) return out;

    // Davomat sanalari Toshkent taqvimi bo'yicha matn sifatida saqlanadi,
    // `start`/`end` esa UTC instant. Oy chegarasi UTC+5 dan surilgani uchun
    // (1-avgust Toshkentda = 31-iyul 19:00 UTC) matnni to'g'ridan-to'g'ri
    // instantdan kesib bo'lmaydi — avval Toshkent kuniga o'tkazamiz.
    const startStr = tashkentKuni(start);
    const endStr = tashkentKuni(end);

    const [attendance, tasks, income] = await Promise.all([
      // Davomat — sana matn ("YYYY-MM-DD") sifatida saqlanadi, shuning uchun
      // matn oralig'i bo'yicha filtrlaymiz.
      this.prisma.attendanceRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: { gte: startStr, lte: endStr },
        },
        select: {
          employeeId: true, date: true, checkIn: true, checkOut: true,
          lateMinutes: true, overtimeMinutes: true,
        },
      }),

      // Bajarilgan buyurtmalar — completedAt bo'yicha (updatedAt EMAS: u har
      // tahrirda o'zgaradi va oyni noto'g'ri ko'rsatardi).
      //
      // NEGA completedAt: KPI buyurtma TOPSHIRILGANDA yoziladi, qabul
      // qilinganda emas. Buyurtma yo'lda bekor bo'lib ketishi mumkin —
      // bajarilmagan ish uchun pul berib bo'lmaydi. Shuning uchun oy
      // oxirida olingan buyurtma keyingi oy tayyor bo'lsa, KPI keyingi
      // oyga yoziladi.
      this.prisma.task.findMany({
        where: {
          isArchived: false,
          completedAt: { gte: start, lte: end },
        },
        select: {
          assignees: true, totalAmount: true, quantity: true,
          departmentId: true, createdAt: true, orderGroupId: true, id: true,
        },
      }),

      // groupBy emas — har yozuvning bo'limi kerak (xodim faqat o'z
      // bo'limi tushumidan hisob oladi). Hajm oylik, kichik.
      this.prisma.transaction.findMany({
        where: {
          type: 'kirim',
          isInternalTransfer: false,
          employeeId: { in: employeeIds },
          date: { gte: start, lte: end },
        },
        select: { employeeId: true, amount: true, departmentId: true },
      }),
    ]);

    // ISH GRAFIGI — davomat moduli bilan BIR XIL manba (`workDays` sozlamasi).
    //
    // Ilgari "ish kunlari" har qanday davomat yozuvini sanardi, jumladan dam
    // olish kunini ham. Natijada maoshdagi "ish kunlari" davomat sahifasidagi
    // grafikka mos kelmasdi. Endi faqat grafikdagi kunlar sanaladi va grafik
    // normasi ham metrika sifatida beriladi — shunda "to'liq davomat" sharti
    // oy uzunligidan qat'i nazar to'g'ri ishlaydi.
    const workDays: number[] = (await this.settings.get('workDays')) || DEFAULT_WORK_DAYS;
    const isWorkDay = (dateStr: string) => {
      const d = new Date(`${dateStr}T00:00:00Z`);
      return Array.isArray(workDays) ? workDays.includes(d.getUTCDay()) : true;
    };

    // Davrdagi grafik kunlari soni — hamma xodim uchun bir xil.
    let norma = 0;
    for (let t = new Date(`${startStr}T00:00:00Z`); t <= new Date(`${endStr}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1)) {
      if (isWorkDay(t.toISOString().slice(0, 10))) norma += 1;
    }
    for (const id of employeeIds) out[id].norma_ish_kunlari = norma;

    for (const a of attendance) {
      const mv = out[a.employeeId];
      if (!mv) continue;
      // Grafikdan tashqari kun (masalan yakshanba) "ish kuni" sifatida
      // sanalmaydi — u qo'shimcha ish, uni overtime ko'rsatadi.
      if (a.checkIn && isWorkDay(a.date)) mv.ish_kunlari += 1;
      if (a.checkIn && a.checkOut) {
        const hours = (a.checkOut.getTime() - a.checkIn.getTime()) / 3600000;
        if (hours > 0) mv.ish_soatlari += hours;
      }
      mv.kechikish_daqiqa += a.lateMinutes || 0;
      mv.overtime_daqiqa += a.overtimeMinutes || 0;
    }

    // XODIM QAYSI BO'LIM(LAR)DA ISHLAYDI.
    //
    // Bo'limlar moliyasi aralashmasligi kerak: poligrafiyachi poligrafiyadan
    // kelgan pul bo'yicha hisob oladi, tashqi reklamachi — o'zinikidan.
    // Xodimga bo'lim biriktirilmagan bo'lsa cheklov qo'llanmaydi (eski
    // ma'lumot va bo'limi yo'q tashkilotlar avvalgidek ishlashi uchun).
    const links = await this.prisma.employeeDepartment.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true, departmentId: true },
    });
    const empDepts = new Map<string, Set<string>>();
    for (const l of links) {
      if (!empDepts.has(l.employeeId)) empDepts.set(l.employeeId, new Set());
      empDepts.get(l.employeeId)!.add(l.departmentId);
    }
    /**
     * Shu buyurtma/tushum xodimning bo'limiga kiradimi.
     *
     * BO'LIMSIZ yozuv hammaga hisoblanadi. Sinovda buni teskari qilib
     * ko'rdim — bo'limi ko'rsatilmagan buyurtma hech kimga tegmasdi va
     * xodimning 12 500 000 so'mlik bajarilgan ishi maoshdan butunlay
     * yo'qoldi. Bo'lim maydoni buyurtmalarga keyinroq qo'shilgani uchun
     * eski yozuvlarda u bo'sh, ya'ni bu nazariy emas — real ma'lumot.
     * Odamning haqini olib qo'yishdan ko'ra, biriktirilmagan ishni umumiy
     * deb hisoblagan afzal.
     */
    const inScope = (empId: string, deptId: string | null) => {
      const mine = empDepts.get(empId);
      if (!mine || mine.size === 0) return true; // xodimga bo'lim belgilanmagan
      if (!deptId) return true; // yozuv bo'limsiz — umumiy ish
      return mine.has(deptId);
    };

    // KPI BOSHLANISH SANASI — bir martalik o'tish qoidasi.
    //
    // Tashkilot KPI'ga o'tganda, o'tishdan OLDIN qabul qilingan buyurtmalar
    // hisobga olinmasligi kerak: o'sha ishlar boshqa shartlarda olingan va
    // ular uchun KPI va'da qilinmagan edi. Aks holda o'tgan oylardagi butun
    // arxiv birinchi oyning maoshiga qo'shilib ketardi.
    //
    // Sana `KPI_START_DATE` sozlamasidan olinadi (Sozlamalar → Maosh).
    // Belgilanmagan bo'lsa cheklov yo'q — eski xulq saqlanadi.
    let kpiStart: Date | null = null;
    try {
      kpiStart = kpiSanasiniOqi(await this.settings.get('KPI_START_DATE'));
    } catch {}

    // "BUYURTMA" NIMANI ANGLATADI — ikki xil sanash.
    //
    // Bir buyurtma bir necha xizmatdan iborat bo'lishi mumkin (vizitka +
    // banner + futbolka) va har xizmat alohida Task bo'ladi. "Har buyurtmadan
    // 10 000 so'm" deb belgilanganda bu 30 000 bo'lib ketardi — aslida u
    // BITTA buyurtma.
    //
    // Shuning uchun ikkita alohida ko'rsatkich bor va tashkilot o'zi tanlaydi:
    //   bajarilgan_buyurtma_soni   — har xizmat alohida (ishbay uchun)
    //   bajarilgan_buyurtma_guruh  — xizmatlar birga (buyurtma boshiga)
    const guruhlar = new Map<string, Set<string>>();

    // BUYURTMA SUMMASI — xizmat qatoriniki emas, BUTUN buyurtmaniki.
    //
    // Har xizmat alohida Task bo'lgani uchun har qatorning o'z summasi bor.
    // Agar KPI shu qator summasidan hisoblansa, bitta buyurtmada ishlagan
    // odamlar har xil bazadan hisob olardi: hamma xizmatga mas'ul qilingan
    // odam butun buyurtmadan, bitta xizmatga mas'ul odam esa o'sha qatordan.
    //
    // Real misol (NEXUS, 2026-08, jami 8 771 000): Muhammadali yettala
    // xizmatga ham mas'ul edi va butun summadan hisob oldi; Osiyo ikkitasiga
    // mas'ul edi va bazasi 1 080 000 + 1 638 000 = 2 718 000 bo'lib qoldi.
    // Bu xato — ikkalasi ham bitta buyurtma ustida ishlagan.
    //
    // Qoida: buyurtmaga mas'ul bo'lgan HAR KIM bir xil summadan — butun
    // buyurtma summasidan — o'z sxemasi bo'yicha hisob oladi. Summa
    // mas'ullar soniga BO'LINMAYDI (dizayner dona bo'yicha, sotuv menejeri
    // o'sha summaning foizidan oladi — har biri o'z qoidasi bilan).
    const guruhJami = new Map<string, number>();
    for (const t of tasks) {
      if (kpiStart && t.createdAt < kpiStart) continue;
      const kalit = t.orderGroupId || t.id;
      guruhJami.set(kalit, (guruhJami.get(kalit) || 0) + (t.totalAmount || 0));
    }

    const wanted = new Set(employeeIds);
    for (const t of tasks) {
      // Buyurtma KPI'ga o'tishdan oldin qabul qilingan bo'lsa — o'tkazamiz.
      if (kpiStart && t.createdAt < kpiStart) continue;
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(t.assignees || '[]');
        if (Array.isArray(parsed)) ids = parsed;
      } catch {
        // Buzuq JSON — buyurtmani o'tkazib yuboramiz, hisob to'xtamasin.
      }
      for (const id of ids) {
        if (!wanted.has(id)) continue;
        if (!inScope(id, t.departmentId)) continue;
        const mv = out[id];
        mv.bajarilgan_buyurtma_soni += 1;
        // Guruh kaliti bo'lmasa (bitta xizmatli yoki eski yozuv) — task
        // id'sining o'zi kalit bo'ladi, ya'ni u yakka buyurtma sanaladi.
        if (!guruhlar.has(id)) guruhlar.set(id, new Set());
        guruhlar.get(id).add(t.orderGroupId || t.id);
        // Miqdor guruhga yig'ilmaydi: 1000 dona vizitka + 500 dona banner =
        // 1500 degani ma'nosiz raqam. Dona bo'yicha to'lov xodim aynan
        // bajargan xizmatning donasidan hisoblanadi.
        mv.bajarilgan_buyurtma_miqdori += t.quantity || 0;
      }
    }

    // Summa guruh bo'yicha: bir buyurtma bir marta, xodim uning nechta
    // xizmatida qatnashganidan qat'i nazar.
    for (const [id, kalitlar] of guruhlar) {
      let jami = 0;
      for (const k of kalitlar) jami += guruhJami.get(k) || 0;
      out[id].bajarilgan_buyurtma_summasi = jami;
    }

    for (const g of income) {
      if (!g.employeeId || !out[g.employeeId]) continue;
      if (!inScope(g.employeeId, g.departmentId)) continue;
      out[g.employeeId].kirim_summasi += g.amount || 0;
    }

    // Soatlarni butunlashtiramiz — payslip'da kasrli soat chalkashtiradi.
    for (const id of employeeIds) {
      out[id].ish_soatlari = Math.round(out[id].ish_soatlari);

      // Hosila ko'rsatkichlar. Foiz aynan shuning uchun kerak: "to'liq
      // davomat uchun +1 mln" shartini "ish_kunlari >= 26" deb yozib
      // bo'lmaydi — har oyda grafik kunlari soni har xil. "davomat_foizi
      // >= 100" esa har oyda to'g'ri ishlaydi.
      out[id].bajarilgan_buyurtma_guruh = guruhlar.get(id)?.size || 0;
      out[id].qoldirilgan_kunlar = Math.max(0, norma - out[id].ish_kunlari);
      out[id].davomat_foizi = norma > 0
        ? Math.round((out[id].ish_kunlari / norma) * 100)
        : 0;
    }

    return out;
  }

  async measureOne(employeeId: string, start: Date, end: Date): Promise<MetricValues> {
    const all = await this.measureMany([employeeId], start, end);
    return all[employeeId];
  }
}
