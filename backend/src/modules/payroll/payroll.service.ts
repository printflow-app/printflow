import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SalarySchemeService } from './salary-scheme.service';

// =============================================
// PAYROLL SERVICE — oylik maosh hisob-kitobi
// Sof maosh = fixedSalary + bonus − penalty
// Berish kerak = sof maosh − shu oy avansi − oldingi qarz (workDebt)
//   ≥ 0 → shu summa chiqim qilinadi, qarz = 0
//   < 0 → hech narsa berilmaydi, |manfiy| keyingi oyga qarz bo'lib ko'chadi
// =============================================

// Asia/Tashkent — UTC+5, yozgi vaqt yo'q.
const TZ = 5 * 3600000;

/**
 * "2026-08" → o'sha oyning TOSHKENT bo'yicha boshi va oxiri (UTC instant).
 *
 * Ilgari chegaralar sof UTC edi va bu 5 soatlik siljish berardi: 1-avgust
 * ertalab soat 03:00 da topshirilgan buyurtma UTC'da hali 31-iyul bo'lgani
 * uchun iyul maoshiga tushardi, 1-sentabr tunggi buyurtma esa avgustga
 * qo'shilib ketardi. Xodim uchun bu "bajargan ishim maoshda yo'q" degani.
 */
function periodBounds(period: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0) - TZ);
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999) - TZ); // oyning oxirgi kuni
  return { start, end };
}

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private schemes: SalarySchemeService,
  ) {}

  /** Shu oy uchun barcha xodimlarning maosh qatorini qaytaradi (saqlangan yozuv bilan birlashtirilgan). */
  async list(period: string, branchId?: string) {
    const bounds = periodBounds(period);
    if (!bounds) throw new BadRequestException("Davr formati noto'g'ri (YYYY-MM)");

    const employees = await this.prisma.employee.findMany({
      where: branchId ? { branchId } : {},
      include: { role: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
    });
    const empIds = employees.map((e) => e.id);

    // Maosh sxemasi bo'yicha avtomatik hisob. Sxemasi bo'lmagan xodimda
    // natija bo'lmaydi va u avvalgidek qo'lda kiritiladi.
    const tenantId = employees[0]?.tenantId;
    const computed = tenantId
      ? await this.schemes
          .computeForEmployees(
            tenantId,
            employees.map((e) => ({ id: e.id, roleId: e.roleId })),
            bounds.start,
            bounds.end,
          )
          .catch(() => ({} as Record<string, any>))
      : {};

    // Saqlangan maosh varaqalari
    const records = empIds.length
      ? await this.prisma.salaryRecord.findMany({ where: { period, employeeId: { in: empIds } } })
      : [];
    const recByEmp: Record<string, any> = {};
    for (const r of records) recByEmp[r.employeeId] = r;

    // Shu oy avanslari (employeeId bo'yicha yig'indi)
    const advGroups = empIds.length
      ? await this.prisma.transaction.groupBy({
          by: ['employeeId'],
          where: {
            type: 'chiqim',
            isSalaryAdvance: true,
            employeeId: { in: empIds },
            date: { gte: bounds.start, lte: bounds.end },
          } as any,
          _sum: { amount: true },
        })
      : [];
    const advByEmp: Record<string, number> = {};
    for (const g of advGroups) if (g.employeeId) advByEmp[g.employeeId] = g._sum.amount || 0;

    return employees.map((e) => {
      const rec = recByEmp[e.id];
      const paid = rec?.status === 'paid';
      const calc = computed[e.id];

      // FIKSA VA BONUS — SXEMA BO'LSA DOIM JONLI HISOBLANADI.
      //
      // Ilgari saqlangan yozuv ustun turardi va bu jimgina pul xatosiga
      // olib kelardi: "Saqlash" bosilgan on fiksa/bonus o'sha kundagi
      // qiymatda muzlab qolardi. Oyning 2-kunida jarimani qabul qilib
      // saqlagan buxgalter, oy oxirida xodimga 2 kunlik maosh to'lardi
      // (5 000 000 × 2/26 = 384 615, aslida 8/26 = 1 538 462).
      //
      // Endi sxemasi bor xodimda ular har ochilganda qayta hisoblanadi —
      // davomat, buyurtma va tushum o'zgarsa, maosh ham darhol ergashadi.
      // Saqlangan qiymat faqat SXEMASI YO'Q xodimda ishlatiladi: u yerda
      // hisoblovchi qoida yo'q va summa qo'lda kiritiladi.
      //
      // To'langan oy tegilmaydi — u snapshot, tarix o'zgarmasligi kerak.
      const fixedSalary = paid
        ? rec.fixedSalary
        : calc
          ? calc.fiksa
          : rec
            ? rec.fixedSalary
            : Number(e.baseSalary || 0);
      const bonus = paid ? rec.bonus || 0 : calc ? calc.kpi : rec ? rec.bonus || 0 : 0;
      // Jarima BUNDAN MUSTASNO: u avtomatik qo'llanmaydi, buxgalter
      // taklifni qabul qiladi yoki o'zi yozadi — ya'ni ongli qaror.
      const penalty = rec?.penalty || 0;
      const netSalary = Math.round(fixedSalary + bonus - penalty);
      // Paid bo'lsa snapshotlar; aks holda jonli hisob
      const advances = paid ? rec.advanceDeducted : advByEmp[e.id] || 0;
      const prevDebt = paid ? rec.prevDebt : Number(e.workDebt || 0);
      const toPay = paid ? rec.paidAmount : Math.round(netSalary - advances - prevDebt);

      return {
        employeeId: e.id,
        fullName: e.fullName,
        roleName: e.role?.name || '',
        branchId: e.branchId,
        period,
        fixedSalary,
        bonus,
        bonusNote: rec?.bonusNote || '',
        penalty,
        penaltyNote: rec?.penaltyNote || '',
        netSalary,
        advances,
        prevDebt,
        toPay,
        paidAmount: paid ? rec.paidAmount : 0,
        carriedDebt: paid ? rec.carriedDebt : Math.max(0, -(netSalary - advances - prevDebt)),
        status: rec?.status || 'draft',
        recordId: rec?.id || null,

        // Sxema bo'yicha hisob — UI "nimadan qanday chiqdi" ni ko'rsatadi.
        // To'langan yozuvda o'sha paytdagi snapshot ko'rsatiladi.
        breakdown: paid ? rec.breakdown || null : calc?.rows || null,
        // Taklif qilingan jarima: avtomatik AYIRILMAYDI, buxgalter tasdiqlaydi.
        taklifJarima: calc?.jarima || 0,
        // Sxema bo'yicha jonli hisoblanyaptimi — UI shuni bildiradi va
        // fiksa/bonus kataklarini tahrirlashga yopadi (yozilgan qiymat
        // baribir keyingi ochilishda qayta hisoblanardi — buni taklif
        // qilish yolg'on bo'lardi).
        jonli: !!calc && !paid,
      };
    });
  }

  /** Fiksa/bonus/jarima'ni saqlaydi (qoralama). To'langan yozuvni tahrirlab bo'lmaydi. */
  async save(
    data: { employeeId: string; period: string; fixedSalary?: number; bonus?: number; bonusNote?: string; penalty?: number; penaltyNote?: string },
  ) {
    const bounds = periodBounds(data.period);
    if (!bounds) throw new BadRequestException("Davr formati noto'g'ri (YYYY-MM)");
    const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!emp) throw new NotFoundException('Xodim topilmadi');

    const existing = await this.prisma.salaryRecord.findFirst({
      where: { employeeId: data.employeeId, period: data.period },
    });
    if (existing?.status === 'paid') {
      throw new BadRequestException("Bu oy to'langan — avval 'Bekor qilish' bosing, keyin tahrirlang");
    }

    // Sxemasi bor xodimda fiksa/bonus KELGAN QIYMATDAN OLINMAYDI — ular
    // jonli hisoblanadi va yozuvga faqat nusxa sifatida tushadi.
    //
    // Nega nusxa kerak: sxema keyinchalik o'chirilsa, `list()` yozuvga
    // qaytadi. Kelgan qiymat yozilsa, o'sha yerda oylar oldingi eskirgan
    // raqam qolib ketardi. Jonli qiymatni yozib qo'yish yozuvni har doim
    // haqiqatga mos ushlab turadi.
    const calc = await this.schemes
      .computeForEmployees(
        emp.tenantId,
        [{ id: emp.id, roleId: emp.roleId }],
        bounds.start,
        bounds.end,
      )
      .then((r) => r[emp.id])
      .catch(() => undefined);

    const fixedSalary = calc
      ? calc.fiksa
      : data.fixedSalary !== undefined
        ? Number(data.fixedSalary)
        : Number(emp.baseSalary || 0);
    const bonus = calc ? calc.kpi : Number(data.bonus || 0);
    // Jarima har doim foydalanuvchidan — u ongli qaror, hisoblanmaydi.
    const penalty = Number(data.penalty || 0);
    const netSalary = Math.round(fixedSalary + bonus - penalty);

    const payload = {
      fixedSalary,
      bonus,
      bonusNote: data.bonusNote || null,
      penalty,
      penaltyNote: data.penaltyNote || null,
      netSalary,
      branchId: emp.branchId,
      status: 'draft',
    };

    if (existing) {
      return this.prisma.salaryRecord.update({ where: { id: existing.id }, data: payload as any });
    }
    return this.prisma.salaryRecord.create({
      data: { employeeId: data.employeeId, period: data.period, ...payload } as any,
    });
  }

  /** Maoshni to'laydi: berish kerak > 0 bo'lsa Kassadan chiqim, ortiqcha avans keyingi oyga qarz. */
  async pay(data: { employeeId: string; period: string }, userId?: string) {
    const bounds = periodBounds(data.period);
    if (!bounds) throw new BadRequestException("Davr formati noto'g'ri (YYYY-MM)");
    const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!emp) throw new NotFoundException('Xodim topilmadi');

    let rec = await this.prisma.salaryRecord.findFirst({
      where: { employeeId: data.employeeId, period: data.period },
    });
    if (rec?.status === 'paid') throw new BadRequestException("Bu oy allaqachon to'langan");

    // TO'LOV SUMMASI HAM JONLI HISOBLANADI.
    //
    // Ilgari bu yer saqlangan yozuvni o'qirdi va shu sabab xodimga
    // "Saqlash" bosilgan kundagi summa to'lanardi — oy boshida saqlangan
    // bo'lsa, oylikning bir qismi. `list()` bilan bir xil qoida: sxemasi
    // bor xodimda sxema, yo'q xodimda saqlangan/asosiy qiymat.
    const calc = await this.schemes
      .computeForEmployees(
        emp.tenantId,
        [{ id: emp.id, roleId: emp.roleId }],
        bounds.start,
        bounds.end,
      )
      .then((r) => r[emp.id])
      .catch(() => undefined);

    const fixedSalary = calc ? calc.fiksa : rec ? rec.fixedSalary : Number(emp.baseSalary || 0);
    const bonus = calc ? calc.kpi : rec?.bonus || 0;
    // Jarima har doim yozuvdan — u buxgalter tasdiqlagan qiymat.
    const penalty = rec?.penalty || 0;
    const netSalary = Math.round(fixedSalary + bonus - penalty);

    const advAgg = await this.prisma.transaction.aggregate({
      where: {
        type: 'chiqim',
        isSalaryAdvance: true,
        employeeId: data.employeeId,
        date: { gte: bounds.start, lte: bounds.end },
      } as any,
      _sum: { amount: true },
    });
    const advances = advAgg._sum.amount || 0;
    const prevDebt = Number(emp.workDebt || 0);
    const rawToPay = Math.round(netSalary - advances - prevDebt);
    const paidAmount = Math.max(0, rawToPay);
    const carriedDebt = Math.max(0, -rawToPay);

    // Chiqim kassasi — xodim filialining "Asosiy kassa"si
    const mainBox = await this.prisma.cashBox.findFirst({
      where: { type: 'main', branchId: emp.branchId },
      select: { id: true },
    });

    return this.prisma.$transaction(async (tx) => {
      let paidTxId: string | null = null;
      if (paidAmount > 0) {
        const t = await tx.transaction.create({
          data: {
            type: 'chiqim',
            amount: paidAmount,
            employeeId: data.employeeId,
            expenseReason: `Maosh: ${emp.fullName} (${data.period})`,
            branchId: emp.branchId,
            cashBoxId: mainBox?.id || null,
            isSalaryAdvance: false,
            createdById: userId || null,
          } as any,
        });
        paidTxId = t.id;
        // Xodimga berilgan jami summa — maosh ham berilgan pul.
        await tx.employee.update({
          where: { id: data.employeeId },
          data: { givenAmount: { increment: paidAmount } },
        });
      }

      // Ortiqcha avans → keyingi oyga qarz (workDebt).
      await tx.employee.update({ where: { id: data.employeeId }, data: { workDebt: carriedDebt } });

      const snapshot = {
        fixedSalary,
        bonus,
        penalty,
        netSalary,
        advanceDeducted: advances,
        prevDebt,
        paidAmount,
        carriedDebt,
        status: 'paid',
        paidTransactionId: paidTxId,
        paidAt: new Date(),
        branchId: emp.branchId,
      };
      if (rec) {
        return tx.salaryRecord.update({ where: { id: rec.id }, data: snapshot as any });
      }
      return tx.salaryRecord.create({
        data: { employeeId: data.employeeId, period: data.period, ...snapshot } as any,
      });
    });
  }

  /** To'lovni bekor qiladi: chiqimni o'chiradi, qarzni tiklaydi, holat = qoralama. */
  async revert(data: { employeeId: string; period: string }) {
    const rec = await this.prisma.salaryRecord.findFirst({
      where: { employeeId: data.employeeId, period: data.period },
    });
    if (!rec) throw new NotFoundException('Maosh varaqasi topilmadi');
    if (rec.status !== 'paid') throw new BadRequestException("Bu oy hali to'lanmagan");

    return this.prisma.$transaction(async (tx) => {
      if (rec.paidTransactionId) {
        await tx.transaction.deleteMany({ where: { id: rec.paidTransactionId } });
        await tx.employee.update({
          where: { id: data.employeeId },
          data: { givenAmount: { decrement: rec.paidAmount } },
        });
      }
      // Qarzni to'lashdan OLDINGI holatga qaytaramiz.
      await tx.employee.update({ where: { id: data.employeeId }, data: { workDebt: rec.prevDebt } });
      return tx.salaryRecord.update({
        where: { id: rec.id },
        data: {
          status: 'draft',
          paidAmount: 0,
          carriedDebt: 0,
          advanceDeducted: 0,
          paidTransactionId: null,
          paidAt: null,
        } as any,
      });
    });
  }
}
