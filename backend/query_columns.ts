import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const columns = await prisma.kanbanColumn.findMany();
  console.log(JSON.stringify(columns, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
