import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// =============================================
// JAMOA DOSKASI — "kim hozir nima bilan band?"
//
// Doskada IKKI xil ish birga ko'rsatiladi:
//   1. TeamTask — operatsion vazifalar ("qarzdorlar bilan ishlash")
//   2. Task     — buyurtmalar (o'qish uchun; ular o'z kanbanida boshqariladi)
//
// Nega birga: rahbarga xodimning BUTUN yuki kerak. "Azizbek band" degan
// javob uchun uning buyurtmasi bormi yoki operatsion vazifasimi — farqi
// yo'q. Ikkalasini alohida ko'rsatish bu savolga javob bermaydi.
// =============================================

export type TeamTaskStatus = 'reja' | 'jarayon' | 'bajarildi';
const STATUSES: TeamTaskStatus[] = ['reja', 'jarayon', 'bajarildi'];

@Injectable()
export class TeamTasksService {
  private readonly logger = new Logger(TeamTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Buyurtma qaysi ustunda turganini doskaning uchta holatiga o'giradi.
   *
   * Buyurtma kanbanida ustunlar ixtiyoriy (har tashkilot o'zi nomlaydi),
   * shuning uchun nom bo'yicha emas, TARTIB bo'yicha aniqlaymiz:
   * birinchi ustun — hali boshlanmagan, "bajarildi" belgili ustun —
   * tugagan, oradagilar — jarayonda.
   */
  private orderStatus(
    columnId: string,
    firstColumnId: string | null,
    doneColumnIds: Set<string>,
  ): TeamTaskStatus {
    if (doneColumnIds.has(columnId)) return 'bajarildi';
    if (columnId === firstColumnId) return 'reja';
    return 'jarayon';
  }

  /** Doska: uchta ustun, har birida operatsion vazifalar + buyurtmalar. */
  async board(tenantId: string, branchId?: string) {
    const [teamTasks, columns, orders, employees] = await Promise.all([
      this.prisma.teamTask.findMany({
        where: { tenantId, ...(branchId ? { branchId } : {}) },
        include: { assignee: { select: { id: true, fullName: true } } },
        orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.kanbanColumn.findMany({
        where: { tenantId },
        orderBy: { orderIdx: 'asc' },
        select: { id: true, isDone: true },
      }),
      this.prisma.task.findMany({
        where: { tenantId, isArchived: false },
        select: {
          id: true, displayId: true, orderName: true, title: true,
          deadlineAt: true, assignees: true, columnId: true, totalAmount: true,
        },
      }),
      this.prisma.employee.findMany({
        where: { tenantId },
        select: { id: true, fullName: true },
      }),
    ]);

    const firstColumnId = columns.length ? columns[0].id : null;
    const doneIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id));
    const empName = new Map(employees.map((e) => [e.id, e.fullName]));

    const out: Record<TeamTaskStatus, any[]> = { reja: [], jarayon: [], bajarildi: [] };

    for (const t of teamTasks) {
      const st = (STATUSES.includes(t.status as TeamTaskStatus) ? t.status : 'reja') as TeamTaskStatus;
      out[st].push({
        id: t.id,
        tur: 'vazifa',
        sarlavha: t.title,
        izoh: t.description,
        masul: t.assignee ? { id: t.assignee.id, ism: t.assignee.fullName } : null,
        muddat: t.deadlineAt,
        status: st,
      });
    }

    for (const o of orders) {
      let ids: string[] = [];
      try { const p = JSON.parse(o.assignees || '[]'); if (Array.isArray(p)) ids = p; } catch {}
      const st = this.orderStatus(o.columnId, firstColumnId, doneIds);
      out[st].push({
        id: o.id,
        tur: 'buyurtma',
        sarlavha: o.displayId ? `${o.displayId} — ${o.orderName || o.title}` : (o.orderName || o.title),
        izoh: null,
        // Buyurtmada bir necha mas'ul bo'lishi odatiy — birinchisini
        // ko'rsatamiz, qolganini son bilan bildiramiz.
        masul: ids.length ? { id: ids[0], ism: empName.get(ids[0]) || '—' } : null,
        qoshimcha_masullar: Math.max(0, ids.length - 1),
        muddat: o.deadlineAt,
        summa: o.totalAmount,
        status: st,
      });
    }

    return out;
  }

  async create(tenantId: string, data: any, actorId?: string) {
    const created = await this.prisma.teamTask.create({
      data: {
        tenantId,
        title: String(data.title || '').trim(),
        description: data.description?.trim() || null,
        assigneeId: data.assigneeId || null,
        branchId: data.branchId || null,
        status: STATUSES.includes(data.status) ? data.status : 'reja',
        deadlineAt: data.deadlineAt ? new Date(data.deadlineAt) : null,
        createdById: actorId || null,
      },
      include: { assignee: { select: { id: true, fullName: true, telegramId: true } } },
    });

    // Xabar yuborish vazifani YARATISHNI to'xtatmasligi kerak — Telegram
    // ishlamasa ham vazifa saqlanib qolishi kerak.
    this.notifyAssignee(created).catch((e) =>
      this.logger.warn(`Telegram xabari yuborilmadi: ${e?.message}`),
    );

    return created;
  }

  private async notifyAssignee(t: any) {
    const tg = t.assignee?.telegramId;
    if (!tg) return;
    const muddat = t.deadlineAt
      ? new Date(t.deadlineAt).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' })
      : null;
    const lines = [
      '📋 *Sizga yangi vazifa berildi*',
      '',
      `*${t.title}*`,
      t.description ? `\n${t.description}` : '',
      muddat ? `\n🗓 Muddat: *${muddat}*` : '',
      // Buyurtma xabaridagi bilan bir xil eslatma — javobgarlik ikkala
      // turdagi ishda ham bir xil o'tadi, matn ham bir xil bo'lishi kerak.
      '',
      "⚠️ *Diqqat!* Ishni qabul qilgan paytdan boshlab javobgarlik sizda.",
      "Muddat va sifat talablariga rioya qiling, noaniqlik bo'lsa DARHOL rahbaringizga murojaat qiling.",
      "E'tiborsizlik yoki xatoyingiz sababli yetkazilgan zarar uchun javobgarlik sizning zimmangizda.",
    ].filter(Boolean);
    await this.telegram.sendMessage(tg, lines.join('\n'));
  }

  async update(id: string, data: any) {
    const patch: any = {};
    if (data.title !== undefined) patch.title = String(data.title).trim();
    if (data.description !== undefined) patch.description = data.description?.trim() || null;
    if (data.assigneeId !== undefined) patch.assigneeId = data.assigneeId || null;
    if (data.deadlineAt !== undefined) {
      patch.deadlineAt = data.deadlineAt ? new Date(data.deadlineAt) : null;
    }
    if (data.status !== undefined && STATUSES.includes(data.status)) {
      patch.status = data.status;
      // Bajarilgan vaqti maosh/KPI hisobida kerak bo'lishi mumkin.
      patch.completedAt = data.status === 'bajarildi' ? new Date() : null;
    }
    return this.prisma.teamTask.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    return this.prisma.teamTask.delete({ where: { id } });
  }
}
