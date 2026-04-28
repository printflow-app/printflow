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
exports.FeatureGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const prisma_service_1 = require("../../prisma/prisma.service");
const feature_decorator_1 = require("../decorators/feature.decorator");
let FeatureGuard = class FeatureGuard {
    constructor(reflector, prisma) {
        this.reflector = reflector;
        this.prisma = prisma;
    }
    async canActivate(context) {
        const requiredFeature = this.reflector.getAllAndOverride(feature_decorator_1.REQUIRE_FEATURE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredFeature) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const tenantId = req._tenantPayload?.tenantId;
        if (!tenantId) {
            return true;
        }
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { plan: true }
        });
        if (!tenant || !tenant.plan) {
            throw new common_1.ForbiddenException(`FEATURE_DISABLED: Sizning ta'rifingizda '${requiredFeature}' imkoniyati yo'q`);
        }
        let features = {};
        try {
            features = JSON.parse(tenant.plan.features);
        }
        catch (e) { }
        const featureVal = features[requiredFeature];
        if (featureVal === false || featureVal === undefined || featureVal === null || featureVal === '') {
            throw new common_1.ForbiddenException(`FEATURE_DISABLED: Sizning ta'rifingizda '${requiredFeature}' imkoniyati yo'q`);
        }
        return true;
    }
};
exports.FeatureGuard = FeatureGuard;
exports.FeatureGuard = FeatureGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector, prisma_service_1.PrismaService])
], FeatureGuard);
//# sourceMappingURL=feature.guard.js.map