const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    include: { role: true }
  });
  console.log('--- Barcha Xodimlar ---');
  employees.forEach(e => {
    console.log(`ID: ${e.id} | Login: ${e.login} | Ism: ${e.fullName} | Rol: ${e.role?.name}`);
  });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
