// =============================================
// CONSOLIDATE PUFFPRINT — move all data from Samarqand/Jizzax/Bosh Ofis (Asosiy)
// into Puffprint Toshkent, then delete the 3 now-empty branches.
//
// Handles the @@unique([tenantId, branchId, name]) collision on Department
// (every branch has its own "poligrafiya") by remapping task/transaction
// departmentIds to Toshkent's "poligrafiya" before deleting source duplicates.
//
// Run from backend/:
//   node consolidate-puffprint.js          # DRY RUN
//   node consolidate-puffprint.js --apply  # commit
// =============================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const TARGET_BRANCH_NAME = 'Puffprint Toshkent';
const SOURCE_BRANCH_NAMES = ['Puffprtin Samarqand', 'Puffprint Jizzax', 'Bosh Ofis (Asosiy)'];

// Tables with branchId column where rows simply get repointed.
// Department is handled separately because of the unique-name constraint.
const SIMPLE_TABLES = ['employee', 'customer', 'task', 'transaction', 'kanbanColumn', 'role', 'service', 'vendor'];

async function main() {
  console.log('========================================================');
  console.log(APPLY ? 'CONSOLIDATE PUFFPRINT — APPLY MODE' : 'CONSOLIDATE PUFFPRINT — DRY RUN');
  console.log('========================================================');

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'puffprint' } });
  if (!tenant) throw new Error('puffprint tenant not found');

  const target = await prisma.branch.findFirst({ where: { tenantId: tenant.id, name: TARGET_BRANCH_NAME } });
  if (!target) throw new Error(`Target branch "${TARGET_BRANCH_NAME}" not found`);

  const sources = await prisma.branch.findMany({ where: { tenantId: tenant.id, name: { in: SOURCE_BRANCH_NAMES } } });
  if (sources.length === 0) throw new Error('No source branches found — already consolidated?');

  console.log(`\nTarget: "${target.name}" (id=${target.id})`);
  console.log(`Sources (${sources.length}):`);
  sources.forEach((b) => console.log(`  - "${b.name}" (id=${b.id})`));

  const sourceIds = sources.map((b) => b.id);

  // Pre-compute Department merge: for each source dept, find target dept with same name.
  const sourceDepts = await prisma.department.findMany({
    where: { tenantId: tenant.id, branchId: { in: sourceIds } },
    select: { id: true, name: true, branchId: true },
  });
  const targetDepts = await prisma.department.findMany({
    where: { tenantId: tenant.id, branchId: target.id },
    select: { id: true, name: true },
  });
  const targetDeptByName = Object.fromEntries(targetDepts.map((d) => [d.name, d.id]));

  // For each source dept: if target has same name → remap & delete; else → just move.
  const deptPlan = sourceDepts.map((d) => ({
    sourceDept: d,
    targetDeptId: targetDeptByName[d.name] || null, // null = no collision, just move
  }));

  console.log('\nDepartment plan:');
  deptPlan.forEach((p) => {
    const action = p.targetDeptId ? `MERGE → ${p.targetDeptId.slice(0, 8)}…` : 'MOVE (no collision)';
    console.log(`  - "${p.sourceDept.name}" (${p.sourceDept.id.slice(0, 8)}…)  ${action}`);
  });

  // Pre-counts for simple tables
  console.log('\nRows to move (branchId IN sources → target):');
  const plan = {};
  for (const tbl of SIMPLE_TABLES) {
    plan[tbl] = await prisma[tbl].count({ where: { tenantId: tenant.id, branchId: { in: sourceIds } } });
    if (plan[tbl] > 0) console.log(`  → ${tbl.padEnd(15)} ${plan[tbl]}`);
  }
  // Task.executorBranchId — repoint where executor is a source
  const execCount = await prisma.task.count({ where: { tenantId: tenant.id, executorBranchId: { in: sourceIds } } });
  if (execCount > 0) console.log(`  → task.executorBranchId  ${execCount}`);

  if (!APPLY) {
    console.log('\n[dry-run] No writes. Re-run with --apply to commit.');
    return;
  }

  // === APPLY ===
  // Default Prisma interactive-tx timeout is 5s — bumped to 30s so the
  // dept-merge + multi-table updateMany + verify loop has room to finish.
  await prisma.$transaction(async (tx) => {
    // 1. Department merge / move
    for (const p of deptPlan) {
      if (p.targetDeptId) {
        // Remap tasks & transactions referencing the source dept → target dept
        await tx.task.updateMany({
          where: { tenantId: tenant.id, departmentId: p.sourceDept.id },
          data: { departmentId: p.targetDeptId },
        });
        await tx.transaction.updateMany({
          where: { tenantId: tenant.id, departmentId: p.sourceDept.id },
          data: { departmentId: p.targetDeptId },
        });
        // Delete the now-orphaned source dept
        await tx.department.delete({ where: { id: p.sourceDept.id } });
      } else {
        // No collision — just move
        await tx.department.update({
          where: { id: p.sourceDept.id },
          data: { branchId: target.id },
        });
      }
    }

    // 2. Simple table repoint
    for (const tbl of SIMPLE_TABLES) {
      if (plan[tbl] === 0) continue;
      await tx[tbl].updateMany({
        where: { tenantId: tenant.id, branchId: { in: sourceIds } },
        data: { branchId: target.id },
      });
    }

    // 3. Task.executorBranchId
    if (execCount > 0) {
      await tx.task.updateMany({
        where: { tenantId: tenant.id, executorBranchId: { in: sourceIds } },
        data: { executorBranchId: target.id },
      });
    }

    // 4. Verify sources are empty across every nullable-branch table
    for (const tbl of [...SIMPLE_TABLES, 'department']) {
      const left = await tx[tbl].count({ where: { tenantId: tenant.id, branchId: { in: sourceIds } } });
      if (left > 0) throw new Error(`Refusing to delete: ${tbl} still has ${left} rows in source branches`);
    }

    // 5. Delete the source branches
    const del = await tx.branch.deleteMany({ where: { id: { in: sourceIds } } });
    console.log(`  ✓ deleted ${del.count} empty branches`);
  }, { timeout: 30000, maxWait: 10000 });

  console.log('\n✓ APPLIED. Verify with: node diagnose-branches.js puffprint');
  console.log('========================================================\n');
}

main().catch((e) => { console.error('\n✗ Failed:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
