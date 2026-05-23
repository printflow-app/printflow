const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const railwayUrl = "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require&connection_limit=30&connect_timeout=20&pool_timeout=15";

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: railwayUrl }
    }
  });

  try {
    const services = await prisma.service.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
        tenantId: true,
        branchId: true,
        tenant: { select: { name: true, slug: true } }
      }
    });

    let output = '';
    for (const s of services) {
      output += `- ID: ${s.id}\n  Name: "${s.name}"\n  Tenant: "${s.tenant.name}" (${s.tenant.slug})\n  Has Image: ${s.imageUrl ? 'Yes' : 'No'}\n\n`;
    }

    fs.writeFileSync('scratch/all-services.txt', output);
    console.log(`Saved ${services.length} services to scratch/all-services.txt`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
