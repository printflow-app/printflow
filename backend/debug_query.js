const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing transaction query...');
    const result = await prisma.transaction.findMany({
      include: {
        paymentType: true,
        customer: true,
        expenseType: true,
      },
      orderBy: { date: 'desc' },
    });
    console.log('Query success:', result);
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
