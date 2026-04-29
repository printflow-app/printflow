import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;

  constructor(private prisma: PrismaService) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token !== 'your_bot_token_here') {
      this.bot = new Telegraf(token);
      this.initializeBot();
    } else {
      console.warn('TELEGRAM_BOT_TOKEN not found. Bot is disabled.');
    }
  }

  async onModuleInit() {
    if (this.bot) {
      this.bot.launch().then(() => console.log('🚀 Telegram Bot ishga tushdi')).catch(err => console.error('Bot failed to launch', err));
    }
  }

  onModuleDestroy() {
    if (this.bot) this.bot.stop();
  }

  private initializeBot() {
    this.bot.use(async (ctx: any, next) => {
      const chatId = ctx.chat?.id?.toString();
      if (!chatId) return next();
      const session = await this.prisma.botSession.findUnique({
        where: { chatId },
        include: { tenant: true }
      });
      if (session && session.tenant) {
        ctx.tenantId = session.tenantId;
        ctx.tenant = session.tenant;
        ctx.botSession = session;
        ctx.employeeId = session.employeeId || null;
      }
      return next();
    });

    this.bot.start(async (ctx: any) => {
      const chatId = ctx.chat.id.toString();

      if (ctx.tenantId) {
        return ctx.reply(`✅ *${ctx.tenant.name}* ga ulangansiz.\n/report — Hisobot\n/check — Vazifalar`, { parse_mode: 'Markdown' });
      }

      await this.prisma.botSession.upsert({
        where: { chatId },
        update: { step: 'ENTER_SLUG', employeeId: null, loginAttempt: null, tenantId: null },
        create: { chatId, step: 'ENTER_SLUG' }
      });

      return ctx.reply('👋 Botga xush kelibsiz!\n\n1️⃣ Ishlaydigan kompaniyangizni kiriting (Workspace Slug):');
    });

    this.bot.command('report', async (ctx: any) => {
      if (!ctx.tenantId || !ctx.employeeId) return ctx.reply('❌ Avval ulaning va tizimga kiring.');
      const emp = await this.prisma.employee.findFirst({
        where: { id: ctx.employeeId, tenantId: ctx.tenantId },
        include: { role: true }
      });
      if (!emp || !emp.role?.canViewFinance) return ctx.reply("❌ Huquq yo'q.");
      const report = await this.generateReportForTenant(ctx.tenantId);
      return ctx.reply(report, { parse_mode: 'Markdown' });
    });

    this.bot.command('check', async (ctx: any) => {
      if (!ctx.tenantId || !ctx.employeeId) return ctx.reply('❌ Avval ulaning va tizimga kiring.');
      const emp = await this.prisma.employee.findFirst({
        where: { id: ctx.employeeId, tenantId: ctx.tenantId },
        include: { role: true }
      });
      if (!emp || !emp.role?.canViewTasks) return ctx.reply("❌ Huquq yo'q.");
      await ctx.reply('🔄 Tekshirilmoqda...');
      await this.checkInactiveTasks(ctx.tenantId);
      return ctx.reply('✅ Tekshirish yakunlandi.');
    });

    this.bot.on('text', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      const text = ctx.message.text.trim();
      
      const session = await this.prisma.botSession.findUnique({ where: { chatId } });
      if (!session) return;
      
      const { step } = session;
      
      if (step === 'ENTER_SLUG') {
        const tenant = await this.prisma.tenant.findUnique({ where: { slug: text } });
        if (!tenant || !tenant.isActive) {
          return ctx.reply('❌ Bunday kompaniya topilmadi yoki nofaol. Qaytadan kiriting (Workspace Slug):');
        }
        
        await this.prisma.botSession.update({
          where: { chatId },
          data: { tenantId: tenant.id, step: 'LOGIN' }
        });
        return ctx.reply(`🖨️ *PrintFlow — ${tenant.name}*\n\n2️⃣ Tizimga kirish uchun loginingizni kiriting:`, { parse_mode: 'Markdown' });
      }
      
      if (!session.tenantId) return;

      if (step === 'LOGIN') {
        await this.prisma.botSession.update({
          where: { chatId },
          data: { loginAttempt: text, step: 'PASSWORD' }
        });
        return ctx.reply('🔐 3️⃣ Parolingizni kiriting:');
      }
      
      if (step === 'PASSWORD') {
        const emp = await this.prisma.employee.findFirst({
          where: { login: session.loginAttempt, tenantId: session.tenantId }
        });
        if (emp && await bcrypt.compare(text, emp.passwordHash)) {
          await this.prisma.botSession.update({
            where: { chatId },
            data: { employeeId: emp.id, step: 'IDLE', loginAttempt: null }
          });
          await this.prisma.employee.update({
            where: { id: emp.id },
            data: { telegramId: chatId }
          });
          return ctx.reply(`✅ Xush kelibsiz, *${emp.fullName}*!`, { parse_mode: 'Markdown' });
        }
        await this.prisma.botSession.update({
          where: { chatId },
          data: { step: 'LOGIN', loginAttempt: null }
        });
        return ctx.reply('❌ Login yoki parol xato. Qaytadan loginingizni kiriting:');
      }
    });
  }

  async sendMessage(telegramId: string, text: string) {
    if (this.bot) {
      try {
        await this.bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
      } catch (err) {}
    }
  }

  async sendNotification(employeeId: string, message: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (emp?.telegramId) await this.sendMessage(emp.telegramId, `🔔 *Yangi xabarnoma:*\n\n${message}`);
  }

  async notifyAdmins(message: string) {
    const admins = await this.prisma.employee.findMany({ where: { role: { name: 'Admin' } } });
    for (const admin of admins) {
      if (admin.telegramId) await this.sendMessage(admin.telegramId, `📢 *Admin xabarnomasi:*\n\n${message}`);
    }
  }

  private async generateReportForTenant(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const txs = await this.prisma.transaction.findMany({ where: { tenantId, date: { gte: today } } });
    const kirim = txs.filter(t => t.type === 'kirim').reduce((s, t) => s + t.amount, 0);
    const chiqim = txs.filter(t => t.type === 'chiqim').reduce((s, t) => s + t.amount, 0);
    return `📊 *Kunlik Hisobot*\n💰 Kirim: ${kirim.toLocaleString()} UZS\n💸 Chiqim: ${chiqim.toLocaleString()} UZS\n📈 Foyda: ${(kirim - chiqim).toLocaleString()} UZS`;
  }

  private async checkInactiveTasks(tenantId: string) {
    const cols = await this.prisma.kanbanColumn.findMany({ where: { tenantId }, orderBy: { orderIdx: 'asc' } });
    if (cols.length === 0) return;
    const lastCol = cols[cols.length - 1].id;
    const old = new Date(Date.now() - 24 * 3600000);
    const tasks = await this.prisma.task.findMany({
      where: { tenantId, updatedAt: { lt: old }, columnId: { not: lastCol } },
      include: { column: true }
    });
    for (const t of tasks) {
      const assignees = JSON.parse(t.assignees || '[]');
      for (const empId of assignees) {
        const emp = await this.prisma.employee.findFirst({ where: { id: empId, tenantId } });
        if (emp?.telegramId) {
          await this.sendMessage(emp.telegramId, `⚠️ *Vazifa qolib ketdi*\n📌 ${t.title}\n⏳ ${t.column.title} da 24 soatdan beri turibdi.`);
        }
      }
    }
  }

  @Cron('0 21 * * *')
  async handleDailyReport() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      const report = await this.generateReportForTenant(t.id);
      const admins = await this.prisma.employee.findMany({
        where: { tenantId: t.id, role: { canViewFinance: true } }
      });
      for (const admin of admins) {
        if (admin.telegramId) await this.sendMessage(admin.telegramId, report);
      }
    }
  }

  @Cron('0 * * * *')
  async handleHourlyTaskCheck() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      await this.checkInactiveTasks(t.id);
    }
  }
}
