const { PrismaClient } = require('@prisma/client');

const railwayUrl = "postgresql://postgres:eDwJptngKQlrCPBAWclfzyTAzaAsMTWN@switchback.proxy.rlwy.net:54697/railway?sslmode=require&connection_limit=30&connect_timeout=20&pool_timeout=15";

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: railwayUrl }
    }
  });

  try {
    console.log("Starting deep full-text database search...");
    
    // Get all tables and columns of text/varchar type
    const columns = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND data_type IN ('text', 'character varying', 'json', 'jsonb')
    `);

    console.log(`Found ${columns.length} columns to search in.`);

    for (const col of columns) {
      const table = col.table_name;
      const column = col.column_name;

      // Skip potentially huge or binary columns like imageUrl if we want, but let's check it anyway.
      // We will search for 'mix' or 'miks'
      try {
        const query = `
          SELECT id, "${column}"::text as matched_val 
          FROM "${table}" 
          WHERE "${column}"::text ILIKE '%mix%' OR "${column}"::text ILIKE '%miks%'
        `;
        const results = await prisma.$queryRawUnsafe(query);
        if (results && results.length > 0) {
          console.log(`\n[MATCH FOUND] Table: "${table}", Column: "${column}"`);
          results.forEach(row => {
            console.log(`  - Row ID: ${row.id}`);
            console.log(`    Value: "${row.matched_val.slice(0, 100)}..."`);
          });
        }
      } catch (err) {
        // Some tables might not have an "id" column, or some other error, let's catch and ignore or handle
        try {
          const query = `
            SELECT * 
            FROM "${table}" 
            WHERE "${column}"::text ILIKE '%mix%' OR "${column}"::text ILIKE '%miks%'
            LIMIT 5
          `;
          const results = await prisma.$queryRawUnsafe(query);
          if (results && results.length > 0) {
            console.log(`\n[MATCH FOUND (no ID or different schema)] Table: "${table}", Column: "${column}"`);
            console.log(results);
          }
        } catch (e) {
          // ignore
        }
      }
    }
    console.log("\nDeep search complete.");

  } catch (err) {
    console.error("Error during deep search:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
