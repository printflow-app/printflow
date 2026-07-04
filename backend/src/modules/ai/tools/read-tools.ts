import { z } from 'zod/v3';
import { AgentToolDef } from './types';

// =============================================
// O'QISH TOOL'LARI — hech narsa o'zgartirmaydi, confirm/audit shart emas.
// Hammasi tenant bilan explicit cheklangan (Prisma middleware ustiga qo'shimcha).
// =============================================

const READ_DEFAULTS = { requiresConfirm: false, audit: false } as const;

export const READ_TOOLS: AgentToolDef[] = [
  {
    ...READ_DEFAULTS,
    name: 'searchCustomers',
    description:
      "Mijozni ism bo'yicha qidirish. Mijoz haqida savol bo'lsa (qarzi, telefoni) avval shu bilan top.",
    permissions: ['canViewCustomers'],
    inputSchema: z.object({
      query: z.string().min(1).describe('Mijoz ismi yoki ism qismi'),
    }),
    summarize: (i) => `Mijoz qidiruvi: "${i.query}"`,
    execute: async (i, ctx) => {
      const customers = await ctx.services.prisma.customer.findMany({
        where: { tenantId: ctx.tenantId, name: { contains: i.query, mode: 'insensitive' } },
        select: {
          id: true, name: true, phone: true, totalDebt: true, totalPaid: true,
          contacts: { where: { isPrimary: true }, select: { firstName: true, phone: true }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
      return { topildi: customers.length, mijozlar: customers };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'getDebtors',
    description: "Qarzdor mijozlar ro'yxati (qarzi kattasidan boshlab).",
    permissions: ['canViewCustomers'],
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10).describe('Nechta mijoz'),
    }),
    summarize: () => "Qarzdorlar ro'yxati",
    execute: async (i, ctx) => {
      const debtors = await ctx.services.prisma.customer.findMany({
        where: { tenantId: ctx.tenantId, totalDebt: { gt: 0 } },
        select: { id: true, name: true, phone: true, totalDebt: true },
        orderBy: { totalDebt: 'desc' },
        take: i.limit ?? 10,
      });
      const jami = debtors.reduce((s, d) => s + (d.totalDebt || 0), 0);
      return { soni: debtors.length, jami_qarz: jami, qarzdorlar: debtors };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'getFinanceSummary',
    description: "Davr bo'yicha moliya xulosasi: jami kirim, chiqim va balans.",
    permissions: ['canViewFinance', 'canViewTotalBalance'],
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).default(30).describe('Oxirgi necha kun'),
    }),
    summarize: (i) => `Moliya xulosasi (oxirgi ${i.days ?? 30} kun)`,
    execute: async (i, ctx) => {
      const from = new Date(Date.now() - (i.days ?? 30) * 86400000);
      const base = { tenantId: ctx.tenantId, date: { gte: from } };
      const [kirim, chiqim] = await Promise.all([
        ctx.services.prisma.transaction.aggregate({ where: { ...base, type: 'kirim' }, _sum: { amount: true }, _count: true }),
        ctx.services.prisma.transaction.aggregate({ where: { ...base, type: 'chiqim' }, _sum: { amount: true }, _count: true }),
      ]);
      const k = kirim._sum.amount || 0;
      const c = chiqim._sum.amount || 0;
      return {
        davr_kun: i.days ?? 30,
        kirim: k, kirim_soni: kirim._count,
        chiqim: c, chiqim_soni: chiqim._count,
        balans: k - c,
      };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'getRecentTransactions',
    description: "Oxirgi kassa tranzaksiyalari ro'yxati (kirim/chiqim).",
    permissions: ['canViewFinance'],
    inputSchema: z.object({
      days: z.number().int().min(1).max(90).default(7),
      type: z.enum(['kirim', 'chiqim']).optional().describe("Bo'sh qoldirilsa ikkalasi ham"),
      limit: z.number().int().min(1).max(50).default(15),
    }),
    summarize: (i) => `Oxirgi tranzaksiyalar (${i.type || 'hammasi'}, ${i.days ?? 7} kun)`,
    execute: async (i, ctx) => {
      const from = new Date(Date.now() - (i.days ?? 7) * 86400000);
      const txs = await ctx.services.prisma.transaction.findMany({
        where: {
          tenantId: ctx.tenantId,
          date: { gte: from },
          ...(i.type ? { type: i.type } : {}),
        },
        select: {
          id: true, type: true, amount: true, date: true,
          customerName: true, expenseReason: true, serviceType: true,
          customer: { select: { name: true } },
          paymentType: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        take: i.limit ?? 15,
      });
      return {
        soni: txs.length,
        tranzaksiyalar: txs.map((t) => ({
          id: t.id, tur: t.type, summa: t.amount, sana: t.date,
          mijoz: t.customer?.name || t.customerName || null,
          sabab: t.expenseReason || t.serviceType || null,
          tolov_turi: t.paymentType?.name || null,
        })),
      };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'searchOrders',
    description:
      "Buyurtmalarni qidirish — nom, sarlavha, displayId (masalan YC-10001) yoki mijoz ismi bo'yicha.",
    permissions: ['canViewTasks'],
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(30).default(10),
    }),
    summarize: (i) => `Buyurtma qidiruvi: "${i.query}"`,
    execute: async (i, ctx) => {
      const tasks = await ctx.services.prisma.task.findMany({
        where: {
          tenantId: ctx.tenantId,
          isArchived: false,
          OR: [
            { orderName: { contains: i.query, mode: 'insensitive' } },
            { title: { contains: i.query, mode: 'insensitive' } },
            { displayId: { contains: i.query, mode: 'insensitive' } },
            { customerName: { contains: i.query, mode: 'insensitive' } },
            { customer: { name: { contains: i.query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true, displayId: true, orderName: true, title: true,
          quantity: true, totalAmount: true, depositAmount: true, remainingAmount: true,
          deadlineAt: true, createdAt: true,
          customer: { select: { name: true } }, customerName: true,
          column: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: i.limit ?? 10,
      });
      return {
        topildi: tasks.length,
        buyurtmalar: tasks.map((t) => ({
          id: t.id, displayId: t.displayId, nom: t.orderName || t.title,
          mijoz: t.customer?.name || t.customerName || null,
          soni: t.quantity, jami: t.totalAmount, zakolat: t.depositAmount, qoldiq: t.remainingAmount,
          muddat: t.deadlineAt, holat: t.column?.title || null,
        })),
      };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'getOrdersSummary',
    description: "Kanban holati: har ustunda nechta buyurtma va jami summalar.",
    permissions: ['canViewTasks'],
    inputSchema: z.object({}),
    summarize: () => 'Buyurtmalar xulosasi',
    execute: async (_i, ctx) => {
      const cols = await ctx.services.prisma.kanbanColumn.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { orderIdx: 'asc' },
        select: {
          id: true, title: true, isDone: true,
          tasks: {
            where: { isArchived: false },
            select: { totalAmount: true, remainingAmount: true },
          },
        },
      });
      return {
        ustunlar: cols.map((c) => ({
          nom: c.title,
          bajarilgan_ustun: c.isDone,
          buyurtma_soni: c.tasks.length,
          jami_summa: c.tasks.reduce((s, t) => s + (t.totalAmount || 0), 0),
          jami_qoldiq: c.tasks.reduce((s, t) => s + (t.remainingAmount || 0), 0),
        })),
      };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'getUpcomingDeadlines',
    description: "Muddati yaqinlashgan yoki o'tib ketgan buyurtmalar (bajarilmaganlar).",
    permissions: ['canViewTasks'],
    inputSchema: z.object({
      days: z.number().int().min(1).max(60).default(7).describe('Necha kun ichida'),
    }),
    summarize: (i) => `Yaqin muddatlar (${i.days ?? 7} kun)`,
    execute: async (i, ctx) => {
      const until = new Date(Date.now() + (i.days ?? 7) * 86400000);
      const tasks = await ctx.services.prisma.task.findMany({
        where: {
          tenantId: ctx.tenantId,
          isArchived: false,
          deadlineAt: { not: null, lte: until },
          column: { isDone: false },
        },
        select: {
          id: true, displayId: true, orderName: true, title: true, deadlineAt: true,
          remainingAmount: true,
          customer: { select: { name: true } }, customerName: true,
          column: { select: { title: true } },
        },
        orderBy: { deadlineAt: 'asc' },
        take: 30,
      });
      const now = Date.now();
      return {
        soni: tasks.length,
        buyurtmalar: tasks.map((t) => ({
          displayId: t.displayId, nom: t.orderName || t.title,
          mijoz: t.customer?.name || t.customerName || null,
          muddat: t.deadlineAt, holat: t.column?.title,
          otib_ketgan: !!t.deadlineAt && t.deadlineAt.getTime() < now,
          qoldiq: t.remainingAmount,
        })),
      };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'getLowStock',
    description: "Kam qolgan materiallar (qoldiq minimal chegaradan pastda yoki teng).",
    permissions: ['canViewInventory'],
    inputSchema: z.object({}),
    summarize: () => 'Kam qoldiq materiallar',
    execute: async (_i, ctx) => {
      // currentStock <= minStock ni ustun-ustunga solishtirish — kichik jadval,
      // JS'da filtrlash sodda va portativ.
      const materials = await ctx.services.prisma.material.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, name: true, unit: true, currentStock: true, minStock: true },
      });
      const low = materials.filter((m) => m.minStock > 0 && m.currentStock <= m.minStock);
      return {
        soni: low.length,
        materiallar: low.map((m) => ({
          nom: m.name, qoldiq: m.currentStock, minimal: m.minStock, birlik: m.unit,
        })),
      };
    },
  },
  {
    ...READ_DEFAULTS,
    name: 'searchMaterials',
    description: "Ombordagi materialni nomi bo'yicha qidirish (qoldiq bilan).",
    permissions: ['canViewInventory'],
    inputSchema: z.object({ query: z.string().min(1) }),
    summarize: (i) => `Material qidiruvi: "${i.query}"`,
    execute: async (i, ctx) => {
      const materials = await ctx.services.prisma.material.findMany({
        where: { tenantId: ctx.tenantId, name: { contains: i.query, mode: 'insensitive' } },
        select: { id: true, name: true, unit: true, currentStock: true, reservedStock: true, minStock: true },
        take: 10,
      });
      return { topildi: materials.length, materiallar: materials };
    },
  },
];
