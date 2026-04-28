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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const common_1 = require("@nestjs/common");
const attendance_service_1 = require("./attendance.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const feature_decorator_1 = require("../../common/decorators/feature.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const common_2 = require("@nestjs/common");
let AttendanceController = class AttendanceController {
    constructor(attendanceService) {
        this.attendanceService = attendanceService;
    }
    getCurrentToken() {
        return this.attendanceService.getCurrentToken();
    }
    refreshToken() {
        return this.attendanceService.getOrCreateToken();
    }
    async checkIn(body) {
        try {
            return await this.attendanceService.checkIn(body.employeeId, body.token, body.deviceId);
        }
        catch (err) {
            throw new common_1.HttpException(err.message || 'Xatolik', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    async checkOut(body) {
        try {
            return await this.attendanceService.checkOut(body.employeeId, body.token, body.deviceId);
        }
        catch (err) {
            throw new common_1.HttpException(err.message || 'Xatolik', common_1.HttpStatus.BAD_REQUEST);
        }
    }
    getTodayRecords() {
        return this.attendanceService.getTodayRecords();
    }
    getRecords(date) {
        return this.attendanceService.getRecords(date);
    }
    getMonthlyRecords(year, month) {
        if (!year || !month)
            throw new common_1.HttpException('Year and month required', common_1.HttpStatus.BAD_REQUEST);
        return this.attendanceService.getMonthlyRecords(parseInt(year), parseInt(month));
    }
    getByEmployee(employeeId) {
        return this.attendanceService.getRecordsByEmployee(employeeId);
    }
};
exports.AttendanceController = AttendanceController;
__decorate([
    (0, common_1.Get)('token'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "getCurrentToken", null);
__decorate([
    (0, common_1.Post)('token/refresh'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "refreshToken", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('checkin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "checkIn", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('checkout'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AttendanceController.prototype, "checkOut", null);
__decorate([
    (0, common_1.Get)('records/today'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "getTodayRecords", null);
__decorate([
    (0, common_1.Get)('records'),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "getRecords", null);
__decorate([
    (0, common_1.Get)('monthly'),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "getMonthlyRecords", null);
__decorate([
    (0, common_1.Get)('records/employee/:employeeId'),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AttendanceController.prototype, "getByEmployee", null);
exports.AttendanceController = AttendanceController = __decorate([
    (0, common_2.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, feature_decorator_1.RequireFeature)('attendance'),
    (0, common_1.Controller)('attendance'),
    __metadata("design:paramtypes", [attendance_service_1.AttendanceService])
], AttendanceController);
//# sourceMappingURL=attendance.controller.js.map