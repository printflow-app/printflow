const { PrismaClient } = require('@prisma/client');

const railwayUrl = "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require&connection_limit=30&connect_timeout=20&pool_timeout=15";

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: railwayUrl }
    }
  });

  try {
    console.log("Searching entire Railway database for 'mix' or 'miks'...");
    
    // We can query using raw SQL to search across all tables or specifically look at key tables we might have missed.
    // Let's do a search on:
    // - Service (name, description)
    // - Material (name)
    // - Customer (name, phone)
    // - Task (title, description)
    // - Department (name)
    // - Transaction (customerName, expenseReason, serviceType)
    // - Branch (name)
    // - Role (name)

    const services = await prisma.service.findMany({
      where: {
        OR: [
          { name: { contains: 'mix', mode: 'insensitive' } },
          { name: { contains: 'miks', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`Services found: ${services.length}`);
    services.forEach(s => console.log(`  - Service: ${s.name} (${s.id})`));

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: 'mix', mode: 'insensitive' } },
          { title: { contains: 'miks', mode: 'insensitive' } },
          { description: { contains: 'mix', mode: 'insensitive' } },
          { description: { contains: 'miks', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`Tasks found: ${tasks.length}`);
    tasks.forEach(t => console.log(`  - Task: ${t.title} (ID: ${t.id}, displayId: ${t.displayId})`));

    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { name: { contains: 'mix', mode: 'insensitive' } },
          { name: { contains: 'miks', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`Materials found: ${materials.length}`);
    materials.forEach(m => console.log(`  - Material: ${m.name} (${m.id})`));

    // Also check if there are transactions or other tables
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { customerName: { contains: 'mix', mode: 'insensitive' } },
          { customerName: { contains: 'miks', mode: 'insensitive' } },
          { expenseReason: { contains: 'mix', mode: 'insensitive' } },
          { expenseReason: { contains: 'miks', mode: 'insensitive' } },
          { serviceType: { contains: 'mix', mode: 'insensitive' } },
          { serviceType: { contains: 'miks', mode: 'insensitive' } }
        ]
      }
    });
    console.log(`Transactions found: ${transactions.length}`);
    transactions.forEach(tx => console.log(`  - Transaction: amount=${tx.amount}, customerName=${tx.customerName}, expenseReason=${tx.expenseReason}`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
