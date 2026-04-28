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
exports.LeadsController = void 0;
const common_1 = require("@nestjs/common");
const leads_service_1 = require("./leads.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const super_admin_guard_1 = require("../../common/guards/super-admin.guard");
const create_lead_dto_1 = require("./create-lead.dto");
let LeadsController = class LeadsController {
    constructor(leadsService) {
        this.leadsService = leadsService;
    }
    create(body) {
        return this.leadsService.create(body);
    }
    findAll() {
        return this.leadsService.findAll();
    }
    updateStatus(id, body) {
        return this.leadsService.updateStatus(id, body.status);
    }
    remove(id) {
        return this.leadsService.remove(id);
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lead_dto_1.CreateLeadDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "create", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "findAll", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, common_1.Post)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "updateStatus", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "remove", null);
exports.LeadsController = LeadsController = __decorate([
    (0, common_1.Controller)('leads'),
    __metadata("design:paramtypes", [leads_service_1.LeadsService])
], LeadsController);
//# sourceMappingURL=leads.controller.js.map