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

/** Platformaning standart tarifi — tenant'da o'ziniki bo'lmaganda ishlatiladi. */
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
