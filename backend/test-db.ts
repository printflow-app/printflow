import { PrismaClient } from '@prisma/client';

async function testConnection() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway"
      }
    }
  });

  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connection successful!');
    const tenantsCount = await prisma.tenant.count();
    console.log(`Total tenants: ${tenantsCount}`);
  } catch (error) {
    console.error('Connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
