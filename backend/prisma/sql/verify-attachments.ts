// Smoke test — TaskAttachment migration to'g'ri ishladi-mi.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.taskAttachment.count();
  const sample = await prisma.taskAttachment.findMany({
    take: 3,
    select: { id: true, taskId: true, name: true, mimeType: true, size: true, createdAt: true, tenantId: true },
  });
  console.log(`Total TaskAttachment rows: ${total}`);
  console.table(sample);

  // Har attachment'ning task'i mavjudligini tekshiramiz
  const orphans = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*)::text AS orphan_attachments FROM "TaskAttachment" a
    WHERE NOT EXISTS (SELECT 1 FROM "Task" t WHERE t."id" = a."taskId")
  `);
  console.log('Orphan attachments (taskId not in Task):', orphans[0].orphan_attachments);

  // Tenant'lar bo'yicha taqsimot
  const byTenant = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "tenantId", COUNT(*)::text AS attachment_count FROM "TaskAttachment"
    GROUP BY "tenantId" ORDER BY COUNT(*) DESC LIMIT 10
  `);
  console.log('\nTop tenants by attachment count:');
  console.table(byTenant);
}

main()
  .catch((e) => { console.error('FAILED:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
