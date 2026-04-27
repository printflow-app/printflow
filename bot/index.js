const TelegramBot = require('node-telegram-bot-api');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token || token === 'SIZNING_BOT_TOKENINGIZ') {
  console.error('❌ XATO: .env faylida TELEGRAM_BOT_TOKEN o\'rnatilmagan!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// In-memory state tracking
const userStates = new Map();

// Sedentary Task Reminder (every hour)
setInterval(async () => {
  await checkInactiveTasks();
}, 60 * 60 * 1000);

async function checkInactiveTasks() {
  console.log('🔍 Inactive tasks tekshirilmoqda...');
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get all columns to find the last one (Done)
    const columns = await prisma.kanbanColumn.findMany({
      orderBy: { orderIdx: 'asc' }
    });
    if (columns.length === 0) return;
    const lastColumnId = columns[columns.length - 1].id;

    const inactiveTasks = await prisma.task.findMany({
      where: {
        updatedAt: { lt: twentyFourHoursAgo },
        columnId: { not: lastColumnId }
      },
      include: {
        column: true
      }
    });

    for (const task of inactiveTasks) {
      const assigneeIds = JSON.parse(task.assignees || "[]");
      if (assigneeIds.length === 0) continue;

      for (const empId of assigneeIds) {
        const employee = await prisma.employee.findUnique({ where: { id: empId } });
        if (employee && employee.telegramId) {
          const message = `⚠️ *DIQQAT: Vazifa turg'unligi*\n\n📌 *Vazifa:* ${task.title}\n⏳ *Holat:* 24 soatdan beri "${task.column.title}" bosqichida.\n\n_Ushbu vazifa bo'yicha jarayon qanday? Bajarildimi yoki keyingi bosqichga o'tkazish esdan chiqdimi?_`;
          bot.sendMessage(employee.telegramId, message, { parse_mode: 'Markdown' }).catch(e => console.error(`Bot message fail for ${empId}:`, e.message));
        }
      }
    }
  } catch (err) {
    console.error('Inactive check error:', err);
  }
}

console.log('🚀 Sharq Admin Bot ishga tushdi...');

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Assalomu alaykum! Sharq Admin botiga xush kelibsiz.\nTizimdan foydalanish uchun Login mas\'uliyatingizni kiriting:');
  userStates.set(chatId, { step: 'LOGIN' });
});

bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  const employee = await prisma.employee.findFirst({ where: { telegramId: chatId.toString() }, include: { role: true } });
  if (employee && employee.role?.name === 'Admin') {
    bot.sendMessage(chatId, '🔄 Qo\'lda tekshirish boshlandi...');
    await checkInactiveTasks();
    bot.sendMessage(chatId, '✅ Tekshirish yakunlandi.');
  }
});

bot.onText(/\/report/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const employee = await prisma.employee.findFirst({
      where: { telegramId: chatId.toString() },
      include: { role: true }
    });

    if (employee && employee.role && (employee.role.name === 'Admin' || employee.login === 'admin')) {
      const report = await generateReport('Hozirgi Holat');
      bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, '❌ Sizda hisobotlarni ko\'rish huquqi yo\'q.');
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const state = userStates.get(chatId);

  if (!state || !text || text.startsWith('/')) return;

  if (state.step === 'LOGIN') {
    state.login = text;
    state.step = 'PASSWORD';
    bot.sendMessage(chatId, 'Endi parolingizni kiriting:');
  } else if (state.step === 'PASSWORD') {
    try {
      const employee = await prisma.employee.findUnique({
        where: { login: state.login },
        include: { role: true }
      });

      if (employee && employee.password === text) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { telegramId: chatId.toString() }
        });
        bot.sendMessage(chatId, `✅ Muvaffaqiyatli bog'landi! Xush kelibsiz, ${employee.fullName}.\nEndi sizga barcha muhim xabarlar shu yerga kelib turadi.`);
        userStates.delete(chatId);
      } else {
        bot.sendMessage(chatId, '❌ Login yoki parol xato. Qaytadan /start bosing.');
        userStates.delete(chatId);
      }
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '❌ Tizimda xatolik. Keyinroq urinib ko\'ring.');
    }
  }
});

async function generateReport(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: today } }
  });

  const totalKirim = transactions.filter(t => t.type === 'kirim').reduce((sum, t) => sum + t.amount, 0);
  const totalChiqim = transactions.filter(t => t.type === 'chiqim').reduce((sum, t) => sum + t.amount, 0);
  const newTasks = await prisma.task.count({ where: { createdAt: { gte: today } } });

  return `📊 *Kunlik Hisobot (${period})*\n\n💰 *Jami Kirim:* ${totalKirim.toLocaleString()} UZS\n💸 *Jami Chiqim:* ${totalChiqim.toLocaleString()} UZS\n📈 *Foyda:* ${(totalKirim - totalChiqim).toLocaleString()} UZS\n\n📝 *Yangi topshiriqlar:* ${newTasks} ta\n\n_Sharq Admin avtomatik hisoboti_`;
}

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

