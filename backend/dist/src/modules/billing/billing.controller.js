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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const billing_service_1 = require("./billing.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
let BillingController = class BillingController {
    constructor(billingService) {
        this.billingService = billingService;
    }
    submitPayment(body) {
        return this.billingService.submitPayment(body);
    }
    getStatus() {
        return this.billingService.getTenantBillingStatus();
    }
    getMyPayments() {
        return this.billingService.getMyPayments();
    }
    getPaymentCards() {
        return this.billingService.getSetting('PAYMENT_CARDS');
    }
    updateSetting(key, body) {
        return this.billingService.updateSetting(key, body.value);
    }
    async getSetting(key) {
        const value = await this.billingService.getSetting(key);
        return { value };
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('payment'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "submitPayment", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('my-payments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getMyPayments", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('settings/payment-cards'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getPaymentCards", null);
__decorate([
    (0, common_1.Put)('settings/:key'),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "updateSetting", null);
__decorate([
    (0, common_1.Get)('settings/:key'),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BillingController.prototype, "getSetting", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map