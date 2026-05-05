import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// =============================================
// OVERTIME SERVICE
// Xodim Telegram bot orqali ortiqcha ish vaqti haqida izoh yuboradi.
// Admin tasdiqlasa AttendanceRecord ga overtimeMinutes yoziladi.
// =============================================

@Injectable()
export class OvertimeService {
  constructor(private prisma: PrismaService) {}

  // =========== CREATE (telegram bot tomonidan chaqiriladi) ===========

  /**
   * Bot tomonidan yaratiladi — tenantId aniq, TenantContext kerak emas.
   * (PrismaService middleware'i context bo'lmasa scope qo'llamaydi.)
   */
  async createFromTelegram(params: {
    tenantId: string;
    employeeId: string;
    date: string;
    message: string;
    minutes: number;
  }) {
    return this.prisma.overtimeRequest.create({
      data: {
        tenantId: params.tenantId,
        employeeId: params.employeeId,
        date: params.date,
        message: params.message,
        minutes: params.minutes,
      } as any,
    });
  }

  // =========== ADMIN: LIST + APPROVE / REJECT ===========

  /** Tenant-scoped — barcha so'rovlar (status filter ixtiyoriy) */
  async findAll(status?: string) {
    return this.prisma.overtimeRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        employee: { include: { role: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findPending() {
    return this.findAll('PENDING');
  }

  /**
   * Tasdiqlash:
   * 1. So'rovni APPROVED qilamiz
   * 2. Shu kun uchun AttendanceRecord ga overtimeMinutes qo'shamiz
   *    (record yo'q bo'lsa yaratamiz — masalan dam olish kuni)
   */
  async approve(requestId: string, approverId: string) {
    const tenantId = TenantContext.getTenantId();

    return this.prisma.$transaction(async (tx) => {
      const req = await tx.overtimeRequest.findFirst({
        where: { id: requestId, tenantId },
      });
      if (!req) throw new Error('So\'rov topilmadi');
      if (req.status !== 'PENDING') throw new Error('So\'rov allaqachon ko\'rib chiqilgan');

      const updated = await tx.overtimeRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: approverId } as any,
      });

      // AttendanceRecord upsert (uniqueness: employeeId+date)
      const existing = await tx.attendanceRecord.findFirst({
        where: { employeeId: req.employeeId, date: req.date, tenantId },
      });

      if (existing) {
        await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: { overtimeMinutes: (existing as any).overtimeMinutes + req.minutes } as any,
        });
      } else {
        // Dam olish kuni / kelmagan kun bo'lishi mumkin — record yaratamiz
        await tx.attendanceRecord.create({
          data: {
            tenantId,
            employeeId: req.employeeId,
            date: req.date,
            overtimeMinutes: req.minutes,
            note: 'Overtime (admin tasdiqlagan)',
          } as any,
        });
      }

      return updated;
    });
  }

  async reject(requestId: string, approverId: string, reason?: string) {
    return this.prisma.overtimeRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedAt: new Date(),
        approvedBy: approverId,
        rejectedReason: reason || null,
      } as any,
    });
  }
}
