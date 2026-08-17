/**
 * MIGRATSIYALARNI DEPLOYDA AVTOMATIK QO'LLASH.
 *
 * MUAMMO. Deploy quvuri sxemani hech qachon bazaga yetkazmasdi:
 *   build → `prisma generate && nest build`   (faqat klient generatsiyasi)
 *   start → `node dist/main.js`               (migratsiya yo'q)
 * `prisma generate` schema.prisma'ni o'qiydi, ya'ni deploy qilingan Prisma
 * KLIENTI yangi ustunni biladi, PRODDAGI BAZA esa bilmaydi. Natijada shu
 * ustunga tegadigan har bir so'rov P2022 ("column does not exist") beradi va
 * foydalanuvchi "Internal server error" ko'radi — aynan `Task.customerContactId`
 * qo'shilgandan keyin buyurtma yaratish shu sababdan ishlamay qoldi.
 *
 * Migratsiyani qo'lda qo'llash yechim emas: u unutiladi va nosozlik faqat
 * mijoz shikoyat qilgandan keyin ma'lum bo'ladi.
 *
 * NEGA `prisma migrate deploy` EMAS. Prodda sxema qo'lda SQL bilan qurilgan,
 * shuning uchun `_prisma_migrations` jadvali yo'q yoki to'liq emas.
 * `migrate deploy` bunday bazada allaqachon qo'llangan migratsiyalarni
 * boshidan yugurtirmoqchi bo'ladi va yiqiladi — ya'ni qisman nosozlik
 * o'rniga ilova umuman ko'tarilmaydi.
 *
 * YECHIM. Migratsiyalar shu repoda allaqachon idempotent yozilgan
 * (IF NOT EXISTS / pg_constraint guard). Shuning uchun ularni tartib bilan
 * o'zimiz yugurtiramiz va `_prisma_migrations`ga Prisma'ning o'z formatida
 * yozib qo'yamiz — kelajakda `prisma migrate deploy`/`status` ham to'g'ri
 * ishlayveradi.
 *
 * BAZELIN. Agar baza bo'sh bo'lmasa-yu (Tenant jadvali bor), birinchi
 * migratsiya qayd etilmagan bo'lsa — u qo'lda qo'llangan degani. Uni QAYTA
 * YUGURTIRMAYMIZ (initial_schema idempotent emas), faqat "qo'llangan" deb
 * belgilaymiz. Qolganlari idempotent, ular xavfsiz yugurtiriladi.
 *
 * Xato bo'lsa jarayon non-zero kod bilan tugaydi — deploy ko'rinarli
 * yiqilsin, ilova buzuq sxema ustida 500 qaytarib turmasin.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const MIGRATSIYALAR = path.join(__dirname, '..', 'prisma', 'migrations');

// Bir vaqtda ikki instansiya ko'tarilsa DDL'lar bir-biriga urilmasin.
// Ixtiyoriy, lekin barqaror kalit — shu skript uchun qat'iy son.
const LOCK_KEY = 776_142_395;

const log = (m) => console.log(`[migratsiya] ${m}`);

/** Prisma checksum'i — migratsiya faylining sha256 hex'i. */
const checksum = (matn) => crypto.createHash('sha256').update(matn).digest('hex');

/**
 * SQL faylni alohida buyruqlarga ajratadi.
 *
 * Kerak, chunki Prisma'ning `$executeRawUnsafe`'i prepared statement
 * ishlatadi va bitta chaqiriqda bir nechta buyruqni qabul qilmaydi
 * ("cannot insert multiple commands into a prepared statement"), migratsiya
 * fayllari esa tabiiy ravishda ko'p buyruqli.
 *
 * Nuqtali vergul faqat HAQIQIY buyruq chegarasi bo'lgandagina bo'linadi —
 * satr ichidagi, izohdagi va `DO $$ ... END $$` bloki ichidagilar emas
 * (bu repoda guardlar aynan shu blok bilan yozilgan).
 */
function buyruqlargaAjrat(sql) {
  const buyruqlar = [];
  let joriy = '';
  let i = 0;
  let izohChuqurligi = 0; // Postgres'da /* */ ichma-ich bo'lishi mumkin

  while (i < sql.length) {
    const q = sql[i];
    const juft = sql.slice(i, i + 2);

    if (izohChuqurligi > 0) {
      if (juft === '/*') { izohChuqurligi++; joriy += juft; i += 2; continue; }
      if (juft === '*/') { izohChuqurligi--; joriy += juft; i += 2; continue; }
      joriy += q; i++; continue;
    }

    // Satrli izoh — satr oxirigacha
    if (juft === '--') {
      const oxir = sql.indexOf('\n', i);
      const kesim = oxir === -1 ? sql.length : oxir;
      joriy += sql.slice(i, kesim);
      i = kesim;
      continue;
    }

    if (juft === '/*') { izohChuqurligi = 1; joriy += juft; i += 2; continue; }

    // Matn literali: '...' ('' — ekranlangan apostrof)
    if (q === "'") {
      joriy += q; i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { joriy += "''"; i += 2; continue; }
        if (sql[i] === "'") { joriy += "'"; i++; break; }
        joriy += sql[i]; i++;
      }
      continue;
    }

    // Tirnoqli identifikator: "..." ("" — ekranlangan tirnoq)
    if (q === '"') {
      joriy += q; i++;
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') { joriy += '""'; i += 2; continue; }
        if (sql[i] === '"') { joriy += '"'; i++; break; }
        joriy += sql[i]; i++;
      }
      continue;
    }

    // Dollar-quoting: $$ ... $$ yoki $tag$ ... $tag$ — DO bloklari shu yerda.
    if (q === '$') {
      const teg = /^\$[A-Za-z_-￿][A-Za-z0-9_-￿]*\$|^\$\$/.exec(sql.slice(i));
      if (teg) {
        const ochuvchi = teg[0];
        const yopuvchi = sql.indexOf(ochuvchi, i + ochuvchi.length);
        const oxir = yopuvchi === -1 ? sql.length : yopuvchi + ochuvchi.length;
        joriy += sql.slice(i, oxir);
        i = oxir;
        continue;
      }
    }

    if (q === ';') {
      if (joriy.trim()) buyruqlar.push(joriy.trim());
      joriy = '';
      i++;
      continue;
    }

    joriy += q;
    i++;
  }

  if (joriy.trim()) buyruqlar.push(joriy.trim());
  // Faqat izohdan iborat bo'laklar bajarilmaydi — Postgres ularni bo'sh
  // so'rov deb qaytaradi, Prisma esa xato beradi.
  return buyruqlar.filter((b) => b.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim());
}

/** Migratsiya papkalari — nomi bo'yicha tartiblangan (nom = sana prefiksi). */
function migratsiyalarRoyxati() {
  if (!fs.existsSync(MIGRATSIYALAR)) return [];
  return fs
    .readdirSync(MIGRATSIYALAR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((nom) => fs.existsSync(path.join(MIGRATSIYALAR, nom, 'migration.sql')))
    .sort();
}

/**
 * Bazaga ulanishni kutamiz. Railway'da baza ilovadan keyinroq ko'tarilishi
 * mumkin; bir urinishda taslim bo'lsak deploy bekorga yiqiladi.
 */
async function ulanishniKut(prisma, urinish = 5) {
  for (let i = 1; i <= urinish; i++) {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      return;
    } catch (e) {
      if (i === urinish) throw e;
      const kut = 1000 * i;
      log(`baza hali tayyor emas (${i}/${urinish}), ${kut}ms kutamiz...`);
      await new Promise((r) => setTimeout(r, kut));
    }
  }
}

/** Prisma'ning o'z jadvali — mavjud bo'lmasa yaratamiz (Prisma bilan bir xil DDL). */
async function qaydJadvaliniTayyorla(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum"            VARCHAR(64) NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);
}

/** Muvaffaqiyatli qo'llangan migratsiyalar nomi. */
async function qollanganlar(prisma) {
  const qatorlar = await prisma.$queryRawUnsafe(
    `SELECT "migration_name" FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`,
  );
  return new Set(qatorlar.map((r) => r.migration_name));
}

/** Baza bo'sh emasmi — ya'ni sxema qo'lda qurilganmi. */
async function sxemaBormi(prisma) {
  // ::text shart — Prisma `regclass` tipini deserializatsiya qila olmaydi.
  const r = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."Tenant"')::text AS bor`);
  return !!r[0]?.bor;
}

async function qaydEt(prisma, nom, summa, qadamlar) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations"
       ("id","checksum","migration_name","started_at","finished_at","applied_steps_count")
     VALUES ($1,$2,$3,now(),now(),$4)`,
    crypto.randomUUID(),
    summa,
    nom,
    qadamlar,
  );
}

(async () => {
  const prisma = new PrismaClient({ log: ['warn', 'error'] });
  let lockOlindi = false;
  try {
    await ulanishniKut(prisma);
    await prisma.$executeRawUnsafe(`SELECT pg_advisory_lock(${LOCK_KEY})`);
    lockOlindi = true;

    await qaydJadvaliniTayyorla(prisma);
    const oldin = await qollanganlar(prisma);
    const royxat = migratsiyalarRoyxati();
    const bazaTolgan = await sxemaBormi(prisma);

    if (royxat.length === 0) {
      log("migratsiya papkasi bo'sh — o'tkazib yuborildi.");
      return;
    }

    let qollandi = 0;
    let bazelin = 0;

    for (const [idx, nom] of royxat.entries()) {
      if (oldin.has(nom)) continue;

      const sql = fs.readFileSync(path.join(MIGRATSIYALAR, nom, 'migration.sql'), 'utf8');
      const summa = checksum(sql);

      // BAZELIN: birinchi migratsiya + baza allaqachon to'la = sxema qo'lda
      // qurilgan. initial_schema idempotent emas, uni qayta yugurtirsak
      // "type already exists" bilan yiqiladi — faqat qayd etamiz.
      if (idx === 0 && bazaTolgan) {
        await qaydEt(prisma, nom, summa, 0);
        log(`bazelin (mavjud sxema, yugurtirilmadi): ${nom}`);
        bazelin += 1;
        continue;
      }

      const buyruqlar = buyruqlargaAjrat(sql);
      log(`qo'llanmoqda: ${nom} (${buyruqlar.length} ta buyruq)`);
      // Bitta tranzaksiya — yarim qo'llangan migratsiya qolmasin.
      // timeout oshirilgan: initial_schema ~180 ta buyruq, Prisma'ning
      // sukutdagi 5 soniyasi sovuq bazada yetmaydi.
      await prisma.$transaction(
        async (tx) => {
          for (const buyruq of buyruqlar) await tx.$executeRawUnsafe(buyruq);
        },
        { maxWait: 30_000, timeout: 300_000 },
      );
      await qaydEt(prisma, nom, summa, buyruqlar.length);
      qollandi += 1;
    }

    if (qollandi === 0 && bazelin === 0) log("sxema dolzarb — yangi migratsiya yo'q.");
    else log(`tayyor: ${qollandi} ta qo'llandi, ${bazelin} ta bazelin qilindi.`);
  } catch (e) {
    console.error('\n[migratsiya] XATO — deploy to\'xtatildi. Sxema yangilanmagan holda');
    console.error('[migratsiya] ilovani ko\'tarish 500 xatolarga olib keladi.');
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (lockOlindi) {
      try { await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock(${LOCK_KEY})`); } catch { /* ulanish uzilgan */ }
    }
    await prisma.$disconnect();
  }
})();
