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
exports.SettingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const tenant_context_1 = require("../../common/tenant/tenant.context");
let SettingsService = class SettingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(key) {
        const setting = await this.prisma.systemSetting.findFirst({
            where: { key },
        });
        return setting ? JSON.parse(setting.value) : null;
    }
    async set(key, value) {
        const valueStr = JSON.stringify(value);
        const tenantId = tenant_context_1.TenantContext.getTenantId();
        return this.prisma.systemSetting.upsert({
            where: { tenantId_key: { tenantId, key } },
            update: { value: valueStr },
            create: { key, value: valueStr },
        });
    }
    async getAll() {
        const settings = await this.prisma.systemSetting.findMany();
        const result = {};
        settings.forEach((s) => {
            result[s.key] = JSON.parse(s.value);
        });
        return result;
    }
};
exports.SettingsService = SettingsService;
exports.SettingsService = SettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SettingsService);
//# sourceMappingURL=settings.service.js.map