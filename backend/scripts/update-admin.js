const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.role.updateMany({
    where: { canManageRoles: true },
    data: { canViewSalary: true }
  });
  console.log(`Updated ${result.count} Admin roles (based on canManageRoles).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
