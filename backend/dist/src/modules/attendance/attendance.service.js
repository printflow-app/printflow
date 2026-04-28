"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const settings_service_1 = require("../settings/settings.service");
const tenant_context_1 = require("../../common/tenant/tenant.context");
const DEFAULT_WORK_START = { hour: 9, minute: 0 };
const TOKEN_EXPIRE_MINUTES = 10;
let AttendanceService = class AttendanceService {
    constructor(prisma, settings) {
        this.prisma = prisma;
        this.settings = settings;
    }
    async getOrCreateToken() {
        const tenantId = tenant_context_1.TenantContext.getTenantId();
        const now = new Date();
        await this.prisma.attendanceToken.deleteMany({
            where: { tenantId, expiresAt: { lt: now } },
        });
        const expiresAt = new Date(now.getTime() + TOKEN_EXPIRE_MINUTES * 60 * 1000);
        const token = await this.prisma.attendanceToken.create({
            data: { tenantId, expiresAt },
        });
        return token;
    }
    async getCurrentToken() {
        const tenantId = tenant_context_1.TenantContext.getTenantId();
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
    async validateToken(tokenValue, tenantId) {
        const now = new Date();
        const token = await this.prisma.attendanceToken.findFirst({
            where: { token: tokenValue, tenantId, expiresAt: { gt: now } },
        });
        return !!token;
    }
    getTodayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    async calculateLateMinutes(checkInTime) {
        const settings = (await this.settings.get('workStart')) || DEFAULT_WORK_START;
        const workDays = (await this.settings.get('workDays')) || [1, 2, 3, 4, 5, 6];
        const dayOfWeek = checkInTime.getDay();
        if (!workDays.includes(dayOfWeek)) {
            return 0;
        }
        const workStart = new Date(checkInTime);
        workStart.setHours(settings.hour, settings.minute, 0, 0);
        if (checkInTime <= workStart)
            return 0;
        return Math.round((checkInTime.getTime() - workStart.getTime()) / 60000);
    }
    async checkIn(employeeId, tokenValue, deviceId) {
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
        });
        if (!employee) {
            throw new Error('Xodim topilmadi');
        }
        const tenantId = employee.tenantId;
        const isValid = await this.validateToken(tokenValue, tenantId);
        if (!isValid) {
            throw new Error("QR kod eskirgan yoki noto'g'ri. Yangi kod oling.");
        }
        const today = this.getTodayString();
        const now = new Date();
        return tenant_context_1.TenantContext.run({ tenantId, userId: employeeId, userRole: '' }, async () => {
            const lateMinutes = await this.calculateLateMinutes(now);
            const existing = await this.prisma.attendanceRecord.findFirst({
                where: { employeeId, date: today },
            });
            if (existing) {
                return this.prisma.attendanceRecord.update({
                    where: { id: existing.id },
                    data: { checkOut: now },
                    include: { employee: true },
                });
            }
            return this.prisma.attendanceRecord.create({
                data: { employeeId, date: today, checkIn: now, lateMinutes, deviceId },
                include: { employee: true },
            });
        });
    }
    async checkOut(employeeId, tokenValue, deviceId) {
        return this.checkIn(employeeId, tokenValue, deviceId);
    }
    async getRecords(date) {
        return this.prisma.attendanceRecord.findMany({
            where: date ? { date } : undefined,
            include: { employee: { include: { role: true } } },
            orderBy: { date: 'desc' },
        });
    }
    async getMonthlyRecords(year, month) {
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
    async getRecordsByEmployee(employeeId) {
        return this.prisma.attendanceRecord.findMany({
            where: { employeeId },
            orderBy: { date: 'desc' },
            take: 30,
        });
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        settings_service_1.SettingsService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map