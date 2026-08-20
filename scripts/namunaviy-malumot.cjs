/* =============================================================
   PrintFlow — namunaviy ma'lumot to'ldirgich
   =============================================================
   Nima qiladi:
     1. B2C mijozlarning bir qismini TASHKILOT (B2B) ga aylantiradi —
        tashkilot nomi, INN, vakillari qo'shiladi. Mavjud yozuvlar
        (buyurtma, to'lov, qarz) tegilmaydi.
     2. Mijozlarga manzil va xarita koordinatasi qo'yadi.
     3. Lavozimlar uchun maosh sxemasi yaratadi (fiksa + KPI + jarima).
     4. Joriy oy uchun xodimlar davomatini to'ldiradi.

   Ishlatish:
     node .ui-migration/mock-data.cjs <slug> [--apply]
   `--apply` bo'lmasa faqat NIMA QILINISHINI ko'rsatadi, bazaga yozmaydi.
   ============================================================= */

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND, '.env') });
const { PrismaClient } = require(path.join(BACKEND, 'node_modules', '@prisma', 'client'));

const p = new PrismaClient();
const slug = process.argv[2] || 'demo';
const APPLY = process.argv.includes('--apply');

const log = (...a) => console.log(...a);
const pul = (n) => new Intl.NumberFormat('uz-UZ').format(Math.round(n));

// ── Namunaviy tashkilotlar. Har biri real bosmaxona mijoziga o'xshaydi:
//    nomi, faoliyati, vakili va uning lavozimi bir-biriga mos.
const TASHKILOTLAR = [
  { nom: 'Namangan Tekstil MCHJ', inn: '301234567', vakillar: [
      { name: 'Dilshod Ergashev', role: 'Direktor', phone: '901112233' },
      { name: 'Nodira Solieva', role: 'Buxgalter', phone: '935556677' } ] },
  { nom: 'Oq Saroy Restorani', inn: '302345678', vakillar: [
      { name: 'Bekzod Rahimov', role: 'Menejer', phone: '901234567' } ] },
  { nom: 'Shifo Med Klinikasi', inn: '303456789', vakillar: [
      { name: 'Zilola Yusupova', role: 'Bosh hamshira', phone: '947778899' },
      { name: 'Sardor Abdullayev', role: "Ta'minot bo'limi", phone: '901239876' } ] },
  { nom: 'Baraka Savdo Markazi', inn: '304567890', vakillar: [
      { name: 'Jahongir Nazarov', role: 'Marketing', phone: '937654321' } ] },
  { nom: 'Yangi Asr Maktabi', inn: '305678901', vakillar: [
      { name: 'Muhayyo Karimova', role: 'Direktor o\'rinbosari', phone: '902223344' } ] },
  { nom: 'Farg\'ona Qurilish Servis', inn: '306789012', vakillar: [
      { name: 'Otabek Tursunov', role: 'Loyiha rahbari', phone: '946665544' } ] },
];

// Namangan markazi atrofidagi haqiqiy ko'chalar — xaritada tarqoq turadi.
const MANZILLAR = [
  { matn: "Namangan sh., Uychi ko'chasi 12", lat: 40.9983, lng: 71.6726 },
  { matn: "Namangan sh., Islom Karimov ko'chasi 45", lat: 41.0045, lng: 71.6431 },
  { matn: "Namangan sh., Navoiy ko'chasi 8", lat: 40.9921, lng: 71.6688 },
  { matn: "Namangan sh., Amir Temur ko'chasi 103", lat: 41.0102, lng: 71.6602 },
  { matn: "Namangan sh., Bobur shoh ko'chasi 27", lat: 40.9878, lng: 71.6549 },
  { matn: "Namangan sh., Do'stlik ko'chasi 61", lat: 41.0067, lng: 71.6795 },
  { matn: "Chust tumani, Toshkent yo'li 4", lat: 41.0003, lng: 71.2394 },
  { matn: "Pop tumani, Mustaqillik ko'chasi 19", lat: 40.8739, lng: 71.1094 },
];

async function main() {
  const tenant = await p.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Workspace topilmadi: ${slug}`);
  const tenantId = tenant.id;
  log(`\n=== ${tenant.name} (${slug}) ===`);
  log(APPLY ? '>>> BAZAGA YOZILADI\n' : '>>> SINOV REJIMI — bazaga yozilmaydi (--apply qo\'shing)\n');

  // ── 1. B2C → B2B ─────────────────────────────────────────────
  const mijozlar = await p.customer.findMany({
    where: { tenantId },
    include: { contacts: true },
    orderBy: { createdAt: 'asc' },
  });
  // Tashkilot belgilari — nomida shulardan biri bo'lsa u allaqachon B2B.
  const TASHKILOT_BELGISI =
    /MCHJ|OOO|ООО|LLC|AJ|QK|bank|klinika|shifoxona|maktab|litsey|kollej|universitet|restoran|kafe|servis|markaz|firma|kompaniya|savdo|zavod|fabrika|print|reklama|studiya|salon|market|dokon|do'kon/i;

  const bor_tashkilot = mijozlar.filter(m => TASHKILOT_BELGISI.test(m.name || ''));
  const jismoniy = mijozlar.filter(m => !TASHKILOT_BELGISI.test(m.name || ''));

  // 1a. Allaqachon tashkilot, lekin vakili yo'q — faqat vakil qo'shamiz,
  //     nomiga TEGMAYMIZ (u haqiqiy mijoz nomi).
  const vakilsiz = bor_tashkilot.filter(m => m.contacts.length === 0);
  // 1b. Jismoniy shaxsga o'xshaganlarning bir qismi tashkilotga aylanadi.
  const aylantiriladi = jismoniy.filter(m => m.contacts.length === 0)
    .slice(0, Math.min(TASHKILOTLAR.length, Math.ceil(jismoniy.length / 2)));

  log(`Mijozlar: jami ${mijozlar.length} — tashkilot ${bor_tashkilot.length}, jismoniy ${jismoniy.length}`);
  log(`  · ${vakilsiz.length} ta mavjud tashkilotga vakil qo'shiladi (nomi o'zgarmaydi)`);
  log(`  · ${aylantiriladi.length} ta jismoniy shaxs tashkilotga aylantiriladi`);

  // Mavjud tashkilotlarga vakil
  const VAKIL_NAMUNA = [
    { name: 'Dilshod Ergashev', role: 'Direktor' },
    { name: 'Nodira Solieva', role: 'Buxgalter' },
    { name: 'Bekzod Rahimov', role: 'Menejer' },
    { name: 'Zilola Yusupova', role: "Ta'minot bo'limi" },
    { name: 'Jahongir Nazarov', role: 'Marketing' },
    { name: 'Muhayyo Karimova', role: "Direktor o'rinbosari" },
    { name: 'Otabek Tursunov', role: 'Loyiha rahbari' },
    { name: "Kamola Yo'ldosheva", role: 'Ofis menejeri' },
  ];
  for (let i = 0; i < vakilsiz.length; i++) {
    const m = vakilsiz[i];
    const soni = (i % 2) + 1; // 1 yoki 2 vakil
    if (i < 5) log(`    + ${m.name}: ${soni} vakil`);
    if (!APPLY) continue;
    for (let v = 0; v < soni; v++) {
      const vak = VAKIL_NAMUNA[(i * 2 + v) % VAKIL_NAMUNA.length];
      await p.customerContact.create({
        data: {
          tenantId, customerId: m.id, name: vak.name, role: vak.role,
          phone: `+99890${String(1000000 + ((i * 7 + v * 13) % 8999999)).slice(0, 7)}`,
          isPrimary: v === 0,
        },
      });
    }
  }
  if (vakilsiz.length > 5) log(`    … yana ${vakilsiz.length - 5} ta`);

  for (let i = 0; i < aylantiriladi.length; i++) {
    const m = aylantiriladi[i];
    const t = TASHKILOTLAR[i % TASHKILOTLAR.length];
    log(`  · "${m.name}" → "${t.nom}" (+${t.vakillar.length} vakil)`);
    if (!APPLY) continue;
    await p.customer.update({
      where: { id: m.id },
      data: { name: t.nom, companyInfo: `INN: ${t.inn}` },
    });
    for (let v = 0; v < t.vakillar.length; v++) {
      const vak = t.vakillar[v];
      await p.customerContact.create({
        data: {
          tenantId, customerId: m.id, name: vak.name, role: vak.role,
          phone: `+998${vak.phone}`, isPrimary: v === 0,
        },
      });
    }
  }

  // Yetarli tashkilot bo'lmasa — qolganini yangi mijoz sifatida qo'shamiz.
  const yangiKerak = Math.max(0, TASHKILOTLAR.length - aylantiriladi.length);
  const branch = await p.branch.findFirst({ where: { tenantId } });
  for (let i = 0; i < yangiKerak; i++) {
    const t = TASHKILOTLAR[aylantiriladi.length + i];
    if (!t) break;
    const bor = await p.customer.findFirst({ where: { tenantId, name: t.nom } });
    if (bor) { log(`  · "${t.nom}" allaqachon bor`); continue; }
    log(`  + yangi tashkilot: "${t.nom}" (+${t.vakillar.length} vakil)`);
    if (!APPLY) continue;
    const c = await p.customer.create({
      data: { tenantId, branchId: branch?.id, name: t.nom, companyInfo: `INN: ${t.inn}`, phone: `+998${t.vakillar[0].phone}` },
    });
    for (let v = 0; v < t.vakillar.length; v++) {
      const vak = t.vakillar[v];
      await p.customerContact.create({
        data: { tenantId, customerId: c.id, name: vak.name, role: vak.role, phone: `+998${vak.phone}`, isPrimary: v === 0 },
      });
    }
  }

  // ── 2. Manzil va xarita nuqtasi ──────────────────────────────
  const manzilsiz = await p.customer.findMany({
    where: { tenantId, OR: [{ latitude: null }, { longitude: null }] },
  });
  log(`\nManzili yo'q mijozlar: ${manzilsiz.length} → xaritaga qo'yiladi`);
  for (let i = 0; i < manzilsiz.length; i++) {
    const m = manzilsiz[i];
    const a = MANZILLAR[i % MANZILLAR.length];
    // Bir nuqtada uyum bo'lmasligi uchun kichik siljish
    const lat = a.lat + (i % 7) * 0.0012 - 0.003;
    const lng = a.lng + (i % 5) * 0.0014 - 0.003;
    if (i < 4) log(`  · ${m.name} → ${a.matn}`);
    if (!APPLY) continue;
    await p.customer.update({
      where: { id: m.id },
      data: { address: m.address || a.matn, latitude: lat, longitude: lng },
    });
  }
  if (manzilsiz.length > 4) log(`  · … yana ${manzilsiz.length - 4} ta`);

  // ── 3. Maosh sxemalari ───────────────────────────────────────
  const rollar = await p.role.findMany({ where: { tenantId } });
  const sxemalar = [
    { rolNomi: /dizayn/i, nom: 'Dizayner sxemasi', komponent: [
        { id: 'f1', label: 'Fiksa', group: 'fiksa', kind: 'fixed', amount: 4000000 },
        { id: 'k1', label: 'Har bajarilgan buyurtma', group: 'kpi', kind: 'per_unit', metric: 'bajarilgan_buyurtma_guruh', rate: 15000 },
        { id: 'b1', label: "Kechikmagani uchun bonus", group: 'kpi', kind: 'fixed', amount: 500000,
          conditions: [{ metric: 'kechikish_daqiqa', op: 'lte', value: 0 }, { metric: 'ish_kunlari', op: 'gte', value: 22 }] },
        { id: 'j1', label: 'Kechikish jarimasi (daqiqasiga)', group: 'jarima', kind: 'per_unit', metric: 'kechikish_daqiqa', rate: 2000 },
      ] },
    { rolNomi: /pechat|bosma|usta|ishlab/i, nom: 'Ishlab chiqarish sxemasi', komponent: [
        { id: 'f1', label: 'Fiksa', group: 'fiksa', kind: 'fixed', amount: 3500000 },
        { id: 'k1', label: 'Bajarilgan buyurtma summasidan', group: 'kpi', kind: 'percent', metric: 'bajarilgan_buyurtma_summasi', rate: 2 },
        { id: 'j1', label: 'Kechikish jarimasi (daqiqasiga)', group: 'jarima', kind: 'per_unit', metric: 'kechikish_daqiqa', rate: 2000 },
      ] },
    { rolNomi: /sotuv|menejer|marketing/i, nom: 'Sotuv menejeri sxemasi', komponent: [
        { id: 'f1', label: 'Fiksa', group: 'fiksa', kind: 'fixed', amount: 3000000 },
        { id: 'k1', label: 'Shaxsiy kirimdan', group: 'kpi', kind: 'percent', metric: 'kirim_summasi', rate: 3 },
        { id: 'b1', label: 'Davomat bonusi', group: 'kpi', kind: 'fixed', amount: 300000,
          conditions: [{ metric: 'davomat_foizi', op: 'gte', value: 95 }] },
      ] },
  ];

  log('\nMaosh sxemalari:');
  for (const sx of sxemalar) {
    const rol = rollar.find(r => sx.rolNomi.test(r.name));
    if (!rol) { log(`  · (${sx.nom}) — mos lavozim topilmadi, o'tkazildi`); continue; }
    const bor = await p.salaryScheme.findFirst({ where: { tenantId, roleId: rol.id } });
    if (bor) { log(`  · ${rol.name}: sxema allaqachon bor`); continue; }
    const jami = sx.komponent.filter(c => c.kind === 'fixed' && c.group === 'fiksa')
      .reduce((s, c) => s + (c.amount || 0), 0);
    log(`  + ${rol.name}: "${sx.nom}" — fiksa ${pul(jami)} + ${sx.komponent.length - 1} qator`);
    if (!APPLY) continue;
    await p.salaryScheme.create({
      data: { tenantId, name: sx.nom, roleId: rol.id, isActive: true, components: sx.komponent },
    });
  }

  // ── 4. Joriy oy davomati ─────────────────────────────────────
  const xodimlar = await p.employee.findMany({
    where: { tenantId },
    include: { role: true },
  });
  const ishlovchi = xodimlar.filter(e => {
    const r = (e.role?.name || '').toLowerCase();
    return r !== 'admin' && r !== 'superadmin' && r !== 'rahbar' && r !== 'owner' && e.login !== 'admin';
  });

  const bugun = new Date();
  const yil = bugun.getFullYear(), oy = bugun.getMonth();
  const oyBoshi = new Date(yil, oy, 1);
  const kunlar = [];
  for (let d = new Date(oyBoshi); d < bugun; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // yakshanba — dam olish
    kunlar.push(new Date(d));
  }
  log(`\nDavomat: ${ishlovchi.length} xodim × ${kunlar.length} ish kuni (${yil}-${String(oy + 1).padStart(2, '0')})`);

  let yaratildi = 0, bor = 0, kelmagan = 0;
  for (const e of ishlovchi) {
    for (const kun of kunlar) {
      const iso = `${kun.getFullYear()}-${String(kun.getMonth() + 1).padStart(2, '0')}-${String(kun.getDate()).padStart(2, '0')}`;
      const mavjud = await p.attendanceRecord.findFirst({ where: { tenantId, employeeId: e.id, date: iso } });
      if (mavjud) { bor++; continue; }
      // Har xodimda o'z xulqi bo'lsin: kimdir deyarli kechikmaydi, kimdir tez-tez.
      const urug = (e.id.charCodeAt(0) + kun.getDate()) % 10;
      if (urug === 0) { kelmagan++; continue; } // ~10% kunlarda kelmagan
      const kechikish = urug >= 8 ? (urug - 7) * 7 : 0;      // ba'zan 7–21 daqiqa
      const ortiqcha = urug === 5 ? 45 : urug === 6 ? 20 : 0; // ba'zan qo'shimcha ish
      const kirish = new Date(`${iso}T09:00:00`);
      kirish.setMinutes(kirish.getMinutes() + kechikish);
      const chiqish = new Date(`${iso}T18:00:00`);
      chiqish.setMinutes(chiqish.getMinutes() + ortiqcha);
      yaratildi++;
      if (!APPLY) continue;
      await p.attendanceRecord.create({
        data: {
          tenantId, employeeId: e.id, date: iso,
          checkIn: kirish, checkOut: chiqish,
          lateMinutes: kechikish, overtimeMinutes: ortiqcha,
        },
      });
    }
  }
  log(`  yangi yozuv: ${yaratildi} · allaqachon bor: ${bor} · kelmagan (X bo'lib ko'rinadi): ${kelmagan}`);

  log(APPLY ? '\n✅ Bajarildi' : '\n(sinov rejimi — hech narsa yozilmadi)');
}

main()
  .catch(e => { console.error('XATO:', e.message); process.exitCode = 1; })
  .finally(() => p.$disconnect());
