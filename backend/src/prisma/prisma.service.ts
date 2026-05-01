import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContext } from '../common/tenant/tenant.context';

// =============================================
// TENANT-SCOPED MODELS
// Bu modellarga barcha so'rovlar avtomatik
// joriy tenant bilan cheklanadi.
// =============================================
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
  'branch',
]);

// These models are NOT tenant-scoped (platform-level):
// - Tenant, SuperAdmin, AttendanceToken

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    // Global Prisma middleware — appended to EVERY query automatically.
    // This is the core of multi-tenant isolation.
    this.$use(async (params, next) => {
      const modelName = params.model
        ? params.model.charAt(0).toLowerCase() + params.model.slice(1)
        : null;

      // Skip non-tenant models
      if (!modelName || !TENANT_SCOPED_MODELS.has(modelName)) {
        return next(params);
      }

      // Try to get tenant from AsyncLocalStorage context
      const tenantId = TenantContext.tryGetTenantId();

      // Outside request context (seed scripts, migrations) — skip injection
      if (!tenantId) {
        return next(params);
      }

      // READ operations — inject tenantId into WHERE
      if (
        ['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(
          params.action,
        )
      ) {
        params.args = params.args || {};
        params.args.where = { ...params.args.where, tenantId };
      }

      // CREATE — inject tenantId into data
      if (params.action === 'create') {
        params.args = params.args || {};
        params.args.data = { ...params.args.data, tenantId };
      }

      // CREATE MANY — inject tenantId into each record
      if (params.action === 'createMany') {
        params.args = params.args || {};
        params.args.data = Array.isArray(params.args.data)
          ? params.args.data.map((d: any) => ({ ...d, tenantId }))
          : params.args.data;
      }

      // UPDATE / DELETE — always scope WHERE to prevent cross-tenant mutations
      if (
        ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(
          params.action,
        )
      ) {
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
}
