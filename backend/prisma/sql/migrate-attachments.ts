// =============================================
// migrate-attachments.ts — bir martalik migratsiya skripti
//
// Eski `Task.attachments` JSON TEXT ustun ichidagi har bir attachmentni
// yangi normalized `TaskAttachment` jadvaliga ko'chiradi.
//
// XAVFSIZLIK:
// - Eski `Task.attachments` ustuni TEGILMAYDI (kelajakda alohida drop bo'ladi)
// - Idempotent: agar task uchun TaskAttachment row'lar mavjud bo'lsa, skip
// - Har task alohida tranzaktsiya — yarim qolib ketmaydi
// - Tenant context yo'q (script), Prisma middleware skip qiladi → tenantId
//   biz qo'lda kiritamiz (Task'dan o'qiymiz)
//
// Ishga tushirish:
//   cd backend
//   npx ts-node prisma/sql/migrate-attachments.ts
// =============================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OldAttachment {
  // Yangi format
  name?: string;
  url?: string;
}

function parseList(raw: string | null | undefined): Array<OldAttachment | string> {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Eski format ham bor edi: toza base64 string (object emas). Ikkalasini ham qo'llab-quvvatlaymiz.
function normalize(item: OldAttachment | string, idx: number): { name: string; url: string } | null {
  if (typeof item === 'string') {
    if (!item) return null;
    return { name: `Rasm-${idx + 1}`, url: item };
  }
  if (item && typeof item === 'object' && item.url) {
    return { name: item.name || `Fayl-${idx + 1}`, url: item.url };
  }
  return null;
}

// data URL'dan MIME aniqlash: "data:image/tiff;base64,..." → "image/tiff"
function detectMime(url: string, name: string): string | null {
  const m = /^data:([^;,]+);/i.exec(url);
  if (m) return m[1];
  // Fallback — ekstension'dan
  const lower = name.toLowerCase();
  if (/\.tiff?$/.test(lower)) return 'image/tiff';
  if (/\.cdr$/.test(lower)) return 'application/x-coreldraw';
  if (/\.pdf$/.test(lower)) return 'application/pdf';
  if (/\.png$/.test(lower)) return 'image/png';
  if (/\.jpe?g$/.test(lower)) return 'image/jpeg';
  return null;
}

// Asl fayl hajmini base64 stringdan taxminlaymiz: base64 ~1.33x katta.
function approxSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const b64 = dataUrl.slice(commaIdx + 1);
  // padding hisobga olib ~3/4 koeffitsient
  return Math.floor(b64.length * 0.75);
}

async function main() {
  console.log('=== TaskAttachment migration ===\n');

  // Bo'sh bo'lmagan attachmentlar bo'lgan tasklar
  const tasks = await prisma.task.findMany({
    where: {
      attachments: { not: '[]' },
    },
    select: {
      id: true,
      tenantId: true,
      attachments: true,
    },
  });

  console.log(`Found ${tasks.length} task(s) with non-empty attachments.\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let totalRowsCreated = 0;

  for (const t of tasks) {
    const list = parseList(t.attachments);
    if (list.length === 0) {
      skipped++;
      continue;
    }

    // Idempotency check
    const existing = await prisma.taskAttachment.count({ where: { taskId: t.id } });
    if (existing > 0) {
      console.log(`  [skip] ${t.id} — already has ${existing} attachment row(s)`);
      skipped++;
      continue;
    }

    const items = list
      .map((item, i) => normalize(item, i))
      .filter((x): x is { name: string; url: string } => x !== null);

    if (items.length === 0) {
      skipped++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const it of items) {
          await tx.taskAttachment.create({
            data: {
              tenantId: t.tenantId,
              taskId: t.id,
              name: it.name,
              mimeType: detectMime(it.url, it.name),
              data: it.url,
              size: approxSize(it.url),
            },
          });
        }
      }, { maxWait: 10_000, timeout: 60_000 });

      migrated++;
      totalRowsCreated += items.length;
      console.log(`  [ok]   ${t.id} → ${items.length} attachment row(s)`);
    } catch (e: any) {
      errors++;
      console.error(`  [err]  ${t.id} — ${e.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Tasks scanned:   ${tasks.length}`);
  console.log(`Migrated:        ${migrated}`);
  console.log(`Skipped:         ${skipped}`);
  console.log(`Errors:          ${errors}`);
  console.log(`Rows created:    ${totalRowsCreated}`);
  console.log(`\nEski Task.attachments ustuni saqlandi (xavfsizlik uchun).`);
  console.log(`Verification'dan keyin alohida skript bilan drop qilinadi.`);
}

main()
  .catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
