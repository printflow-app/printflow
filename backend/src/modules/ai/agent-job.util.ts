import { PrismaService } from '../../prisma/prisma.service';

// =============================================
// FON TOPSHIRIQ NAVBATI — umumiy yordamchi.
//
// Nega alohida fayl: topshiriqni IKKI joy yaratadi — `startJob` tool'i
// (chat agent uzoq ishni fonga uzatganda) va controller (foydalanuvchi
// to'g'ridan-to'g'ri bergan topshiriq). Kunlik chegara ikkalasida ham bir
// xil bo'lishi shart.
//
// Bu mantiq AgentJobService ichida turolmaydi: write-tools → agent-job.service
// → tools/registry → write-tools degan aylanma import hosil bo'lardi. Bu fayl
// esa faqat Prisma'ga tayanadi, shuning uchun aylanma yo'q.
// =============================================

/**
 * Bitta tenant kuniga nechta fon topshirig'i bera oladi.
 * Har topshiriq eng ko'pi ~$0.25 turadi, ya'ni kunlik shift ~$2.5 bilan chegaralangan.
 */
export const KUNLIK_TOPSHIRIQ_LIMITI = 10;

export interface TopshiriqNatija {
  success: boolean;
  jobId?: string;
  sarlavha?: string;
  error?: string;
  xabar?: string;
}

/**
 * Fon topshirig'ini navbatga qo'yadi. Runner (agent-job.service) uni
 * keyingi daqiqada oladi.
 *
 * Chegara shu yerda tekshiriladi — chaqiruvchi uni takrorlamaydi.
 */
export async function fonTopshiriqYarat(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
  topshiriq: string,
  sarlavha: string,
): Promise<TopshiriqNatija> {
  const kunBoshi = new Date();
  kunBoshi.setHours(0, 0, 0, 0);

  const bugungi = await prisma.agentJob.count({
    where: { tenantId, createdAt: { gte: kunBoshi } },
  });
  if (bugungi >= KUNLIK_TOPSHIRIQ_LIMITI) {
    return {
      success: false,
      error: `Kunlik fon topshiriq chegarasi (${KUNLIK_TOPSHIRIQ_LIMITI} ta) tugadi. Ertaga qayta urinib ko'ring.`,
    };
  }

  const job = await prisma.agentJob.create({
    data: {
      tenantId,
      userId,
      topshiriq,
      // Uzun sarlavha ro'yxat ko'rinishini buzadi — kesib qo'yamiz.
      sarlavha: (sarlavha || topshiriq).slice(0, 120),
    },
    select: { id: true, sarlavha: true },
  });

  return { success: true, jobId: job.id, sarlavha: job.sarlavha };
}
