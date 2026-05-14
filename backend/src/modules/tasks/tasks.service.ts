import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import { buildDisplayId, parseDisplayIdSequence } from './task-id.util';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  async findAll(branchId?: string, viewMode: 'all' | 'own' = 'all', currentUserId?: string) {
    const where: any = {
      isArchived: false,
      ...(branchId === '__main__' ? { branchId: null } : branchId ? { branchId } : {}),
    };

    // tasks:view_own — only return tasks where the current employee is an assignee
    if (viewMode === 'own' && currentUserId) {
      where.assignees = { contains: currentUserId };
    }

    return this.prisma.task.findMany({
      where,
      include: {
        column: true,
        customer: true,
        paymentType: true,
        vendor: { select: { id: true, name: true } },
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
        vendor: { select: { id: true, name: true } },
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

    // Retry loop to handle race condition on displayId unique constraint
    let task: any = null;
    let retryCount = 0;
    while (!task) {
      try {
        task = await this.prisma.$transaction(async (tx) => {
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

      // Resolve the name to use for initials (fetch from DB if only ID was supplied)
      let effectiveName = customerName;
      if (!effectiveName && finalCustomerId) {
        const c = await tx.customer.findUnique({
          where: { id: finalCustomerId },
          select: { name: true },
        });
        effectiveName = c?.name ?? null;
      }
      const tenant = await tx.tenant.findUnique({
        where: { id: TenantContext.getTenantId() },
        select: { name: true },
      });
      const maxTask = await (tx.task.findFirst as any)({
        orderBy: { displayId: 'desc' },
        select: { displayId: true },
      });
      const nextSeq = (maxTask ? parseDisplayIdSequence(maxTask.displayId) + 1 : 10001) + retryCount;
      const displayId = buildDisplayId(tenant?.name ?? 'X', nextSeq - 10001);

      const createdTask = await tx.task.create({
        data: {
          displayId,
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
          deadlineAt: (() => { const d = deadlineAt ? new Date(deadlineAt) : null; return d && !isNaN(d.getTime()) ? d : null; })(),
          branchId: data.branchId || data.targetBranchId || undefined,
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
      } catch (err: any) {
        const isUniqueViolation = err?.code === 'P2002' ||
          err?.message?.includes('Unique constraint') ||
          err?.message?.includes('displayId');
        if (isUniqueViolation && retryCount < 5) {
          retryCount++;
          continue;
        }
        throw err;
      }
    }

    // Telegram Notification
    this.notifyAssignees(task, '🆕 Yangi topshiriq');
    const tId = TenantContext.getTenantId();
    if (tId) {
      this.telegramService.notifyNewOrder(tId, `📌 *${title}*\n💰 ${totalAmount} UZS\n📍 Bosqich: Yangi Buyurtma`);
    }

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

    let tasks: any[] | null = null;
    let bulkRetry = 0;
    while (!tasks) {
      try {
        tasks = await this.prisma.$transaction(async (tx) => {
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

      // Resolve display-name for initials once before the loop
      let effectiveBulkName = customerName;
      if (!effectiveBulkName && finalCustomerId) {
        const c = await tx.customer.findUnique({
          where: { id: finalCustomerId },
          select: { name: true },
        });
        effectiveBulkName = c?.name ?? null;
      }
      const bulkTenant = await tx.tenant.findUnique({
        where: { id: TenantContext.getTenantId() },
        select: { name: true },
      });
      // Find the current max displayId across the entire tenant to avoid collisions.
      const maxBulkTask = await (tx.task.findFirst as any)({
        orderBy: { displayId: 'desc' },
        select: { displayId: true },
      });
      let nextBulkSeq = (maxBulkTask ? parseDisplayIdSequence(maxBulkTask.displayId) + 1 : 10001) + bulkRetry;

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

        const displayId = buildDisplayId(bulkTenant?.name ?? 'X', nextBulkSeq++ - 10001);

        const task = await tx.task.create({
          data: {
            displayId,
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
            deadlineAt: (() => { const d = deadlineAt ? new Date(deadlineAt) : null; return d && !isNaN(d.getTime()) ? d : null; })(),
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
      } catch (err: any) {
        const isUniqueViolation = err?.code === 'P2002' ||
          err?.message?.includes('Unique constraint') ||
          err?.message?.includes('displayId');
        if (isUniqueViolation && bulkRetry < 5) {
          bulkRetry += items.length; // skip ahead by item count to avoid all collisions
          continue;
        }
        throw err;
      }
    }

    // Notify for each task
    const tId = TenantContext.getTenantId();
    for (const t of tasks) {
      this.notifyAssignees(t, '🆕 Yangi topshiriq (Guruhli)');
      if (tId) {
        this.telegramService.notifyNewOrder(tId, `📌 *${t.title}* (Guruhli)\n💰 ${t.totalAmount} UZS\n📍 Bosqich: Yangi Buyurtma`);
      }
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

        if (isFinished) {
          if (oldTask.serviceId) {
            await this.deductStock(tx, id);
          }
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

  // DELETE o'chirildi — faqat arxivlash mumkin (audit trail saqlanadi)
  // async remove() — DISABLED intentionally (use archive() instead)

  async getColumns(viewMode: 'all' | 'own' = 'all', currentUserId?: string) {
    const taskWhere: any = { isArchived: false };
    if (viewMode === 'own' && currentUserId) {
      taskWhere.assignees = { contains: currentUserId };
    }

    return this.prisma.kanbanColumn.findMany({
      orderBy: { orderIdx: 'asc' },
      include: {
        tasks: { where: taskWhere },
      },
    });
  }

  async archive(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { isArchived: true } as any,
    });
  }

  async getArchived() {
    return this.prisma.task.findMany({
      where: { isArchived: true } as any,
      include: { column: true, customer: true },
      orderBy: { updatedAt: 'desc' },
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
  // TASK EXPENSE CRUD (Tannarx xarajatlari)
  // =============================================

  async getExpenses(taskId: string) {
    return (this.prisma as any).taskExpense.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createExpense(taskId: string, data: { expenseName: string; amount: number }) {
    return (this.prisma as any).taskExpense.create({
      data: {
        taskId,
        expenseName: data.expenseName,
        amount: Number(data.amount),
      },
    });
  }

  async deleteExpense(expenseId: string) {
    return (this.prisma as any).taskExpense.delete({
      where: { id: expenseId },
    });
  }

  // =============================================
  // BACKFILL — Generate displayIds for old tasks
  // =============================================
  async backfillDisplayIds() {
    const tasks = await (this.prisma as any).task.findMany({
      where: { displayId: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, tenantId: true, customerName: true },
    });

    const tenantCounters: Record<string, number> = {};
    const tenantNames: Record<string, string> = {};
    let updated = 0;

    for (const task of tasks) {
      if (tenantNames[task.tenantId] === undefined) {
        const t = await (this.prisma as any).tenant.findUnique({
          where: { id: task.tenantId },
          select: { name: true },
        });
        tenantNames[task.tenantId] = t?.name ?? 'XX';
      }
      if (tenantCounters[task.tenantId] === undefined) {
        tenantCounters[task.tenantId] = await (this.prisma as any).task.count({
          where: { tenantId: task.tenantId, displayId: { not: null } },
        });
      }
      const count = tenantCounters[task.tenantId];
      const displayId = buildDisplayId(tenantNames[task.tenantId], count);
      try {
        await (this.prisma as any).task.update({ where: { id: task.id }, data: { displayId } });
        tenantCounters[task.tenantId]++;
        updated++;
      } catch { /* skip if unique collision */ }
    }

    return { updated, total: tasks.length };
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


}

