"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const jwt_1 = require("@nestjs/jwt");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const tenants_module_1 = require("./modules/tenants/tenants.module");
const jwt_auth_guard_1 = require("./common/guards/jwt-auth.guard");
const feature_guard_1 = require("./common/guards/feature.guard");
const tenant_interceptor_1 = require("./common/tenant/tenant.interceptor");
const roles_module_1 = require("./modules/roles/roles.module");
const employees_module_1 = require("./modules/employees/employees.module");
const customers_module_1 = require("./modules/customers/customers.module");
const payment_types_module_1 = require("./modules/payment-types/payment-types.module");
const tasks_module_1 = require("./modules/tasks/tasks.module");
const telegram_module_1 = require("./modules/telegram/telegram.module");
const expense_types_module_1 = require("./modules/expense-types/expense-types.module");
const services_module_1 = require("./modules/services/services.module");
const inventory_module_1 = require("./modules/inventory/inventory.module");
const attendance_module_1 = require("./modules/attendance/attendance.module");
const settings_module_1 = require("./modules/settings/settings.module");
const finance_module_1 = require("./modules/finance/finance.module");
const billing_module_1 = require("./modules/billing/billing.module");
const plans_module_1 = require("./modules/plans/plans.module");
const leads_module_1 = require("./modules/leads/leads.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'global',
                    ttl: 60000,
                    limit: 200,
                },
            ]),
            jwt_1.JwtModule.register({ global: true }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            tenants_module_1.TenantsModule,
            roles_module_1.RolesModule,
            employees_module_1.EmployeesModule,
            customers_module_1.CustomersModule,
            payment_types_module_1.PaymentTypesModule,
            expense_types_module_1.ExpenseTypesModule,
            tasks_module_1.TasksModule,
            finance_module_1.FinanceModule,
            telegram_module_1.TelegramModule,
            services_module_1.ServicesModule,
            inventory_module_1.InventoryModule,
            attendance_module_1.AttendanceModule,
            settings_module_1.SettingsModule,
            billing_module_1.BillingModule,
            plans_module_1.PlansModule,
            leads_module_1.LeadsModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: jwt_auth_guard_1.JwtAuthGuard,
            },
            {
                provide: core_1.APP_GUARD,
                useClass: feature_guard_1.FeatureGuard,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: tenant_interceptor_1.TenantInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map