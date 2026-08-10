import { PrismaService } from '../prisma/prisma.service';

// =============================================
// MIJOZ QARZI — YAGONA MANBA
//
// QOLDIQ QARZ = buyurtmalar summasi − to'langan pul.
//
// `Customer.totalDebt` ustunini HECH QAYERDA ishlatmang. U ikki sababga
// ko'ra noto'g'ri:
//   1. Ma'nosi "jami buyurtmalar summasi", "qarz" emas — to'lovlar undan
//      ayirilmaydi, shuning uchun to'liq hisob-kitob qilgan mijoz ham eng
//      katta qarzdor bo'lib turadi.
//   2. U eski saqlanadigan hisoblagich va manba yozuvlardan drift qilgan
//      (46 mijozdan 16 tasida noto'g'ri balans topilgan).
//
// Bu fayl aynan shuning uchun bor: qarz to'rt xil joyda to'rt xil
// hisoblanardi va ekranlar bir-biriga zid raqam ko'rsatardi — Bosh sahifa
// "33 ta qarzdor, 394 mln" desa, Mijozlar sahifasi "9 ta qarzdor, 37 mln"
// derdi. Yangi joyda qarz kerak bo'lsa, o'z so'rovingizni yozmang — shu
// yerdan chaqiring.
//
// ARXIV: arxivlangan buyurtmalar ham hisobga kiradi. Arxiv — kanban
// doskasidan yashirish, moliyaga ta'sir qilmasligi kerak. Aks holda
// buyurtma arxivlanganda qarz tushib, to'lov o'z joyida qolib, mijoz
// "ortiqcha to'lagan" bo'lib ko'rinardi va bu kredit yangi buyurtmalar
// qarzini bekor qilardi.
// =============================================

/** Kasrli summalar tufayli to'liq to'lagan mijozda qoldiq aniq 0 chiqmaydi. */
export const MIN_QARZ = 1;

/**
 * Tenantdagi har mijozning qoldiq qarzi.
 * Musbat — mijoz bizga qarzdor; manfiy — ortiqcha to'lagan.
 */
export async function mijozQoldiqlari(
  prisma: PrismaService,
  tenantId: string,
): Promise<Map<string, number>> {
  const [orders, paid] = await Promise.all([
    prisma.task.groupBy({
      by: ['customerId'],
      where: { tenantId, customerId: { not: null } },
      _sum: { totalAmount: true },
    }),
    prisma.transaction.groupBy({
      by: ['customerId'],
      where: { tenantId, customerId: { not: null }, type: 'kirim', isInternalTransfer: false },
      _sum: { amount: true },
    }),
  ]);

  const out = new Map<string, number>();
  for (const o of orders as any[]) {
    if (o.customerId) out.set(o.customerId, Number(o._sum.totalAmount || 0));
  }
  for (const p of paid as any[]) {
    if (!p.customerId) continue;
    out.set(p.customerId, (out.get(p.customerId) || 0) - Number(p._sum.amount || 0));
  }
  return out;
}

export type Qarzdor = { id: string; nom: string; qarz: number };

/**
 * Qarzdorlar ro'yxati — nomi bilan, kamayish tartibida.
 * `limit` berilsa faqat eng kattalari qaytadi, lekin `soni`/`jami` HAMMASI
 * bo'yicha hisoblanadi (ro'yxat qisqarganda jami ham qisqarib qolmasin).
 */
export async function qarzdorlarRoyxati(
  prisma: PrismaService,
  tenantId: string,
  limit?: number,
): Promise<{ soni: number; jami: number; royxat: Qarzdor[] }> {
  const qoldiq = await mijozQoldiqlari(prisma, tenantId);
  const qarzdorlar = [...qoldiq.entries()]
    .filter(([, qarz]) => qarz >= MIN_QARZ)
    .sort((a, b) => b[1] - a[1]);

  const jami = qarzdorlar.reduce((s, [, qarz]) => s + qarz, 0);
  const kerakli = limit ? qarzdorlar.slice(0, limit) : qarzdorlar;

  const nomlar = kerakli.length
    ? await prisma.customer.findMany({
        where: { id: { in: kerakli.map(([id]) => id) } },
        select: { id: true, name: true },
      })
    : [];
  const nomById = new Map(nomlar.map((c) => [c.id, c.name]));

  return {
    soni: qarzdorlar.length,
    jami,
    royxat: kerakli.map(([id, qarz]) => ({ id, nom: nomById.get(id) || '—', qarz })),
  };
}
