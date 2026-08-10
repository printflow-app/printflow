/**
 * MIJOZ = TASHKILOT — eski yozuvlarni to'g'rilash.
 *
 * Muammo: `Customer.name` ga odam ismi ("Ilhom aka"), `companyInfo` ga esa
 * tashkilot ("Boburshox klinikasi") yozilgan — teskari. Mijozlar ro'yxati
 * shu sababli odamlar ro'yxatiga o'xshab qolgan.
 *
 * Bu skript ularni almashtiradi:
 *   name        := companyInfo   (tashkilot asosiy bo'ladi)
 *   companyInfo := null
 *   eski name   → CustomerContact sifatida saqlanadi (vakil)
 *
 * TEGILMAYDI:
 *   • companyInfo bo'sh bo'lgan mijozlar — ular yakka tartibdagi mijoz,
 *     ismi to'g'ri joyda turibdi;
 *   • companyInfo ma'nosi tashkilot emas, izoh bo'lgan yozuvlar —
 *     ularni ajratib bo'lmaydi, shuning uchun ro'yxatni AVVAL ko'rib
 *     chiqasiz (skript sukut bo'yicha hech narsani o'zgartirmaydi).
 *
 * ISHLATISH:
 *   node scripts/mijoz-tashkilot-almashtir.js          → faqat ro'yxat
 *   node scripts/mijoz-tashkilot-almashtir.js --qolla  → haqiqatan o'zgartiradi
 */
const { PrismaClient } = require('@prisma/client');

const QOLLA = process.argv.includes('--qolla');

(async () => {
  const prisma = new PrismaClient();
  try {
    const hammasi = await prisma.customer.findMany({
      select: {
        id: true, tenantId: true, name: true, phone: true, companyInfo: true,
        contacts: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const nomzodlar = hammasi.filter(
      (c) => (c.companyInfo || '').trim() && (c.name || '').trim(),
    );

    console.log(`\nJami mijoz: ${hammasi.length}`);
    console.log(`Almashtiriladigan: ${nomzodlar.length}`);
    console.log(`Tegilmaydi (kompaniyasi bo'sh): ${hammasi.length - nomzodlar.length}\n`);

    if (nomzodlar.length === 0) {
      console.log("Almashtiriladigan yozuv yo'q.");
      return;
    }

    console.log('OLDIN                          →  KEYIN (tashkilot + vakil)');
    console.log('─'.repeat(78));
    for (const c of nomzodlar) {
      const eski = (c.name || '').slice(0, 28).padEnd(28);
      const yangi = (c.companyInfo || '').trim();
      // Shu ismli vakil allaqachon bo'lsa, ikkinchi marta qo'shilmaydi.
      const bor = c.contacts.some(
        (k) => (k.name || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase(),
      );
      console.log(`${eski}  →  ${yangi}  +  ${c.name}${bor ? '  (vakil allaqachon bor)' : ''}`);
    }
    console.log('─'.repeat(78));

    if (!QOLLA) {
      console.log('\nHech narsa o\'zgartirilmadi. Qo\'llash uchun:');
      console.log('  node scripts/mijoz-tashkilot-almashtir.js --qolla\n');
      return;
    }

    let almashtirildi = 0;
    let vakilQoshildi = 0;
    for (const c of nomzodlar) {
      const tashkilot = (c.companyInfo || '').trim();
      const odam = (c.name || '').trim();
      const vakilBor = c.contacts.some(
        (k) => (k.name || '').trim().toLowerCase() === odam.toLowerCase(),
      );

      // Bitta tranzaksiyada: mijozni tashkilotga aylantiramiz va eski
      // ismni vakil qilib qo'shamiz. Yarim bajarilgan holat qolmasin —
      // aks holda odam ismi ham yo'qolib, vakil ham yaratilmasdi.
      await prisma.$transaction(async (tx) => {
        await tx.customer.update({
          where: { id: c.id },
          data: { name: tashkilot, companyInfo: null },
        });
        if (!vakilBor) {
          await tx.customerContact.create({
            data: {
              tenantId: c.tenantId,
              customerId: c.id,
              name: odam,
              phone: c.phone || null,
              // Birinchi vakil — asosiy aloqa shaxsi.
              isPrimary: c.contacts.length === 0,
            },
          });
          vakilQoshildi += 1;
        }
      });
      almashtirildi += 1;
    }

    console.log(`\nBajarildi: ${almashtirildi} ta mijoz tashkilotga aylantirildi, ${vakilQoshildi} ta vakil qo'shildi.\n`);
  } catch (e) {
    console.error('XATO:', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
