/**
 * PrintFlow Telegram Bot — Multi-Tenant (Telegraf.js)
 * 
 * Asosiy xususiyatlar:
 * - Deep link orqali workspace onboarding: /start workspace_SLUG
 * - BotSession: chatId → tenantId bog'lanishi
 * - Har bir xabar avtomatik tenant kontekstida ishlaydi
 * - bcrypt bilan xavfsiz parol tekshirish
 * - Har soatda vazifa turg'unlik tekshiruvi (tenant-scoped)
 */

const { Telegraf, Markup } = require('telegraf');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'your_bot_token_here') {
  console.error('❌ TELEGRAM_BOT_TOKEN .env faylida o\'rnatilmagan!');
  process.exit(1);
}

const bot = new Telegraf(token);

// =============================================
// MIDDLEWARE 1: Tenant Resolution
// chatId → BotSession → tenantId
// =============================================
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) return next();

  const session = await prisma.botSession.findUnique({
    where: { chatId },
    include: { tenant: true },
  });

  if (session && session.tenant) {
    ctx.tenantId = session.tenantId;
    ctx.tenant = session.tenant;
    ctx.botSession = session;
    ctx.employeeId = session.employeeId || null;
  }

  return next();
});

// =============================================
// /start — Workspace onboarding via deep link
// Format: /start workspace_TENANT_SLUG
// =============================================
bot.start(async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const payload = ctx.startPayload; // text after /start

  // Deep link: /start workspace_demo
  if (payload && payload.startsWith('workspace_')) {
    const slug = payload.replace('workspace_', '');

    const tenant = await prisma.tenant.findUnique({ where: { slug } });

    if (!tenant || !tenant.isActive) {
      return ctx.reply(
        '❌ *Workspace topilmadi yoki faol emas.*\n\nIltimos, administratoringiz bilan bog\'laning.',
        { parse_mode: 'Markdown' },
      );
    }

    // Check if already linked to this tenant
    const existing = await prisma.botSession.findUnique({ where: { chatId } });
    if (existing && existing.tenantId === tenant.id) {
      return ctx.reply(
        `✅ Siz allaqachon *${tenant.name}* workspacega ulangansiz.\n\nHisobot uchun /report, tekshirish uchun /check buyrug'ini ishlating.`,
        { parse_mode: 'Markdown' },
      );
    }

    // Create or update BotSession with tenant (step = LOGIN)
    await prisma.botSession.upsert({
      where: { chatId },
      update: { tenantId: tenant.id, step: 'LOGIN', employeeId: null, loginAttempt: null },
      create: { chatId, tenantId: tenant.id, step: 'LOGIN' },
    });

    return ctx.reply(
      `🖨️ *PrintFlow — ${tenant.name}*\n\nWorkspace tanlandi! Tizimga kirish uchun loginингizni kiriting:`,
      { parse_mode: 'Markdown' },
    );
  }

  // No deep link — show instructions
  if (ctx.tenantId) {
    // Already connected
    return ctx.reply(
      `✅ *${ctx.tenant.name}* workspacega ulangansiz.\n\n/report — Kunlik hisobot\n/check — Vazifalarni tekshirish`,
      { parse_mode: 'Markdown' },
    );
  }

  return ctx.reply(
    '👋 *PrintFlow Botiga xush kelibsiz!*\n\nBotdan foydalanish uchun admin sizga maxsus havola yuboradi.\n\nAgar havola yo\'q bo\'lsa, administratoringiz bilan bog\'laning.',
    { parse_mode: 'Markdown' },
  );
});

// =============================================
// /report — Kunlik hisobot (Admin only, tenant-scoped)
// =============================================
bot.command('report', async (ctx) => {
  if (!ctx.tenantId) {
    return ctx.reply('❌ Avval workspace\'ga ulaning. Admin havolasidan foydalaning.');
  }

  if (!ctx.employeeId) {
    return ctx.reply('❌ Tizimga kirishingiz kerak. /start buyrug\'ini qayta ishlating.');
  }

  try {
    const employee = await prisma.employee.findFirst({
      where: { id: ctx.employeeId, tenantId: ctx.tenantId },
      include: { role: true },
    });

    if (!employee || !employee.role?.canViewFinance) {
      return ctx.reply('❌ Hisobot ko\'rish huquqi yo\'q.');
    }

    const report = await generateReport(ctx.tenantId);
    return ctx.reply(report, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Report error:', err);
    return ctx.reply('❌ Hisobot olishda xatolik.');
  }
});

// =============================================
// /check — Turg'un vazifalarni tekshirish (manual trigger)
// =============================================
bot.command('check', async (ctx) => {
  if (!ctx.tenantId || !ctx.employeeId) {
    return ctx.reply('❌ Avval workspace\'ga ulaning.');
  }

  const employee = await prisma.employee.findFirst({
    where: { id: ctx.employeeId, tenantId: ctx.tenantId },
    include: { role: true },
  });

  if (!employee || !employee.role?.canViewTasks) {
    return ctx.reply('❌ Vazifalarni ko\'rish huquqi yo\'q.');
  }

  await ctx.reply('🔄 Tekshirilmoqda...');
  await checkInactiveTasks(ctx.tenantId);
  return ctx.reply('✅ Tekshirish yakunlandi.');
});

// =============================================
// TEXT MESSAGES — Login flow state machine
// =============================================
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id.toString();
  const text = ctx.message.text;

  if (!ctx.botSession || !ctx.tenantId) {
    return; // No session — ignore
  }

  const { step } = ctx.botSession;

  // Step 1: Waiting for login
  if (step === 'LOGIN') {
    await prisma.botSession.update({
      where: { chatId },
      data: { loginAttempt: text, step: 'PASSWORD' },
    });
    return ctx.reply('🔐 Parolingizni kiriting:');
  }

  // Step 2: Waiting for password
  if (step === 'PASSWORD') {
    const loginAttempt = ctx.botSession.loginAttempt;

    const employee = await prisma.employee.findFirst({
      where: { login: loginAttempt, tenantId: ctx.tenantId },
      include: { role: true },
    });

    if (employee && await bcrypt.compare(text, employee.passwordHash)) {
      // ✅ Authentication successful
      await prisma.botSession.update({
        where: { chatId },
        data: { employeeId: employee.id, step: 'IDLE', loginAttempt: null },
      });

      // Link telegram ID to employee record
      await prisma.employee.update({
        where: { id: employee.id },
        data: { telegramId: chatId },
      });

      return ctx.reply(
        `✅ *Muvaffaqiyatli kirildi!*\n\nXush kelibsiz, *${employee.fullName}*!\n🏢 Workspace: *${ctx.tenant.name}*\n\nEndi muhim xabarlar shu yerga keladi.\n\n/report — Hisobot\n/check — Vazifalar`,
        { parse_mode: 'Markdown' },
      );
    } else {
      // ❌ Wrong credentials — reset to LOGIN step
      await prisma.botSession.update({
        where: { chatId },
        data: { step: 'LOGIN', loginAttempt: null },
      });

      return ctx.reply(
        "❌ Login yoki parol xato.\nQaytadan loginингizni kiriting:",
      );
    }
  }
});

// =============================================
// SCHEDULED: Har soatda turg'un vazifalarni tekshirish
// =============================================
setInterval(async () => {
  console.log('🔍 Turg\'un vazifalar tekshirilmoqda...');
  try {
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
    });

    for (const tenant of tenants) {
      await checkInactiveTasks(tenant.id);
    }
  } catch (err) {
    console.error('Scheduled check error:', err);
  }
}, 60 * 60 * 1000);

// =============================================
// HELPER: Turg'un vazifalar tekshiruvi (tenant-scoped)
// =============================================
async function checkInactiveTasks(tenantId) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Eng oxirgi ustunni topamiz (Done/Yetkazildi)
  const columns = await prisma.kanbanColumn.findMany({
    where: { tenantId },
    orderBy: { orderIdx: 'asc' },
  });
  if (columns.length === 0) return;
  const lastColumnId = columns[columns.length - 1].id;

  const inactiveTasks = await prisma.task.findMany({
    where: {
      tenantId,
      updatedAt: { lt: twentyFourHoursAgo },
      columnId: { not: lastColumnId },
    },
    include: { column: true },
  });

  for (const task of inactiveTasks) {
    const assigneeIds = JSON.parse(task.assignees || '[]');
    if (assigneeIds.length === 0) continue;

    for (const empId of assigneeIds) {
      const employee = await prisma.employee.findFirst({
        where: { id: empId, tenantId },
      });

      if (employee?.telegramId) {
        const message =
          `⚠️ *DIQQAT: Vazifa turg'unligi*\n\n` +
          `📌 *Vazifa:* ${task.title}\n` +
          `⏳ *Holat:* 24 soatdan beri "${task.column.title}" bosqichida.\n\n` +
          `_Ushbu vazifa bo'yicha jarayon qanday?_`;

        await bot.telegram
          .sendMessage(employee.telegramId, message, { parse_mode: 'Markdown' })
          .catch((e) => console.error(`Bot xabar yuborishda xato (${empId}):`, e.message));
      }
    }
  }
}

// =============================================
// HELPER: Kunlik hisobot generatsiyasi
// =============================================
async function generateReport(tenantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [transactions, newTasks, activeTasks] = await Promise.all([
    prisma.transaction.findMany({ where: { tenantId, date: { gte: today } } }),
    prisma.task.count({ where: { tenantId, createdAt: { gte: today } } }),
    prisma.task.count({ where: { tenantId } }),
  ]);

  const totalKirim = transactions
    .filter((t) => t.type === 'kirim')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalChiqim = transactions
    .filter((t) => t.type === 'chiqim')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    `📊 *Kunlik Hisobot*\n\n` +
    `💰 *Jami Kirim:* ${totalKirim.toLocaleString()} UZS\n` +
    `💸 *Jami Chiqim:* ${totalChiqim.toLocaleString()} UZS\n` +
    `📈 *Foyda:* ${(totalKirim - totalChiqim).toLocaleString()} UZS\n\n` +
    `📝 *Yangi topshiriqlar:* ${newTasks} ta\n` +
    `📋 *Jami faol topshiriqlar:* ${activeTasks} ta\n\n` +
    `_PrintFlow avtomatik hisoboti_`
  );
}

// =============================================
// ERROR HANDLING
// =============================================
bot.catch((err, ctx) => {
  console.error(`Bot xatosi (${ctx.updateType}):`, err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// =============================================
// LAUNCH
// =============================================
bot.launch().then(() => {
  console.log('🚀 PrintFlow Bot ishga tushdi (Telegraf.js)');
  console.log('📋 Deep link format: https://t.me/BotUsername?start=workspace_SLUG');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
