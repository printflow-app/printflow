// Read-only diagnostic — run with: npx ts-node prisma/sql/check-state.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 'Vendor rows total' AS metric, COUNT(*)::text AS value FROM "Vendor"
    UNION ALL
    SELECT 'Vendor has branchId column?',
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'Vendor' AND column_name = 'branchId')
           THEN 'YES' ELSE 'NO' END
    UNION ALL
    SELECT 'Vendor rows with NULL branchId', COUNT(*)::text FROM "Vendor" WHERE "branchId" IS NULL
    UNION ALL
    SELECT 'Service rows total', COUNT(*)::text FROM "Service"
    UNION ALL
    SELECT 'Service rows with NULL branchId', COUNT(*)::text FROM "Service" WHERE "branchId" IS NULL
    UNION ALL
    SELECT 'Tenants total', COUNT(*)::text FROM "Tenant"
    UNION ALL
    SELECT 'Tenants WITHOUT any Branch', COUNT(*)::text FROM "Tenant" t
      WHERE NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."tenantId" = t."id");
  `);
  console.table(rows);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
