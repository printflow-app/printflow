const { PrismaClient } = require('@prisma/client');

const railwayUrl = "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require&connection_limit=30&connect_timeout=20&pool_timeout=15";

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: railwayUrl }
    }
  });

  try {
    const tenants = await prisma.tenant.findMany();
    console.log("Tenants in Railway:");
    tenants.forEach(t => {
      console.log(`- Slug: "${t.slug}", Name: "${t.name}", ID: "${t.id}"`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
