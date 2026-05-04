import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Markup } from 'telegraf';
import * as bcrypt from 'bcrypt';

// =============================================
// TELEGRAM BOT SERVICE — PrintFlow
// Oqim: /start → Til tanlash → Workspace → Login → Parol → IDLE
// =============================================

const LANGS = {
  uz: {
    chooseLanguage: '🌐 *Tilni tanlang:*',
    btnLatin:   "🇺🇿 O'zbek (lotin)",
    btnCyrillic:"🇺🇿 O'zbek (kirill)",
    enterWorkspace:
      '🏢 Ishlayotgan kompaniyangizning *workspace slug*ini kiriting:\n\n' +
      '_(Masalan: mycompany, sharq-bosma, printshop123)_',
    workspaceNotFound: (s: string) =>
      `❌ *"${s}"* — bu workspace topilmadi.\n\nIltimos, to'g'ri slug kiriting:`,
    workspaceFound: (n: string) =>
      `✅ *${n}* topildi!\n\n🔑 Endi *loginingizni* kiriting:`,
    enterPassword: '🔐 *Parolingizni* kiriting:',
    success: (n: string) =>
      `🎉 *Xush kelibsiz, ${n}!*\n\nSiz muvaffaqiyatli ro'yxatdan o'tdingiz.\nEndi bu bot orqali bildirishnomalar qabul qilasiz.`,
    wrongCredentials:
      "❌ Login yoki parol noto'g'ri.\n\n🔑 *Loginingizni* qayta kiriting:",
    alreadyLinked: (n: string) =>
      `✅ *${n}*ga ulangansiz.\n\nBildirishnomalar qabul qilasiz.`,
    pressButton: '👆 Iltimos, yuqoridagi tugmalardan birini tanlang.',
    idle: "Bildirishnomalar kelishini kuting.\n\nChiqish uchun 🚪 tugmasini bosing.",
    logoutConfirm: '👋 Siz tizimdan chiqdingiz. Qayta kirish uchun /start bosing.',
    btnLogout: '🚪 Chiqish',
    noSession: '❌ /start bosing.',
    error: '❌ Xatolik yuz berdi. /start bosing.',
    noWorkspace: "❌ Tizimda hali hech qanday workspace yo'q.",
  },
  kril: {
    chooseLanguage: '🌐 *Тилни танланг:*',
    btnLatin:   '🇺🇿 Ўзбек (лотин)',
    btnCyrillic:'🇺🇿 Ўзбек (кирилл)',
    enterWorkspace:
      '🏢 Ишлаётган компанияси *workspace slug*ини киринг:\n\n' +
      '_(Масалан: mycompany, sharq-bosma, printshop123)_',
    workspaceNotFound: (s: string) =>
      `❌ *"${s}"* — бу воркспейс топилмади.\n\nИлтимос, тўғри слуг киринг:`,
    workspaceFound: (n: string) =>
      `✅ *${n}* топилди!\n\n🔑 Энди *логинингизни* киринг:`,
    enterPassword: '🔐 *Паролингизни* киринг:',
    success: (n: string) =>
      `🎉 *Хуш келибсиз, ${n}!*\n\nСиз муваффақиятли рўйхатдан ўтдингиз.\nЭнди бу бот орқали билдиришномалар қабул қиласиз.`,
    wrongCredentials:
      '❌ Логин ёки парол нотўғри.\n\n🔑 *Логинингизни* қайта киринг:',
    alreadyLinked: (n: string) =>
      `✅ *${n}*га уланганcиз.\n\nБилдиришномалар қабул қиласиз.`,
    pressButton: '👆 Илтимос, юқоридаги тугмалардан бирини танланг.',
    idle: 'Билдиришномалар келишини кутинг.\n\nЧиқиш учун 🚪 тугмасини босинг.',
    logoutConfirm: '👋 Сиз тизимдан чиқдингиз. Қайта кириш учун /start босинг.',
    btnLogout: '🚪 Чиқиш',
    noSession: '❌ /start босинг.',
    error: '❌ Хатолик юз берди. /start босинг.',
    noWorkspace: '❌ Тизимда ҳали ҳеч қандай воркспейс йўқ.',
  },
};

function L(session: any) {
  return session?.lang === 'kril' ? LANGS.kril : LANGS.uz;
}

function langKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(LANGS.uz.btnLatin,   'lang_uz')],
    [Markup.button.callback(LANGS.uz.btnCyrillic, 'lang_kril')],
  ]);
}

function logoutKeyboard(lang: typeof LANGS.uz) {
  return Markup.keyboard([[lang.btnLogout]]).resize();
}

function removeKeyboard() {
  return Markup.removeKeyboard();
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;

  constructor(private prisma: PrismaService) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token !== 'your_bot_token_here') {
      this.bot = new Telegraf(token);
      this.initializeBot();
    } else {
      console.warn('TELEGRAM_BOT_TOKEN topilmadi. Bot o\'chirilgan.');
    }
  }

  async onModuleInit() {
    if (!this.bot) return;

    // Error handler — prevents polling from silently dying on unhandled handler exceptions
    this.bot.catch((err: any, ctx: any) => {
      console.error('❌ Telegram bot handler xatosi:', err?.message || err);
    });

    try {
      // Delete any existing webhook so long-polling works cleanly
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log('🔗 Webhook tozalandi');
    } catch (e: any) {
      console.warn('Webhook o\'chirishda xato (davom etiladi):', e?.message);
    }

    this.bot.launch({ dropPendingUpdates: true })
      .catch(err => console.error('Bot ishga tushmadi:', err?.message || err));

    console.log('🚀 Telegram Bot polling boshlandi');
  }

  onModuleDestroy() {
    if (this.bot) this.bot.stop();
  }

  // =============================================
  // BOT ISHGA TUSHIRISH
  // =============================================

  private initializeBot() {
    // Har bir updateda session ma'lumotlarini yuklash
    this.bot.use(async (ctx: any, next) => {
      const chatId = ctx.chat?.id?.toString();
      if (!chatId) return next();
      try {
        const session = await this.prisma.botSession.findUnique({
          where: { chatId },
          include: { tenant: true },
        });
        if (session) {
          ctx.tenantId    = session.tenantId   || null;
          ctx.tenant      = session.tenant     || null;
          ctx.botSession  = session;
          ctx.employeeId  = session.employeeId || null;
        }
      } catch (err: any) {
        console.error('Session yuklashda xato:', err?.message || err);
      }
      return next();
    });

    // /start komandasi
    this.bot.start(async (ctx: any) => {
      try {
        const chatId = ctx.chat.id.toString();

        // Allaqachon ulangan foydalanuvchi
        if (ctx.employeeId && ctx.botSession?.step === 'IDLE') {
          const lang = L(ctx.botSession);
          return ctx.reply(
            lang.alreadyLinked(ctx.tenant?.name || 'Workspace'),
            { parse_mode: 'Markdown', ...logoutKeyboard(lang) },
          );
        }

        // Session yangilash yoki yaratish — til tanlash bosqichiga o'tish
        const firstTenant = await this.prisma.tenant.findFirst({ where: { isActive: true } });
        if (!firstTenant) {
          return ctx.reply(LANGS.uz.noWorkspace);
        }

        await this.prisma.botSession.upsert({
          where: { chatId },
          update: { step: 'LANG', employeeId: null, loginAttempt: null, lang: 'uz' },
          create: { chatId, tenantId: firstTenant.id, step: 'LANG', lang: 'uz' },
        });

        return ctx.reply(
          LANGS.uz.chooseLanguage,
          { parse_mode: 'Markdown', ...langKeyboard() },
        );
      } catch (err: any) {
        console.error('/start handler xatosi:', err?.message || err);
        return ctx.reply('❌ Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
      }
    });

    // =============================================
    // TIL TANLASH (inline tugmalar)
    // =============================================

    this.bot.action('lang_uz', async (ctx: any) => {
      await ctx.answerCbQuery();
      const chatId = ctx.chat.id.toString();

      await this.prisma.botSession.update({
        where: { chatId },
        data: { lang: 'uz', step: 'WORKSPACE' },
      });

      return ctx.reply(LANGS.uz.enterWorkspace, { parse_mode: 'Markdown' });
    });

    this.bot.action('lang_kril', async (ctx: any) => {
      await ctx.answerCbQuery();
      const chatId = ctx.chat.id.toString();

      await this.prisma.botSession.update({
        where: { chatId },
        data: { lang: 'kril', step: 'WORKSPACE' },
      });

      return ctx.reply(LANGS.kril.enterWorkspace, { parse_mode: 'Markdown' });
    });

    // =============================================
    // MATN XABARLARI — qadamli oqim
    // =============================================

    this.bot.on('text', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      const text   = ctx.message.text.trim();

      if (text.startsWith('/')) return;

      if (!ctx.botSession) {
        return ctx.reply(LANGS.uz.noSession);
      }

      const { step } = ctx.botSession;
      const lang = L(ctx.botSession);

      // Til tanlash bosqichida matn kelsa — tugma bosishni so'rash
      if (step === 'LANG') {
        return ctx.reply(lang.pressButton, { parse_mode: 'Markdown', ...langKeyboard() });
      }

      // =============================================
      // QADAM 1: Workspace slug
      // =============================================
      if (step === 'WORKSPACE') {
        const slug   = text.toLowerCase().replace(/\s+/g, '-');
        const tenant = await this.prisma.tenant.findUnique({ where: { slug } });

        if (!tenant || !tenant.isActive) {
          return ctx.reply(lang.workspaceNotFound(slug), { parse_mode: 'Markdown' });
        }

        await this.prisma.botSession.update({
          where: { chatId },
          data: { tenantId: tenant.id, step: 'LOGIN', loginAttempt: null },
        });

        return ctx.reply(lang.workspaceFound(tenant.name), { parse_mode: 'Markdown' });
      }

      // =============================================
      // QADAM 2: Login
      // =============================================
      if (step === 'LOGIN') {
        await this.prisma.botSession.update({
          where: { chatId },
          data: { loginAttempt: text, step: 'PASSWORD' },
        });
        return ctx.reply(lang.enterPassword, { parse_mode: 'Markdown' });
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
          return ctx.reply(lang.error);
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
            lang.success(emp.fullName),
            { parse_mode: 'Markdown', ...logoutKeyboard(lang) },
          );
        }

        // Xato — logindan qayta boshlash
        await this.prisma.botSession.update({
          where: { chatId },
          data: { step: 'LOGIN', loginAttempt: null },
        });
        return ctx.reply(lang.wrongCredentials, { parse_mode: 'Markdown' });
      }

      // IDLE holatda — logout tugmasi bosilganini tekshirish
      if (step === 'IDLE') {
        if (text === LANGS.uz.btnLogout || text === LANGS.kril.btnLogout) {
          return this.performLogout(ctx, chatId, lang);
        }
        return ctx.reply(lang.idle, logoutKeyboard(lang));
      }
    });

    // /logout komandasi
    this.bot.command('logout', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      if (!ctx.botSession) return ctx.reply(LANGS.uz.noSession);
      const lang = L(ctx.botSession);
      return this.performLogout(ctx, chatId, lang);
    });
  }

  private async performLogout(ctx: any, chatId: string, lang: typeof LANGS.uz) {
    const session = ctx.botSession;
    if (session?.employeeId) {
      await this.prisma.employee.update({
        where: { id: session.employeeId },
        data: { telegramId: null },
      });
    }
    await this.prisma.botSession.update({
      where: { chatId },
      data: { employeeId: null, step: 'LANG', loginAttempt: null },
    });
    return ctx.reply(lang.logoutConfirm, removeKeyboard());
  }

  // =============================================
  // XABARNOMA YUBORISH METHODLARI
  // =============================================

  async sendMessage(telegramId: string, text: string) {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.warn(`Telegram xabar yuborilmadi (${telegramId}):`, err.message);
    }
  }

  async sendNotification(employeeId: string, message: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (emp?.telegramId) {
      await this.sendMessage(emp.telegramId, `🔔 *Yangi bildirishnoma:*\n\n${message}`);
    }
  }

  async notifyAdmins(tenantId: string, message: string) {
    const admins = await this.prisma.employee.findMany({
      where: { tenantId, role: { canViewFinance: true } },
    });
    for (const admin of admins) {
      if (admin.telegramId) {
        await this.sendMessage(admin.telegramId, `📢 *Admin bildirishnomasi:*\n\n${message}`);
      }
    }
  }

  async notifyNewOrder(tenantId: string, message: string) {
    const prefs = await this.getNotifPrefs(tenantId);
    if (!prefs.newOrderReceivers?.length) return;
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

    const kirim  = txs.filter(t => t.type === 'kirim').reduce((s, t) => s + t.amount, 0);
    const chiqim = txs.filter(t => t.type === 'chiqim').reduce((s, t) => s + t.amount, 0);

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

  // =============================================
  // CRON JOBLAR
  // =============================================

  private async getNotifPrefs(tenantId: string): Promise<{
    hisobotReceivers: string[];
    newOrderReceivers: string[];
    reminderReceivers: string[];
  }> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key: 'TELEGRAM_BOT_PREFS' },
    });
    const defaults = { hisobotReceivers: [], newOrderReceivers: [], reminderReceivers: [] };
    if (!setting) return defaults;
    try {
      return { ...defaults, ...JSON.parse(setting.value) };
    } catch {
      return defaults;
    }
  }

  @Cron('0 21 * * *')
  async handleDailyReport() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      const prefs = await this.getNotifPrefs(t.id);
      if (!prefs.hisobotReceivers?.length) continue;
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
      if (!prefs.reminderReceivers?.length) continue;

      const cols = await this.prisma.kanbanColumn.findMany({
        where: { tenantId: t.id },
        orderBy: { orderIdx: 'asc' },
      });
      if (!cols.length) continue;
      const lastColId = cols[cols.length - 1].id;

      const tasks = await this.prisma.task.findMany({
        where: { tenantId: t.id, columnId: { not: lastColId }, deadlineAt: { not: null } },
        include: { column: true },
      });

      for (const task of tasks) {
        if (!task.deadlineAt) continue;
        const diffHours = (task.deadlineAt.getTime() - now) / 3600000;

        let label = '';
        if (diffHours > 11.5 && diffHours <= 12.5)      label = '12 soat qoldi';
        else if (diffHours > 4.5 && diffHours <= 5.5)   label = '5 soat qoldi';
        else if (diffHours > -0.5 && diffHours <= 0.5)  label = '⚡ Muddati keldi!';

        if (!label) continue;

        for (const empId of prefs.reminderReceivers) {
          const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
          if (emp?.telegramId) {
            await this.sendMessage(
              emp.telegramId,
              `⏳ *Muddat Eslatmasi: ${label}*\n\n` +
              `📌 Buyurtma: *${task.title}*\n` +
              `🏢 Bosqich: ${(task as any).column?.title}\n` +
              `📅 Muddat: ${task.deadlineAt.toLocaleString('uz-UZ')}`,
            );
          }
        }
      }
    }
  }

  @Cron('0 9 * * *')
  async handleLowStockAlert() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      const materials = await this.prisma.material.findMany({ where: { tenantId: t.id } });
      const lowStock  = materials.filter(m => m.minStock > 0 && m.currentStock <= m.minStock);
      if (!lowStock.length) continue;

      const message =
        `⚠️ *Kam qoldiq materiallari*\n\n` +
        lowStock.map(m => `📦 *${m.name}*: ${m.currentStock} ${m.unit} (min: ${m.minStock})`).join('\n');

      const managers = await this.prisma.employee.findMany({
        where: { tenantId: t.id, role: { canManageInventory: true } },
      });
      for (const m of managers) {
        if (m.telegramId) await this.sendMessage(m.telegramId, message);
      }
    }
  }
}
