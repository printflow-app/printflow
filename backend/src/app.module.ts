import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';

// Infrastructure
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';

// Guards & Interceptors
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { FeatureGuard } from './common/guards/feature.guard';
import { TenantInterceptor } from './common/tenant/tenant.interceptor';

// Existing feature modules
import { RolesModule } from './modules/roles/roles.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PaymentTypesModule } from './modules/payment-types/payment-types.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { ExpenseTypesModule } from './modules/expense-types/expense-types.module';
import { ServicesModule } from './modules/services/services.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { SettingsModule } from './modules/settings/settings.module';
import { FinanceModule } from './modules/finance/finance.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlansModule } from './modules/plans/plans.module';
import { LeadsModule } from './modules/leads/leads.module';

// =============================================
// APP MODULE — PrintFlow Multi-Tenant SaaS
// Global guards applied here (no per-controller decoration needed)
//
// Request lifecycle:
// ThrottlerGuard → JwtAuthGuard → TenantInterceptor → Handler
// =============================================

@Module({
  imports: [
    ScheduleModule.forRoot(),

    // Rate limiting — brute-force va DoS himoyasi
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,  // 1 minute window
        limit: 200,  // max 200 requests per window
      },
    ]),

    // JWT module — needed for JwtAuthGuard injection
    JwtModule.register({ global: true }),

    // Infrastructure
    PrismaModule,
    AuthModule,
    TenantsModule,

    // Feature modules (all auto-scoped by TenantInterceptor + Prisma middleware)
    RolesModule,
    EmployeesModule,
    CustomersModule,
    PaymentTypesModule,
    ExpenseTypesModule,
    TasksModule,
    FinanceModule,
    TelegramModule,
    ServicesModule,
    InventoryModule,
    AttendanceModule,
    SettingsModule,
    BillingModule,
    PlansModule,
    LeadsModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global JWT auth guard — protects ALL routes by default
    // Use @Public() decorator to exempt specific routes
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Global Feature guard
    {
      provide: APP_GUARD,
      useClass: FeatureGuard,
    },

    // Global tenant interceptor — activates AsyncLocalStorage scope
    // Must run AFTER JwtAuthGuard sets req._tenantPayload
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
