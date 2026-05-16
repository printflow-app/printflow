// =============================================
// INSPECT PUFFPRINT — list every employee, customer, task, etc. with
// its current branch assignment so you can spot misplaced records.
//
// Read-only. Run from backend/:
//   node inspect-puffprint.js
// =============================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'puffprint' } });
  if (!tenant) { console.log('puffprint tenant not found'); return; }

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });
  const branchById = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const bn = (id) => (id ? (branchById[id] || `?${id.slice(0, 8)}`) : '(NULL)');

  console.log('\n========================================================');
  console.log('PUFFPRINT — per-record branch assignment');
  console.log('========================================================');
  console.log('Branches:');
  branches.forEach((b) => console.log(`  - ${b.name} (id=${b.id.slice(0, 8)}…)`));

  // --- EMPLOYEES ---
  const employees = await prisma.employee.findMany({
    where: { tenantId: tenant.id },
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, login: true, branchId: true },
  });
  console.log(`\n--- EMPLOYEES (${employees.length}) ---`);
  employees.forEach((e) => console.log(`  [${bn(e.branchId).padEnd(22)}]  ${e.fullName.padEnd(28)}  login=${e.login || '-'}`));

  // --- CUSTOMERS ---
  const customers = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true, branchId: true },
  });
  console.log(`\n--- CUSTOMERS (${customers.length}) ---`);
  customers.forEach((c) => console.log(`  [${bn(c.branchId).padEnd(22)}]  ${(c.name || '-').padEnd(28)}  ${c.phone || ''}`));

  // --- TASKS ---
  const tasks = await prisma.task.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, displayId: true, title: true, branchId: true, executorBranchId: true, totalAmount: true },
  });
  console.log(`\n--- TASKS (${tasks.length}) ---`);
  tasks.forEach((t) => console.log(`  [${bn(t.branchId).padEnd(22)}]  ${(t.displayId || t.id.slice(0,8)).padEnd(10)}  ${(t.title || '').slice(0, 35).padEnd(35)}  exec=${bn(t.executorBranchId)}`));

  // --- TRANSACTIONS ---
  const transactions = await prisma.transaction.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true, type: true, customerName: true, expenseReason: true, serviceType: true, branchId: true, createdAt: true },
    take: 50,
  });
  console.log(`\n--- TRANSACTIONS (showing up to 50) ---`);
  transactions.forEach((tx) => {
    const note = tx.customerName || tx.expenseReason || tx.serviceType || '';
    console.log(`  [${bn(tx.branchId).padEnd(22)}]  ${tx.type.padEnd(8)}  ${String(tx.amount).padStart(10)}  ${note.slice(0, 30).padEnd(30)}  ${tx.createdAt.toISOString().slice(0, 10)}`);
  });

  // --- KANBAN COLUMNS ---
  const cols = await prisma.kanbanColumn.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ branchId: 'asc' }, { orderIdx: 'asc' }],
    select: { id: true, title: true, branchId: true, orderIdx: true },
  });
  console.log(`\n--- KANBAN COLUMNS (${cols.length}) ---`);
  cols.forEach((c) => console.log(`  [${bn(c.branchId).padEnd(22)}]  ord=${c.orderIdx}  ${c.title}`));

  // --- ROLES ---
  const roles = await prisma.role.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, branchId: true },
  });
  console.log(`\n--- ROLES (${roles.length}) ---`);
  roles.forEach((r) => console.log(`  [${bn(r.branchId).padEnd(22)}]  ${r.name}`));

  // --- DEPARTMENTS ---
  const depts = await prisma.department.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, branchId: true },
  });
  console.log(`\n--- DEPARTMENTS (${depts.length}) ---`);
  depts.forEach((d) => console.log(`  [${bn(d.branchId).padEnd(22)}]  ${d.name}`));

  // --- SERVICES ---
  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, branchId: true },
  });
  console.log(`\n--- SERVICES (${services.length}) ---`);
  services.forEach((s) => console.log(`  [${bn(s.branchId).padEnd(22)}]  ${s.name}`));

  // --- VENDORS ---
  const vendors = await prisma.vendor.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, branchId: true },
  });
  console.log(`\n--- VENDORS (${vendors.length}) ---`);
  vendors.forEach((v) => console.log(`  [${bn(v.branchId).padEnd(22)}]  ${v.name}`));

  console.log('\n========================================================\n');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
