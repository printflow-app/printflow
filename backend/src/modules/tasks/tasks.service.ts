import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import {
  buildDisplayId,
  buildDisplayIdFromService,
  parseDisplayIdSequence,
} from './task-id.util';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

  async findAll(branchId?: string, viewMode: 'all' | 'own' = 'all', currentUserId?: string) {
    const base: any = { isArchived: false };

    if (viewMode === 'own' && currentUserId) {
      base.assignees = { contains: currentUserId };
    }

    let branchClause: any = {};
    if (branchId === '__main__') {
      branchClause = { branchId: null, executorBranchId: null };
    } else if (branchId) {
      // Own tasks (we are the origin and executor) OR tasks delegated TO this branch
      branchClause = {
        OR: [
          { branchId, executorBranchId: null },
          { executorBranchId: branchId },
        ],
      };
    }

    const tasks = await this.prisma.task.findMany({
      where: { ...base, ...branchClause },
      include: {
        column: true,
        customer: true,
        paymentType: true,
        vendor: { select: { id: true, name: true } },
        executorBranch: { select: { id: true, name: true } },
        // histories include qilinmaydi — kanban kartochkasi tarixni ko'rsatmaydi.
        // Detail modal `tasksApi.findOne(id)` chaqiradi va u yerda histories
        // employeega bog'liq holda yuklanadi. Avval bu yerda histories +
        // employee join bor edi: 1000 ta task uchun ~20K history qator + 20K
        // employee join har 12 sek polling'da. Bu kanbanni Railway PG'da
        // 6-10s'gacha sekinlashtirardi.
      },
    });

    // Kanban kartasi attachmentlarni ko'rsatmaydi. Base64 CDR/TIF fayllar TEXT
    // ustunida 30MB+ bo'lishi mumkin — har 12 sekundlik polling'da ularni qaytarish
    // tarmoq va brauzer asosiy thread'ini blok qiladi. Faqat detail modal kerak,
    // u esa alohida findOne() chaqiradi.
    return tasks.map((t: any) => ({ ...t, attachments: undefined, hasAttachments: !!t.attachments && t.attachments !== '[]' }));
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        column: true,
        customer: true,
        paymentType: true,
        vendor: { select: { id: true, name: true } },
        histories: { include: { employee: true }, orderBy: { createdAt: 'desc' } },
        attachmentRecords: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) return null;

    // Fallback — agar yangi jadval'da row yo'q-u, eski JSON ustun'da data bor bo'lsa
    // (ya'ni migratsiya skripti hali ishlatilmagan), o'qish vaqtida synthesize qilamiz.
    // Bu read-only fallback — DB yozish yo'q. Migratsiya ishlatilgach bu blok ishga tushmaydi.
    const records: any[] = (task as any).attachmentRecords || [];
    if (records.length === 0 && (task as any).attachments && (task as any).attachments !== '[]') {
      try {
        const legacy: any[] = JSON.parse((task as any).attachments);
        const synth = legacy.map((it: any, idx: number) => {
          const url = typeof it === 'string' ? it : (it?.url || '');
          const name = typeof it === 'string' ? `Fayl-${idx + 1}` : (it?.name || `Fayl-${idx + 1}`);
          return {
            id: `legacy-${idx}`,
            name,
            mimeType: null,
            data: url,
            size: 0,
            createdAt: task.createdAt,
            _legacy: true, // Frontend ekranda DELETE imkonsizligini bilishi uchun
          };
        });
        (task as any).attachmentRecords = synth;
      } catch { /* JSON buzilgan — bo'sh massiv qoldiramiz */ }
    }

    return task;
  }

  async create(data: any, employeeId?: string) {
    const {
      orderName, title, description, customerId, customerName, customerPhone,
      totalAmount, depositAmount, paymentTypeId, columnId, assignees, attachments, deadlineAt,
      departmentId,
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
      // Prefiks endi har xil bo'lgani uchun (har xil xizmatlar), max sequence'ni
      // butun tenant tasklari ichidan numerik tarzda topamiz.
      const allDisplayIds = await (tx.task.findMany as any)({
        select: { displayId: true },
      });
      const maxSeq = allDisplayIds.reduce(
        (m: number, t: { displayId: string | null }) =>
          Math.max(m, parseDisplayIdSequence(t.displayId || '')),
        10000,
      );
      const nextSeq = maxSeq + 1 + retryCount;
      const displayId = buildDisplayIdFromService(title, tenant?.name ?? 'X', nextSeq - 10001);

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
          departmentId: departmentId || null,
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
            serviceType: title,
            departmentId: departmentId || null,
            // Filial scope — taskning origin branch'iga moslash, aks holda Kassa filiali
            // filtri kirim tranzaksiyani yashiradi.
            branchId: data.branchId || data.targetBranchId || null,
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

    // Telegram Notification — summa ko'rsatilmaydi, faqat buyurtma/xizmat/bosqich
    this.notifyAssignees(task, '🆕 Yangi topshiriq');
    const tId = TenantContext.getTenantId();
    if (tId) {
      const orderLine = orderName ? `📌 *Buyurtma:* ${orderName}\n🛠 *Xizmat:* ${title}` : `🛠 *Xizmat:* ${title}`;
      this.telegramService.notifyNewOrder(tId, `${orderLine}\n📍 *Bosqich:* Yangi Buyurtma`);
    }

    return task;
  }

  async createBulk(data: any, employeeId?: string) {
    const {
      orderName, items, customerId, customerName, customerPhone,
      totalDeposit, paymentTypeId, columnId, justification, assigneeIds, deadlineAt,
      branchId, executorBranchId, departmentId,
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
      // Prefiks turli xil bo'lgani uchun (birinchi xizmat nomidan), max sequence'ni
      // butun tenant tasklari ichidan numerik tarzda topamiz — alfavit tartibi yaramaydi.
      const allBulkDisplayIds = await (tx.task.findMany as any)({
        select: { displayId: true },
      });
      const maxBulkSeq = allBulkDisplayIds.reduce(
        (m: number, t: { displayId: string | null }) =>
          Math.max(m, parseDisplayIdSequence(t.displayId || '')),
        10000,
      );
      let nextBulkSeq = maxBulkSeq + 1 + bulkRetry;
      // Barcha bulk tasklar uchun bir xil prefiks — birinchi xizmatdan.
      const bulkPrefixSource = items[0]?.title ?? null;

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

        const displayId = buildDisplayIdFromService(
          bulkPrefixSource,
          bulkTenant?.name ?? 'X',
          nextBulkSeq++ - 10001,
        );

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
            branchId: branchId || undefined,
            executorBranchId: executorBranchId || null,
            vendorId: item.vendorId || undefined,
            vendorCost: Number(item.vendorCost || 0),
            departmentId: departmentId || null,
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
            serviceType: items.length > 1 ? `${items[0].title} (+${items.length - 1} ta)` : items[0].title,
            departmentId: departmentId || null,
            // Filial scope — bulk orderning origin branch'iga moslash, aks holda Kassa
            // filiali filtri kirim tranzaksiyani yashiradi.
            branchId: branchId || null,
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

    // Notify for each task — summa ko'rsatilmaydi
    const tId = TenantContext.getTenantId();
    for (const t of tasks) {
      this.notifyAssignees(t, '🆕 Yangi topshiriq (Guruhli)');
      if (tId) {
        const orderLine = (t as any).orderName ? `📌 *Buyurtma:* ${(t as any).orderName}\n🛠 *Xizmat:* ${t.title}` : `🛠 *Xizmat:* ${t.title}`;
        this.telegramService.notifyNewOrder(tId, `${orderLine} (Guruhli)\n📍 *Bosqich:* Yangi Buyurtma`);
      }
    }

    return tasks;
  }

  async update(id: string, data: any, employeeId?: string) {
    const oldTask = await this.prisma.task.findUnique({
      where: { id },
      include: { service: { include: { materials: true } } },
    });
    if (!oldTask) throw new Error('Task topilmadi');

    const { historyNote, ...taskData } = data;

    // Fetch static columns and existing stock movement concurrently BEFORE transaction
    // to minimize transaction duration and network round-trips over remote Railway proxy.
    const [oldCol, newCol, existingMovement] = await Promise.all([
      taskData.columnId && oldTask.columnId ? this.prisma.kanbanColumn.findUnique({ where: { id: oldTask.columnId } }) : Promise.resolve(null),
      taskData.columnId ? this.prisma.kanbanColumn.findUnique({ where: { id: taskData.columnId } }) : Promise.resolve(null),
      oldTask.serviceId ? this.prisma.stockMovement.findFirst({ where: { taskId: id, type: 'chiqim' } }) : Promise.resolve(null),
    ]);

    // Katta attachment'lar (CDR/TIF base64) yozilishi 5s'dan uzunroq vaqt olishi mumkin —
    // Prisma'ning default transaction timeout'i (5000ms) bilan ishlamaydi. Limitni oshiramiz.
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

        if (isFinished && oldTask.serviceId && !existingMovement && oldTask.service?.materials) {
          const taskOverrides = JSON.parse(oldTask.materialOverrides || "[]");
          // Execute all material stock deductions concurrently inside transaction
          await Promise.all(oldTask.service.materials.map(async (sm: any) => {
            const override = taskOverrides.find((o: any) => o.materialId === sm.materialId);
            const amount = override 
              ? Number(override.quantity) 
              : (Number(sm.normPerUnit) * Number(oldTask.quantity));
            
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
                taskId: id,
                type: 'chiqim',
                quantity: amount,
                note: `Buyurtma yakunlandi: ${oldTask.title}`
              } as any
            });

            if (updatedMaterial.currentStock <= updatedMaterial.minStock) {
              const warningMessage = `⚠️ *OMBOR OGOHLANTIRISHI*\n\n📌 *Mahsulot:* ${updatedMaterial.name}\n📊 *Qoldiq:* ${updatedMaterial.currentStock} ${updatedMaterial.unit}\n📉 *Minimal qoldiq:* ${updatedMaterial.minStock} ${updatedMaterial.unit}\n\n_Iltimos, zaxirani to'ldiring!_`;
              const tenantId = TenantContext.getTenantId();
              if (tenantId) {
                this.telegramService.notifyAdmins(tenantId, warningMessage);
              }
            }
          }));
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
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    // Telegram Notification if assignees changed or task moved
    if (data.assignees && data.assignees !== oldTask.assignees) {
      this.notifyAssignees(updatedTask, '👥 Sizga topshiriq biriktirildi');
    } else if (data.columnId && data.columnId !== oldTask.columnId) {
      this.notifyAssignees(updatedTask, '🚚 Topshiriq bosqichi o\'zgardi');
    }

    return updatedTask;
  }

  // Yangi normalized model — har attachment bitta INSERT (30MB TEXT UPDATE emas).
  // - Race condition yo'q (har row alohida)
  // - Task'ni o'qiganda boshqa fayllar o'qilmaydi
  // - Bitta faylni o'chirish = DELETE WHERE id (boshqa fayllarga tegmaydi)
  async appendAttachment(id: string, attachment: { name: string; url: string }) {
    // Task mavjudligini va tenant scope'ni tasdiqlaymiz — middleware tenantId'ni
    // findUnique where'ga avtomatik qo'shadi, shuning uchun cross-tenant kirib bo'lmaydi.
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!task) throw new Error('Task topilmadi');

    // data URL'dan MIME aniqlash (masalan "data:image/tiff;base64,..." → "image/tiff")
    const mimeMatch = /^data:([^;,]+);/i.exec(attachment.url);
    const mimeType = mimeMatch?.[1] || null;

    // Asl fayl hajmini taxminlash (base64 ~1.33x katta)
    const commaIdx = attachment.url.indexOf(',');
    const b64Len = commaIdx === -1 ? 0 : attachment.url.length - commaIdx - 1;
    const size = Math.floor(b64Len * 0.75);

    return this.prisma.taskAttachment.create({
      data: {
        taskId: id,
        name: attachment.name,
        mimeType,
        data: attachment.url,
        size,
      } as any, // tenantId Prisma middleware tomonidan avtomatik qo'shiladi
    });
  }

  // Yagona attachmentni o'chirish — yangi modelda kichik DELETE row, eski JSON
  // TEXT yondashuvida butun ustun qayta yozilardi.
  async deleteAttachment(attachmentId: string) {
    return this.prisma.taskAttachment.delete({ where: { id: attachmentId } });
  }

  private async notifyAssignees(task: any, prefix: string) {
    try {
      const assigneeIds = JSON.parse(task.assignees || "[]");
      // Summa atayin ko'rsatilmaydi — faqat buyurtma nomi, xizmat va tafsilot.
      const orderLine = task.orderName
        ? `📌 *Buyurtma:* ${task.orderName}\n🛠 *Xizmat:* ${task.title}`
        : `🛠 *Xizmat:* ${task.title}`;
      const message = `*${prefix}*\n\n${orderLine}\n📝 *Tafsilot:* ${task.description || '-'}\n\nIltimos, platformaga kirib batafsil ko'ring.`;

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

  async getColumns(viewMode: 'all' | 'own' = 'all', currentUserId?: string, branchId?: string) {
    const taskBase: any = { isArchived: false };
    if (viewMode === 'own' && currentUserId) {
      taskBase.assignees = { contains: currentUserId };
    }

    let taskWhere: any = taskBase;
    if (branchId && branchId !== '__main__') {
      taskWhere = {
        ...taskBase,
        OR: [
          { branchId, executorBranchId: null },
          { executorBranchId: branchId },
        ],
      };
    } else if (branchId === '__main__') {
      taskWhere = { ...taskBase, branchId: null, executorBranchId: null };
    }

    // Multi-Branch isolation:
    //   '__main__'              → branchId IS NULL (Bosh ofis / legacy)
    //   real UUID               → branchId = <UUID>
    //   undefined / ''          → no filter (Barcha filiallar — all columns across tenant)
    const colWhere: any = {};
    if (branchId === '__main__') {
      colWhere.branchId = null;
    } else if (branchId) {
      colWhere.branchId = branchId;
    }

    const cols = await this.prisma.kanbanColumn.findMany({
      where: colWhere,
      orderBy: { orderIdx: 'asc' },
      include: {
        tasks: {
          where: taskWhere,
          include: {
            customer: true, paymentType: true,
            vendor: { select: { id: true, name: true } },
            executorBranch: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Kanban view'da attachments kerak emas (qarang: findAll izohi). Detail modal
    // findOne orqali alohida yuklaydi.
    return cols.map((c: any) => ({
      ...c,
      tasks: (c.tasks || []).map((t: any) => ({ ...t, attachments: undefined, hasAttachments: !!t.attachments && t.attachments !== '[]' })),
    }));
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

  async createColumn(title: string, orderIdx: number, branchId?: string) {
    const branchScope = !branchId || branchId === '__main__' ? null : branchId;
    return this.prisma.kanbanColumn.create({
      data: { title, orderIdx, branchId: branchScope } as any,
    });
  }

  async updateColumn(id: string, title: string, branchId?: string) {
    const branchScope = !branchId || branchId === '__main__' ? null : branchId;
    const existing = await this.prisma.kanbanColumn.findFirst({ where: { id, branchId: branchScope } as any });
    if (!existing) throw new Error('Bosqich topilmadi yoki ushbu filialga tegishli emas');
    return this.prisma.kanbanColumn.update({ where: { id }, data: { title } });
  }

  async removeColumn(id: string, branchId?: string) {
    const branchScope = !branchId || branchId === '__main__' ? null : branchId;
    const existing = await this.prisma.kanbanColumn.findFirst({ where: { id, branchId: branchScope } as any });
    if (!existing) throw new Error('Bosqich topilmadi yoki ushbu filialga tegishli emas');
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



}

