import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { emptyMetrics, MetricValues } from './salary-scheme';

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
  constructor(private readonly prisma: PrismaService) {}

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
          employeeId: true, checkIn: true, checkOut: true,
          lateMinutes: true, overtimeMinutes: true,
        },
      }),

      // Bajarilgan buyurtmalar — completedAt bo'yicha (updatedAt EMAS: u har
      // tahrirda o'zgaradi va oyni noto'g'ri ko'rsatardi).
      this.prisma.task.findMany({
        where: {
          isArchived: false,
          completedAt: { gte: start, lte: end },
        },
        select: { assignees: true, totalAmount: true, quantity: true },
      }),

      this.prisma.transaction.groupBy({
        by: ['employeeId'],
        where: {
          type: 'kirim',
          employeeId: { in: employeeIds },
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
    ]);

    for (const a of attendance) {
      const mv = out[a.employeeId];
      if (!mv) continue;
      if (a.checkIn) mv.ish_kunlari += 1;
      if (a.checkIn && a.checkOut) {
        const hours = (a.checkOut.getTime() - a.checkIn.getTime()) / 3600000;
        if (hours > 0) mv.ish_soatlari += hours;
      }
      mv.kechikish_daqiqa += a.lateMinutes || 0;
      mv.overtime_daqiqa += a.overtimeMinutes || 0;
    }

    const wanted = new Set(employeeIds);
    for (const t of tasks) {
      let ids: string[] = [];
      try {
        const parsed = JSON.parse(t.assignees || '[]');
        if (Array.isArray(parsed)) ids = parsed;
      } catch {
        // Buzuq JSON — buyurtmani o'tkazib yuboramiz, hisob to'xtamasin.
      }
      for (const id of ids) {
        if (!wanted.has(id)) continue;
        const mv = out[id];
        mv.bajarilgan_buyurtma_soni += 1;
        mv.bajarilgan_buyurtma_summasi += t.totalAmount || 0;
        mv.bajarilgan_buyurtma_miqdori += t.quantity || 0;
      }
    }

    for (const g of income) {
      if (g.employeeId && out[g.employeeId]) {
        out[g.employeeId].kirim_summasi = g._sum.amount || 0;
      }
    }

    // Soatlarni butunlashtiramiz — payslip'da kasrli soat chalkashtiradi.
    for (const id of employeeIds) {
      out[id].ish_soatlari = Math.round(out[id].ish_soatlari);
    }

    return out;
  }

  async measureOne(employeeId: string, start: Date, end: Date): Promise<MetricValues> {
    const all = await this.measureMany([employeeId], start, end);
    return all[employeeId];
  }
}
