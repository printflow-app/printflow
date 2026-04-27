import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// Default ish boshlanish vaqti (09:00)
const DEFAULT_WORK_START = { hour: 9, minute: 0 };
// Token muddati (minutlarda)
const TOKEN_EXPIRE_MINUTES = 10;

// =============================================
// ATTENDANCE SERVICE — Tenant-scoped
// checkIn/checkOut public endpoint'lardan kelganda
// tenantId employee yozuvidan olinadi.
// Token yaratish/tekshirish authenticated context'da ishlaydi.
// =============================================

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  // Joriy token olish yoki yangi yaratish (authenticated — TenantContext mavjud)
  async getOrCreateToken() {
    const tenantId = TenantContext.getTenantId();
    const now = new Date();

    // Eskirgan tokenlarni o'chirish
    await this.prisma.attendanceToken.deleteMany({
      where: { tenantId, expiresAt: { lt: now } },
    });

    // Yangi token yaratish
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRE_MINUTES * 60 * 1000);
    const token = await this.prisma.attendanceToken.create({
      data: { tenantId, expiresAt },
    });
    return token;
  }

  // Joriy aktiv token
  async getCurrentToken() {
    const tenantId = TenantContext.getTenantId();
    const now = new Date();

    const token = await this.prisma.attendanceToken.findFirst({
      where: { tenantId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      return this.getOrCreateToken();
    }
    return token;
  }

  // Token validatsiya — public context, tenantId dan foydalanish
  private async validateToken(tokenValue: string, tenantId: string): Promise<boolean> {
    const now = new Date();
    const token = await this.prisma.attendanceToken.findFirst({
      where: { token: tokenValue, tenantId, expiresAt: { gt: now } },
    });
    return !!token;
  }

  // Bugungi sanani string formatda olish
  private getTodayString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Kechikishni hisoblash (minutlarda) — settings tenant-scoped
  private async calculateLateMinutes(checkInTime: Date): Promise<number> {
    const settings =
      (await this.settings.get('workStart')) || DEFAULT_WORK_START;
    const workDays =
      (await this.settings.get('workDays')) || [1, 2, 3, 4, 5, 6];

    const dayOfWeek = checkInTime.getDay();
    if (!workDays.includes(dayOfWeek)) {
      return 0; // Dam olish kuni — kechikish hisoblanmaydi
    }

    const workStart = new Date(checkInTime);
    workStart.setHours(settings.hour, settings.minute, 0, 0);

    if (checkInTime <= workStart) return 0;

    return Math.round(
      (checkInTime.getTime() - workStart.getTime()) / 60000,
    );
  }

  /**
   * checkIn — PUBLIC endpoint'dan keladi.
   * TenantContext o'rnatilmagan, shuning uchun tenantId ni
   * employee yozuvidan olamiz (cross-tenant xavfsizlik uchun).
   */
  async checkIn(employeeId: string, tokenValue: string, deviceId?: string) {
    // 1. Employee'ni platform-level (non-scoped) so'rov bilan topamiz
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new Error('Xodim topilmadi');
    }

    const tenantId = employee.tenantId;

    // 2. Token ushbu tenantga tegishli ekanligini tekshiramiz
    const isValid = await this.validateToken(tokenValue, tenantId);
    if (!isValid) {
      throw new Error("QR kod eskirgan yoki noto'g'ri. Yangi kod oling.");
    }

    const today = this.getTodayString();
    const now = new Date();

    // 3. TenantContext o'rnatib, qolgan amallarni tenant-scoped qilamiz
    return TenantContext.run(
      { tenantId, userId: employeeId, userRole: '' },
      async () => {
        const lateMinutes = await this.calculateLateMinutes(now);

        const existing = await this.prisma.attendanceRecord.findFirst({
          where: { employeeId, date: today },
        });

        if (existing) {
          // Allaqachon kelgan — ketishni qayd qilamiz
          return this.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: { checkOut: now },
            include: { employee: true },
          });
        }

        // Birinchi skan — keldi
        return this.prisma.attendanceRecord.create({
          data: { employeeId, date: today, checkIn: now, lateMinutes, deviceId } as any,
          include: { employee: true },
        });
      },
    );
  }

  // checkOut — double-scan mantiqqa asosan checkIn bilan bir xil
  async checkOut(employeeId: string, tokenValue: string, deviceId?: string) {
    return this.checkIn(employeeId, tokenValue, deviceId);
  }

  // Yozuvlar — authenticated, TenantContext mavjud
  async getRecords(date?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: date ? { date } : undefined,
      include: { employee: { include: { role: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async getMonthlyRecords(year: number, month: number) {
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    return this.prisma.attendanceRecord.findMany({
      where: { date: { startsWith: prefix } },
      include: { employee: { include: { role: true } } },
      orderBy: [{ date: 'asc' }],
    });
  }

  async getTodayRecords() {
    const today = this.getTodayString();
    return this.getRecords(today);
  }

  async getRecordsByEmployee(employeeId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }
}
