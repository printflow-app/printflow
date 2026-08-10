/**
 * YAGONA TARIFGA O'TISH.
 *
 * Qaror (2026-08-10): platformada bitta tarif bo'ladi, hamma modul ochiq.
 * Farq faqat MUDDATDA. Xodim/filial/AI cheklovlari hamma uchun bir xil.
 *
 * Bu 28-iyuldagi `5d308c7` commit'da yozilgan, lekin oxirigacha
 * bajarilmagan qarorning davomi: o'shanda kodda "platformada bitta umumiy
 * tarif bor" deb yozilgan edi, ammo bazada uchtasi qolgan va FeatureGuard
 * ularni modul bo'yicha bloklab turgan.
 *
 * NIMA QILADI:
 *   1. STANDARD — yagona tarif bo'ladi: hamma modul ochiladi, "eng
 *      ommabop" belgisi olinadi (solishtiradigan narsa qolmadi).
 *   2. STARTER va INDUSTRIAL — isActive=false. O'CHIRILMAYDI: eski
 *      to'lovlar (`Payment.planName`) ularga nom bo'yicha tayanadi va
 *      tarif tarixi buzilmasligi kerak.
 *   3. Barcha tenantlar yagona tarifga ko'chiriladi.
 *
 * Nofaol tarif Landing'da ko'rinmaydi (`/plans` faqat isActive=true
 * qaytaradi) va tarifsiz tenantga ham o'sha yagona faol tarif beriladi
 * (common/effective-plan.ts).
 *
 * ISHLATISH:
 *   node scripts/yagona-tarifga-otish.js          → faqat ro'yxat
 *   node scripts/yagona-tarifga-otish.js --qolla  → haqiqatan qo'llaydi
 */
const { PrismaClient } = require('@prisma/client');

const QOLLA = process.argv.includes('--qolla');

// Yagona tarif nomi — mavjud STANDARD saqlanadi (unga bog'langan
// to'lovlar va tenantlar bor, yangisini yaratish ularni uzib qo'yardi).
const YAGONA = 'STANDARD';

// Ko'rsatiladigan nom. "🔥 Eng ommabop" olib tashlanadi — u boshqa
// tariflar bilan solishtirish uchun edi, solishtiradigan narsa qolmadi.
// Nomni keyin super-admin panelidan istalgancha o'zgartirsa bo'ladi.
const YANGI_NOM = 'PrintFlow';

// Tavsif ham bosqichli modeldan qolgan ("O'rta va katta bosmaxonalar
// uchun") — yagona tarifda u noto'g'ri, chunki bo'linish yo'q.
const YANGI_TAVSIF = 'Barcha modullar ochiq — bosmaxona uchun to\'liq tizim';

// Platformadagi barcha modullar — admin panelidagi ALLOWED_MODULES bilan
// bir xil ro'yxat (admin/src/shared/constants.ts).
const BARCHA_MODULLAR = [
  'finance', 'statistics', 'reports', 'kanban', 'customers', 'employees',
  'administration', 'inventory', 'attendance', 'partners', 'settings',
  'branches', 'subscriptions', 'ai_chat',
];

(async () => {
  const prisma = new PrismaClient();
  try {
    const tariflar = await prisma.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tenants: true } } },
    });
    const yagona = tariflar.find((p) => p.name === YAGONA);
    if (!yagona) {
      console.error(`XATO: "${YAGONA}" tarifi topilmadi. Bazadagilar:`,
        tariflar.map((p) => p.name).join(', ') || "(bo'sh)");
      process.exitCode = 1;
      return;
    }

    const ochiriladi = tariflar.filter((p) => p.name !== YAGONA && p.isActive);
    const tenantlar = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, planId: true },
      orderBy: { name: 'asc' },
    });
    const kochadi = tenantlar.filter((t) => t.planId !== yagona.id);

    console.log('\n=== YAGONA TARIF ===');
    console.log(`${yagona.name} — ${yagona.displayName}`);
    console.log(`  narx (12 oy): ${yagona.price12m.toLocaleString()} so'm`);
    console.log(`  xodim: ${yagona.maxEmployees === 0 ? 'cheksiz' : yagona.maxEmployees}`);
    console.log(`  filial: ${yagona.maxBranches === 0 ? 'cheksiz' : yagona.maxBranches}`);
    console.log(`  AI/oy: ${yagona.aiMessagesPerMonth === 0 ? 'cheksiz' : yagona.aiMessagesPerMonth}`);
    console.log(`  modullar: ${(yagona.allowedModules || []).length} → ${BARCHA_MODULLAR.length} (hammasi ochiladi)`);
    if (yagona.isPopular) console.log('  "eng ommabop" belgisi olinadi');
    if (yagona.displayName !== YANGI_NOM) {
      console.log(`  nomi: "${yagona.displayName}" → "${YANGI_NOM}"`);
    }
    if ((yagona.description || '') !== YANGI_TAVSIF) {
      console.log(`  tavsifi: "${yagona.description || '(bo\'sh)'}" → "${YANGI_TAVSIF}"`);
    }

    console.log('\n=== NOFAOL QILINADI (o\'chirilmaydi) ===');
    if (ochiriladi.length === 0) console.log('  yo\'q');
    for (const p of ochiriladi) {
      console.log(`  ${p.name} — ${p.displayName}  (${p._count.tenants} ta workspace ulangan)`);
    }

    console.log('\n=== WORKSPACE KO\'CHIRILADI ===');
    if (kochadi.length === 0) console.log('  yo\'q — hammasi allaqachon yagona tarifda');
    for (const t of kochadi) {
      const eski = tariflar.find((p) => p.id === t.planId);
      console.log(`  ${t.name} (${t.slug}): ${eski ? eski.name : 'tarifsiz'} → ${YAGONA}`);
    }

    if (!QOLLA) {
      console.log('\nHech narsa o\'zgartirilmadi. Qo\'llash uchun:');
      console.log('  node scripts/yagona-tarifga-otish.js --qolla\n');
      return;
    }

    // Hammasi bitta tranzaksiyada — yarim bajarilgan holatda tenantlar
    // nofaol tarifda osilib qolmasin.
    await prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: yagona.id },
        data: {
          allowedModules: BARCHA_MODULLAR,
          displayName: YANGI_NOM,
          description: YANGI_TAVSIF,
          isPopular: false,
          sortOrder: 1,
        },
      });
      if (ochiriladi.length) {
        await tx.plan.updateMany({
          where: { id: { in: ochiriladi.map((p) => p.id) } },
          data: { isActive: false },
        });
      }
      if (kochadi.length) {
        await tx.tenant.updateMany({
          where: { id: { in: kochadi.map((t) => t.id) } },
          data: { planId: yagona.id },
        });
      }
    });

    console.log(`\nBajarildi: yagona tarif ${YAGONA}, ${ochiriladi.length} ta tarif nofaol qilindi, ${kochadi.length} ta workspace ko'chirildi.`);
    console.log("DIQQAT: backend tarifni 60 soniya keshlaydi (effective-plan.ts) — o'zgarish darhol ko'rinmasligi mumkin.\n");
  } catch (e) {
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
