/**
 * PrintFlow — Database Seed Script
 * 
 * Bu script:
 * 1. SuperAdmin akkauntini yaratadi (platform operations)
 * 2. Birinchi demo tenant workspace ni yaratadi
 * 3. Demo tenant uchun admin employee yaratadi (bcrypt hash bilan)
 * 
 * Foydalanish:
 *   npx ts-node prisma/seed.ts
 *   yoki
 *   npm run prisma:seed
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 PrintFlow seed boshlandi...\n');

  // =============================================
  // 1. SUPER ADMIN (Platform level)
  // =============================================
  const superAdminLogin = process.env.SUPER_ADMIN_LOGIN || 'admin';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminPassword) {
    console.log('ℹ️ SUPER_ADMIN_PASSWORD kiritilmagan. SuperAdmin yaratish o\'tkazib yuborildi.');
  } else {

    const existingSuperAdmin = await prisma.superAdmin.findUnique({
      where: { login: superAdminLogin },
    });

    if (!existingSuperAdmin) {
      const passwordHash = await bcrypt.hash(superAdminPassword, 12);
      await prisma.superAdmin.create({
        data: { login: superAdminLogin, passwordHash },
      });
      console.log(`✅ SuperAdmin yaratildi: ${superAdminLogin}`);
    } else {
      console.log(`ℹ️  SuperAdmin mavjud: ${superAdminLogin}`);
    }
  }

  // =============================================
  // 1b. DEFAULT PLAN — Yagona tarif
  // Oylik baza narx 500.000 so'm. 6 oyda -5%, 12 oyda -10% chegirma.
  // =============================================
  const MONTHLY_PRICE = 500_000;
  const defaultPlans = [
    {
      name: 'STANDARD',
      displayName: 'PrintFlow Tarifi',
      price3m: MONTHLY_PRICE * 3, // endi UI'da ko'rsatilmaydi, muvofiqlik uchun saqlanadi
      price6m: Math.round(MONTHLY_PRICE * 6 * 0.95), // 5% chegirma
      price12m: Math.round(MONTHLY_PRICE * 12 * 0.9), // 10% chegirma
      maxEmployees: 20,
      sortOrder: 1,
      isPopular: true,
      description: 'Bosmaxonalar uchun to\'liq boshqaruv tizimi',
      features: JSON.stringify({
        kanban: true,
        finance: true,
        crm: true,
        inventory: true,
        telegram_bot: true,
        telegram_webapp: true,
        services: true,
        attendance: true,
        finance_analytics: true,
        task_management: true,
        kpi_analytics: false,
        auto_debt_notify: false,
        multi_branch: false,
        archive: false,
        excel_export: false,
      }),
    },
  ];

  for (const plan of defaultPlans) {
    const existing = await prisma.plan.findUnique({ where: { name: plan.name } });
    if (!existing) {
      await prisma.plan.create({ data: plan });
      console.log(`✅ Plan yaratildi: ${plan.name}`);
    } else {
      console.log(`ℹ️  Plan mavjud: ${plan.name}`);
    }
  }

  // =============================================
  // 2. DEMO TENANT WORKSPACE
  // =============================================
  const demoSlug = process.env.DEMO_TENANT_SLUG || 'demo';
  const demoAdminLogin = process.env.DEMO_ADMIN_LOGIN || 'admin';
  const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD;

  if (!demoAdminPassword) {
    console.log('ℹ️ DEMO_ADMIN_PASSWORD kiritilmagan. Demo tenant yaratish o\'tkazib yuborildi.');
    return;
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: demoSlug } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Demo Bosmaxona',
        slug: demoSlug,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    console.log(`✅ Demo tenant yaratildi: slug="${demoSlug}", id="${tenant.id}"`);
  } else {
    console.log(`ℹ️  Demo tenant mavjud: slug="${demoSlug}"`);
  }

  const tenantId = tenant.id;

  // =============================================
  // 3. ADMIN ROLE (for demo tenant)
  // =============================================
  let adminRole = await prisma.role.findFirst({
    where: { tenantId, name: 'Admin' },
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        tenantId,
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
      },
    });
    console.log('✅ Admin role yaratildi');
  } else {
    console.log('ℹ️  Admin role mavjud');
  }

  // =============================================
  // 4. ADMIN EMPLOYEE (bcrypt hash)
  // =============================================
  const existingAdmin = await prisma.employee.findFirst({
    where: { tenantId, login: demoAdminLogin },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(demoAdminPassword, 12);
    await prisma.employee.create({
      data: {
        tenantId,
        fullName: 'Bosh Administrator',
        login: demoAdminLogin,
        passwordHash,
        roleId: adminRole.id,
      },
    });
    console.log(`✅ Admin employee yaratildi: login="${demoAdminLogin}"`);
  } else {
    console.log(`ℹ️  Admin employee mavjud: login="${demoAdminLogin}"`);
  }

  // =============================================
  // 5. DEFAULT KANBAN COLUMNS
  // =============================================
  const colCount = await prisma.kanbanColumn.count({ where: { tenantId } });
  if (colCount === 0) {
    const columns = [
      { title: 'Buyurtma olindi', orderIdx: 0 },
      { title: 'Dizayn', orderIdx: 1 },
      { title: 'Bosma', orderIdx: 2 },
      { title: 'Tayyor', orderIdx: 3 },
      { title: 'Yetkazildi', orderIdx: 4 },
    ];
    for (const col of columns) {
      await prisma.kanbanColumn.create({ data: { tenantId, ...col } });
    }
    console.log('✅ Default Kanban ustunlari yaratildi (5 ta)');
  } else {
    console.log(`ℹ️  Kanban ustunlari mavjud (${colCount} ta)`);
  }

  // =============================================
  // 6. DEFAULT PAYMENT TYPES
  // =============================================
  const ptCount = await prisma.paymentType.count({ where: { tenantId } });
  if (ptCount === 0) {
    const paymentTypes = ["Naqd", "Karta", "Click/Payme"];
    for (const name of paymentTypes) {
      await prisma.paymentType.create({ data: { tenantId, name } });
    }
    console.log('✅ Default to\'lov turlari yaratildi');
  } else {
    console.log(`ℹ️  To'lov turlari mavjud (${ptCount} ta)`);
  }

  console.log('\n🎉 Seed muvaffaqiyatli yakunlandi!');
  console.log(`\n📋 Login ma'lumotlari:`);
  console.log(`   Workspace: ${demoSlug}`);
  console.log(`   Login:     ${demoAdminLogin}`);
  console.log(`   Parol:     [DEMO_ADMIN_PASSWORD env variable]`);
}

main()
  .catch((e) => {
    console.error('❌ Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
