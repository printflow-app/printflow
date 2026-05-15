// Smoke test — confirms findMany works after the fix.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const vendors = await prisma.vendor.findMany({
      take: 3,
      select: { id: true, name: true, branchId: true, tenantId: true },
    });
    console.log(`✓ Vendor.findMany works. Sample (${vendors.length} rows):`);
    console.table(vendors);

    const services = await prisma.service.findMany({
      take: 3,
      select: { id: true, name: true, branchId: true, tenantId: true },
    });
    console.log(`✓ Service.findMany works. Sample (${services.length} rows):`);
    console.table(services);

    // Confirm the FK is actually wired (branchId points at real Branch rows)
    const orphans = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::text AS orphan_vendors FROM "Vendor" v
      WHERE NOT EXISTS (SELECT 1 FROM "Branch" b WHERE b."id" = v."branchId")
    `);
    console.log('Orphan vendors (branchId not in Branch):', orphans[0].orphan_vendors);
  } catch (e: any) {
    console.error('✗ FAILED:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
