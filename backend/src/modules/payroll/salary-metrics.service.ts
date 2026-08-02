import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { emptyMetrics, MetricValues } from './salary-scheme';
import { SettingsService } from '../settings/settings.service';

// Davomat moduli bilan bir xil sukut — yakshanbadan boshqa kunlar.
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];

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

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

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
      const raw = await this.settings.get('KPI_START_DATE');
      const d = raw ? new Date(typeof raw === 'string' ? raw : raw?.value) : null;
      if (d && !isNaN(d.getTime())) kpiStart = d;
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
        mv.bajarilgan_buyurtma_summasi += t.totalAmount || 0;
        mv.bajarilgan_buyurtma_miqdori += t.quantity || 0;
      }
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
