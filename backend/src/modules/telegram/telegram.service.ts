import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { Telegraf } from 'telegraf';
import * as bcrypt from 'bcrypt';

// =============================================
// TELEGRAM BOT SERVICE — PrintFlow
// /start oqimi (O'zbek tilida, 3 qadam):
// 1. Workspace slug so'rash
// 2. Login so'rash
// 3. Parol so'rash → tekshirish va ulash
// =============================================

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
      this.bot.launch()
        .then(() => console.log('🚀 Telegram Bot ishga tushdi'))
        .catch(err => console.error('Bot failed to launch', err));
    }
  }

  onModuleDestroy() {
    if (this.bot) this.bot.stop();
  }

  private initializeBot() {
    // Middleware: har bir xabarga session va tenant ma'lumotlarini yuklash
    this.bot.use(async (ctx: any, next) => {
      const chatId = ctx.chat?.id?.toString();
      if (!chatId) return next();
      const session = await this.prisma.botSession.findUnique({
        where: { chatId },
        include: { tenant: true },
      });
      if (session) {
        ctx.tenantId = session.tenantId || null;
        ctx.tenant = session.tenant || null;
        ctx.botSession = session;
        ctx.employeeId = session.employeeId || null;
      }
      return next();
    });

    // /start komandasi — 3 qadam bilan onboarding
    this.bot.start(async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      const payload = ctx.startPayload;

      // Deep link orqali kelgan: /start workspace_<slug>
      if (payload && payload.startsWith('workspace_')) {
        const slug = payload.replace('workspace_', '');
        const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
        if (!tenant || !tenant.isActive) {
          return ctx.reply('❌ Workspace topilmadi yoki faol emas.');
        }

        await this.prisma.botSession.upsert({
          where: { chatId },
          update: { tenantId: tenant.id, step: 'LOGIN', employeeId: null, loginAttempt: null },
          create: { chatId, tenantId: tenant.id, step: 'LOGIN' },
        });

        return ctx.reply(
          `🖨️ *PrintFlow — ${tenant.name}*\n\n` +
          `Tizimga kirish uchun *loginingizni* kiriting:`,
          { parse_mode: 'Markdown' },
        );
      }

      // Agar allaqachon ulanganlar uchun
      if (ctx.tenantId && ctx.employeeId) {
        return ctx.reply(
          `✅ *${ctx.tenant?.name || 'Workspace'}*ga ulangansiz.\n\n` +
          `📊 /report — Kunlik hisobot\n` +
          `✅ /check — Muddati o'tgan vazifalar`,
          { parse_mode: 'Markdown' },
        );
      }

      // Birinchi marta kelganlar uchun — 3 qadam boshlanadi
      const existingSession = await this.prisma.botSession.findUnique({ where: { chatId } });

      if (!existingSession) {
        // Placeholder tenant sifatida birinchi aktiv tenant topiladi
        const firstTenant = await this.prisma.tenant.findFirst({ where: { isActive: true } });
        if (!firstTenant) {
          return ctx.reply("❌ Tizimda hali birorta ham ishchi workspace yo'q.");
        }
        await this.prisma.botSession.create({
          data: {
            chatId,
            tenantId: firstTenant.id,
            step: 'WORKSPACE',
          },
        });
      } else {
        await this.prisma.botSession.update({
          where: { chatId },
          data: { step: 'WORKSPACE', employeeId: null, loginAttempt: null },
        });
      }

      return ctx.reply(
        `👋 Assalomu alaykum! *PrintFlow*ga xush kelibsiz!\n\n` +
        `🏢 Birinchi navbatda, ishlaydigan *kompaniyangizning workspace slug*ini kiriting.\n\n` +
        `_(Masalan: mycompany, sharq-bosma, printshop123)_`,
        { parse_mode: 'Markdown' },
      );
    });

    // Komandalar
    this.bot.command('report', async (ctx: any) => {
      if (!ctx.tenantId || !ctx.employeeId) {
        return ctx.reply('❌ Avval tizimga kiring. /start bosing.');
      }
      const emp = await this.prisma.employee.findFirst({
        where: { id: ctx.employeeId, tenantId: ctx.tenantId },
        include: { role: true },
      });
      if (!emp?.role?.canViewFinance) return ctx.reply("❌ Moliya hisobotini ko'rish huquqi yo'q.");
      const report = await this.generateReportForTenant(ctx.tenantId);
      return ctx.reply(report, { parse_mode: 'Markdown' });
    });

    this.bot.command('check', async (ctx: any) => {
      if (!ctx.tenantId || !ctx.employeeId) {
        return ctx.reply('❌ Avval tizimga kiring. /start bosing.');
      }
      const emp = await this.prisma.employee.findFirst({
        where: { id: ctx.employeeId, tenantId: ctx.tenantId },
        include: { role: true },
      });
      if (!emp?.role?.canViewTasks) return ctx.reply("❌ Vazifalarni ko'rish huquqi yo'q.");
      await ctx.reply('🔄 Tekshirilmoqda...');
      await this.checkInactiveTasks(ctx.tenantId);
      return ctx.reply('✅ Tekshirish yakunlandi.');
    });

    // Matn xabarlari — qadamli onboarding oqimi
    this.bot.on('text', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      const text = ctx.message.text.trim();

      // Komandalarni o'tkazib yuborish
      if (text.startsWith('/')) return;

      // Session yo'q bo'lsa
      if (!ctx.botSession) {
        return ctx.reply('❌ /start bosing.');
      }

      const { step } = ctx.botSession;

      // =============================================
      // QADAM 1: Workspace slug qabul qilish
      // =============================================
      if (step === 'WORKSPACE') {
        const slug = text.toLowerCase().replace(/\s+/g, '-');
        const tenant = await this.prisma.tenant.findUnique({ where: { slug } });

        if (!tenant || !tenant.isActive) {
          return ctx.reply(
            `❌ *"${slug}"* — bu workspace topilmadi.\n\n` +
            `Iltimos, to'g'ri workspace slug kiriting:`,
            { parse_mode: 'Markdown' },
          );
        }

        await this.prisma.botSession.update({
          where: { chatId },
          data: { tenantId: tenant.id, step: 'LOGIN', loginAttempt: null },
        });

        return ctx.reply(
          `✅ *${tenant.name}* workspacei topildi!\n\n` +
          `🔑 Endi *loginingizni* kiriting:`,
          { parse_mode: 'Markdown' },
        );
      }

      // =============================================
      // QADAM 2: Login qabul qilish
      // =============================================
      if (step === 'LOGIN') {
        await this.prisma.botSession.update({
          where: { chatId },
          data: { loginAttempt: text, step: 'PASSWORD' },
        });
        return ctx.reply('🔐 *Parolingizni* kiriting:', { parse_mode: 'Markdown' });
      }

      // =============================================
      // QADAM 3: Parolni tekshirish va ulash
      // =============================================
      if (step === 'PASSWORD') {
        if (!ctx.tenantId) {
          await this.prisma.botSession.update({
            where: { chatId },
            data: { step: 'WORKSPACE' },
          });
          return ctx.reply('❌ Xatolik. Qaytadan boshlang: /start');
        }

        const emp = await this.prisma.employee.findFirst({
          where: { login: ctx.botSession.loginAttempt, tenantId: ctx.tenantId },
        });

        if (emp && (await bcrypt.compare(text, emp.passwordHash))) {
          await this.prisma.botSession.update({
            where: { chatId },
            data: { employeeId: emp.id, step: 'IDLE', loginAttempt: null },
          });
          await this.prisma.employee.update({
            where: { id: emp.id },
            data: { telegramId: chatId },
          });

          return ctx.reply(
            `🎉 *Xush kelibsiz, ${emp.fullName}!*\n\n` +
            `Siz muvaffaqiyatli tizimga kirdingiz.\n\n` +
            `📊 /report — Kunlik hisobot\n` +
            `✅ /check — Muddati o'tgan vazifalar`,
            { parse_mode: 'Markdown' },
          );
        }

        // Xato parol — qaytadan login dan boshlash
        await this.prisma.botSession.update({
          where: { chatId },
          data: { step: 'LOGIN', loginAttempt: null },
        });
        return ctx.reply(
          '❌ Login yoki parol noto\'g\'ri.\n\n' +
          '🔑 Iltimos, *loginingizni* qayta kiriting:',
          { parse_mode: 'Markdown' },
        );
      }

      // IDLE holatda — qo'shimcha xabarlar uchun
      if (step === 'IDLE') {
        return ctx.reply(
          '📋 Buyruqlar:\n/report — Kunlik hisobot\n/check — Muddati o\'tgan vazifalar',
        );
      }
    });
  }

  // =============================================
  // XABARNOMA YUBORISH METHODLARI
  // =============================================

  async sendMessage(telegramId: string, text: string) {
    if (this.bot) {
      try {
        await this.bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
      } catch (err) {
        console.warn(`Telegram message failed for ${telegramId}:`, err.message);
      }
    }
  }

  async sendNotification(employeeId: string, message: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (emp?.telegramId) {
      await this.sendMessage(emp.telegramId, `🔔 *Yangi xabarnoma:*\n\n${message}`);
    }
  }

  async notifyAdmins(tenantId: string, message: string) {
    const admins = await this.prisma.employee.findMany({
      where: { tenantId, role: { canViewFinance: true } },
    });
    for (const admin of admins) {
      if (admin.telegramId) {
        await this.sendMessage(admin.telegramId, `📢 *Admin xabarnomasi:*\n\n${message}`);
      }
    }
  }

  async notifyNewOrder(tenantId: string, message: string) {
    const prefs = await this.getNotifPrefs(tenantId);
    if (!prefs.newOrderReceivers || prefs.newOrderReceivers.length === 0) return;
    for (const empId of prefs.newOrderReceivers) {
      const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
      if (emp?.telegramId) {
        await this.sendMessage(emp.telegramId, `🆕 *Yangi Buyurtma tushdi!*\n\n${message}`);
      }
    }
  }

  // =============================================
  // HISOBOT GENERATSIYA
  // =============================================

  private async generateReportForTenant(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const txs = await this.prisma.transaction.findMany({
      where: { tenantId, date: { gte: today } },
      include: { expenseType: true },
    });

    const kirim = txs.filter(t => t.type === 'kirim').reduce((s, t) => s + t.amount, 0);
    const chiqim = txs.filter(t => t.type === 'chiqim').reduce((s, t) => s + t.amount, 0);

    // Bajarilgan buyurtmalar soni (so'nggi kunlik)
    const cols = await this.prisma.kanbanColumn.findMany({
      where: { tenantId },
      orderBy: { orderIdx: 'desc' },
      take: 1,
    });
    let completedCount = 0;
    if (cols.length > 0) {
      completedCount = await this.prisma.task.count({
        where: { tenantId, columnId: cols[0].id, updatedAt: { gte: today } },
      });
    }

    return (
      `📊 *Kunlik Hisobot*\n` +
      `📅 ${today.toLocaleDateString('uz-UZ')}\n\n` +
      `💰 Kirim: *${kirim.toLocaleString()}* UZS\n` +
      `💸 Chiqim: *${chiqim.toLocaleString()}* UZS\n` +
      `📈 Foyda: *${(kirim - chiqim).toLocaleString()}* UZS\n\n` +
      `✅ Bajarilgan buyurtmalar: *${completedCount}* ta`
    );
  }

  private async checkInactiveTasks(tenantId: string) {
    const cols = await this.prisma.kanbanColumn.findMany({
      where: { tenantId },
      orderBy: { orderIdx: 'asc' },
    });
    if (cols.length === 0) return;

    const lastCol = cols[cols.length - 1].id;
    const old = new Date(Date.now() - 24 * 3600000);

    const tasks = await this.prisma.task.findMany({
      where: { tenantId, updatedAt: { lt: old }, columnId: { not: lastCol } },
      include: { column: true },
    });

    for (const t of tasks) {
      const assignees: string[] = JSON.parse(t.assignees || '[]');
      for (const empId of assignees) {
        const emp = await this.prisma.employee.findFirst({
          where: { id: empId, tenantId },
        });
        if (emp?.telegramId) {
          await this.sendMessage(
            emp.telegramId,
            `⚠️ *Vazifa qolib ketdi*\n📌 ${t.title}\n⏳ "${t.column.title}" da 24 soatdan beri turibdi.`,
          );
        }
      }
    }
  }

  // =============================================
  // CRON JOBLAR
  // =============================================

  // Per-tenant notification preferences read from SystemSetting (key=NOTIFICATION_PREFS).
  // Defaults: every channel ON (so existing tenants keep current behavior).
  private async getNotifPrefs(tenantId: string): Promise<{ hisobotReceivers: string[]; newOrderReceivers: string[]; reminderReceivers: string[] }> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key: 'TELEGRAM_BOT_PREFS' },
    });
    const defaults = { hisobotReceivers: [], newOrderReceivers: [], reminderReceivers: [] };
    if (!setting) return defaults;
    try {
      const parsed = JSON.parse(setting.value);
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  }

  @Cron('0 21 * * *')
  async handleDailyReport() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      const prefs = await this.getNotifPrefs(t.id);
      if (!prefs.hisobotReceivers || prefs.hisobotReceivers.length === 0) continue;
      const report = await this.generateReportForTenant(t.id);
      for (const empId of prefs.hisobotReceivers) {
        const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
        if (emp?.telegramId) await this.sendMessage(emp.telegramId, report);
      }
    }
  }

  @Cron('0 * * * *')
  async handleHourlyTaskCheck() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    const now = Date.now();
    for (const t of tenants) {
      const prefs = await this.getNotifPrefs(t.id);
      if (!prefs.reminderReceivers || prefs.reminderReceivers.length === 0) continue;
      
      const cols = await this.prisma.kanbanColumn.findMany({
        where: { tenantId: t.id },
        orderBy: { orderIdx: 'asc' },
      });
      if (cols.length === 0) continue;
      const lastCol = cols[cols.length - 1].id;

      const tasks = await this.prisma.task.findMany({
        where: { tenantId: t.id, columnId: { not: lastCol }, deadlineAt: { not: null } },
        include: { column: true },
      });

      for (const task of tasks) {
        if (!task.deadlineAt) continue;
        const diffHours = (task.deadlineAt.getTime() - now) / 3600000;
        // Tolerance for cron job running exactly at the hour
        let shouldNotify = false;
        let msgType = '';
        if (diffHours > 11.5 && diffHours <= 12.5) {
          shouldNotify = true; msgType = '12 soat qoldi';
        } else if (diffHours > 4.5 && diffHours <= 5.5) {
          shouldNotify = true; msgType = '5 soat qoldi';
        } else if (diffHours > -0.5 && diffHours <= 0.5) {
          shouldNotify = true; msgType = 'Muddati keldi!';
        }

        if (shouldNotify) {
          for (const empId of prefs.reminderReceivers) {
            const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
            if (emp?.telegramId) {
              await this.sendMessage(
                emp.telegramId,
                `⏳ *Muddat Eslatmasi: ${msgType}*\n\n📌 Buyurtma: *${task.title}*\n🏢 Bosqich: ${task.column.title}\n📅 Muddat: ${task.deadlineAt.toLocaleString('uz-UZ')}`
              );
            }
          }
        }
      }
    }
  }

  // Kam qoldiq materiallarni tekshirish (har kuni ertalab 09:00)
  @Cron('0 9 * * *')
  async handleLowStockAlert() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {

      const materials = await this.prisma.material.findMany({
        where: { tenantId: t.id },
      });
      const lowStock = materials.filter(m => m.currentStock <= m.minStock && m.minStock > 0);

      if (lowStock.length === 0) continue;

      const message =
        `⚠️ *Kam qoldiq materiallari*\n\n` +
        lowStock.map(m =>
          `📦 *${m.name}*: ${m.currentStock} ${m.unit} (min: ${m.minStock})`
        ).join('\n');

      // Ombor boshqaruvchilariga yuborish
      const managers = await this.prisma.employee.findMany({
        where: { tenantId: t.id, role: { canManageInventory: true } },
      });
      for (const m of managers) {
        if (m.telegramId) await this.sendMessage(m.telegramId, message);
      }
    }
  }
}
