// =============================================
// BACKFILL BRANCHES — assign legacy NULL-branchId rows to the tenant's
// single real branch. Targets: sharqreklama + vodiyprint.
//
// Each tenant is wrapped in its own $transaction. Safe to re-run: rows
// already pointing at the target branch are not re-updated.
//
// Run from backend/ folder:
//   node backfill-branches.js            # DRY RUN — shows what WOULD change
//   node backfill-branches.js --apply    # actually applies the changes
//
// Refuses to run if a target tenant has 0 or >1 branches (ambiguous target).
// =============================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_TENANT_SLUGS = ['sharqreklama', 'vodiyprint'];

// Tables with nullable branchId that we want to backfill.
// (Department is excluded — both tenants already have NULL=0.)
const TABLES = ['role', 'employee', 'customer', 'transaction', 'kanbanColumn', 'task'];

const APPLY = process.argv.includes('--apply');

async function processTenant(slug) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.log(`\n  ✗ Tenant "${slug}" not found — skipped`);
    return;
  }

  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'asc' },
  });

  if (branches.length === 0) {
    console.log(`\n  ✗ "${slug}" has 0 branches — cannot backfill, skipped`);
    return;
  }
  if (branches.length > 1) {
    console.log(`\n  ✗ "${slug}" has ${branches.length} branches — ambiguous target, skipped`);
    branches.forEach((b) => console.log(`        - "${b.name}" (id=${b.id})`));
    return;
  }

  const target = branches[0];
  console.log(`\n  TENANT: ${tenant.name} (${slug})`);
  console.log(`    target branch: "${target.name}" (id=${target.id})`);

  // Pre-count what we'd touch
  const plan = {};
  for (const tbl of TABLES) {
    plan[tbl] = await prisma[tbl].count({
      where: { tenantId: tenant.id, branchId: null },
    });
  }
  const totalToMove = Object.values(plan).reduce((a, b) => a + b, 0);

  console.log('    NULL → target counts:');
  for (const [tbl, n] of Object.entries(plan)) {
    const marker = n > 0 ? '→' : ' ';
    console.log(`      ${marker} ${tbl.padEnd(15)} ${n}`);
  }

  if (totalToMove === 0) {
    console.log('    (nothing to do)');
    return;
  }

  if (!APPLY) {
    console.log(`    [dry-run] would move ${totalToMove} rows. Re-run with --apply to commit.`);
    return;
  }

  // Apply in a single transaction per tenant
  const result = await prisma.$transaction(async (tx) => {
    const moved = {};
    for (const tbl of TABLES) {
      if (plan[tbl] === 0) { moved[tbl] = 0; continue; }
      const r = await tx[tbl].updateMany({
        where: { tenantId: tenant.id, branchId: null },
        data: { branchId: target.id },
      });
      moved[tbl] = r.count;
    }
    return moved;
  });

  console.log('    ✓ APPLIED — moved rows:');
  for (const [tbl, n] of Object.entries(result)) {
    if (n > 0) console.log(`        ${tbl.padEnd(15)} ${n}`);
  }
}

async function main() {
  console.log('========================================================');
  console.log(APPLY ? 'BACKFILL — APPLY MODE (writing to DB)' : 'BACKFILL — DRY RUN (no DB writes)');
  console.log('========================================================');

  for (const slug of TARGET_TENANT_SLUGS) {
    try {
      await processTenant(slug);
    } catch (e) {
      console.error(`\n  ✗ Error on "${slug}":`, e.message);
    }
  }

  console.log('\n========================================================');
  console.log(APPLY ? 'Done. Re-run diagnose-branches.js to verify NULLs are gone.' : 'Dry-run complete. Re-run with --apply to commit.');
  console.log('========================================================\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
