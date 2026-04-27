const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  try {
    const admin = await prisma.employee.findUnique({ where: { login: 'admin' } });
    if (admin) {
      await prisma.employee.update({
        where: { login: 'admin' },
        data: {
          password: 'admin', // Reset to 'admin' as requested or common default
          passwordVersion: 1
        }
      });
      console.log('Admin password reset to: admin');
    } else {
      console.log('Admin user not found.');
    }
  } catch (err) {
    console.error('Error resetting password:', err);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
