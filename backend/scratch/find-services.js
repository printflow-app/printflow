const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Searching for "mix" or "miks" in services, materials, tasks, departments, and custom queries...');

  // 1. Services
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

  // 2. Materials
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
  console.log(`\nFound ${materials.length} matching materials:`);
  for (const m of materials) {
    console.log(`- Material ID: ${m.id}, Name: "${m.name}", Tenant: "${m.tenant.name}" (${m.tenant.slug})`);
  }

  // 3. Departments
  const departments = await prisma.department.findMany({
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
  console.log(`\nFound ${departments.length} matching departments:`);
  for (const d of departments) {
    console.log(`- Department ID: ${d.id}, Name: "${d.name}", Tenant: "${d.tenant.name}" (${d.tenant.slug})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
