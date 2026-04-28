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
exports.PlansAdminController = exports.PlansController = void 0;
const common_1 = require("@nestjs/common");
const plans_service_1 = require("./plans.service");
const super_admin_guard_1 = require("../../common/guards/super-admin.guard");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let PlansController = class PlansController {
    constructor(plansService) {
        this.plansService = plansService;
    }
    findAll() {
        return this.plansService.findAll();
    }
};
exports.PlansController = PlansController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlansController.prototype, "findAll", null);
exports.PlansController = PlansController = __decorate([
    (0, common_1.Controller)('plans'),
    __metadata("design:paramtypes", [plans_service_1.PlansService])
], PlansController);
let PlansAdminController = class PlansAdminController {
    constructor(plansService) {
        this.plansService = plansService;
    }
    findAll() {
        return this.plansService.findAllAdmin();
    }
    findOne(id) {
        return this.plansService.findOne(id);
    }
    create(data) {
        return this.plansService.create(data);
    }
    update(id, data) {
        return this.plansService.update(id, data);
    }
    remove(id) {
        return this.plansService.remove(id);
    }
};
exports.PlansAdminController = PlansAdminController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlansAdminController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlansAdminController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlansAdminController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PlansAdminController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlansAdminController.prototype, "remove", null);
exports.PlansAdminController = PlansAdminController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Controller)('super-admin/plans'),
    (0, common_1.UseGuards)(super_admin_guard_1.SuperAdminGuard),
    __metadata("design:paramtypes", [plans_service_1.PlansService])
], PlansAdminController);
//# sourceMappingURL=plans.controller.js.map