import { PrismaService } from '../../prisma/prisma.service';

// =============================================
// AGENT XOTIRASI — o'qish, yozish, chegarada ushlash.
//
// Nega alohida fayl (agent-job.util.ts kabi): xotirani UCH joy ishlatadi —
// chat oqimi (ai.service), fon runner (agent-job.service) va tool'lar
// (tools/write-tools). Mantiq servis ichida tursa aylanma import chiqardi.
//
// ASOSIY QOIDA — XOTIRA TEKIN EMAS. U har so'rovda system prompt'ga
// quyiladi, ya'ni har savolda to'lanadigan token. Shuning uchun ikki qat'iy
// chegara bor: bitta faktning uzunligi va umumiy fakt soni. Chegarasiz
// xotira bir necha oyda har savolni ikki barobar qimmatlashtirardi.
// =============================================

/** Bitta faktning eng ko'p uzunligi. Uzun "fakt" — bu aslida hujjat, xotira emas. */
export const MAX_FAKT_UZUNLIGI = 400;

/**
 * Tashkilot bo'yicha eng ko'p fakt soni. 40 x ~40 token ≈ 1600 token —
 * keshdan o'qilganda deyarli tekin, lekin foydasi katta.
 */
export const MAX_TENANT_XOTIRA = 40;

/** Bitta xodimning shaxsiy sozlamalari — bulardan ko'pi kerak bo'lmaydi. */
export const MAX_USER_XOTIRA = 15;

export interface XotiraYozuv {
  id: string;
  doira: string;
  mavzu: string;
  matn: string;
}

/**
 * Shu foydalanuvchi uchun tegishli xotirani o'qiydi:
 * tashkilot faktlari + FAQAT o'ziga tegishli shaxsiy sozlamalar.
 *
 * Boshqa xodimning shaxsiy sozlamasi hech qachon qo'shilmaydi — aks holda
 * "menga qisqa hisobot ber" degan sozlama butun tashkilotga tarqalardi.
 */
export async function xotiraniOqi(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
): Promise<XotiraYozuv[]> {
  const rows = await prisma.agentMemory.findMany({
    where: {
      tenantId,
      OR: [{ doira: 'tenant' }, { doira: 'user', userId }],
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_TENANT_XOTIRA + MAX_USER_XOTIRA,
    select: { id: true, doira: true, mavzu: true, matn: true },
  });
  return rows;
}

/**
 * Xotirani system prompt uchun matnga aylantiradi.
 * Xotira bo'sh bo'lsa BO'SH SATR qaytadi — prompt'ga keraksiz sarlavha
 * qo'shilmasin (u ham token).
 */
export function xotiraMatni(yozuvlar: XotiraYozuv[]): string {
  if (!yozuvlar.length) return '';

  const tashkilot = yozuvlar.filter((y) => y.doira === 'tenant');
  const shaxsiy = yozuvlar.filter((y) => y.doira === 'user');

  const qismlar: string[] = [
    'SENING XOTIRANG — oldingi suhbatlarda bilib olgan narsalaring.',
    "Bularni ma'lum deb hisobla va qayta so'rama. Agar xotiradagi narsa endi",
    "noto'g'ri bo'lsa, forget bilan o'chir va yangisini remember bilan yoz.",
  ];

  if (tashkilot.length) {
    qismlar.push('', 'TASHKILOT HAQIDA:');
    qismlar.push(...tashkilot.map((y) => `- ${y.mavzu}: ${y.matn}`));
  }
  if (shaxsiy.length) {
    qismlar.push('', 'SHU FOYDALANUVCHI HAQIDA:');
    qismlar.push(...shaxsiy.map((y) => `- ${y.mavzu}: ${y.matn}`));
  }

  return qismlar.join('\n');
}

/** Prompt uchun tayyor blok — o'qish va formatlashni birlashtiradi. */
export async function xotiraBlokini(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
): Promise<string> {
  try {
    return xotiraMatni(await xotiraniOqi(prisma, tenantId, userId));
  } catch {
    // Xotira o'qilmasa agent baribir ishlashi kerak — bu qo'shimcha,
    // hayotiy shart emas.
    return '';
  }
}

/**
 * Faktni saqlaydi. Shu mavzuda yozuv bo'lsa — YANGILAYDI, yangisini yaratmaydi.
 *
 * Nega dedup muhim: agent bir xil narsani har suhbatda qayta yozib,
 * xotirani bir xil fakt nusxalari bilan to'ldirib yuborardi va chegara
 * foydali faktlarni siqib chiqarardi.
 *
 * Unique constraint o'rniga kod darajasida qilingan: Postgres'da NULL'lar
 * o'zaro teng emas, shuning uchun `userId` NULL bo'lgan tenant faktlarida
 * unique indeks takrorni umuman ushlamasdi.
 */
export async function xotiraYoz(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
  mavzu: string,
  matn: string,
  faqatMenga: boolean,
  manba: 'chat' | 'job' | 'qolda' = 'chat',
) {
  const doira = faqatMenga ? 'user' : 'tenant';
  const egasi = faqatMenga ? userId : null;
  const toza = matn.trim().slice(0, MAX_FAKT_UZUNLIGI);
  const mavzuToza = mavzu.trim().slice(0, 80);

  const mavjud = await prisma.agentMemory.findFirst({
    where: {
      tenantId,
      doira,
      userId: egasi,
      mavzu: { equals: mavzuToza, mode: 'insensitive' },
    },
    select: { id: true },
  });

  if (mavjud) {
    await prisma.agentMemory.update({
      where: { id: mavjud.id },
      data: { matn: toza, manba },
    });
    return { success: true, holat: 'yangilandi' as const, mavzu: mavzuToza };
  }

  await prisma.agentMemory.create({
    data: { tenantId, doira, userId: egasi, mavzu: mavzuToza, matn: toza, manba },
  });
  await chegaradaUshla(prisma, tenantId, doira, egasi);
  return { success: true, holat: 'saqlandi' as const, mavzu: mavzuToza };
}

/**
 * Chegaradan oshgan xotirani kesadi — eng UZOQ VAQT TEGILMAGANI o'chadi.
 *
 * `updatedAt` bo'yicha, `createdAt` emas: doim tasdiqlanib turadigan eski
 * fakt hali ham dolzarb, bir marta yozilib unutilgani esa yo'q.
 */
async function chegaradaUshla(
  prisma: PrismaService,
  tenantId: string,
  doira: string,
  userId: string | null,
) {
  const chegara = doira === 'user' ? MAX_USER_XOTIRA : MAX_TENANT_XOTIRA;
  const soni = await prisma.agentMemory.count({ where: { tenantId, doira, userId } });
  if (soni <= chegara) return;

  const ortiqcha = await prisma.agentMemory.findMany({
    where: { tenantId, doira, userId },
    orderBy: { updatedAt: 'asc' },
    take: soni - chegara,
    select: { id: true },
  });
  await prisma.agentMemory.deleteMany({
    where: { id: { in: ortiqcha.map((o) => o.id) } },
  });
}

/** Mavzu bo'yicha o'chirish — agent eskirgan faktni tozalashi uchun. */
export async function xotiraOchir(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
  mavzu: string,
) {
  const res = await prisma.agentMemory.deleteMany({
    where: {
      tenantId,
      mavzu: { equals: mavzu.trim(), mode: 'insensitive' },
      // Shaxsiy xotirani faqat egasi o'chira oladi; tashkilot faktini har kim.
      OR: [{ doira: 'tenant' }, { doira: 'user', userId }],
    },
  });
  return res.count > 0
    ? { success: true, ochirildi: res.count }
    : { success: false, error: `"${mavzu}" mavzusida xotira topilmadi` };
}
