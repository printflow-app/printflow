const { PrismaClient } = require('@prisma/client');

const localUrl = "postgresql://postgres:postgres@localhost:5432/printflow_dev?schema=public";
const railwayUrl = "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require&connection_limit=30&connect_timeout=20&pool_timeout=15";

async function checkDb(url, label) {
  console.log(`\n--- Checking database: ${label} ---`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    const services = await prisma.service.findMany({
      where: {
        OR: [
          { name: { contains: 'mix', mode: 'insensitive' } },
          { name: { contains: 'miks', mode: 'insensitive' } }
        ]
      },
      include: {
        tenant: { select: { name: true, slug: true } },
        branch: { select: { name: true } }
      }
    });

    console.log(`Found ${services.length} matching services:`);
    for (const s of services) {
      console.log(`- Service ID: ${s.id}, Name: "${s.name}", Tenant: "${s.tenant.name}" (${s.tenant.slug})`);
    }

    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { name: { contains: 'mix', mode: 'insensitive' } },
          { name: { contains: 'miks', mode: 'insensitive' } }
        ]
      },
      include: {
        tenant: { select: { name: true, slug: true } }
      }
    });

    console.log(`Found ${materials.length} matching materials:`);
    for (const m of materials) {
      console.log(`- Material ID: ${m.id}, Name: "${m.name}", Tenant: "${m.tenant.name}" (${m.tenant.slug})`);
    }

  } catch (err) {
    console.error(`Error checking ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await checkDb(localUrl, 'Local Development');
  await checkDb(railwayUrl, 'Railway Production');
}

main().catch(console.error);
