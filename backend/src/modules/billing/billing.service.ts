import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  async submitPayment(data: {
    planName: string;
    duration: number;
    amount: number;
    sender: string;
    receiptUrl?: string;
    notes?: string;
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Tenant not found');

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        planName: data.planName,
        duration: data.duration,
        amount: data.amount,
        sender: data.sender,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        status: 'PENDING',
      },
    });

    // Update tenant status
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'PENDING_PAYMENT' },
    });

    // Notify Super Admin via Telegram
    try {
      await this.telegramService.notifyAdmins(
        `💸 *Yangi To'lov So'rovi!*\n\n` +
        `🏢 *Workspace:* ${tenant.name}\n` +
        `📦 *Ta'rif:* ${data.planName}\n` +
        `⏳ *Muddat:* ${data.duration} oy\n` +
        `💰 *Summa:* ${data.amount.toLocaleString()} UZS\n` +
        `👤 *Yuboruvchi:* ${data.sender}`,
      );
    } catch (err) {
      // Don't fail if notification fails
    }

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
}
