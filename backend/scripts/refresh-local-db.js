/**
 * LOKAL DEV DB'NI PROD NUSXASI BILAN YANGILASH
 * ============================================
 * `npm run db:refresh` bilan ishga tushadi.
 *
 * Nima qiladi (prod'ga FAQAT O'QISH — bir bayt ham yozmaydi):
 *   1) Railway (prod, PG18) ma'lumotini pg_dump qiladi (TaskAttachment fayllarsiz — tez)
 *   2) Lokal PG18 (:5433) da `printflow_rwtest` DB'ni qayta yaratib, restore qiladi
 *   3) Yangi schema'ni qo'llaydi (prisma db push)
 *   4) Eng ko'p hamkorli tenantga test login yaratadi: test / test123
 *
 * Backend shu nusxaga ulanishi uchun backend/.env dagi DATABASE_URL:
 *   postgresql://postgres:postgres@localhost:5433/printflow_rwtest?schema=public
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..');
const PGBIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const pg_dump = `${PGBIN}\\pg_dump.exe`;
const psql = `${PGBIN}\\psql.exe`;
const TARGET_DB = 'printflow_rwtest';
const TARGET_PORT = '5433';

// --- Ulanish manzillari ---
function libpqUrl(raw) {
  const u = new URL(raw);
  const allowed = new Set(['sslmode', 'connect_timeout']);
  for (const k of [...u.searchParams.keys()]) if (!allowed.has(k)) u.searchParams.delete(k);
  return u.toString();
}
const railwayUrl = libpqUrl(dotenv.parse(fs.readFileSync(path.join(ROOT, '.env.railway'))).DATABASE_URL);
const baseUrl = new URL(dotenv.parse(fs.readFileSync(path.join(ROOT, '.env'))).DATABASE_URL);
const user = baseUrl.username;
const password = decodeURIComponent(baseUrl.password);
const adminUrl = `postgresql://${user}:${encodeURIComponent(password)}@localhost:${TARGET_PORT}/postgres`;
const targetUrl = `postgresql://${user}:${encodeURIComponent(password)}@localhost:${TARGET_PORT}/${TARGET_DB}`;
const targetUrlPrisma = `${targetUrl}?schema=public`;

const env = { ...process.env, PGPASSWORD: password };
const dumpFile = path.join(ROOT, 'railway_clone.sql');

function step(label, fn) { process.stdout.write(`\n▶ ${label}\n`); const t = Date.now(); fn(); console.log(`  ✓ (${((Date.now() - t) / 1000).toFixed(1)}s)`); }

(async () => {
  try {
    // 1) Target DB ni qayta yaratamiz
    step('1/4 Target DB tayyorlash (PG18 :' + TARGET_PORT + ')', () => {
      execFileSync(psql, [adminUrl, '-v', 'ON_ERROR_STOP=1', '-c', `DROP DATABASE IF EXISTS ${TARGET_DB} WITH (FORCE);`], { stdio: 'inherit', env });
      execFileSync(psql, [adminUrl, '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE ${TARGET_DB};`], { stdio: 'inherit', env });
    });

    // 2) Railway dump (TaskAttachment data'siz) + restore
    step('2/4 Railway dump (read-only, TaskAttachment fayllarsiz)', () => {
      const fd = fs.openSync(dumpFile, 'w');
      execFileSync(pg_dump, [railwayUrl, '--no-owner', '--no-acl', '--no-comments', '--exclude-table-data=public."TaskAttachment"'],
        { stdio: ['ignore', fd, 'inherit'], env, maxBuffer: 1024 * 1024 * 1024 });
      fs.closeSync(fd);
      console.log(`  dump: ${(fs.statSync(dumpFile).size / 1048576).toFixed(1)} MB`);
    });
    step('2/4 Lokalga restore', () => {
      execFileSync(psql, [targetUrl, '-v', 'ON_ERROR_STOP=0', '-q', '-f', dumpFile], { stdio: ['ignore', 'ignore', 'inherit'], env });
    });

    // 3) Yangi schema (prisma db push)
    step('3/4 Schema sync (prisma db push)', () => {
      execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'],
        { stdio: 'inherit', cwd: ROOT, shell: true, env: { ...process.env, DATABASE_URL: targetUrlPrisma } });
    });

    // 4) Test login (eng ko'p hamkorli tenantga)
    await new Promise((resolve, reject) => {
      step('4/4 Test login yaratish', () => {});
      const { PrismaClient } = require('@prisma/client');
      const bcrypt = require('bcrypt');
      const p = new PrismaClient({ datasources: { db: { url: targetUrlPrisma } } });
      (async () => {
        const grouped = await p.vendor.groupBy({ by: ['branchId'], _count: { id: true } });
        let tenantId, slug, tenantName;
        if (grouped.length) {
          const top = grouped.sort((a, b) => b._count.id - a._count.id)[0];
          const branch = await p.branch.findUnique({ where: { id: top.branchId }, include: { tenant: true } });
          tenantId = branch.tenantId; slug = branch.tenant.slug; tenantName = branch.tenant.name;
        } else {
          const t = await p.tenant.findFirst(); tenantId = t.id; slug = t.slug; tenantName = t.name;
        }
        await p.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE', isActive: true, subscriptionEndsAt: new Date('2030-01-01') } });
        const hash = await bcrypt.hash('test123', 12);
        const ex = await p.workspaceAdmin.findFirst({ where: { tenantId, login: 'test' } });
        if (ex) await p.workspaceAdmin.update({ where: { id: ex.id }, data: { passwordHash: hash, isActive: true } });
        else await p.workspaceAdmin.create({ data: { tenantId, fullName: 'Test Admin', login: 'test', passwordHash: hash, isActive: true } });
        await p.$disconnect();
        console.log('\n========================================');
        console.log('✅ NUSXA TAYYOR. Backend .env DATABASE_URL:');
        console.log(`   postgresql://${user}:***@localhost:${TARGET_PORT}/${TARGET_DB}?schema=public`);
        console.log('\n   TEST LOGIN:');
        console.log('   Workspace :', slug, `(${tenantName})`);
        console.log('   Login     : test');
        console.log('   Parol     : test123');
        console.log('========================================');
        resolve();
      })().catch(reject);
    });
  } catch (e) {
    console.error('\n💥 XATO:', e.message);
    process.exit(1);
  }
})();
