import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';

// =============================================
// SUPPORT BOT — Mijozdan super-adminga xabar
//
// Oqim:
//   /start → "📨 Xabar yuborish" tugma
//   → COLLECTING holati: user istagancha matn / ovoz / rasm / video yuboradi
//   → "✅ Yuborish" inline tugma → har bir xabar copyMessage orqali
//     SUPPORT_BOT_ADMIN_CHAT_IDS dagi har bir adminga forward qilinadi.
//
// Holatlar in-memory Map'da saqlanadi — restart drafts'ni yo'qotadi (5-30 sekundli
// interaktiv flow uchun bu yetarli; DB schema o'zgartirishni talab qilmaydi).
// =============================================

type DraftItem = { fromChatId: number; messageId: number };
type UserInfo = {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  isBot?: boolean;
  bio?: string;
};
type Session = {
  state: 'IDLE' | 'COLLECTING';
  items: DraftItem[];
  user: UserInfo;
};

const BTN_SEND_FLOW = '📨 Xabar yuborish';
const BTN_HELP = 'ℹ️ Yordam';
const CB_START_COLLECT = 'sb:start_collect';
const CB_SEND_ALL = 'sb:send_all';
const CB_CANCEL = 'sb:cancel';

@Injectable()
export class SupportBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SupportBotService.name);
  private bot?: Telegraf;
  private readonly sessions = new Map<number, Session>();
  private adminChatIds: number[] = [];

  async onModuleInit() {
    const token = process.env.SUPPORT_BOT_TOKEN;
    if (!token) {
      this.logger.warn('SUPPORT_BOT_TOKEN topilmadi — Support bot o\'chirilgan.');
      return;
    }

    this.adminChatIds = this.parseAdminIds(process.env.SUPPORT_BOT_ADMIN_CHAT_IDS);
    if (!this.adminChatIds.length) {
      this.logger.warn(
        'SUPPORT_BOT_ADMIN_CHAT_IDS bo\'sh. Bot ishlaydi, lekin xabarlar yetkazilmaydi. ' +
        'Super-admin /myid komandasi bilan o\'z chat ID\'sini olib, env\'ga qo\'shsin.',
      );
    }

    this.bot = new Telegraf(token);
    this.registerHandlers();

    this.bot.catch((err: any) => {
      this.logger.error('Support bot handler xatosi: ' + (err?.message || err));
    });

    // Webhook'siz polling rejimi — boshqa bot bilan port konflikti yo'q (telegraf
    // har bot uchun alohida long-poll connection oladi).
    try {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
      this.bot.launch({ dropPendingUpdates: true }).catch((err) => {
        this.logger.error('Support bot ishga tushmadi: ' + (err?.message || err));
      });
      this.logger.log('🚀 Support bot polling boshlandi');
    } catch (e: any) {
      this.logger.error('Support bot launch xato: ' + (e?.message || e));
    }
  }

  onModuleDestroy() {
    if (this.bot) {
      try { this.bot.stop(); } catch {}
    }
  }

  private parseAdminIds(raw?: string): number[] {
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n !== 0);
  }

  private extractUser(ctx: any): UserInfo {
    const from = ctx.from || {};
    return {
      id: from.id ?? ctx.chat?.id,
      firstName: from.first_name,
      lastName: from.last_name,
      username: from.username,
      languageCode: from.language_code,
      isPremium: from.is_premium,
      isBot: from.is_bot,
    };
  }

  private getSession(ctx: any): Session {
    const chatId = ctx.chat?.id as number;
    let s = this.sessions.get(chatId);
    if (!s) {
      s = { state: 'IDLE', items: [], user: this.extractUser(ctx) };
      this.sessions.set(chatId, s);
    } else {
      // Username/ism o'zgargan bo'lishi mumkin — har update'da yangilab turamiz
      const fresh = this.extractUser(ctx);
      s.user = { ...s.user, ...fresh };
    }
    return s;
  }

  /** Bio va boshqa profil maydonlarini Telegram API'dan tortib oladi (best-effort). */
  private async enrichUserFromTelegram(chatId: number, user: UserInfo): Promise<void> {
    if (!this.bot) return;
    try {
      const chat: any = await this.bot.telegram.getChat(chatId);
      if (chat?.bio) user.bio = chat.bio;
      if (!user.firstName && chat?.first_name) user.firstName = chat.first_name;
      if (!user.lastName && chat?.last_name) user.lastName = chat.last_name;
      if (!user.username && chat?.username) user.username = chat.username;
    } catch (err: any) {
      // getChat ba'zan rate-limit yoki access muammosi beradi — header bezovta bo'lmasin
      this.logger.warn(`getChat muvaffaqiyatsiz (chat=${chatId}): ${err?.message}`);
    }
  }

  private mainKeyboard() {
    return Markup.keyboard([[BTN_SEND_FLOW], [BTN_HELP]]).resize();
  }

  private composingKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yuborish', CB_SEND_ALL)],
      [Markup.button.callback('❌ Bekor qilish', CB_CANCEL)],
    ]);
  }

  private registerHandlers() {
    if (!this.bot) return;

    // /myid — har qanday chat'da ishlaydi (private + group + supergroup + channel)
    // chunki guruh chat ID ham super-admin uchun kerak.
    this.bot.command('myid', async (ctx: any) => {
      const t = ctx.chat?.type;
      const isPrivate = t === 'private';
      const label = isPrivate
        ? 'Sizning chat ID'
        : `Guruh chat ID (${ctx.chat?.title || t})`;
      await ctx.reply(
        `🆔 ${label}: \`${ctx.chat.id}\`\n\n` +
        (isPrivate
          ? 'Super-admin bo\'lsangiz, bu raqamni `SUPPORT_BOT_ADMIN_CHAT_IDS` env o\'zgaruvchisiga qo\'shing.'
          : 'Murojaatlar shu guruhga kelishi uchun bu raqamni `SUPPORT_BOT_ADMIN_CHAT_IDS` env o\'zgaruvchisiga qo\'shing.\n\n' +
            '_Eslatma: bot manfiy raqamni qaytaradi (masalan: -1001234567890) — bu normal._'),
        { parse_mode: 'Markdown' },
      );
    });

    // Quyidagi handlerlar faqat private chat'larda ishlaydi — guruhda spam bo'lmasin
    this.bot.use(async (ctx: any, next) => {
      // Callback query (inline tugma) va /myid komandasi har joyda ishlaydi
      // Boshqa hammasi — faqat private
      if (ctx.chat?.type === 'private') return next();
      // Guruhda kelgan boshqa xabarlar/komandalarni jim o'tkazib yuboramiz
      return;
    });

    this.bot.start(async (ctx: any) => {
      this.getSession(ctx);
      await ctx.reply(
        '👋 *Xush kelibsiz!*\n\n' +
        'Bu — PrintFlow qo\'llab-quvvatlash boti. ' +
        'Murojaatingizni yuborish uchun pastdagi *📨 Xabar yuborish* tugmasini bosing.\n\n' +
        'Matn, ovozli xabar, rasm va video yuborishingiz mumkin.',
        { parse_mode: 'Markdown', ...this.mainKeyboard() },
      );
    });

    this.bot.command('cancel', async (ctx: any) => {
      const s = this.getSession(ctx);
      s.state = 'IDLE';
      s.items = [];
      await ctx.reply('❌ Bekor qilindi.', this.mainKeyboard());
    });

    this.bot.hears(BTN_HELP, async (ctx: any) => {
      await ctx.reply(
        'ℹ️ *Yordam*\n\n' +
        '1. *📨 Xabar yuborish* tugmasini bosing.\n' +
        '2. Murojaatingizni yozing yoki ovozli/rasm/video sifatida yuboring (bir nechta xabar bo\'lishi mumkin).\n' +
        '3. Tayyor bo\'lganingizda *✅ Yuborish* tugmasini bosing — barcha xabarlaringiz adminga bir to\'plamda yetkaziladi.',
        { parse_mode: 'Markdown', ...this.mainKeyboard() },
      );
    });

    this.bot.hears(BTN_SEND_FLOW, async (ctx: any) => {
      await this.startCollecting(ctx);
    });

    this.bot.action(CB_START_COLLECT, async (ctx: any) => {
      await ctx.answerCbQuery();
      await this.startCollecting(ctx);
    });

    this.bot.action(CB_SEND_ALL, async (ctx: any) => {
      await ctx.answerCbQuery();
      await this.sendAll(ctx);
    });

    this.bot.action(CB_CANCEL, async (ctx: any) => {
      await ctx.answerCbQuery();
      const s = this.getSession(ctx);
      s.state = 'IDLE';
      s.items = [];
      await ctx.reply('❌ Murojaat bekor qilindi.', this.mainKeyboard());
    });

    // Har qanday xabar turi (matn / rasm / ovoz / video / hujjat / sticker / ...)
    // COLLECTING holatida draft'ga qo'shiladi.
    this.bot.on('message', async (ctx: any, next) => {
      const text = ctx.message?.text as string | undefined;
      if (text && text.startsWith('/')) return next();
      if (text === BTN_SEND_FLOW || text === BTN_HELP) return next();

      const s = this.getSession(ctx);
      if (s.state !== 'COLLECTING') {
        await ctx.reply(
          'Murojaat yuborish uchun avval *📨 Xabar yuborish* tugmasini bosing.',
          { parse_mode: 'Markdown', ...this.mainKeyboard() },
        );
        return;
      }

      s.items.push({ fromChatId: ctx.chat.id, messageId: ctx.message.message_id });
      // Har xabarga javob qaytarmaymiz — spam bo'lmasin. Yig'ish tasdig'i
      // startCollecting'da berildi, yakuniy tasdiq sendAll'da bo'ladi.
    });
  }

  private async startCollecting(ctx: any) {
    const s = this.getSession(ctx);
    s.state = 'COLLECTING';
    s.items = [];
    await ctx.reply(
      '📝 *Murojaatingizni yozing.*\n\n' +
      'Bir nechta xabar yuborishingiz mumkin — matn, ovozli xabar, rasm, video — istalgan format.\n\n' +
      'Tayyor bo\'lganingizda quyidagi *✅ Yuborish* tugmasini bosing.',
      { parse_mode: 'Markdown', ...this.composingKeyboard() },
    );
  }

  private formatUserHeader(s: Session, total: number): string {
    const u = s.user;
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Noma\'lum';
    const contact = u.username ? `@${u.username}` : `[Direkt chat](tg://user?id=${u.id})`;

    const lines: string[] = [
      '📨 *Yangi qo\'llab-quvvatlash murojaati*',
      '',
      `👤 *Ism familiya:* ${this.escapeMd(fullName)}`,
    ];
    if (u.firstName) lines.push(`• Ism: ${this.escapeMd(u.firstName)}`);
    if (u.lastName) lines.push(`• Familiya: ${this.escapeMd(u.lastName)}`);
    lines.push(`🔗 *Username:* ${u.username ? '@' + u.username : '—'}`);
    lines.push(`💬 *Kontakt:* ${contact}`);
    lines.push(`🆔 *Telegram ID:* \`${u.id}\``);
    if (u.languageCode) lines.push(`🌐 *Til:* ${u.languageCode}`);
    if (u.isPremium) lines.push('⭐ *Premium:* ha');
    if (u.isBot) lines.push('🤖 *Bot:* ha');
    if (u.bio) lines.push(`📝 *Bio:* ${this.escapeMd(u.bio)}`);
    lines.push(`📦 *Xabarlar soni:* ${total}`);
    lines.push('');
    lines.push('⤵️ Quyida murojaat mazmuni:');

    return lines.join('\n');
  }

  private escapeMd(s: string): string {
    return s.replace(/([_*`\[\]])/g, '\\$1');
  }

  private async sendAll(ctx: any) {
    if (!this.bot) return;
    const s = this.getSession(ctx);

    if (s.state !== 'COLLECTING') {
      await ctx.reply('Hech qanday faol murojaat yo\'q. *📨 Xabar yuborish* tugmasini bosing.', {
        parse_mode: 'Markdown',
        ...this.mainKeyboard(),
      });
      return;
    }
    if (!s.items.length) {
      await ctx.reply('⚠️ Siz hali hech qanday xabar yubormadingiz. Avval murojaatingizni yozing yoki bekor qiling.');
      return;
    }
    if (!this.adminChatIds.length) {
      this.logger.error('Murojaat keldi, lekin SUPPORT_BOT_ADMIN_CHAT_IDS sozlanmagan.');
      await ctx.reply('❌ Hozircha xizmat sozlanmagan. Iltimos, keyinroq urinib ko\'ring.');
      s.state = 'IDLE';
      s.items = [];
      return;
    }

    const fromChatId = ctx.chat.id;
    // Telegram'dan qo'shimcha ochiq ma'lumotlarni tortib olamiz (bio va h.k.)
    await this.enrichUserFromTelegram(fromChatId, s.user);
    const header = this.formatUserHeader(s, s.items.length);
    let successAdmins = 0;
    let failed = 0;

    for (const adminId of this.adminChatIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, header, { parse_mode: 'Markdown' });
        for (const item of s.items) {
          try {
            await this.bot.telegram.copyMessage(adminId, fromChatId, item.messageId);
          } catch (err: any) {
            failed++;
            this.logger.warn(
              `copyMessage muvaffaqiyatsiz (admin=${adminId}, msg=${item.messageId}): ${err?.message}`,
            );
          }
        }
        await this.bot.telegram.sendMessage(adminId, '— — — — — — — — — —').catch(() => {});
        successAdmins++;
      } catch (err: any) {
        failed++;
        this.logger.warn(`Admin ${adminId}'ga yuborilmadi: ${err?.message}`);
      }
    }

    s.state = 'IDLE';
    s.items = [];

    if (successAdmins > 0) {
      await ctx.reply(
        '✅ *Murojaatingiz yuborildi!*\n\n' +
        'Rahmat. Tez orada siz bilan bog\'lanamiz.',
        { parse_mode: 'Markdown', ...this.mainKeyboard() },
      );
    } else {
      await ctx.reply(
        '❌ Afsuski, hozir xabarni yetkazib bo\'lmadi. Iltimos, keyinroq urinib ko\'ring.',
        this.mainKeyboard(),
      );
    }
  }
}
