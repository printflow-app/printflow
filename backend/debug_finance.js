const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugFinance() {
  try {
    console.log('Testing finance/transactions logic...');
    // Simulate what's happening in findAll
    const where = {}; // default for no params
    const result = await prisma.transaction.findMany({
      where,
      include: {
        paymentType: true,
        customer: true,
        expenseType: true,
      },
      orderBy: { date: 'desc' },
    });
    console.log('Success! Count:', result.length);
  } catch (err) {
    console.error('FAILED with error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

debugFinance();
