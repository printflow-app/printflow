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
    const materials = await prisma.material.findMany({
      include: {
        tenant: { select: { name: true, slug: true } }
      }
    });

    let output = '';
    for (const m of materials) {
      output += `- ID: ${m.id}\n  Name: "${m.name}"\n  Tenant: "${m.tenant.name}" (${m.tenant.slug})\n  Stock: ${m.currentStock}\n\n`;
    }

    fs.writeFileSync('scratch/all-materials.txt', output);
    console.log(`Saved ${materials.length} materials to scratch/all-materials.txt`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
