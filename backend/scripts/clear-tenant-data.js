/**
 * clear-tenant-data.js
 * "vodiyprint" tenantidagi BARCHA biznes ma'lumotlarni tozalaydi.
 * Tenant va WorkspaceAdmin (admin login) SAQLANIB QOLADI.
 *
 * Ishlatish: node backend/scripts/clear-tenant-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_SLUG = 'vodiyprint';

async function clearTenantData() {
  // 1. Tenantni topamiz
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TARGET_SLUG },
    include: { workspaceAdmins: true },
  });

  if (!tenant) {
    console.error(`❌ Tenant topilmadi: "${TARGET_SLUG}"`);
    process.exit(1);
  }

  const tenantId = tenant.id;
  console.log(`\n✅ Tenant topildi: ${tenant.name} (${tenant.slug})`);
  console.log(`   ID: ${tenantId}`);
  console.log(`   WorkspaceAdmin soni: ${tenant.workspaceAdmins.length}`);
  console.log('\n⚠️  DIQQAT: Barcha biznes ma\'lumotlar o\'chiriladi!');
  console.log('   (Tenant va WorkspaceAdmin saqlanib qoladi)\n');

  // Har bir jadval uchun o'chirish soni
  const deleted = {};

  // --- 1. TaskExpense (Task ga bog'liq, oldin o'chiriladi) ---
  deleted.taskExpenses = await prisma.taskExpense.deleteMany({ where: { tenantId } });

  // --- 2. TaskHistory (Task va Employee ga bog'liq) ---
  deleted.taskHistories = await prisma.taskHistory.deleteMany({ where: { tenantId } });

  // --- 3. OrderVendorCost (Task va Vendor ga bog'liq) ---
  deleted.orderVendorCosts = await prisma.orderVendorCost.deleteMany({ where: { tenantId } });

  // --- 4. StockMovement (Material va Task ga bog'liq) ---
  deleted.stockMovements = await prisma.stockMovement.deleteMany({ where: { tenantId } });

  // --- 5. OvertimeRequest (Employee ga bog'liq) ---
  deleted.overtimeRequests = await prisma.overtimeRequest.deleteMany({ where: { tenantId } });

  // --- 6. AttendanceRecord (Employee ga bog'liq) ---
  deleted.attendanceRecords = await prisma.attendanceRecord.deleteMany({ where: { tenantId } });

  // --- 7. Transaction (Customer, Employee, PaymentType, Branch, ExpenseType ga bog'liq) ---
  deleted.transactions = await prisma.transaction.deleteMany({ where: { tenantId } });

  // --- 8. CustomerContact (Customer ga bog'liq) ---
  deleted.customerContacts = await prisma.customerContact.deleteMany({ where: { tenantId } });

  // --- 9. Task (KanbanColumn, Customer, Service, Branch, PaymentType ga bog'liq) ---
  deleted.tasks = await prisma.task.deleteMany({ where: { tenantId } });

  // --- 10. ServiceMaterial (Service va Material ga bog'liq) ---
  deleted.serviceMaterials = await prisma.serviceMaterial.deleteMany({ where: { tenantId } });

  // --- 11. ServiceOption (Service ga bog'liq) ---
  deleted.serviceOptions = await prisma.serviceOption.deleteMany({ where: { tenantId } });

  // --- 12. KanbanColumn ---
  deleted.kanbanColumns = await prisma.kanbanColumn.deleteMany({ where: { tenantId } });

  // --- 13. Service ---
  deleted.services = await prisma.service.deleteMany({ where: { tenantId } });

  // --- 14. Material ---
  deleted.materials = await prisma.material.deleteMany({ where: { tenantId } });

  // --- 15. Customer ---
  deleted.customers = await prisma.customer.deleteMany({ where: { tenantId } });

  // --- 16. Employee ---
  deleted.employees = await prisma.employee.deleteMany({ where: { tenantId } });

  // --- 17. Vendor ---
  deleted.vendors = await prisma.vendor.deleteMany({ where: { tenantId } });

  // --- 18. Branch ---
  deleted.branches = await prisma.branch.deleteMany({ where: { tenantId } });

  // --- 19. PaymentType ---
  deleted.paymentTypes = await prisma.paymentType.deleteMany({ where: { tenantId } });

  // --- 20. ExpenseType ---
  deleted.expenseTypes = await prisma.expenseType.deleteMany({ where: { tenantId } });

  // --- 21. Role ---
  deleted.roles = await prisma.role.deleteMany({ where: { tenantId } });

  // --- 22. SystemSetting ---
  deleted.systemSettings = await prisma.systemSetting.deleteMany({ where: { tenantId } });

  // --- 23. BotSession ---
  deleted.botSessions = await prisma.botSession.deleteMany({ where: { tenantId } });

  // --- 24. PromoCodeUsage (usingTenantId) ---
  deleted.promoCodeUsages = await prisma.promoCodeUsage.deleteMany({
    where: { usingTenantId: tenantId },
  });

  // Natijani chiqaramiz
  console.log('\n📊 O\'chirilgan ma\'lumotlar:\n');
  const labels = {
    taskExpenses:      'Task xarajatlari (TaskExpense)',
    taskHistories:     'Task tarixi (TaskHistory)',
    orderVendorCosts:  'Hamkor xarajatlari (OrderVendorCost)',
    stockMovements:    'Ombor harakatlari (StockMovement)',
    overtimeRequests:  'Ortiqcha ish so\'rovlari (OvertimeRequest)',
    attendanceRecords: 'Davomat yozuvlari (AttendanceRecord)',
    transactions:      'Moliya tranzaksiyalari (Transaction)',
    customerContacts:  'Mijoz kontaktlari (CustomerContact)',
    tasks:             'Topshiriqlar/Buyurtmalar (Task)',
    serviceMaterials:  'Xizmat materiallari (ServiceMaterial)',
    serviceOptions:    'Xizmat opsiyalari (ServiceOption)',
    kanbanColumns:     'Kanban ustunlari (KanbanColumn)',
    services:          'Xizmatlar (Service)',
    materials:         'Materiallar (Material)',
    customers:         'Mijozlar (Customer)',
    employees:         'Xodimlar (Employee)',
    vendors:           'Hamkorlar (Vendor)',
    branches:          'Filiallar (Branch)',
    paymentTypes:      "To'lov turlari (PaymentType)",
    expenseTypes:      "Chiqim turlari (ExpenseType)",
    roles:             'Rollar (Role)',
    systemSettings:    'Sozlamalar (SystemSetting)',
    botSessions:       'Bot sessiyalari (BotSession)',
    promoCodeUsages:   'Promo kod foydalanishlari (PromoCodeUsage)',
  };

  let totalDeleted = 0;
  for (const [key, result] of Object.entries(deleted)) {
    const count = result.count;
    totalDeleted += count;
    if (count > 0) {
      console.log(`   ✓ ${labels[key]}: ${count} ta`);
    }
  }

  console.log(`\n🎉 Jami ${totalDeleted} ta yozuv o'chirildi.`);
  console.log(`✅ Tenant "${TARGET_SLUG}" va WorkspaceAdmin saqlanib qoldi.\n`);
}

clearTenantData()
  .catch((err) => {
    console.error('❌ Xatolik:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
