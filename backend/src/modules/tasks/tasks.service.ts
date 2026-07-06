import { Injectable, NotFoundException } from '@nestjs/common';
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
        // Service kerak — modal variant jadvalining ustun nomlarini xizmatning
        // variantAxes'idan oladi (variant data'da kalit sifatida nima saqlangan bo'lishidan qat'i nazar).
        service: { select: { id: true, name: true, unit: true, variantAxes: true } },
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

  /**
   * Variant qatorlarini normalize qiladi va validatsiya qiladi.
   * Kirish: noma'lum (any), masalan client'dan kelgan array.
   * Chiqish: tozalangan array, yoki null (variantlar yo'q/yaroqsiz).
   */
  private normalizeVariants(raw: any): Array<{ atributlar: Record<string, string>; soni: number }> | null {
    if (!raw) return null;
    if (!Array.isArray(raw)) return null;
    const cleaned: Array<{ atributlar: Record<string, string>; soni: number }> = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const soni = Number(row.soni ?? row.quantity ?? 0);
      if (!Number.isFinite(soni) || soni <= 0) continue;
      const attrsRaw = row.atributlar ?? row.attributes ?? {};
      if (!attrsRaw || typeof attrsRaw !== 'object') continue;
      const attrs: Record<string, string> = {};
      for (const [k, v] of Object.entries(attrsRaw)) {
        const key = String(k).trim();
        const val = String(v ?? '').trim();
        if (key && val) attrs[key] = val;
      }
      // Atributsiz qator — variant emas, o'tkazib yuboramiz
      if (Object.keys(attrs).length === 0) continue;
      cleaned.push({ atributlar: attrs, soni: Math.round(soni) });
    }
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Mavjud mijozni topadi — avval telefon raqami (faqat raqamlar bo'yicha
   * normalizatsiya qilib, "+998 90 123" va "998901230000" mos kelishi uchun),
   * keyin aniq ism bo'yicha. Yangi buyurtma yaratishda dublikat mijoz paydo
   * bo'lishining oldini oladi. tx — Prisma tranzaksiya klienti.
   */
  private async findExistingCustomer(
    tx: any,
    name?: string,
    phone?: string,
  ): Promise<{ id: string } | null> {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length >= 7) {
      // O'sha tenantdagi telefonli mijozlarni olib, normalizatsiya bilan solishtiramiz.
      const candidates = await tx.customer.findMany({
        where: { phone: { not: null } },
        select: { id: true, phone: true },
      });
      const match = candidates.find(
        (c: any) => (c.phone || '').replace(/\D/g, '') === digits,
      );
      if (match) return { id: match.id };
    }
    if (name) {
      const byName = await tx.customer.findFirst({ where: { name } });
      if (byName) return { id: byName.id };
    }
    return null;
  }

  /**
   * TaskHistory.employeeId FK faqat Employee.id qabul qiladi. Chaqiruvchi
   * workspace admin bo'lsa (WorkspaceAdmin.id — Employee jadvalida YO'Q)
   * yoki legacy 'admin' string kelsa null qaytaramiz; aks holda FK buzilib
   * butun buyurtma tranzaksiyasi yiqiladi (agent orqali admin buyurtma
   * yaratganda aynan shu xato chiqardi).
   */
  private async historyEmployeeId(employeeId?: string | null): Promise<string | null> {
    if (!employeeId || employeeId === 'admin') return null;
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId },
      select: { id: true },
    });
    return emp ? employeeId : null;
  }

  async create(data: any, employeeId?: string) {
    const {
      orderName, title, description, customerId, customerName, customerPhone,
      totalAmount, depositAmount, paymentTypeId, columnId, assignees, attachments, deadlineAt,
      departmentId,
    } = data;

    const remainingAmount = Math.max(0, Math.round(Number(totalAmount || 0) - Number(depositAmount || 0)));
    const historyEmpId = await this.historyEmployeeId(employeeId);

    // Variant qatorlari — agar berilgan bo'lsa, jami soni avtomatik hisoblanadi
    const normalizedVariants = this.normalizeVariants(data.variants);
    const effectiveQuantity = normalizedVariants
      ? normalizedVariants.reduce((s, v) => s + (Number(v.soni) || 0), 0)
      : Number(data.quantity || 1);

    // Retry loop to handle race condition on displayId unique constraint
    let task: any = null;
    let retryCount = 0;
    while (!task) {
      try {
        task = await this.prisma.$transaction(async (tx) => {
      let finalCustomerId = customerId;

      if (!finalCustomerId && (customerName || customerPhone)) {
        // Dublikatning oldini olish — telefon (normalizatsiya bilan), keyin ism bo'yicha.
        let customer = await this.findExistingCustomer(tx, customerName, customerPhone);
        if (!customer) {
          // Mijozni buyurtmaning filiali bilan yaratamiz — aks holda branchId=null
          // bo'lib qoladi va filial tanlangan Mijozlar ro'yxati filtridan tushib ketadi.
          customer = await tx.customer.create({
            data: {
              name: customerName,
              phone: customerPhone,
              branchId: data.branchId || data.targetBranchId || null,
            } as any
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
          quantity: effectiveQuantity,
          coefficient: Number(data.coefficient || 1.0),
          variants: normalizedVariants ?? undefined,
          deadlineAt: (() => { const d = deadlineAt ? new Date(deadlineAt) : null; return d && !isNaN(d.getTime()) ? d : null; })(),
          branchId: data.branchId || data.targetBranchId || undefined,
          departmentId: departmentId || null,
        } as any
      });

      // Handle Stock Reservation
      if (data.serviceId) {
        await this.reserveStock(tx, createdTask.id, data.serviceId, effectiveQuantity);
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
          employeeId: historyEmpId,
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
    const historyEmpId = await this.historyEmployeeId(employeeId);

    let tasks: any[] | null = null;
    let bulkRetry = 0;
    while (!tasks) {
      try {
        tasks = await this.prisma.$transaction(async (tx) => {
      let finalCustomerId = customerId;

      if (!finalCustomerId && (customerName || customerPhone)) {
        // Dublikatning oldini olish: avval telefon bo'yicha (raqamlar normalizatsiyasi
        // bilan), keyin ism bo'yicha mavjud mijozni qidiramiz. Topilsa — o'shani
        // ishlatamiz, yangi yaratmaymiz.
        let customer = await this.findExistingCustomer(tx, customerName, customerPhone);
        if (!customer) {
          // Mijozni buyurtmaning filiali bilan yaratamiz — aks holda branchId=null
          // bo'lib qoladi va filial tanlangan Mijozlar ro'yxati filtridan tushib ketadi.
          customer = await tx.customer.create({
            data: {
              name: customerName,
              phone: customerPhone,
              branchId: branchId || null,
            } as any
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

        // Variant qatorlari berilgan bo'lsa — quantity sum bo'yicha hisoblanadi
        const itemVariants = this.normalizeVariants(item.variants);
        const effectiveQty = itemVariants
          ? itemVariants.reduce((s, v) => s + (Number(v.soni) || 0), 0)
          : Number(quantity || 1);

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
            quantity: effectiveQty,
            coefficient: Number(coefficient || 1.0),
            variants: itemVariants ?? undefined,
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
          await this.reserveStock(tx, task.id, serviceId, effectiveQty);
        }

        await tx.taskHistory.create({
          data: {
            taskId: task.id,
            employeeId: historyEmpId,
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

    const historyEmpId = await this.historyEmployeeId(employeeId);
    const { historyNote, ...taskData } = data;

    // Variant qatorlari berilgan bo'lsa — quantity ni avtomatik yangilaymiz.
    // null/array.length=0 yuborilsa — variantlar o'chiriladi va eski quantity saqlanadi.
    if (taskData.variants !== undefined) {
      const normalized = this.normalizeVariants(taskData.variants);
      taskData.variants = normalized ?? null;
      if (normalized) {
        taskData.quantity = normalized.reduce((s, v) => s + (Number(v.soni) || 0), 0);
      }
    }

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
            employeeId: historyEmpId,
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
            employeeId: historyEmpId,
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
        employeeId: await this.historyEmployeeId(employeeId),
        action: 'ko\'rildi',
        details: 'Topshiriq tafsilotlari ko\'rildi'
      } as any
    });
  }

  // Buyurtmani BUTUNLAY o'chirish — faqat administrator/super admin uchun (controller'da tekshiriladi).
  // Oddiy foydalanuvchilar uchun arxivlash (archive) ishlatiladi.
  async remove(id: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Buyurtma topilmadi');

    // Transaction.taskId — FK bog'lanmagan loose ustun. Kassa yozuvi (zakolat) saqlanadi,
    // faqat task bilan bog'liqligini uzamiz (yetim ID qolmasligi uchun).
    await this.prisma.transaction.updateMany({ where: { taskId: id }, data: { taskId: null } });

    // Qolgan bolalar onDelete bilan avtomatik tozalanadi:
    //   TaskHistory / TaskExpense / TaskAttachment / OrderVendorCost → Cascade
    //   StockMovement.taskId → SetNull (default, ombor harakati tarixi saqlanadi)
    return this.prisma.task.delete({ where: { id } });
  }

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

  async createColumn(title: string, orderIdx: number, branchId?: string, isDone = false) {
    const branchScope = !branchId || branchId === '__main__' ? null : branchId;
    return this.prisma.kanbanColumn.create({
      data: { title, orderIdx, branchId: branchScope, isDone: !!isDone } as any,
    });
  }

  async updateColumn(id: string, data: { title?: string; isDone?: boolean }, branchId?: string) {
    const branchScope = !branchId || branchId === '__main__' ? null : branchId;
    const existing = await this.prisma.kanbanColumn.findFirst({ where: { id, branchId: branchScope } as any });
    if (!existing) throw new Error('Bosqich topilmadi yoki ushbu filialga tegishli emas');
    const updateData: any = {};
    if (typeof data.title === 'string') updateData.title = data.title;
    if (typeof data.isDone === 'boolean') updateData.isDone = data.isDone;
    return this.prisma.kanbanColumn.update({ where: { id }, data: updateData });
  }

  // "Bajarilgan" deb belgilangan ustun ID'lari. Hech biri belgilanmagan bo'lsa —
  // eski xulq (oxirgi ustun) bilan moslik uchun oxirgi ustunni qaytaradi.
  async getDoneColumnIds(): Promise<string[]> {
    const done = await this.prisma.kanbanColumn.findMany({ where: { isDone: true } as any, select: { id: true } });
    if (done.length) return done.map((c) => c.id);
    const all = await this.prisma.kanbanColumn.findMany({ orderBy: { orderIdx: 'asc' }, select: { id: true } });
    return all.length ? [all[all.length - 1].id] : [];
  }

  async removeColumn(id: string, branchId?: string) {
    const branchScope = !branchId || branchId === '__main__' ? null : branchId;
    const existing = await this.prisma.kanbanColumn.findFirst({ where: { id, branchId: branchScope } as any });
    if (!existing) throw new Error('Bosqich topilmadi yoki ushbu filialga tegishli emas');

    // MUHIM: Task.column relation `onDelete: Cascade`. Ustunni to'g'ridan-to'g'ri o'chirsak,
    // undagi BARCHA buyurtma — shu jumladan arxivlanganlari ham (isArchived: true) — bazadan
    // butunlay o'chib ketadi. Shuning uchun avval ustundagi hamma buyurtmani (faol + arxiv)
    // o'sha filialdagi boshqa bosqichga ko'chiramiz, keyingina ustunni o'chiramiz.
    const taskCount = await this.prisma.task.count({ where: { columnId: id } });
    if (taskCount > 0) {
      const fallback = await this.prisma.kanbanColumn.findFirst({
        where: { branchId: branchScope, id: { not: id } } as any,
        orderBy: { orderIdx: 'asc' },
      });
      if (!fallback) {
        throw new Error(
          'Bu bosqichda buyurtmalar bor, lekin ularni ko\'chirish uchun boshqa bosqich yo\'q. ' +
          'Avval yangi bosqich yarating yoki buyurtmalarni boshqa bosqichga ko\'chiring.',
        );
      }
      await this.prisma.task.updateMany({ where: { columnId: id }, data: { columnId: fallback.id } });
    }

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

