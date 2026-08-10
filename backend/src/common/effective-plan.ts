import { PrismaService } from '../prisma/prisma.service';

// =============================================
// AMALDAGI TARIF
//
// Muammo: tenant'ga tarif biriktirilmagan bo'lsa (planId = null), tizim uni
// "hech narsaga ruxsati yo'q" deb hisoblardi va workspace butunlay ishlamay
// qolardi — sahifalar ochilmasdi, AI ko'rinmasdi. Holbuki platformada
// bitta umumiy tarif bor va u hamma modulni beradi; cheklov faqat MUDDAT va
// RESURS (xodim soni, AI so'rovlari) bo'yicha.
//
// Yechim: tarif biriktirilmagan bo'lsa, platformadagi standart (faol,
// eng yuqori tartibdagi) tarif qo'llanadi. Bu obuna muddati tekshiruvini
// CHETLAB O'TMAYDI — u alohida joyda, tenant.status/subscriptionEndsAt
// bo'yicha tekshiriladi.
//
// Natija bir necha soniya keshlanadi: tarif kamdan-kam o'zgaradi, lekin
// har so'rovda bazaga qayta bormaslik kerak.
// =============================================

const CACHE_TTL_MS = 60_000;
let cached: { plan: any | null; at: number } | null = null;

/**
 * Platformaning standart tarifi — tenant'da o'ziniki bo'lmaganda ishlatiladi.
 *
 * 2026-08-10 dan boshlab platformada FAOL tarif bitta (yagona tarifga
 * o'tildi, `scripts/yagona-tarifga-otish.js`), shuning uchun bu yerdagi
 * "birinchi faol tarif" aynan o'sha yagona tarifni qaytaradi.
 *
 * Ilgari uchta faol tarif bor edi va bu funksiya `sortOrder` bo'yicha
 * ENG KICHIGINI (STARTER) tanlardi — ya'ni tarifsiz tenant eng kam
 * modulli tarifni olardi, holbuki maqsad teskari edi. Yagona tarifda bu
 * savol o'z-o'zidan yo'qoldi; agar kelajakda yana bir necha tarif
 * qo'shilsa, bu joyni qaytadan ko'rib chiqish kerak.
 */
export async function getDefaultPlan(prisma: PrismaService): Promise<any | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.plan;
  const plan = await prisma.plan.findFirst({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  cached = { plan, at: Date.now() };
  return plan;
}

/**
 * Tenant uchun amalda ishlaydigan tarif: o'ziniki bo'lsa o'sha, bo'lmasa
 * platformaning standart tarifi.
 */
export async function resolveEffectivePlan(
  prisma: PrismaService,
  tenant: { plan?: any | null } | null,
): Promise<any | null> {
  if (tenant?.plan) return tenant.plan;
  return getDefaultPlan(prisma);
}
