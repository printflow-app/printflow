"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tenant_context_1 = require("../common/tenant/tenant.context");
const TENANT_SCOPED_MODELS = new Set([
    'role',
    'employee',
    'customer',
    'paymentType',
    'transaction',
    'expenseType',
    'kanbanColumn',
    'task',
    'taskHistory',
    'service',
    'serviceOption',
    'serviceMaterial',
    'material',
    'stockMovement',
    'attendanceRecord',
    'systemSetting',
    'botSession',
]);
let PrismaService = class PrismaService extends client_1.PrismaClient {
    async onModuleInit() {
        this.$use(async (params, next) => {
            const modelName = params.model
                ? params.model.charAt(0).toLowerCase() + params.model.slice(1)
                : null;
            if (!modelName || !TENANT_SCOPED_MODELS.has(modelName)) {
                return next(params);
            }
            const tenantId = tenant_context_1.TenantContext.tryGetTenantId();
            if (!tenantId) {
                return next(params);
            }
            if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
                params.args = params.args || {};
                params.args.where = { ...params.args.where, tenantId };
            }
            if (params.action === 'create') {
                params.args = params.args || {};
                params.args.data = { ...params.args.data, tenantId };
            }
            if (params.action === 'createMany') {
                params.args = params.args || {};
                params.args.data = Array.isArray(params.args.data)
                    ? params.args.data.map((d) => ({ ...d, tenantId }))
                    : params.args.data;
            }
            if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(params.action)) {
                params.args = params.args || {};
                params.args.where = { ...params.args.where, tenantId };
            }
            return next(params);
        });
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
//# sourceMappingURL=prisma.service.js.map