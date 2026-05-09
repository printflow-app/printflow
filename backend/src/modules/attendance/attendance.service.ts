import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import { randomUUID } from 'crypto';

const DEFAULT_WORK_START = { hour: 9, minute: 0 };
const DEFAULT_WORK_END = { hour: 17, minute: 0 };
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];

// =============================================
// ATTENDANCE SERVICE — Tenant-scoped
// QR kod statik (admin generate qiladi va print qiladi).
// GPS Geofencing orqali faqat ofis hududidan davomat belgilash mumkin.
// =============================================

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  // ============ TOKEN MANAGEMENT (static, admin-generated) ============

  /**
   * Joriy token olish; agar yo'q bo'lsa avtomatik yaratmaydi —
   * faqat admin manual ravishda generatsiya qilishi kerak.
   */
  async getCurrentToken() {
    const tenantId = TenantContext.getTenantId();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { attendanceQrToken: true },
    });
    return { token: tenant?.attendanceQrToken || null };
  }

  /**
   * Yangi statik token yaratish (admin chaqiradi).
   * Eski token bekor bo'ladi — eski printlangan QR endi ishlamaydi.
   */
  async rotateToken() {
    const tenantId = TenantContext.getTenantId();
    const newToken = randomUUID();
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { attendanceQrToken: newToken },
    });
    return { token: newToken };
  }

  // ============ GPS GEOFENCING ============

  /** Haversine formula — ikkita GPS koordinata orasidagi masofani metrda qaytaradi */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Yer radiusi (metr)
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /** Ofis GPS koordinatalari va radiusini settings'dan olish */
  private async getOfficeLocation(tenantId: string): Promise<{ lat: number; lng: number; radius: number } | null> {
    const [latRow, lngRow, radiusRow] = await Promise.all([
      this.prisma.systemSetting.findFirst({ where: { tenantId, key: 'OFFICE_LAT' } }),
      this.prisma.systemSetting.findFirst({ where: { tenantId, key: 'OFFICE_LNG' } }),
      this.prisma.systemSetting.findFirst({ where: { tenantId, key: 'OFFICE_RADIUS' } }),
    ]);
    // Supports both formats: raw number "41.2995" and wrapped {"value":41.2995}
    const parseGeoRow = (row: any): number => {
      if (!row) return NaN;
      try {
        const parsed = JSON.parse(row.value);
        if (typeof parsed === 'number') return parsed;
        if (parsed?.value !== undefined) return parseFloat(String(parsed.value));
        return NaN;
      } catch {
        return parseFloat(row.value);
      }
    };
    const lat = parseGeoRow(latRow);
    const lng = parseGeoRow(lngRow);
    if (isNaN(lat) || isNaN(lng)) return null;
    const radius = Math.round(parseGeoRow(radiusRow));
    return { lat, lng, radius: isNaN(radius) || radius < 10 ? 50 : radius };
  }

  /** GPS tekshiruv: ofis hududi sozlanmagan bo'lsa — error; masofa oshsa — 403 */
  private async assertOfficeLocation(tenantId: string, lat: number, lng: number): Promise<void> {
    const office = await this.getOfficeLocation(tenantId);
    if (!office) {
      throw new Error(
        "Ofis joylashuvi sozlanmagan. Admin Sozlamalar > Davomat bo'limida GPS koordinatlarini kiriting.",
      );
    }
    const distance = this.calculateDistance(lat, lng, office.lat, office.lng);
    if (distance > office.radius) {
      throw new ForbiddenException(
        `Xato: Siz ofis hududida emassiz! Masofa: ${Math.round(distance)} m (ruxsat: ${office.radius} m)`,
      );
    }
  }

  // ============ TOKEN VALIDATION ============

  private async validateToken(tokenValue: string, tenantId: string): Promise<boolean> {
    if (!tokenValue) return false;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { attendanceQrToken: true },
    });
    return !!tenant?.attendanceQrToken && tenant.attendanceQrToken === tokenValue;
  }

  // ============ HELPERS ============

  private getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /** Late-minutes calculation — settings tenant-scoped */
  private async calculateLateMinutes(checkInTime: Date): Promise<number> {
    const startSetting = (await this.settings.get('workStart')) || DEFAULT_WORK_START;
    const workDays = (await this.settings.get('workDays')) || DEFAULT_WORK_DAYS;

    const dayOfWeek = checkInTime.getDay();
    if (!workDays.includes(dayOfWeek)) return 0;

    const workStart = new Date(checkInTime);
    workStart.setHours(startSetting.hour, startSetting.minute, 0, 0);

    if (checkInTime <= workStart) return 0;
    return Math.round((checkInTime.getTime() - workStart.getTime()) / 60000);
  }

  // ============ PUBLIC: SCAN ENDPOINTS ============

  /**
   * checkIn — PUBLIC endpoint'dan keladi.
   * tenantId employee yozuvidan olinadi (cross-tenant xavfsizlik).
   * GPS Geofencing tekshiriladi.
   */
  async checkIn(employeeId: string, tokenValue: string, deviceId?: string, lat?: number, lng?: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Xodim topilmadi');

    const tenantId = employee.tenantId;

    if (lat !== undefined && lng !== undefined) {
      await this.assertOfficeLocation(tenantId, lat, lng);
    }

    const isValid = await this.validateToken(tokenValue, tenantId);
    if (!isValid) {
      throw new Error('QR kod yaroqsiz. Admin yangi QR yaratishi kerak.');
    }

    const today = this.getTodayString();
    const now = new Date();

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

        return this.prisma.attendanceRecord.create({
          data: { employeeId, date: today, checkIn: now, lateMinutes, deviceId } as any,
          include: { employee: true },
        });
      },
    );
  }

  async checkOut(employeeId: string, tokenValue: string, deviceId?: string, lat?: number, lng?: number) {
    return this.checkIn(employeeId, tokenValue, deviceId, lat, lng);
  }

  // ============ AUTHENTICATED: READ ENDPOINTS ============

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
    return this.getRecords(this.getTodayString());
  }

  async getRecordsByEmployee(employeeId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }

  // ============ SELF SERVICE — employee marks own attendance ============

  /**
   * selfCheckIn / selfCheckOut — JWT-authenticated.
   * No QR token required (JWT proves identity). GPS Geofencing enforced.
   * One toggle: first call = check-in, second call = check-out.
   */
  async selfMark(employeeId: string, lat?: number, lng?: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Xodim topilmadi');

    const tenantId = employee.tenantId;
    const today = this.getTodayString();
    const now = new Date();

    return TenantContext.run(
      { tenantId, userId: employeeId, userRole: '' },
      async () => {
        const existing = await this.prisma.attendanceRecord.findFirst({
          where: { employeeId, date: today },
        });

        const isCheckIn = !existing || !!existing.checkOut;

        // GPS tekshiruvi faqat kelishda (check-in) talab qilinadi
        if (isCheckIn && lat !== undefined && lng !== undefined) {
          await this.assertOfficeLocation(tenantId, lat, lng);
        } else if (isCheckIn) {
          // Check-in uchun GPS koordinatalari majburiy
          throw new Error('Kelish uchun GPS koordinatalari kerak');
        }

        if (!existing) {
          const lateMinutes = await this.calculateLateMinutes(now);
          const created = await this.prisma.attendanceRecord.create({
            data: { employeeId, date: today, checkIn: now, lateMinutes } as any,
            include: { employee: true },
          });
          return { ...created, action: 'checkin' };
        }

        if (!existing.checkOut) {
          // Ketish (check-out) — GPS tekshirmasdan
          const updated = await this.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: { checkOut: now },
            include: { employee: true },
          });
          return { ...updated, action: 'checkout' };
        }

        return { ...existing, action: 'done' };
      },
    );
  }

  // ============ ADMIN: MANUAL ENTRY (no IP / token required) ============

  /**
   * Admin tomonidan qo'lda davomat kiritish.
   * QR yoki IP tekshiruvi yo'q — faqat JWT orqali autentifikatsiya kerak.
   * Mavjud yozuv bo'lsa yangilanadi, bo'lmasa yangi yaratiladi.
   */
  async adminManualMark(data: {
    employeeId: string;
    date: string;      // "YYYY-MM-DD"
    checkIn?: string;  // "HH:mm"
    checkOut?: string; // "HH:mm"
  }) {
    const employee = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!employee) throw new Error('Xodim topilmadi');

    const tenantId = employee.tenantId;

    // Parse "HH:mm" as Asia/Tashkent (UTC+5) local time so storage and display are consistent
    const parseDateTime = (dateStr: string, timeStr: string): Date =>
      new Date(`${dateStr}T${timeStr}:00+05:00`);

    const checkInDate = data.checkIn ? parseDateTime(data.date, data.checkIn) : null;
    const checkOutDate = data.checkOut ? parseDateTime(data.date, data.checkOut) : null;

    return TenantContext.run(
      { tenantId, userId: data.employeeId, userRole: '' },
      async () => {
        let lateMinutes = 0;
        if (data.checkIn) {
          // Compare pure local-time numbers to avoid any server-TZ dependency
          const startSetting = (await this.settings.get('workStart')) || DEFAULT_WORK_START;
          const workDays = (await this.settings.get('workDays')) || DEFAULT_WORK_DAYS;
          const localDate = new Date(`${data.date}T12:00:00+05:00`);
          const dayOfWeek = localDate.getDay();
          if (workDays.includes(dayOfWeek)) {
            const [ciH, ciM] = data.checkIn.split(':').map(Number);
            const checkInMins = ciH * 60 + ciM;
            const workStartMins = startSetting.hour * 60 + startSetting.minute;
            lateMinutes = Math.max(0, checkInMins - workStartMins);
          }
        }

        const existing = await this.prisma.attendanceRecord.findFirst({
          where: { employeeId: data.employeeId, date: data.date },
        });

        if (existing) {
          return this.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              ...(checkInDate !== null && { checkIn: checkInDate, lateMinutes }),
              ...(checkOutDate !== null && { checkOut: checkOutDate }),
            },
            include: { employee: { include: { role: true } } },
          });
        }

        return this.prisma.attendanceRecord.create({
          data: {
            employeeId: data.employeeId,
            date: data.date,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            lateMinutes,
          } as any,
          include: { employee: { include: { role: true } } },
        });
      },
    );
  }

  async getMyToday(employeeId: string) {
    const today = this.getTodayString();
    return this.prisma.attendanceRecord.findFirst({
      where: { employeeId, date: today },
    });
  }

  async getMyRecords(employeeId: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }

}
