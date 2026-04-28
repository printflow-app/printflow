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
exports.TenantsController = void 0;
const common_1 = require("@nestjs/common");
const tenants_service_1 = require("./tenants.service");
const super_admin_guard_1 = require("../../common/guards/super-admin.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let TenantsController = class TenantsController {
    constructor(tenantsService) {
        this.tenantsService = tenantsService;
    }
    findAll() {
        return this.tenantsService.findAll();
    }
    getStats() {
        return this.tenantsService.getStats();
    }
    getPendingPayments() {
        return this.tenantsService.getPendingPayments();
    }
    getAllPayments() {
        return this.tenantsService.getAllPayments();
    }
    approvePayment(id, req) {
        const superAdminId = req.superAdmin?.sub || 'system';
        return this.tenantsService.approvePayment(id, superAdminId);
    }
    rejectPayment(id) {
        return this.tenantsService.rejectPayment(id);
    }
    createFromLead(body) {
        return this.tenantsService.createFromLead(body);
    }
    findOne(id) {
        return this.tenantsService.findOne(id);
    }
    create(body) {
        return this.tenantsService.createWithAdmin(body);
    }
    update(id, body) {
        return this.tenantsService.update(id, body);
    }
    remove(id) {
        return this.tenantsService.remove(id);
    }
};
exports.TenantsController = TenantsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats/overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('payments/pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "getPendingPayments", null);
__decorate([
    (0, common_1.Get)('payments/all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "getAllPayments", null);
__decorate([
    (0, common_1.Post)('payments/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "approvePayment", null);
__decorate([
    (0, common_1.Post)('payments/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "rejectPayment", null);
__decorate([
    (0, common_1.Post)('from-lead'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "createFromLead", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TenantsController.prototype, "remove", null);
exports.TenantsController = TenantsController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('super-admin/tenants'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    __metadata("design:paramtypes", [tenants_service_1.TenantsService])
], TenantsController);
//# sourceMappingURL=tenants.controller.js.map