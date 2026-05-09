import { Injectable } from '@nestjs/common';
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
// IP allowlist orqali faqat ofis Wi-Fi'sidan skanerlashga ruxsat beradi.
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

  // ============ IP ALLOWLIST (office Wi-Fi only) ============

  /**
   * Office IP allowlist — Sozlamalar > "OFFICE_NETWORK_IPS" da saqlanadi.
   * Format: massiv ['203.0.113.45', '192.168.1.0/24', ...]
   * Bo'sh bo'lsa cheklov qo'llanmaydi (back-compat).
   */
  private async getOfficeIpAllowlist(tenantId: string): Promise<string[]> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key: 'OFFICE_NETWORK_IPS' },
    });
    if (!setting) return [];
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string' && s.trim());
      return [];
    } catch {
      return [];
    }
  }

  /** IPv4 → 32-bit unsigned int (IPv6 uchun strict-equal solishtirish) */
  private ipv4ToInt(ip: string): number | null {
    const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const parts = m.slice(1, 5).map(Number);
    if (parts.some((p) => p < 0 || p > 255)) return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  /** Mijoz IP'sini olish — Express'da req.ip; X-Forwarded-For ham hisobga olinadi */
  private extractClientIp(rawIp: string | null | undefined, xff: string | null | undefined): string | null {
    if (xff && typeof xff === 'string') {
      // X-Forwarded-For: "client, proxy1, proxy2" — birinchi mijoz IP'si
      const first = xff.split(',')[0].trim();
      if (first) return this.normalizeIp(first);
    }
    if (rawIp) return this.normalizeIp(rawIp);
    return null;
  }

  private normalizeIp(ip: string): string {
    // ::ffff:192.168.1.1 → 192.168.1.1
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
  }

  private ipMatchesEntry(clientIp: string, entry: string): boolean {
    const cleanEntry = entry.trim();
    if (!cleanEntry) return false;

    // CIDR (e.g., 192.168.1.0/24)
    if (cleanEntry.includes('/')) {
      const [base, prefixStr] = cleanEntry.split('/');
      const prefix = parseInt(prefixStr, 10);
      if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false;
      const baseInt = this.ipv4ToInt(base);
      const ipInt = this.ipv4ToInt(clientIp);
      if (baseInt === null || ipInt === null) return false;
      const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
      return (baseInt & mask) === (ipInt & mask);
    }

    // Plain equality (IPv4 or IPv6 string)
    return cleanEntry === clientIp;
  }

  /**
   * IP tekshirish: agar allowlist bo'sh bo'lsa — ruxsat (back-compat).
   * Agar bo'sh bo'lmasa va clientIp moslashmasa — error.
   */
  private async assertOfficeIp(tenantId: string, clientIp: string | null) {
    const allowlist = await this.getOfficeIpAllowlist(tenantId);
    if (allowlist.length === 0) return; // Cheklov o'rnatilmagan

    if (!clientIp) {
      throw new Error('IP manzilingiz aniqlanmadi. Iltimos, ofis Wi-Fi\'siga ulaning.');
    }

    const ok = allowlist.some((entry) => this.ipMatchesEntry(clientIp, entry));
    if (!ok) {
      throw new Error('Faqat ofis Wi-Fi tarmog\'idan davomat belgilash mumkin.');
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
   * Office IP allowlist tekshiriladi.
   */
  async checkIn(employeeId: string, tokenValue: string, deviceId?: string, clientIp?: string | null) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Xodim topilmadi');

    const tenantId = employee.tenantId;

    await this.assertOfficeIp(tenantId, clientIp ?? null);

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

  async checkOut(employeeId: string, tokenValue: string, deviceId?: string, clientIp?: string | null) {
    return this.checkIn(employeeId, tokenValue, deviceId, clientIp);
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
   * No QR token required (JWT proves identity), but IP allowlist enforced.
   * One toggle: first call = check-in, second call = check-out.
   */
  async selfMark(employeeId: string, clientIp: string | null) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Xodim topilmadi');

    const tenantId = employee.tenantId;
    await this.assertOfficeIp(tenantId, clientIp);

    const today = this.getTodayString();
    const now = new Date();

    return TenantContext.run(
      { tenantId, userId: employeeId, userRole: '' },
      async () => {
        const existing = await this.prisma.attendanceRecord.findFirst({
          where: { employeeId, date: today },
        });

        if (!existing) {
          // First mark of the day → check-in
          const lateMinutes = await this.calculateLateMinutes(now);
          const created = await this.prisma.attendanceRecord.create({
            data: { employeeId, date: today, checkIn: now, lateMinutes } as any,
            include: { employee: true },
          });
          return { ...created, action: 'checkin' };
        }

        if (!existing.checkOut) {
          // Already checked in → check out
          const updated = await this.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: { checkOut: now },
            include: { employee: true },
          });
          return { ...updated, action: 'checkout' };
        }

        // Already checked out — nothing to do
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

    const parseDateTime = (dateStr: string, timeStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      return new Date(year, month - 1, day, hour, minute, 0);
    };

    const checkInDate = data.checkIn ? parseDateTime(data.date, data.checkIn) : null;
    const checkOutDate = data.checkOut ? parseDateTime(data.date, data.checkOut) : null;

    return TenantContext.run(
      { tenantId, userId: data.employeeId, userRole: '' },
      async () => {
        let lateMinutes = 0;
        if (checkInDate) {
          lateMinutes = await this.calculateLateMinutes(checkInDate);
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

  // ============ OFFICE IP SETTINGS HELPERS (used by Sozlamalar) ============

  async getOfficeIps(): Promise<string[]> {
    const tenantId = TenantContext.getTenantId();
    return this.getOfficeIpAllowlist(tenantId);
  }
}
