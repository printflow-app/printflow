import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TenantContext } from '../../common/tenant/tenant.context';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

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

  async findOne(id: string) {
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

  async create(data: any, employeeId?: string) {
    const { 
      orderName, title, description, customerId, customerName, customerPhone, 
      totalAmount, depositAmount, paymentTypeId, columnId, assignees, attachments, deadlineAt
    } = data;

    const remainingAmount = Math.max(0, Math.round(Number(totalAmount || 0) - Number(depositAmount || 0)));

    const task = await this.prisma.$transaction(async (tx) => {
      let finalCustomerId = customerId;

      if (!finalCustomerId && customerName) {
        let customer = await tx.customer.findFirst({ where: { name: customerName } });
        if (!customer) {
          customer = await tx.customer.create({
            data: { name: customerName, phone: customerPhone } as any
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
        } as any
      });

      // Handle Stock Reservation
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
          } as any
        });
      }

      await tx.taskHistory.create({
        data: {
          taskId: createdTask.id,
          employeeId: employeeId === 'admin' ? null : employeeId,
          action: 'yaratildi',
          details: `Buyurtma yaratildi. Summa: ${totalAmount}, Zakolat: ${depositAmount}`
        } as any
      });

      return createdTask;
    });

    // Telegram Notification
    this.notifyAssignees(task, '🆕 Yangi topshiriq');

    return task;
  }

  async createBulk(data: any, employeeId?: string) {
    const { 
      orderName, items, customerId, customerName, customerPhone, 
      totalDeposit, paymentTypeId, columnId, justification, assigneeIds, deadlineAt
    } = data;

    const totalDepositNum = Math.round(Number(totalDeposit || 0));
    const perTaskDepositFloor = Math.floor(totalDepositNum / items.length);
    const remainder = totalDepositNum % items.length;

    const tasks = await this.prisma.$transaction(async (tx) => {
      let finalCustomerId = customerId;

      if (!finalCustomerId && customerName) {
        let customer = await tx.customer.findFirst({ where: { name: customerName } });
        if (!customer) {
          customer = await tx.customer.create({
            data: { name: customerName, phone: customerPhone } as any
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

        // Distribute deposit: the last item gets the remainder if any
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
          } as any
        });

        // Handle Stock Reservation for each bulk item
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
          } as any
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
          } as any
        });
      }

      return createdTasks;
    });

    // Notify for each task
    for (const t of tasks) {
      this.notifyAssignees(t, '🆕 Yangi topshiriq (Guruhli)');
    }

    return tasks;
  }

  async update(id: string, data: any, employeeId?: string) {
    const oldTask = await this.prisma.task.findUnique({ where: { id } });
    if (!oldTask) throw new Error('Task topilmadi');

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
          } as any
        });

        // Check if moved to "Finished" columns: "Tayyor" or "Topshirildi"
        const finishedKeywords = ['tayyor', 'topshirildi', 'yakunlandi', 'bajarildi'];
        const isFinished = finishedKeywords.some(k => newCol?.title?.toLowerCase().includes(k));
        
        if (isFinished && oldTask.serviceId) {
          await this.deductStock(tx, id);
        }
      } else if (data.title || data.description) {
        await tx.taskHistory.create({
          data: {
            taskId: id,
            employeeId: employeeId === 'admin' ? null : employeeId,
            action: 'o\'zgartirildi',
            details: 'Ma\'lumotlar yangilandi'
          } as any
        });
      }

      return task;
    });

    // Telegram Notification if assignees changed or task moved
    if (data.assignees && data.assignees !== oldTask.assignees) {
      this.notifyAssignees(updatedTask, '👥 Sizga topshiriq biriktirildi');
    } else if (data.columnId && data.columnId !== oldTask.columnId) {
      this.notifyAssignees(updatedTask, '🚚 Topshiriq bosqichi o\'zgardi');
    }

    return updatedTask;
  }

  private async notifyAssignees(task: any, prefix: string) {
    try {
      const assigneeIds = JSON.parse(task.assignees || "[]");
      const message = `*${prefix}*\n\n📌 *Nomi:* ${task.title}\n📝 *Tafsilot:* ${task.description || '-'}\n💰 *Summa:* ${task.totalAmount} UZS\n\nIltimos, platformaga kirib batafsil ko'ring.`;
      
      for (const empId of assigneeIds) {
        await this.telegramService.sendNotification(empId, message);
      }
    } catch (e) {
      console.error('Notification error:', e);
    }
  }

  async logView(id: string, employeeId: string) {
    return this.prisma.taskHistory.create({
      data: {
        taskId: id,
        employeeId: employeeId === 'admin' ? null : employeeId,
        action: 'ko\'rildi',
        details: 'Topshiriq tafsilotlari ko\'rildi'
      } as any
    });
  }

  async remove(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }

  async getColumns() {
    return this.prisma.kanbanColumn.findMany({
      orderBy: { orderIdx: 'asc' },
      include: { tasks: true }
    });
  }

  async createColumn(title: string, orderIdx: number) {
    return this.prisma.kanbanColumn.create({ data: { title, orderIdx } as any });
  }

  async updateColumn(id: string, title: string) {
    return this.prisma.kanbanColumn.update({ where: { id }, data: { title } });
  }

  async removeColumn(id: string) {
    return this.prisma.kanbanColumn.delete({ where: { id } });
  }

  // =============================================
  // STOCK LOGIC (BOM)
  // =============================================

  private async reserveStock(tx: any, taskId: string, serviceId: string, quantity: number) {
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

  private async deductStock(tx: any, taskId: string) {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { service: { include: { materials: true } } }
    });

    if (!task || !task.serviceId) return;

    // Check if already deducted to avoid double deduction
    const existingMovement = await tx.stockMovement.findFirst({
      where: { taskId: taskId, type: 'chiqim' }
    });
    if (existingMovement) return;

    const taskOverrides = JSON.parse(task.materialOverrides || "[]");

    for (const sm of task.service.materials) {
      // Find if this specific material has an override for this task
      const override = taskOverrides.find((o: any) => o.materialId === sm.materialId);
      const amount = override 
        ? Number(override.quantity) 
        : (Number(sm.normPerUnit) * Number(task.quantity));
      
      // Decrement both current and reserved
      const updatedMaterial = await tx.material.update({
        where: { id: sm.materialId },
        data: {
          currentStock: { decrement: amount },
          reservedStock: { decrement: amount }
        }
      });

      // Record movement
      await tx.stockMovement.create({
        data: {
          materialId: sm.materialId,
          taskId: taskId,
          type: 'chiqim',
          quantity: amount,
          note: `Buyurtma yakunlandi: ${task.title}`
        } as any
      });

      // Check minStock and notify admins
      if (updatedMaterial.currentStock <= updatedMaterial.minStock) {
        const warningMessage = `⚠️ *OMBOR OGOHLANTIRISHI*\n\n📌 *Mahsulot:* ${updatedMaterial.name}\n📊 *Qoldiq:* ${updatedMaterial.currentStock} ${updatedMaterial.unit}\n📉 *Minimal qoldiq:* ${updatedMaterial.minStock} ${updatedMaterial.unit}\n\n_Iltimos, zaxirani to'ldiring!_`;
        const tenantId = TenantContext.getTenantId();
        if (tenantId) {
          this.telegramService.notifyAdmins(tenantId, warningMessage);
        }
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleDeadlineReminders() {
    const now = new Date();
    
    // Find all active tasks with deadline
    const tasks = await this.prisma.task.findMany({
      where: {
        deadlineAt: { not: null },
      },
      include: { column: true }
    });

    for (const task of tasks) {
      if (!task.deadlineAt) continue;
      
      const finishedKeywords = ['tayyor', 'topshirildi', 'yakunlandi', 'bajarildi'];
      const isFinished = finishedKeywords.some(k => task.column?.title?.toLowerCase().includes(k));
      if (isFinished) continue;

      const diffMs = task.deadlineAt.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      
      // Eslatmalar: 20, 12, 3 soat oldin
      if (diffHours === 20) {
         this.notifyAssignees(task, `⏰ Eslatma: Topshiriq muddatiga 20 soat qoldi!`);
      } else if (diffHours === 12) {
         this.notifyAssignees(task, `⏳ DIQQAT: Topshiriq muddatiga 12 soat qoldi!`);
      } else if (diffHours === 3) {
         this.notifyAssignees(task, `🚨 SHOSHILINCH: Topshiriq muddatiga 3 soat qoldi!`);
      } else if (diffHours === 0 && diffMs > -3600000) {
         this.notifyAssignees(task, `🔥 MUDDAT TUGADI: Topshiriqni yopish vaqti keldi!`);
      }
    }
  }
}

