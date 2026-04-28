"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const schedule_1 = require("@nestjs/schedule");
const telegraf_1 = require("telegraf");
const bcrypt = require("bcrypt");
let TelegramService = class TelegramService {
    constructor(prisma) {
        this.prisma = prisma;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token && token !== 'your_bot_token_here') {
            this.bot = new telegraf_1.Telegraf(token);
            this.initializeBot();
        }
        else {
            console.warn('TELEGRAM_BOT_TOKEN not found. Bot is disabled.');
        }
    }
    async onModuleInit() {
        if (this.bot) {
            this.bot.launch().then(() => console.log('🚀 Telegram Bot ishga tushdi')).catch(err => console.error('Bot failed to launch', err));
        }
    }
    onModuleDestroy() {
        if (this.bot)
            this.bot.stop();
    }
    initializeBot() {
        this.bot.use(async (ctx, next) => {
            const chatId = ctx.chat?.id?.toString();
            if (!chatId)
                return next();
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
        this.bot.start(async (ctx) => {
            const chatId = ctx.chat.id.toString();
            const payload = ctx.startPayload;
            if (payload && payload.startsWith('workspace_')) {
                const slug = payload.replace('workspace_', '');
                const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
                if (!tenant || !tenant.isActive)
                    return ctx.reply('❌ Workspace topilmadi yoki faol emas.');
                const existing = await this.prisma.botSession.findUnique({ where: { chatId } });
                if (existing && existing.tenantId === tenant.id)
                    return ctx.reply(`✅ Siz allaqachon *${tenant.name}* workspacega ulangansiz.`, { parse_mode: 'Markdown' });
                await this.prisma.botSession.upsert({
                    where: { chatId },
                    update: { tenantId: tenant.id, step: 'LOGIN', employeeId: null, loginAttempt: null },
                    create: { chatId, tenantId: tenant.id, step: 'LOGIN' }
                });
                return ctx.reply(`🖨️ *PrintFlow — ${tenant.name}*\n\nTizimga kirish uchun loginingizni kiriting:`, { parse_mode: 'Markdown' });
            }
            if (ctx.tenantId)
                return ctx.reply(`✅ *${ctx.tenant.name}* ga ulangansiz.\n/report — Hisobot\n/check — Vazifalar`, { parse_mode: 'Markdown' });
            return ctx.reply('👋 Botga xush kelibsiz! Admin yuborgan havolani bosing.');
        });
        this.bot.command('report', async (ctx) => {
            if (!ctx.tenantId || !ctx.employeeId)
                return ctx.reply('❌ Avval ulaning va tizimga kiring.');
            const emp = await this.prisma.employee.findFirst({
                where: { id: ctx.employeeId, tenantId: ctx.tenantId },
                include: { role: true }
            });
            if (!emp || !emp.role?.canViewFinance)
                return ctx.reply("❌ Huquq yo'q.");
            const report = await this.generateReportForTenant(ctx.tenantId);
            return ctx.reply(report, { parse_mode: 'Markdown' });
        });
        this.bot.command('check', async (ctx) => {
            if (!ctx.tenantId || !ctx.employeeId)
                return ctx.reply('❌ Avval ulaning va tizimga kiring.');
            const emp = await this.prisma.employee.findFirst({
                where: { id: ctx.employeeId, tenantId: ctx.tenantId },
                include: { role: true }
            });
            if (!emp || !emp.role?.canViewTasks)
                return ctx.reply("❌ Huquq yo'q.");
            await ctx.reply('🔄 Tekshirilmoqda...');
            await this.checkInactiveTasks(ctx.tenantId);
            return ctx.reply('✅ Tekshirish yakunlandi.');
        });
        this.bot.on('text', async (ctx) => {
            const chatId = ctx.chat.id.toString();
            const text = ctx.message.text;
            if (!ctx.botSession || !ctx.tenantId)
                return;
            const { step } = ctx.botSession;
            if (step === 'LOGIN') {
                await this.prisma.botSession.update({
                    where: { chatId },
                    data: { loginAttempt: text, step: 'PASSWORD' }
                });
                return ctx.reply('🔐 Parolingizni kiriting:');
            }
            if (step === 'PASSWORD') {
                const emp = await this.prisma.employee.findFirst({
                    where: { login: ctx.botSession.loginAttempt, tenantId: ctx.tenantId }
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
                return ctx.reply('❌ Xato. Qaytadan login kiriting:');
            }
        });
    }
    async sendMessage(telegramId, text) {
        if (this.bot) {
            try {
                await this.bot.telegram.sendMessage(telegramId, text, { parse_mode: 'Markdown' });
            }
            catch (err) { }
        }
    }
    async sendNotification(employeeId, message) {
        const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (emp?.telegramId)
            await this.sendMessage(emp.telegramId, `🔔 *Yangi xabarnoma:*\n\n${message}`);
    }
    async notifyAdmins(message) {
        const admins = await this.prisma.employee.findMany({ where: { role: { name: 'Admin' } } });
        for (const admin of admins) {
            if (admin.telegramId)
                await this.sendMessage(admin.telegramId, `📢 *Admin xabarnomasi:*\n\n${message}`);
        }
    }
    async generateReportForTenant(tenantId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const txs = await this.prisma.transaction.findMany({ where: { tenantId, date: { gte: today } } });
        const kirim = txs.filter(t => t.type === 'kirim').reduce((s, t) => s + t.amount, 0);
        const chiqim = txs.filter(t => t.type === 'chiqim').reduce((s, t) => s + t.amount, 0);
        return `📊 *Kunlik Hisobot*\n💰 Kirim: ${kirim.toLocaleString()} UZS\n💸 Chiqim: ${chiqim.toLocaleString()} UZS\n📈 Foyda: ${(kirim - chiqim).toLocaleString()} UZS`;
    }
    async checkInactiveTasks(tenantId) {
        const cols = await this.prisma.kanbanColumn.findMany({ where: { tenantId }, orderBy: { orderIdx: 'asc' } });
        if (cols.length === 0)
            return;
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
    async handleDailyReport() {
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
        for (const t of tenants) {
            const report = await this.generateReportForTenant(t.id);
            const admins = await this.prisma.employee.findMany({
                where: { tenantId: t.id, role: { canViewFinance: true } }
            });
            for (const admin of admins) {
                if (admin.telegramId)
                    await this.sendMessage(admin.telegramId, report);
            }
        }
    }
    async handleHourlyTaskCheck() {
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true } });
        for (const t of tenants) {
            await this.checkInactiveTasks(t.id);
        }
    }
};
exports.TelegramService = TelegramService;
__decorate([
    (0, schedule_1.Cron)('0 21 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TelegramService.prototype, "handleDailyReport", null);
__decorate([
    (0, schedule_1.Cron)('0 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TelegramService.prototype, "handleHourlyTaskCheck", null);
exports.TelegramService = TelegramService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map