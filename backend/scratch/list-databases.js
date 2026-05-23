const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.$queryRawUnsafe("SELECT datname FROM pg_database WHERE datistemplate = false;");
    console.log("Databases listed via Prisma:");
    console.log(res);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
