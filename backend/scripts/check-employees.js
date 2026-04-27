const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const employees = await p.employee.findMany({
    select: { id: true, fullName: true, login: true, roleId: true }
  });
  console.log(JSON.stringify(employees, null, 2));
  await p['$disconnect']();
}

main();
