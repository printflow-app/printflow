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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../prisma/prisma.service");
const telegram_service_1 = require("../telegram/telegram.service");
let TasksService = class TasksService {
    constructor(prisma, telegramService) {
        this.prisma = prisma;
        this.telegramService = telegramService;
    }
    async findAll() {
        return this.prisma.task.findMany({
            include: {
                column: true,
                customer: true,
                paymentType: true,
                histories: { include: { employee: true }, orderBy: { createdAt: 'desc' } }
            },
        });
    }
    async findOne(id) {
        return this.prisma.task.findUnique({
            where: { id },
            include: {
                column: true,
                customer: true,
                paymentType: true,
                histories: { include: { employee: true }, orderBy: { createdAt: 'desc' } }
            },
        });
    }
    async create(data, employeeId) {
        const { orderName, title, description, customerId, customerName, customerPhone, totalAmount, depositAmount, paymentTypeId, columnId, assignees, attachments, deadlineAt } = data;
        const remainingAmount = Math.max(0, Math.round(Number(totalAmount || 0) - Number(depositAmount || 0)));
        const task = await this.prisma.$transaction(async (tx) => {
            let finalCustomerId = customerId;
            if (!finalCustomerId && customerName) {
                let customer = await tx.customer.findFirst({ where: { name: customerName } });
                if (!customer) {
                    customer = await tx.customer.create({
                        data: { name: customerName, phone: customerPhone }
                    });
                }
                finalCustomerId = customer.id;
            }
            const createdTask = await tx.task.create({
                data: {
                    orderName,
                    title,
                    description,
                    customerId: finalCustomerId,
                    customerName,
                    customerPhone,
                    totalAmount: Number(totalAmount || 0),
                    depositAmount: Number(depositAmount || 0),
                    remainingAmount,
                    paymentTypeId,
                    columnId,
                    assignees: assignees || "[]",
                    attachments: attachments || "[]",
                    serviceId: data.serviceId,
                    quantity: Number(data.quantity || 1),
                    coefficient: Number(data.coefficient || 1.0),
                    deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
                }
            });
            if (data.serviceId) {
                await this.reserveStock(tx, createdTask.id, data.serviceId, Number(data.quantity || 1));
            }
            if (finalCustomerId) {
                await tx.customer.update({
                    where: { id: finalCustomerId },
                    data: {
                        totalDebt: { increment: Number(totalAmount || 0) },
                        totalPaid: { increment: Number(depositAmount || 0) }
                    }
                });
            }
            if (Number(depositAmount || 0) > 0) {
                await tx.transaction.create({
                    data: {
                        type: 'kirim',
                        amount: Number(depositAmount),
                        paymentTypeId,
                        customerId: finalCustomerId,
                        taskId: createdTask.id,
                        serviceType: title
                    }
                });
            }
            await tx.taskHistory.create({
                data: {
                    taskId: createdTask.id,
                    employeeId: employeeId === 'admin' ? null : employeeId,
                    action: 'yaratildi',
                    details: `Buyurtma yaratildi. Summa: ${totalAmount}, Zakolat: ${depositAmount}`
                }
            });
            return createdTask;
        });
        this.notifyAssignees(task, '🆕 Yangi topshiriq');
        return task;
    }
    async createBulk(data, employeeId) {
        const { orderName, items, customerId, customerName, customerPhone, totalDeposit, paymentTypeId, columnId, justification, assigneeIds, deadlineAt } = data;
        const totalDepositNum = Math.round(Number(totalDeposit || 0));
        const perTaskDepositFloor = Math.floor(totalDepositNum / items.length);
        const remainder = totalDepositNum % items.length;
        const tasks = await this.prisma.$transaction(async (tx) => {
            let finalCustomerId = customerId;
            if (!finalCustomerId && customerName) {
                let customer = await tx.customer.findFirst({ where: { name: customerName } });
                if (!customer) {
                    customer = await tx.customer.create({
                        data: { name: customerName, phone: customerPhone }
                    });
                }
                finalCustomerId = customer.id;
            }
            const createdTasks = [];
            let totalOrderAmount = 0;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const { title, description, totalAmount, serviceId, serviceOptions, quantity, coefficient } = item;
                totalOrderAmount += Number(totalAmount || 0);
                const depositForThisTask = (i === items.length - 1)
                    ? (perTaskDepositFloor + remainder)
                    : perTaskDepositFloor;
                const task = await tx.task.create({
                    data: {
                        orderName,
                        title,
                        description,
                        customerId: finalCustomerId,
                        customerName,
                        customerPhone,
                        totalAmount: Number(totalAmount || 0),
                        depositAmount: depositForThisTask,
                        remainingAmount: Math.max(0, Math.round(Number(totalAmount || 0) - depositForThisTask)),
                        paymentTypeId,
                        columnId,
                        serviceId,
                        serviceOptions: JSON.stringify(serviceOptions || []),
                        quantity: Number(quantity || 1),
                        coefficient: Number(coefficient || 1.0),
                        assignees: JSON.stringify(assigneeIds || []),
                        attachments: "[]",
                        deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
                    }
                });
                if (serviceId) {
                    await this.reserveStock(tx, task.id, serviceId, Number(quantity || 1));
                }
                await tx.taskHistory.create({
                    data: {
                        taskId: task.id,
                        employeeId: employeeId === 'admin' ? null : employeeId,
                        action: 'yaratildi',
                        details: `Buyurtma (bulk) yaratildi. Summa: ${totalAmount}, Zakolat: ${depositForThisTask}`,
                        note: justification
                    }
                });
                createdTasks.push(task);
            }
            if (finalCustomerId) {
                await tx.customer.update({
                    where: { id: finalCustomerId },
                    data: {
                        totalDebt: { increment: totalOrderAmount },
                        totalPaid: { increment: Number(totalDeposit || 0) }
                    }
                });
            }
            if (Number(totalDeposit || 0) > 0) {
                await tx.transaction.create({
                    data: {
                        type: 'kirim',
                        amount: Number(totalDeposit),
                        paymentTypeId,
                        customerId: finalCustomerId,
                        taskId: createdTasks[0].id,
                        serviceType: items.length > 1 ? `${items[0].title} (+${items.length - 1} ta)` : items[0].title
                    }
                });
            }
            return createdTasks;
        });
        for (const t of tasks) {
            this.notifyAssignees(t, '🆕 Yangi topshiriq (Guruhli)');
        }
        return tasks;
    }
    async update(id, data, employeeId) {
        const oldTask = await this.prisma.task.findUnique({ where: { id } });
        if (!oldTask)
            throw new Error('Task topilmadi');
        const { historyNote, ...taskData } = data;
        const updatedTask = await this.prisma.$transaction(async (tx) => {
            const task = await tx.task.update({
                where: { id },
                data: {
                    ...taskData,
                    remainingAmount: (taskData.totalAmount !== undefined || taskData.depositAmount !== undefined)
                        ? (Number(taskData.totalAmount ?? oldTask.totalAmount) - Number(taskData.depositAmount ?? oldTask.depositAmount))
                        : undefined
                }
            });
            if (taskData.columnId && taskData.columnId !== oldTask.columnId) {
                const oldCol = await tx.kanbanColumn.findUnique({ where: { id: oldTask.columnId } });
                const newCol = await tx.kanbanColumn.findUnique({ where: { id: taskData.columnId } });
                await tx.taskHistory.create({
                    data: {
                        taskId: id,
                        employeeId: employeeId === 'admin' ? null : employeeId,
                        action: 'ko\'chirildi',
                        details: `Bosqich o'zgardi: ${oldCol?.title} -> ${newCol?.title}`,
                        note: historyNote
                    }
                });
                const finishedKeywords = ['tayyor', 'topshirildi', 'yakunlandi', 'bajarildi'];
                const isFinished = finishedKeywords.some(k => newCol?.title?.toLowerCase().includes(k));
                if (isFinished && oldTask.serviceId) {
                    await this.deductStock(tx, id);
                }
            }
            else if (data.title || data.description) {
                await tx.taskHistory.create({
                    data: {
                        taskId: id,
                        employeeId: employeeId === 'admin' ? null : employeeId,
                        action: 'o\'zgartirildi',
                        details: 'Ma\'lumotlar yangilandi'
                    }
                });
            }
            return task;
        });
        if (data.assignees && data.assignees !== oldTask.assignees) {
            this.notifyAssignees(updatedTask, '👥 Sizga topshiriq biriktirildi');
        }
        else if (data.columnId && data.columnId !== oldTask.columnId) {
            this.notifyAssignees(updatedTask, '🚚 Topshiriq bosqichi o\'zgardi');
        }
        return updatedTask;
    }
    async notifyAssignees(task, prefix) {
        try {
            const assigneeIds = JSON.parse(task.assignees || "[]");
            const message = `*${prefix}*\n\n📌 *Nomi:* ${task.title}\n📝 *Tafsilot:* ${task.description || '-'}\n💰 *Summa:* ${task.totalAmount} UZS\n\nIltimos, platformaga kirib batafsil ko'ring.`;
            for (const empId of assigneeIds) {
                await this.telegramService.sendNotification(empId, message);
            }
        }
        catch (e) {
            console.error('Notification error:', e);
        }
    }
    async logView(id, employeeId) {
        return this.prisma.taskHistory.create({
            data: {
                taskId: id,
                employeeId: employeeId === 'admin' ? null : employeeId,
                action: 'ko\'rildi',
                details: 'Topshiriq tafsilotlari ko\'rildi'
            }
        });
    }
    async remove(id) {
        return this.prisma.task.delete({ where: { id } });
    }
    async getColumns() {
        return this.prisma.kanbanColumn.findMany({
            orderBy: { orderIdx: 'asc' },
            include: { tasks: true }
        });
    }
    async createColumn(title, orderIdx) {
        return this.prisma.kanbanColumn.create({ data: { title, orderIdx } });
    }
    async updateColumn(id, title) {
        return this.prisma.kanbanColumn.update({ where: { id }, data: { title } });
    }
    async removeColumn(id) {
        return this.prisma.kanbanColumn.delete({ where: { id } });
    }
    async reserveStock(tx, taskId, serviceId, quantity) {
        const serviceMaterials = await tx.serviceMaterial.findMany({
            where: { serviceId }
        });
        for (const sm of serviceMaterials) {
            const needed = sm.normPerUnit * quantity;
            await tx.material.update({
                where: { id: sm.materialId },
                data: { reservedStock: { increment: needed } }
            });
        }
    }
    async deductStock(tx, taskId) {
        const task = await tx.task.findUnique({
            where: { id: taskId },
            include: { service: { include: { materials: true } } }
        });
        if (!task || !task.serviceId)
            return;
        const existingMovement = await tx.stockMovement.findFirst({
            where: { taskId: taskId, type: 'chiqim' }
        });
        if (existingMovement)
            return;
        const taskOverrides = JSON.parse(task.materialOverrides || "[]");
        for (const sm of task.service.materials) {
            const override = taskOverrides.find((o) => o.materialId === sm.materialId);
            const amount = override
                ? Number(override.quantity)
                : (Number(sm.normPerUnit) * Number(task.quantity));
            const updatedMaterial = await tx.material.update({
                where: { id: sm.materialId },
                data: {
                    currentStock: { decrement: amount },
                    reservedStock: { decrement: amount }
                }
            });
            await tx.stockMovement.create({
                data: {
                    materialId: sm.materialId,
                    taskId: taskId,
                    type: 'chiqim',
                    quantity: amount,
                    note: `Buyurtma yakunlandi: ${task.title}`
                }
            });
            if (updatedMaterial.currentStock <= updatedMaterial.minStock) {
                const warningMessage = `⚠️ *OMBOR OGOHLANTIRISHI*\n\n📌 *Mahsulot:* ${updatedMaterial.name}\n📊 *Qoldiq:* ${updatedMaterial.currentStock} ${updatedMaterial.unit}\n📉 *Minimal qoldiq:* ${updatedMaterial.minStock} ${updatedMaterial.unit}\n\n_Iltimos, zaxirani to'ldiring!_`;
                this.telegramService.notifyAdmins(warningMessage);
            }
        }
    }
    async handleDeadlineReminders() {
        const now = new Date();
        const tasks = await this.prisma.task.findMany({
            where: {
                deadlineAt: { not: null },
            },
            include: { column: true }
        });
        for (const task of tasks) {
            if (!task.deadlineAt)
                continue;
            const finishedKeywords = ['tayyor', 'topshirildi', 'yakunlandi', 'bajarildi'];
            const isFinished = finishedKeywords.some(k => task.column?.title?.toLowerCase().includes(k));
            if (isFinished)
                continue;
            const diffMs = task.deadlineAt.getTime() - now.getTime();
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            if (diffHours === 20) {
                this.notifyAssignees(task, `⏰ Eslatma: Topshiriq muddatiga 20 soat qoldi!`);
            }
            else if (diffHours === 12) {
                this.notifyAssignees(task, `⏳ DIQQAT: Topshiriq muddatiga 12 soat qoldi!`);
            }
            else if (diffHours === 3) {
                this.notifyAssignees(task, `🚨 SHOSHILINCH: Topshiriq muddatiga 3 soat qoldi!`);
            }
            else if (diffHours === 0 && diffMs > -3600000) {
                this.notifyAssignees(task, `🔥 MUDDAT TUGADI: Topshiriqni yopish vaqti keldi!`);
            }
        }
    }
};
exports.TasksService = TasksService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TasksService.prototype, "handleDeadlineReminders", null);
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        telegram_service_1.TelegramService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map