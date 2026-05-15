import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'Department'
    ORDER BY indexname;
  `);
  console.log('Indexes on Department:');
  console.table(rows);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
