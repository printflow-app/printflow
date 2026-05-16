// =============================================
// DIAGNOSE BRANCHES — read-only inventory of branches and NULL-branchId rows
//
// Run from backend/ folder:
//   node diagnose-branches.js
//   node diagnose-branches.js <tenantSlug>   # narrow to one tenant
//
// Does NOT modify anything. Outputs:
//   - per-tenant branch list (id, name, createdAt, isActive, employee/task counts)
//   - duplicate-name detection
//   - per-tenant count of NULL branchId rows in every nullable-branch table
// =============================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NULLABLE_TABLES = [
  'department',
  'role',
  'employee',
  'customer',
  'transaction',
  'kanbanColumn',
  'task',           // OriginBranch (branchId)
];

async function main() {
  const slugFilter = process.argv[2];

  const tenants = await prisma.tenant.findMany({
    where: slugFilter ? { slug: slugFilter } : undefined,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, slug: true, status: true, createdAt: true },
  });

  if (tenants.length === 0) {
    console.log(slugFilter ? `No tenant with slug "${slugFilter}"` : 'No tenants in DB');
    return;
  }

  for (const t of tenants) {
    console.log('\n========================================================');
    console.log(`TENANT: ${t.name}  (slug=${t.slug}, status=${t.status})`);
    console.log(`        id=${t.id}`);
    console.log(`        created=${t.createdAt.toISOString()}`);
    console.log('========================================================');

    // --- Branches ---
    const branches = await prisma.branch.findMany({
      where: { tenantId: t.id },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { employees: true, tasks: true, customers: true, transactions: true, services: true, vendors: true, kanbanColumns: true, departments: true, roles: true } } },
    });

    console.log(`\n  Branches (${branches.length}):`);
    if (branches.length === 0) {
      console.log('    (none)');
    } else {
      for (const b of branches) {
        const c = b._count;
        console.log(`    - "${b.name}"  ${b.isActive ? '' : '[INACTIVE] '}`);
        console.log(`        id=${b.id}`);
        console.log(`        created=${b.createdAt.toISOString()}`);
        console.log(`        counts: employees=${c.employees}, tasks=${c.tasks}, customers=${c.customers}, transactions=${c.transactions}, services=${c.services}, vendors=${c.vendors}, columns=${c.kanbanColumns}, departments=${c.departments}, roles=${c.roles}`);
      }
    }

    // --- Duplicate-name detection ---
    const byNameLower = {};
    for (const b of branches) {
      const key = b.name.trim().toLowerCase();
      (byNameLower[key] ||= []).push(b);
    }
    const dupes = Object.entries(byNameLower).filter(([, arr]) => arr.length > 1);
    if (dupes.length > 0) {
      console.log('\n  ⚠ DUPLICATE-NAME BRANCHES:');
      for (const [name, arr] of dupes) {
        console.log(`    "${name}" appears ${arr.length} times:`);
        arr.forEach((b) => console.log(`      - id=${b.id}  created=${b.createdAt.toISOString()}`));
      }
    }

    // --- NULL branchId row counts ---
    console.log('\n  NULL branchId rows per table (legacy "synthetic Bosh ofis" data):');
    for (const tbl of NULLABLE_TABLES) {
      const count = await prisma[tbl].count({
        where: { tenantId: t.id, branchId: null },
      });
      const total = await prisma[tbl].count({ where: { tenantId: t.id } });
      const marker = count > 0 ? '  ⚠' : '   ';
      console.log(`  ${marker}  ${tbl.padEnd(15)} NULL=${count} / total=${total}`);
    }

    // Task also has executorBranchId — separate column
    const taskExecNull = await prisma.task.count({
      where: { tenantId: t.id, executorBranchId: null },
    });
    const taskTotal = await prisma.task.count({ where: { tenantId: t.id } });
    console.log(`      task.executorBranchId NULL=${taskExecNull} / total=${taskTotal}  (NULL = "we execute it ourselves" — usually fine)`);
  }

  console.log('\n========================================================');
  console.log('Done. No changes were made.');
  console.log('========================================================\n');
}

main()
  .catch((e) => {
    console.error('Diagnostic failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
