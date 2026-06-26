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
  'taskAttachment',
  'taskExpense',
  'service',
  'serviceOption',
  'serviceMaterial',
  'material',
  'stockMovement',
  'attendanceRecord',
  'overtimeRequest',
  'systemSetting',
  'botSession',
  'branch',
  'vendor',
  'vendorLedgerEntry',
  'orderVendorCost',
  'customerContact',
  'vendorOrder',
  'department',
  'kpiPlan',
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

  /**
   * Retry helper for transient connection errors.
   * Railway's TCP proxy kills idle Postgres sockets after a few minutes; the
   * next query that uses one fails with "Server has closed the connection" /
   * ECONNRESET. Prisma's pool then drains the dead socket — a second attempt
   * succeeds with a fresh one.
   *
   * Pool timeout (P2024) atayin retry qilinmaydi — pool to'lib qolgan bo'lsa
   * yana shu pool'dan kutib hech narsa o'zgarmaydi, faqat foydalanuvchining
   * kutish vaqti 2x bo'ladi. Connection pool sozlamasi katta qilingan (30),
   * shuning uchun P2024 endi mavjud konkurensiya muammosi (boshqa yondashuv
   * kerak), retry yordam bermaydi.
   */
  private async withRetry<T>(op: () => Promise<T>, attempts = 2): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await op();
      } catch (e: any) {
        lastErr = e;
        const msg: string = e?.message ?? '';
        const code: string | undefined = e?.code;
        const transient =
          code === 'P1001' ||                              // can't reach DB
          code === 'P1017' ||                              // server closed connection
          msg.includes('Server has closed the connection') ||
          msg.includes('ECONNRESET') ||
          msg.includes('Connection reset') ||
          msg.includes('Connection terminated');
        if (!transient || i === attempts - 1) throw e;
        console.warn(`[Prisma] Transient connection error, retrying once (${msg.split('\n')[0]})`);
        await new Promise(r => setTimeout(r, 200));
      }
    }
    throw lastErr;
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
        return this.withRetry(() => next(params));
      }

      // Try to get tenant from AsyncLocalStorage context
      const tenantId = TenantContext.tryGetTenantId();

      // Outside request context (seed scripts, migrations) — skip injection
      if (!tenantId) {
        return this.withRetry(() => next(params));
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
        ['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)
      ) {
        params.args = params.args || {};
        params.args.where = { ...params.args.where, tenantId };
      }

      // UPSERT — scope WHERE and inject tenantId into create payload
      if (params.action === 'upsert') {
        params.args = params.args || {};
        params.args.where = { ...params.args.where, tenantId };
        params.args.create = { ...params.args.create, tenantId };
      }

      return this.withRetry(() => next(params));
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
