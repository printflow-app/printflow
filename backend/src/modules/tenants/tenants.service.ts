import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import * as bcrypt from 'bcrypt';

// =============================================
// TENANTS SERVICE — Platform-level operations
// Super-Admin foydalanadi (tenant izolyatsiyasidan tashqarida)
// =============================================

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { employees: true, tasks: true, customers: true },
        },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
            tasks: true,
            customers: true,
            transactions: true,
          },
        },
      },
    });
  }

  /**
   * Creates a new tenant workspace with:
   * - Default Admin role (all permissions)
   * - Initial admin employee (credentials provided)
   * - Default Kanban columns
   * - Default payment types
   */
  async createWithAdmin(data: {
    name: string;
    slug: string;
    plan?: string;
    trialDays?: number;
    adminEmail: string; // Used as login for the admin employee
    adminPassword: string;
  }) {
    const trialEndsAt = data.trialDays
      ? new Date(Date.now() + data.trialDays * 24 * 60 * 60 * 1000)
      : null;

    // Create the tenant
    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan: data.plan || 'starter',
        trialEndsAt,
      },
    });

    // All subsequent operations must run within tenant context
    await TenantContext.run(
      { tenantId: tenant.id, userId: '', userRole: '' },
      async () => {
        // Create Admin role with all permissions
        const adminRole = await this.prisma.role.create({
          data: {
            name: 'Admin',
            canViewFinance: true,
            canAddIncome: true,
            canAddExpense: true,
            canViewTotalBalance: true,
            canManagePaymentTypes: true,
            canViewTasks: true,
            canCreateTask: true,
            canEditTask: true,
            canDeleteTask: true,
            canMoveTask: true,
            canManageColumns: true,
            canViewCustomers: true,
            canManageCustomers: true,
            canViewInventory: true,
            canManageInventory: true,
            canViewAttendance: true,
            canManageAttendance: true,
            canViewServices: true,
            canManageServices: true,
            canViewEmployees: true,
            canManageEmployees: true,
            canManageRoles: true,
            canViewSalary: true,
          } as any,
        });

        // Hash admin password
        const passwordHash = await bcrypt.hash(data.adminPassword, 12);

        // Create admin employee
        await this.prisma.employee.create({
          data: {
            fullName: 'Administrator',
            login: data.adminEmail,
            passwordHash,
            roleId: adminRole.id,
          } as any,
        });

        // Create default Kanban columns
        const defaultColumns = [
          { title: 'Buyurtma olindi', orderIdx: 0 },
          { title: 'Dizayn', orderIdx: 1 },
          { title: 'Bosma', orderIdx: 2 },
          { title: 'Tayyor', orderIdx: 3 },
          { title: 'Yetkazildi', orderIdx: 4 },
        ];

        for (const col of defaultColumns) {
          await this.prisma.kanbanColumn.create({ data: col as any });
        }

        // Create default payment types
        const defaultPaymentTypes = ['Naqd', 'Karta', "Click/Payme"];
        for (const name of defaultPaymentTypes) {
          await this.prisma.paymentType.create({ data: { name } as any });
        }
      },
    );

    return tenant;
  }

  update(id: string, data: { name?: string; plan?: string; isActive?: boolean }) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  remove(id: string) {
    // Cascade deletes all related data via Prisma schema onDelete: Cascade
    return this.prisma.tenant.delete({ where: { id } });
  }

  /**
   * Platform stats for Super-Admin dashboard
   */
  async getStats() {
    const [totalTenants, activeTenants, totalEmployees, totalTasks] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
        this.prisma.employee.count(),
        this.prisma.task.count(),
      ]);

    // Trial tenants expiring in next 7 days
    const trialsExpiringSoon = await this.prisma.tenant.count({
      where: {
        trialEndsAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      totalTenants,
      activeTenants,
      inactiveTenants: totalTenants - activeTenants,
      trialsExpiringSoon,
      totalEmployees,
      totalTasks,
    };
  }
}
