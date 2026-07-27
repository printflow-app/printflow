import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import { TelegramService } from '../telegram/telegram.service';

// Cashback miqdorlari (plan nomi bo'yicha)
const CASHBACK_AMOUNTS: Record<string, number> = {
  STARTER:    300_000,
  STANDARD:   600_000,
  INDUSTRIAL: 1_000_000,
};

function getCashback(planName: string): number {
  const key = planName.toUpperCase();
  // Eng yaqin kalit topish (partial match)
  for (const [k, v] of Object.entries(CASHBACK_AMOUNTS)) {
    if (key.includes(k)) return v;
  }
  return 300_000; // default
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  // =============================================
  // PROMO CODE
  // =============================================

  /** Tenant uchun promo kod yaratadi yoki mavjudini qaytaradi */
  async getOrCreateMyPromoCode() {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant not found');

    const existing = await this.prisma.promoCode.findUnique({ where: { tenantId } });
    if (existing) return existing;

    // Yangi unikal kod yaratish: tenant slug + random 4 raqam
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const slug = (tenant?.slug || 'ref').toUpperCase().slice(0, 8);
    const rand = Math.floor(1000 + Math.random() * 9000);
    const code = `${slug}${rand}`;

    return this.prisma.promoCode.create({
      data: { code, tenantId },
    });
  }

  async getMyPromoStats() {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant not found');

    const promoCode = await this.prisma.promoCode.findUnique({
      where: { tenantId },
      include: {
        usages: {
          include: { usingTenant: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return promoCode;
  }

  /** Promo kodni tekshirish (to'lovdan oldin) */
  async validatePromoCode(code: string) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant not found');

    const promo = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!promo) throw new BadRequestException("Promo kod topilmadi");
    if (!promo.isActive) throw new BadRequestException("Promo kod faol emas");
    if (promo.tenantId === tenantId) throw new BadRequestException("O'z promo kodingizdan foydalana olmaysiz");

    // Bu tenant ilgari bu kodni ishlatganmi?
    const alreadyUsed = await this.prisma.promoCodeUsage.findFirst({
      where: { promoCodeId: promo.id, usingTenantId: tenantId },
    });
    if (alreadyUsed) throw new BadRequestException("Bu promo kodni avval ishlatgansiz");

    return { valid: true, discount: 10, code: promo.code };
  }

  // =============================================
  // TO'LOV YARATISH
  // =============================================

  async submitPayment(data: {
    planName: string;
    duration: number;
    amount: number;
    sender: string;
    receiptUrl?: string;
    notes?: string;
    promoCode?: string;
    useCashback?: boolean;
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant not found');

    let finalAmount = data.amount;
    let originalAmount = data.amount;
    let discountAmount = 0;
    let cashbackUsed = 0;
    let promoCodeRecord: any = null;

    // 1. Promo kod chegirmasi (10%)
    if (data.promoCode) {
      const promoCode = data.promoCode.toUpperCase();
      promoCodeRecord = await this.prisma.promoCode.findUnique({ where: { code: promoCode } });
      if (promoCodeRecord && promoCodeRecord.isActive && promoCodeRecord.tenantId !== tenantId) {
        const alreadyUsed = await this.prisma.promoCodeUsage.findFirst({
          where: { promoCodeId: promoCodeRecord.id, usingTenantId: tenantId },
        });
        if (!alreadyUsed) {
          discountAmount = Math.round(finalAmount * 0.1);
          finalAmount -= discountAmount;
        }
      }
    }

    // 2. Cashback ishlatish
    if (data.useCashback) {
      const myPromo = await this.prisma.promoCode.findUnique({ where: { tenantId } });
      if (myPromo && myPromo.cashbackBalance > 0) {
        cashbackUsed = Math.min(myPromo.cashbackBalance, finalAmount);
        finalAmount -= cashbackUsed;
        // Cashback ni kamaytirish
        await this.prisma.promoCode.update({
          where: { id: myPromo.id },
          data: { cashbackBalance: { decrement: cashbackUsed } },
        });
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        planName: data.planName,
        duration: data.duration,
        amount: Math.max(0, finalAmount),
        originalAmount,
        discountAmount,
        cashbackUsed,
        sender: data.sender,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        promoCodeUsed: promoCodeRecord ? promoCodeRecord.code : null,
        status: 'PENDING',
      },
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'PENDING_PAYMENT' },
    });

    // Promo kod ishlatilgan bo'lsa, usage yozish va cashback berish
    if (promoCodeRecord && discountAmount > 0) {
      const cashbackEarned = getCashback(data.planName);
      await this.prisma.promoCodeUsage.create({
        data: {
          promoCodeId: promoCodeRecord.id,
          usingTenantId: tenantId,
          planName: data.planName,
          paymentAmount: originalAmount,
          discount: discountAmount,
          cashbackEarned,
        },
      });
      await this.prisma.promoCode.update({
        where: { id: promoCodeRecord.id },
        data: {
          cashbackBalance: { increment: cashbackEarned },
          totalEarned: { increment: cashbackEarned },
          totalReferrals: { increment: 1 },
        },
      });
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    try {
      await this.telegramService.notifyAdmins(
        tenantId,
        `💸 *Yangi To'lov So'rovi!*\n\n` +
        `🏢 *Workspace:* ${tenant?.name}\n` +
        `📦 *Ta'rif:* ${data.planName}\n` +
        `⏳ *Muddat:* ${data.duration} oy\n` +
        `💰 *Summa:* ${finalAmount.toLocaleString()} UZS` +
        (discountAmount > 0 ? `\n🎟️ *Promo kod:* ${promoCodeRecord.code} (-${discountAmount.toLocaleString()} UZS)` : '') +
        (cashbackUsed > 0 ? `\n💎 *Cashback:* -${cashbackUsed.toLocaleString()} UZS` : '') +
        `\n👤 *Yuboruvchi:* ${data.sender}`,
      );
    } catch {}

    return payment;
  }

  // =============================================
  // AI QO'SHIMCHA SO'ROV PAKETI (AI_TOPUP)
  // Obuna to'lovidan mustaqil — tenant.status/planId/subscriptionEndsAt'ga
  // TEGMAYDI, faqat tasdiqlangach Tenant.aiExtraCredits'ga qo'shiladi
  // (tenants.service.ts approvePayment'da type='AI_TOPUP' shoxobchasi).
  // =============================================

  async submitAiTopupPurchase(data: {
    packageId: string;
    sender: string;
    receiptUrl?: string;
    notes?: string;
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant not found');

    const packages = (await this.getSetting('AI_TOPUP_PACKAGES')) || [];
    const pkg = packages.find((p: any) => p.id === data.packageId);
    if (!pkg) throw new BadRequestException('Paket topilmadi');

    // Narx/kredit miqdori serverdagi katalogdan olinadi — mijoz tomonidan
    // yuborilgan qiymatlarga ishonilmaydi.
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        type: 'AI_TOPUP',
        planName: pkg.label,
        duration: 0,
        amount: pkg.priceUzs,
        originalAmount: pkg.priceUzs,
        aiCreditsGranted: pkg.credits,
        sender: data.sender,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        status: 'PENDING',
      },
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    try {
      await this.telegramService.notifyAdmins(
        tenantId,
        `🤖 *Yangi AI So'rov Paketi So'rovi!*\n\n` +
        `🏢 *Workspace:* ${tenant?.name}\n` +
        `📦 *Paket:* ${pkg.label} (+${pkg.credits} so'rov)\n` +
        `💰 *Summa:* ${pkg.priceUzs.toLocaleString()} UZS\n` +
        `👤 *Yuboruvchi:* ${data.sender}`,
      );
    } catch {}

    return payment;
  }

  async getMyPayments() {
    const tenantId = TenantContext.getTenantId();
    return this.prisma.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenantBillingStatus() {
    const tenantId = TenantContext.getTenantId();
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        planId: true,
        plan: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });
  }

  // PLATFORM SETTINGS (SuperAdmin only)
  async getSetting(key: string) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    return setting ? JSON.parse(setting.value) : null;
  }

  async updateSetting(key: string, value: any) {
    return this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  // Admin: barcha promo kodlar
  async getAllPromoCodes() {
    return this.prisma.promoCode.findMany({
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        usages: {
          include: { usingTenant: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { totalEarned: 'desc' },
    });
  }
}
