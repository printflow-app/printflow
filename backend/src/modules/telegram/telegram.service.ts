import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

// =============================================
// TELEGRAM SERVICE (NestJS side)
// 
// Bu servis bot logikasini boshqarmaydi —
// Bu FAQAT Telegram HTTP API orqali xabar yuborish uchun.
// Bot logikasi endi alohida bot/ papkasida (Telegraf.js).
//
// Xabar yuborish: Telegram Bot Token bilan HTTP POST.
// =============================================

@Injectable()
export class TelegramService {
  constructor(private prisma: PrismaService) {}

  private async sendMessage(telegramId: string, text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !telegramId) return;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          parse_mode: 'Markdown',
        }),
      });
    } catch (err) {
      console.error(`Telegram xabar yuborishda xato (${telegramId}):`, err);
    }
  }

  async sendNotification(employeeId: string, message: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId },
    });

    if (employee?.telegramId) {
      await this.sendMessage(
        employee.telegramId,
        `🔔 *Yangi xabarnoma:*\n\n${message}`,
      );
    }
  }

  async notifyAdmins(message: string) {
    const admins = await this.prisma.employee.findMany({
      where: { role: { name: 'Admin' } },
    });

    for (const admin of admins) {
      if (admin.telegramId) {
        await this.sendMessage(admin.telegramId, `📢 *Admin xabarnomasi:*\n\n${message}`);
      }
    }
  }

  async generateReport(): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: { date: { gte: today } },
    });

    const totalKirim = transactions
      .filter((t) => t.type === 'kirim')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalChiqim = transactions
      .filter((t) => t.type === 'chiqim')
      .reduce((sum, t) => sum + t.amount, 0);
    const newTasks = await this.prisma.task.count({
      where: { createdAt: { gte: today } },
    });

    return (
      `✨ *Kunlik Hisobot*\n\n` +
      `💰 *Jami Kirim:* ${totalKirim.toLocaleString()} UZS\n` +
      `💸 *Jami Chiqim:* ${totalChiqim.toLocaleString()} UZS\n` +
      `📈 *Foyda:* ${(totalKirim - totalChiqim).toLocaleString()} UZS\n\n` +
      `📝 *Yangi topshiriqlar:* ${newTasks} ta\n\n` +
      `_PrintFlow avtomatik tizimi_`
    );
  }

  @Cron('0 21 * * *') // Har kuni 21:00 da kunlik hisobot
  async handleDailyReport() {
    const report = await this.generateReport();
    const admins = await this.prisma.employee.findMany({
      where: { role: { name: 'Admin' } },
    });

    for (const admin of admins) {
      if (admin.telegramId) {
        await this.sendMessage(admin.telegramId, `🌙 ${report}`);
      }
    }
  }
}
