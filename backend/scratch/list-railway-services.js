const { PrismaClient } = require('@prisma/client');

const railwayUrl = "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require&connection_limit=30&connect_timeout=20&pool_timeout=15";

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: railwayUrl }
    }
  });

  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true }
    });
    console.log(`=== TENANTS in Railway (${tenants.length}) ===`);
    for (const t of tenants) {
      console.log(`- "${t.name}" (slug: ${t.slug}, id: ${t.id})`);
    }

    const services = await prisma.service.findMany({
      select: { id: true, name: true, tenantId: true, branchId: true }
    });
    console.log(`\n=== SERVICES in Railway (${services.length}) ===`);
    for (const s of services.slice(0, 100)) {
      console.log(`- "${s.name}" (id: ${s.id}, tenantId: ${s.tenantId})`);
    }
    if (services.length > 100) {
      console.log(`... and ${services.length - 100} more services`);
    }

  } catch (err) {
    console.error("Error connecting to Railway database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
