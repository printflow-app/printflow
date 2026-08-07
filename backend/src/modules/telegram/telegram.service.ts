import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { Telegraf, Markup } from 'telegraf';
import { OvertimeService } from '../overtime/overtime.service';

// =============================================
// TELEGRAM BOT SERVICE — PrintFlow
// Oqim: /start → Til tanlash → Workspace → Login → Parol → IDLE
// =============================================

const LANGS = {
  uz: {
    welcome:
      '👋 *PrintFlow botiga xush kelibsiz!*\n\n' +
      'Quyidagi tugma orqali platformani oching va bir marta tizimga kiring — ' +
      "hisobingiz Telegram'ga *avtomatik bog'lanadi*. Shundan so'ng bu yerda " +
      'bildirishnomalar olasiz va keyingi safar parol kiritish shart emas.',
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
    welcome:
      '👋 *PrintFlow ботига хуш келибсиз!*\n\n' +
      'Қуйидаги тугма орқали платформани очинг ва бир марта тизимга киринг — ' +
      "ҳисобингиз Телеграмга *автоматик боғланади*. Шундан сўнг бу ерда " +
      'билдиришномалар оласиз ва кейинги сафар парол киритиш шарт эмас.',
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

function logoutKeyboard(lang: typeof LANGS.uz) {
  return Markup.keyboard([
    [Markup.button.webApp('🌐 Platformani ochish', 'https://printflow-gilt.vercel.app/')],
    [lang.btnLogout]
  ]).resize();
}

// Hali bog'lanmagan foydalanuvchi uchun — faqat platformani ochish tugmasi.
// WebApp tugmasi Mini App'ni initData bilan ochadi; platformada login/register
// qilinganda hisob avtomatik Telegram'ga bog'lanadi.
function openPlatformKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp('🚀 Platformani ochish', 'https://printflow-gilt.vercel.app/')],
  ]).resize();
}

function removeKeyboard() {
  return Markup.removeKeyboard();
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;

  constructor(
    private prisma: PrismaService,
    private overtimeService: OvertimeService,
  ) {
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

    this.bot.catch((err: any, ctx: any) => {
      console.error('❌ Telegram bot handler xatosi:', err?.message || err);
    });

    const webhookUrl = this.buildWebhookUrl();

    if (webhookUrl) {
      const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
      try {
        await this.bot.telegram.setWebhook(webhookUrl, {
          secret_token: secret,
          drop_pending_updates: true,
        });
        console.log(`🔗 Telegram Webhook o'rnatildi: ${webhookUrl}`);
      } catch (e: any) {
        console.error('Webhook o\'rnatishda xato:', e?.message);
      }
    } else {
      // Local development — polling rejimi
      try {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log('🔗 Webhook tozalandi (polling rejimi)');
      } catch (e: any) {
        console.warn('Webhook o\'chirishda xato:', e?.message);
      }
      this.bot.launch({ dropPendingUpdates: true })
        .catch(err => console.error('Bot ishga tushmadi:', err?.message || err));
      console.log('🚀 Telegram Bot polling boshlandi');
    }
  }

  onModuleDestroy() {
    if (this.bot && !process.env.BACKEND_URL) {
      this.bot.stop();
    }
  }

  async handleUpdate(body: any) {
    if (!this.bot) return;
    await this.bot.handleUpdate(body);
  }

  // BACKEND_URL'dan webhook manzilini quradi. Trailing slash va xato '/api'
  // qo'shimchalarini tozalaydi (noto'g'ri URL → Telegram update yetkaza olmaydi).
  private buildWebhookUrl(): string | null {
    let base = (process.env.BACKEND_URL || '').trim();
    if (!base) return null;
    base = base.replace(/\/+$/, '');          // oxirgi '/' larni olib tashlaymiz
    base = base.replace(/\/api$/, '');         // BACKEND_URL xato '/api' bilan tugasa
    return `${base}/api/telegram/webhook`;
  }

  // DIAGNOSTIKA — bot holatini va Telegram webhook ma'lumotini qaytaradi.
  // last_error_message / pending_update_count muammoning aniq sababini ko'rsatadi.
  async getDiagnostics() {
    if (!this.bot) {
      return { botActive: false, reason: "TELEGRAM_BOT_TOKEN topilmadi yoki noto'g'ri" };
    }
    const configuredUrl = this.buildWebhookUrl();
    const mode = configuredUrl ? 'webhook' : 'polling';
    try {
      const info = await this.bot.telegram.getWebhookInfo();
      const me = await this.bot.telegram.getMe().catch(() => null);
      return {
        botActive: true,
        mode,
        configuredUrl,
        secretSet: !!process.env.TELEGRAM_WEBHOOK_SECRET,
        botUsername: me?.username || null,
        telegramWebhook: info, // { url, pending_update_count, last_error_date, last_error_message, ... }
      };
    } catch (e: any) {
      return { botActive: true, mode, configuredUrl, error: e?.message || String(e) };
    }
  }

  // Webhook'ni qayta o'rnatadi (manzil yoki secret o'zgargach foydali).
  async resetWebhook() {
    if (!this.bot) return { ok: false, reason: "TELEGRAM_BOT_TOKEN topilmadi" };
    const url = this.buildWebhookUrl();
    if (!url) return { ok: false, reason: "BACKEND_URL topilmadi — webhook o'rnatib bo'lmaydi (polling rejimi)" };
    await this.bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
    await this.bot.telegram.setWebhook(url, {
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      drop_pending_updates: true,
    });
    const info = await this.bot.telegram.getWebhookInfo();
    return { ok: true, url, telegramWebhook: info };
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

    // /start komandasi — endi botda alohida login YO'Q.
    // Foydalanuvchi "Platformani ochish" tugmasi orqali Mini App'ni ochadi va
    // platformada bir marta login/register qiladi; hisob avtomatik Telegram'ga
    // bog'lanadi (auth.service.linkTelegram). Shundan so'ng bildirishnomalar ishlaydi.
    this.bot.start(async (ctx: any) => {
      console.log('📥 /start komandasi qabul qilindi, chatId:', ctx.chat?.id);
      try {
        // Allaqachon ulangan foydalanuvchi
        if (ctx.employeeId && ctx.botSession?.step === 'IDLE') {
          const lang = L(ctx.botSession);
          return ctx.reply(
            lang.alreadyLinked(ctx.tenant?.name || 'Workspace'),
            { parse_mode: 'Markdown', ...logoutKeyboard(lang) },
          );
        }

        return ctx.reply(
          LANGS.uz.welcome,
          { parse_mode: 'Markdown', ...openPlatformKeyboard() },
        );
      } catch (err: any) {
        console.error('❌ /start handler xatosi:', err?.message || err, err?.stack);
        return ctx.reply('❌ Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
      }
    });

    // =============================================
    // KOMANDALAR
    // =============================================

    // /logout komandasi
    this.bot.command('logout', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      if (!ctx.botSession) return ctx.reply(LANGS.uz.noSession);
      const lang = L(ctx.botSession);
      return this.performLogout(ctx, chatId, lang);
    });

    // /update komandasi - Sessiyani yangilash va qotib qolgan qadamlarni tozalash
    this.bot.command('update', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      try {
        let session = await this.prisma.botSession.findUnique({ where: { chatId } });
        if (!session) {
           return ctx.reply('Sizda faol sessiya topilmadi. Boshlash uchun /start tugmasini bosing.', removeKeyboard());
        }
        
        // Agar xodim tizimga kirgan bo'lsa, xodim mavjudligini tekshiramiz
        if (session.employeeId) {
          const emp = await this.prisma.employee.findUnique({ where: { id: session.employeeId } });
          if (!emp) {
            // Agar xodim o'chirilgan bo'lsa, sessiyani tozalaymiz
            await this.performLogout(ctx, chatId, L(session));
            return ctx.reply('Sizning profilingiz tizimdan topilmadi yoki o\'chirilgan. Qayta kirish uchun /start bosing.');
          }
        }

        // Sessiyani IDLE'ga qaytaramiz (qotib qolgan bo'lsa) va yangilangan xabarni beramiz
        await this.prisma.botSession.update({
          where: { chatId },
          data: { step: 'IDLE', loginAttempt: null },
        });

        const lang = L(session);
        if (session.employeeId) {
           return ctx.reply(
             '✅ *Bot muvaffaqiyatli yangilandi!*\n\nSiz eng so\'nggi versiyadan foydalanyapsiz.',
             { parse_mode: 'Markdown', ...logoutKeyboard(lang) }
           );
        } else {
           return ctx.reply(
             '✅ Bot yangilandi! Platformani ochib bir marta tizimga kiring — hisobingiz avtomatik bog\'lanadi.',
             { parse_mode: 'Markdown', ...openPlatformKeyboard() },
           );
        }
      } catch (err) {
        console.error('/update xatosi:', err);
        return ctx.reply('❌ Yangilashda xatolik yuz berdi. /reset ni sinab ko\'ring.');
      }
    });

    // /reset komandasi - Butunlay xotirani tozalash (majburiy)
    this.bot.command('reset', async (ctx: any) => {
      const chatId = ctx.chat.id.toString();
      try {
        // Avval employee bilan bog'liqlikni uzamiz
        const session = await this.prisma.botSession.findUnique({ where: { chatId } });
        if (session?.employeeId) {
          await this.prisma.employee.update({
            where: { id: session.employeeId },
            data: { telegramId: null },
          }).catch(() => {});
        }
        // Sessiyani o'chiramiz
        await this.prisma.botSession.delete({ where: { chatId } }).catch(() => {});
        
        return ctx.reply('🔄 Bot xotirasi butunlay tozalandi va sessiya yopildi.\n\nBoshlash uchun /start bosing.', removeKeyboard());
      } catch (err) {
        return ctx.reply('🔄 Bot xotirasi tozalangan. Boshlash uchun /start bosing.', removeKeyboard());
      }
    });

    // =============================================
    // MATN XABARLARI — qadamli oqim
    // =============================================

    this.bot.on('text', async (ctx: any, next) => {
      const chatId = ctx.chat.id.toString();
      const text   = ctx.message.text.trim();

      if (text.startsWith('/')) return next();

      if (!ctx.botSession) {
        return ctx.reply(LANGS.uz.noSession);
      }

      const { step } = ctx.botSession;
      const lang = L(ctx.botSession);

      // Eslatma: workspace/login/parol oqimi olib tashlandi — ro'yxatdan o'tish
      // endi faqat platformada (Mini App) bo'ladi va hisob avtomatik bog'lanadi.
      // Bot faqat OVERTIME izohi va IDLE (logout tugmasi) holatlarini boshqaradi.

      // OVERTIME_AWAITING — xodim ortiqcha ish izohini yuboryapti
      if (step === 'OVERTIME_AWAITING') {
        const session = ctx.botSession;
        if (!session.employeeId || !session.tenantId || !session.overtimePromptDate) {
          // Session noaniq holatda — IDLE'ga qaytaramiz
          await this.prisma.botSession.update({
            where: { chatId },
            data: { step: 'IDLE', overtimePromptDate: null, overtimePromptedAt: null } as any,
          });
          return ctx.reply(lang.idle, logoutKeyboard(lang));
        }

        // Minute hisoblash: prompt yuborilgandan beri o'tgan minutlar emas,
        // workEnd dan promptedAt vaqtigacha bo'lgan farq.
        const promptedAt: Date = (session as any).overtimePromptedAt || new Date();
        const minutes = await this.calculateOvertimeMinutes(session.tenantId, promptedAt);

        try {
          await this.overtimeService.createFromTelegram({
            tenantId: session.tenantId,
            employeeId: session.employeeId,
            date: session.overtimePromptDate,
            message: text.slice(0, 1000),
            minutes,
          });

          await this.prisma.botSession.update({
            where: { chatId },
            data: { step: 'IDLE', overtimePromptDate: null, overtimePromptedAt: null } as any,
          });

          return ctx.reply(
            "✅ *Rahmat!* Sizning izohingiz adminga yuborildi.\n" +
            "Admin tasdiqlasa, ortiqcha ish vaqti hisoblanadi.",
            { parse_mode: 'Markdown', ...logoutKeyboard(lang) },
          );
        } catch (err: any) {
          console.error('Overtime saqlashda xato:', err?.message || err);
          return ctx.reply('❌ Saqlashda xatolik. Iltimos qayta urinib ko\'ring.');
        }
      }

      // IDLE holatda — logout tugmasi bosilganini tekshirish
      if (step === 'IDLE') {
        if (text === LANGS.uz.btnLogout || text === LANGS.kril.btnLogout) {
          return this.performLogout(ctx, chatId, lang);
        }
        return ctx.reply(lang.idle, logoutKeyboard(lang));
      }
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

  /**
   * Davomat xizmati tomonidan chaqiriladi (xodim manual ketganda).
   * Agar vaqt kech bo'lsa, Telegram orqali izoh so'raydi.
   */
  async triggerOvertimePrompt(employeeId: string, tenantId: string) {
    const { str: todayStr, utc5 } = this.tashkentNow();
    
    const settings = await this.prisma.systemSetting.findMany({
      where: { tenantId, key: { in: ['workEnd', 'workDays'] } },
    });
    const workEnd = this.parseSetting(settings, 'workEnd', { hour: 17, minute: 0 });
    const workDays = this.parseSetting(settings, 'workDays', [1, 2, 3, 4, 5, 6]);

    const isWorkDay = workDays.includes(utc5.getUTCDay());
    const currentMins = utc5.getUTCHours() * 60 + utc5.getUTCMinutes();
    const workEndMins = workEnd.hour * 60 + workEnd.minute;

    // 15 minutdan ko'p o'tgan bo'lsa
    if (currentMins > workEndMins + 15 || !isWorkDay) {
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp?.telegramId) return;

      const promptMsg = 
        `🕐 *Ortiqcha ish vaqti aniqlandi*\n\n` +
        `Siz bugun (${todayStr}) ish vaqtidan tashqari qoldingiz.\n` +
        `Iltimos, nima ishlar qilganingizni yozib yuboring (izoh).`;

      try {
        await this.bot.telegram.sendMessage(emp.telegramId, promptMsg, { parse_mode: 'Markdown' });
        await this.prisma.botSession.update({
          where: { chatId: emp.telegramId },
          data: {
            step: 'OVERTIME_AWAITING',
            overtimePromptDate: todayStr,
            overtimePromptedAt: new Date(),
          } as any,
        });
      } catch (err: any) {
        console.warn(`Overtime trigger prompt yuborilmadi (${emp.telegramId}):`, err.message);
      }
    }
  }

  async sendMessage(telegramId: string, text: string) {
    if (!this.bot) return;
    setTimeout(async () => {
      try {
        await this.bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
      } catch (err: any) {
        console.warn(`Telegram xabar yuborilmadi (${telegramId}):`, err?.message);
      }
    }, 0);
  }

  async sendNotification(employeeId: string, message: string) {
    setTimeout(async () => {
      try {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (emp?.telegramId) {
          await this.sendMessage(emp.telegramId, `🔔 *Yangi bildirishnoma:*\n\n${message}`);
        }
      } catch (err: any) {
        console.warn('sendNotification xatosi:', err?.message);
      }
    }, 0);
  }

  async notifyAdmins(tenantId: string, message: string) {
    setTimeout(async () => {
      try {
        const admins = await this.prisma.employee.findMany({
          where: { tenantId, role: { canViewFinance: true } },
        });
        for (const admin of admins) {
          if (admin.telegramId) {
            await this.sendMessage(admin.telegramId, `📢 *Admin bildirishnomasi:*\n\n${message}`);
          }
        }
      } catch (err: any) {
        console.warn('notifyAdmins xatosi:', err?.message);
      }
    }, 0);
  }

  async notifyNewOrder(tenantId: string, message: string) {
    setTimeout(async () => {
      try {
        const prefs = await this.getNotifPrefs(tenantId);
        if (!prefs.newOrderEnabled) return;
        if (!prefs.newOrderReceivers?.length) return;
        for (const empId of prefs.newOrderReceivers) {
          const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
          if (emp?.telegramId) {
            await this.sendMessage(emp.telegramId, `🆕 *Yangi Buyurtma tushdi!*\n\n${message}`);
          }
        }
      } catch (err: any) {
        console.warn('notifyNewOrder xatosi:', err?.message);
      }
    }, 0);
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
    // Per-event ON/OFF toggles. Default `true` for backward compat with
    // existing tenants whose settings were saved before this field existed.
    hisobotEnabled: boolean;
    newOrderEnabled: boolean;
    reminderEnabled: boolean;
  }> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key: 'TELEGRAM_BOT_PREFS' },
    });
    const defaults = {
      hisobotReceivers: [],
      newOrderReceivers: [],
      reminderReceivers: [],
      hisobotEnabled: true,
      newOrderEnabled: true,
      reminderEnabled: true,
    };
    if (!setting) return defaults;
    try {
      return { ...defaults, ...JSON.parse(setting.value) };
    } catch {
      return defaults;
    }
  }

  @Cron('0 21 * * *')
  async handleDailyReport() {
    const { str: todayStr } = this.tashkentNow();
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    for (const t of tenants) {
      await this.cleanupCronLocks(t.id);
      const prefs = await this.getNotifPrefs(t.id);
      if (!prefs.hisobotEnabled) continue;
      if (!prefs.hisobotReceivers?.length) continue;
      const report = await this.generateReportForTenant(t.id);
      for (const empId of prefs.hisobotReceivers) {
        if (!await this.acquireCronLock(t.id, `cron_lock:daily_report:${todayStr}:${empId}`)) continue;
        const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
        if (emp?.telegramId) await this.sendMessage(emp.telegramId, report);
      }
    }
  }

  @Cron('0 * * * *')
  async handleHourlyTaskCheck() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    const now = Date.now();
    const { utc5 } = this.tashkentNow();
    const hourStr = `${utc5.toISOString().slice(0, 13)}`; // "2025-01-14T09"
    for (const t of tenants) {
      const prefs = await this.getNotifPrefs(t.id);
      if (!prefs.reminderEnabled) continue;
      if (!prefs.reminderReceivers?.length) continue;

      const cols = await this.prisma.kanbanColumn.findMany({
        where: { tenantId: t.id },
        orderBy: { orderIdx: 'asc' },
      });
      if (!cols.length) continue;
      const lastColId = cols[cols.length - 1].id;

      const tasks = await this.prisma.task.findMany({
        where: { tenantId: t.id, columnId: { not: lastColId }, deadlineAt: { not: null } },
        // Mijoz ham qo'shiladi — eslatmada "qaysi mijozning qaysi buyurtmasi"
        // ko'rinishi kerak, faqat xizmat nomi yetarli emas edi.
        include: { column: true, customer: true },
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
          // Multi-instance duplicate guard — keyed to this task + receiver + hour bucket
          if (!await this.acquireCronLock(t.id, `cron_lock:task_reminder:${hourStr}:${task.id}:${empId}`)) continue;
          const emp = await this.prisma.employee.findUnique({ where: { id: empId } });
          if (emp?.telegramId) {
            // Buyurtma nomi bilan xizmat nomi boshqa-boshqa: bitta buyurtmada
            // bir necha xizmat bo'lishi mumkin. Ikkalasi ham ko'rsatiladi,
            // aks holda "qaysi buyurtma edi?" degan savol qolardi.
            const anyTask = task as any;
            const mijoz = anyTask.customer?.name || anyTask.customerName || null;
            const buyurtma = anyTask.orderName || task.title;
            const xizmat = anyTask.orderName && task.title !== anyTask.orderName ? task.title : null;
            const raqam = task.displayId ? ` (${task.displayId})` : '';

            await this.sendMessage(
              emp.telegramId,
              `⏳ *Muddat Eslatmasi: ${label}*\n\n` +
              (mijoz ? `👤 Mijoz: *${mijoz}*\n` : '') +
              `📌 Buyurtma: *${buyurtma}*${raqam}\n` +
              (xizmat ? `🧾 Xizmat: ${xizmat}\n` : '') +
              `🏢 Bosqich: ${anyTask.column?.title}\n` +
              `📅 Muddat: ${task.deadlineAt.toLocaleString('uz-UZ')}`,
            );
          }
        }
      }
    }
  }

  // =============================================
  // ORTIQCHA ISH (OVERTIME) PROMPT — har 30 daqiqada
  // workEnd vaqtidan 30 daqiqa o'tgandan so'ng, hali "ishda" bo'lgan xodimlarni
  // tekshirib (yo checkOut yo'q, yo dam olish kuni qilingan checkIn) — Telegram'da
  // izoh so'rab xabar yuboramiz. Bir kunda 1 marta yuboriladi.
  // =============================================
  @Cron('*/30 * * * *')
  async handleOvertimePrompt() {
    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    const { str: todayStr, day: todayDay, mins: currentMins } = this.tashkentNow();

    for (const t of tenants) {
      try {
        const settings = await this.prisma.systemSetting.findMany({
          where: { tenantId: t.id, key: { in: ['workEnd', 'workDays'] } },
        });
        const workEnd = this.parseSetting(settings, 'workEnd', { hour: 17, minute: 0 });
        const workDays = this.parseSetting(settings, 'workDays', [1, 2, 3, 4, 5, 6]);

        const isWorkDay = workDays.includes(todayDay);

        // workEnd + 30 daqiqa (UTC+5 minutes comparison)
        const workEndMins = workEnd.hour * 60 + workEnd.minute;
        const promptThresholdMins = workEndMins + 30;
        const workEndDate = new Date(); // used only for display in formatTime
        workEndDate.setUTCHours(workEnd.hour - 5, workEnd.minute, 0, 0); // UTC equivalent

        if (currentMins < promptThresholdMins) continue; // Hali vaqti emas

        // Xodimlar ro'yxati: telegramId mavjud bo'lganlar
        const employees = await this.prisma.employee.findMany({
          where: { tenantId: t.id, telegramId: { not: null } },
        });

        for (const emp of employees) {
          if (!emp.telegramId) continue;

          // Bugun uchun overtime so'rovi allaqachon mavjudmi?
          const existingReq = await this.prisma.overtimeRequest.findFirst({
            where: { tenantId: t.id, employeeId: emp.id, date: todayStr },
          });
          if (existingReq) continue;

          // Bot session — xodim allaqachon prompt olganmi?
          const session = await this.prisma.botSession.findFirst({
            where: { chatId: emp.telegramId },
          });
          if (!session || session.employeeId !== emp.id) continue;
          if ((session as any).overtimePromptDate === todayStr) continue; // Bugun yuborilgan

          // Bugungi attendance recordni tekshiramiz
          const rec = await this.prisma.attendanceRecord.findFirst({
            where: { tenantId: t.id, employeeId: emp.id, date: todayStr },
          });

          // Prompt yuborish sharti:
          //  • Ish kuni: rec mavjud va checkIn bor lekin checkOut == null (hali ketmagan)
          //  • Dam olish kuni: rec mavjud (ya'ni dam olish kunida ish qilgan)
          let shouldPrompt = false;
          if (isWorkDay) {
            shouldPrompt = !!(rec && rec.checkIn && !rec.checkOut);
          } else {
            shouldPrompt = !!(rec && rec.checkIn);
          }
          if (!shouldPrompt) continue;
          // Multi-instance duplicate guard — overtimePromptDate check above is not atomic
          if (!await this.acquireCronLock(t.id, `cron_lock:overtime_prompt:${todayStr}:${emp.id}`)) continue;

          const promptMsg =
            `🕐 *Ortiqcha ish vaqti*\n\n` +
            `Siz bugun (${todayStr}) ishxonada *${this.formatTime(workEndDate)}* dan keyin ham qoldingiz.\n\n` +
            `Iltimos, qanday vazifalarni bajarganingizni qisqacha yozing — admin tasdiqlasa, ortiqcha ish vaqtingiz hisoblanadi.`;

          try {
            await this.bot.telegram.sendMessage(emp.telegramId, promptMsg, { parse_mode: 'Markdown' });
            await this.prisma.botSession.update({
              where: { chatId: emp.telegramId },
              data: {
                step: 'OVERTIME_AWAITING',
                overtimePromptDate: todayStr,
                overtimePromptedAt: new Date(),
              } as any,
            });
          } catch (err: any) {
            console.warn(`Overtime prompt yuborilmadi (${emp.telegramId}):`, err?.message);
          }
        }
      } catch (err: any) {
        console.error(`Overtime cron tenant ${t.id} uchun xato:`, err?.message);
      }
    }
  }

  /** workEnd vaqtidan promptedAt vaqtigacha o'tgan minutlar — overtime miqdori */
  private async calculateOvertimeMinutes(tenantId: string, promptedAt: Date): Promise<number> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { tenantId, key: 'workEnd' },
    });
    let workEnd = { hour: 17, minute: 0 };
    if (setting) {
      try {
        const parsed = JSON.parse(setting.value);
        if (parsed && typeof parsed.hour === 'number') workEnd = parsed;
      } catch {}
    }
    // Use UTC+5 representation of promptedAt to compare with local-time settings
    const promptedUTC5 = new Date(promptedAt.getTime() + 5 * 60 * 60 * 1000);
    const promptedMins = promptedUTC5.getUTCHours() * 60 + promptedUTC5.getUTCMinutes();
    const workEndMins = workEnd.hour * 60 + workEnd.minute;
    return Math.max(0, promptedMins - workEndMins);
  }

  private parseSetting(settings: any[], key: string, fallback: any): any {
    const found = settings.find((s) => s.key === key);
    if (!found) return fallback;
    try {
      return JSON.parse(found.value);
    } catch {
      return fallback;
    }
  }

  private formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ──────────────────────────────────────────────────────────────────
  // CRON IDEMPOTENCY — DB-backed lock for multi-instance deployments
  //
  // Railway (and similar platforms) keep the old instance alive during
  // rolling deploys. Both old and new processes fire the same @Cron at
  // the same tick → duplicate messages.
  //
  // SystemSetting.@@unique([tenantId, key]) gives a free Postgres
  // advisory lock: the first INSERT wins (returns true); the concurrent
  // INSERT from the second instance hits a P2002 unique-constraint error
  // and returns false. The loser skips sending.
  // ──────────────────────────────────────────────────────────────────

  // Stable identifier for this process so logs can show WHICH instance won the lock.
  // Set once per process lifetime; survives multiple cron ticks.
  private readonly instanceTag =
    `${process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || 'local'}#${process.pid}`;

  /**
   * Tries to atomically acquire a per-job lock stored in SystemSetting.
   * Returns true  → this instance won the race, proceed with sending.
   * Returns false → another instance already sent, OR a transient DB error
   *                 occurred. Fail-closed: one missed notification is far
   *                 less harmful than duplicate spam to every employee.
   * Public: BriefingService (ai moduli) ham shu lock'dan foydalanadi.
   */
  async acquireCronLock(tenantId: string, lockKey: string): Promise<boolean> {
    try {
      await this.prisma.systemSetting.create({
        data: { tenantId, key: lockKey, value: `${new Date().toISOString()}|${this.instanceTag}` },
      });
      console.log(`[CronLock] ACQUIRED ${this.instanceTag} tenant=${tenantId} key=${lockKey}`);
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        console.log(`[CronLock] SKIPPED  ${this.instanceTag} tenant=${tenantId} key=${lockKey} (another instance held it)`);
        return false;
      }
      // Fail CLOSED on unknown errors. Original code failed open ("duplicate >
      // missed"), but in practice duplicates are far more user-hostile than a
      // single missed reminder — and a transient DB error tends to affect both
      // racing instances simultaneously, so failing open doubles the spam.
      console.error(`[CronLock] ERROR    ${this.instanceTag} tenant=${tenantId} key=${lockKey}:`, e?.message);
      return false;
    }
  }

  /**
   * Deletes cron lock rows older than 25 hours so SystemSetting doesn't grow unboundedly.
   * ISO-8601 strings sort lexicographically, so string `lt` comparison is correct.
   */
  private async cleanupCronLocks(tenantId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await this.prisma.systemSetting
      .deleteMany({ where: { tenantId, key: { startsWith: 'cron_lock:' }, value: { lt: cutoff } } })
      .catch(() => {});
  }

  /** Returns current moment represented as Asia/Tashkent (UTC+5) wall-clock values */
  private tashkentNow(): { utc5: Date; str: string; day: number; mins: number } {
    const utc5 = new Date(Date.now() + 5 * 60 * 60 * 1000);
    return {
      utc5,
      str: `${utc5.getUTCFullYear()}-${String(utc5.getUTCMonth() + 1).padStart(2, '0')}-${String(utc5.getUTCDate()).padStart(2, '0')}`,
      day: utc5.getUTCDay(),
      mins: utc5.getUTCHours() * 60 + utc5.getUTCMinutes(),
    };
  }

  // =============================================
  // DAVOMAT ESLATMALARI — har 5 daqiqada
  // Kelish: ish boshlanishiga ~10-14 daqiqa qolganida
  // Ketish: ish tugashiga ~10-14 daqiqa qolganida
  // =============================================
  @Cron('*/5 * * * *')
  async handleAttendanceReminders() {
    if (!this.bot) return;

    const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
    const { str: todayStr, day: todayDay, mins: currentMinutes } = this.tashkentNow();

    for (const t of tenants) {
      await this.cleanupCronLocks(t.id);
      try {
        const settings = await this.prisma.systemSetting.findMany({
          where: { tenantId: t.id, key: { in: ['workStart', 'workEnd', 'workDays'] } },
        });
        const workStart = this.parseSetting(settings, 'workStart', { hour: 9, minute: 0 });
        const workEnd   = this.parseSetting(settings, 'workEnd',   { hour: 17, minute: 0 });
        const workDays  = this.parseSetting(settings, 'workDays',  [1, 2, 3, 4, 5, 6]);

        if (!workDays.includes(todayDay)) continue;

        const workStartMins = workStart.hour * 60 + workStart.minute;
        const workEndMins   = workEnd.hour   * 60 + workEnd.minute;
        const diffToStart   = workStartMins - currentMinutes;
        const diffToEnd     = workEndMins   - currentMinutes;

        // ── Kelish eslatmasi: ish boshlanishiga 10–14 daqiqa qolganida ──
        // */5 cron bilan bu oyna bir marta ishga tushadi
        if (diffToStart >= 10 && diffToStart < 15) {
          const employees = await this.prisma.employee.findMany({
            where: { tenantId: t.id, telegramId: { not: null } },
          });
          for (const emp of employees) {
            if (!emp.telegramId) continue;
            // Bugun allaqachon kelgan bo'lsa — o'tkazib yuborish
            const alreadyIn = await this.prisma.attendanceRecord.findFirst({
              where: { tenantId: t.id, employeeId: emp.id, date: todayStr, checkIn: { not: null } },
            });
            if (alreadyIn) continue;
            // Multi-instance duplicate guard
            if (!await this.acquireCronLock(t.id, `cron_lock:att_kelish:${todayStr}:${emp.id}`)) continue;

            await this.sendMessage(
              emp.telegramId,
              `🌅 *Xayrli tong!*\n\n` +
              `⏰ Ish vaqti boshlanishiga *${diffToStart} daqiqa* qoldi.\n\n` +
              `📍 *Kelganingizni belgilashni unutmang!*\n` +
              `Platformaga kirib davomat tugmasini bosing.`,
            );
          }
        }

        // ── Kechikish eslatmasi: ish boshlanishidan 10 daqiqa o'tganda ──
        if (currentMinutes >= workStartMins + 10 && currentMinutes < workStartMins + 15) {
          const employees = await this.prisma.employee.findMany({
            where: { tenantId: t.id, telegramId: { not: null } },
          });
          for (const emp of employees) {
            if (!emp.telegramId) continue;

            // Bugun allaqachon kelgan bo'lsa — o'tkazib yuborish
            const alreadyIn = await this.prisma.attendanceRecord.findFirst({
              where: { tenantId: t.id, employeeId: emp.id, date: todayStr, checkIn: { not: null } },
            });
            if (alreadyIn) continue;

            // Bot session — xodim allaqachon bugun uchun prompt olganmi?
            const session = await this.prisma.botSession.findUnique({
              where: { chatId: emp.telegramId },
            });
            if (!session || (session as any).overtimePromptDate === todayStr) continue;
            // Multi-instance duplicate guard
            if (!await this.acquireCronLock(t.id, `cron_lock:att_kechik:${todayStr}:${emp.id}`)) continue;

            await this.sendMessage(
              emp.telegramId,
              `⚠️ *Davomat belgilamadingiz!*\n\n` +
              `Siz davomat qilmadingiz, iltimos davomat qiling yoki kech qolayotgan bo'lsangiz yoki bugun kelmaydigan bo'lsangiz sababini shu yerga yozing.`,
            );

            // Sessiyani xabar kutish holatiga o'tkazamiz
            await this.prisma.botSession.update({
              where: { chatId: emp.telegramId },
              data: {
                step: 'OVERTIME_AWAITING',
                overtimePromptDate: todayStr,
                overtimePromptedAt: new Date(),
              } as any,
            });
          }
        }

        // ── Ketish eslatmasi: ish tugashiga 10–14 daqiqa qolganida ──
        if (diffToEnd >= 10 && diffToEnd < 15) {
          // checkIn bor lekin checkOut yo'q bo'lgan xodimlar
          const uncheckedOut = await this.prisma.attendanceRecord.findMany({
            where: {
              tenantId: t.id,
              date: todayStr,
              checkIn: { not: null },
              checkOut: null,
            },
            include: { employee: true },
          });
          for (const rec of uncheckedOut) {
            if (!rec.employee?.telegramId) continue;
            // Multi-instance duplicate guard
            if (!await this.acquireCronLock(t.id, `cron_lock:att_ketish:${todayStr}:${rec.employee.id}`)) continue;

            await this.sendMessage(
              rec.employee.telegramId,
              `🌆 *Ish vaqti tugashiga yaqin!*\n\n` +
              `⏰ Ish vaqti tugashiga *${diffToEnd} daqiqa* qoldi.\n\n` +
              `🚪 *Ishdan ketganingizni belgilashni unutmang!*\n` +
              `Platformaga kirib davomat tugmasini bosing.`,
            );
          }
        }
      } catch (err: any) {
        console.error(`Davomat eslatmasi xatosi (tenant ${t.id}):`, err?.message);
      }
    }
  }

  @Cron('0 9 * * *')
  async handleLowStockAlert() {
    const { str: todayStr } = this.tashkentNow();
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
        if (!m.telegramId) continue;
        // Multi-instance duplicate guard
        if (!await this.acquireCronLock(t.id, `cron_lock:low_stock:${todayStr}:${m.id}`)) continue;
        await this.sendMessage(m.telegramId, message);
      }
    }
  }
}
