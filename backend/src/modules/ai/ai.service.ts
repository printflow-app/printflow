import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool } from 'ai';
import { z } from 'zod/v3';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropicClient: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      this.logger.error('══ KRITIK: ANTHROPIC_API_KEY topilmadi! ══');
    }
    this.anthropicClient = createAnthropic({ apiKey });
  }

  async streamChat(
    messages: any[],
    tenantId?: string,
    employeeId?: string,
  ): Promise<Response> {
    if (!tenantId) {
      throw new Error('Avtorizatsiya xatosi.');
    }

    try {
      const [employees, customers, servicesRaw, kanbanCols, paymentTypes, departmentsRaw] = await Promise.all([
        this.prisma.employee.findMany({
          where: { tenantId },
          select: { id: true, fullName: true, branchId: true, role: { select: { name: true } } },
        }),
        this.prisma.customer.findMany({
          where: { tenantId },
          select: { id: true, name: true, totalDebt: true },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        }),
        this.prisma.service.findMany({ where: { tenantId }, include: { options: true } }),
        this.prisma.kanbanColumn.findMany({
          where: { tenantId },
          orderBy: { orderIdx: 'asc' },
          select: { id: true, title: true },
        }),
        this.prisma.paymentType.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        (this.prisma as any).department.findMany({
          where: { tenantId },
          select: { id: true, name: true, branchId: true },
        }),
      ]);

      const contextData = {
        xodimlar: employees.map(e => ({ id: e.id, ism: e.fullName, rol: e.role.name })),
        mijozlar: customers.map(c => ({ id: c.id, ism: c.name, qarz: c.totalDebt })),
        xizmatlar: servicesRaw.map(s => ({
          id: s.id,
          nom: s.name,
          narx: s.basePrice,
          birlik: s.unit,
          optsiyalar: s.options.map(o => ({
            id: o.id,
            nom: o.name,
            qiymat: o.value,
            qoshimcha_narx: o.priceAdd,
          })),
        })),
        ustunlar: kanbanCols.map(k => ({ id: k.id, nom: k.title })),
        tolov_turlari: paymentTypes.map(p => ({ id: p.id, nom: p.name })),
        bolimlar: departmentsRaw.map((d: any) => ({ id: d.id, nom: d.name, filial_id: d.branchId })),
      };

      const firstColId = kanbanCols[0]?.id || '';

      const systemPrompt = `You are PrintFlow AI PRO, an advanced assistant and tutor for the PrintFlow ERP system. Today's date is ${new Date().toLocaleDateString('uz-UZ')}.

CORE RESPONSIBILITIES:
1. AUTOMATION: You can automatically create orders, add services, and create service options using tools.
2. GUIDANCE & TUTORING: For actions you CANNOT do automatically, you must act as a guide. Explain precisely where the user needs to go in the system and what buttons to click.

NAVIGATION GUIDE (How to use the platform manually):
- Kassa (Tranzaksiyalar): Sidebar -> "KASSA". View incomes/expenses, filter by date.
- Statistika (Dashboard): Sidebar -> "STATISTIKA". General business overview.
- Hisobotlar: Sidebar -> "HISOBOTLAR". Detailed business analysis.
- Xizmatlar (Kanban): Sidebar -> "XIZMATLAR (KANBAN)". Manage current orders.
- Mijozlar: Sidebar -> "MIJOZLAR BAZASI". Manage CRM and debts.
- Xodimlar: Sidebar -> "XODIMLAR". Manage team and salaries. To add an employee: Click "Yangi xodim" button.
- Ma'muriyat: Sidebar -> "MA'MURIYAT". Role-based access and permissions.
- Ombor: Sidebar -> "OMBOR". Materials and stock management.
- Davomat: Sidebar -> "DAVOMAT". Employee attendance records.
- Hamkorlar: Sidebar -> "HAMKORLAR". Outsourcing and vendor management.
- Tizim Sozlamalari: Sidebar -> "TIZIM SOZLAMALARI". Change branch, manage billing/plans, and system settings.

TOOL USAGE RULES:
Before calling any tool, you MUST summarize the details strictly in one of these templates:

Template 1 (Orders):
- Buyurtma: [Mijoz] - [Xizmat]
- Mijoz: [Mijoz]
- Xizmat: [Xizmat va o'lcham]
- Bo'lim: [Bo'lim nomi yoki Yo'q] (only if the current branch has departments — match by name from "bolimlar" where filial_id = employee's branchId; if no match found or branch has no departments, use "Yo'q")
- Zakolat: [Summa]
- To'lov turi: [Naqd/Click]
- Muddat: [Sana, Vaqt]

Template 2 (New Service):
- Xizmat qo'shish: [Xizmat nomi]
- Asosiy narx: [Summa]
- O'lchov birligi: [dona, metr, m2, vs]
- Tavsif: [Izoh yoki Yo'q]

Template 3 (Service Option/Volume Discount):
- Optsiya: [Qaysi xizmat uchun] - [Optsiya nomi]
- Qiymati: [Masalan: 3000 ta, yoki Qalin qog'oz]
- Asosiy narx: [Joriy narx, masalan: 500]
- Yangi (o'zgargan) narx: [Masalan: 250]
- Izoh: [Izoh yoki Yo'q]

Rule: If any required detail is missing, ask ONE short question to get it. DO NOT call the tool until the summary is presented and confirmed by the user. If the user asks for something outside of these 3 automated workflows, provide step-by-step navigation instructions using the NAVIGATION GUIDE.

TIZIMDAGI MA'LUMOTLAR:
${JSON.stringify(contextData)}`;

      // --- TOKEN DIET: SAFE TRUNCATION LOGIC ---
      const MESSAGE_LIMIT = 6;
      let truncatedMessages = messages.filter(m => 
        (typeof m.content === 'string' ? m.content.trim().length > 0 : true)
      );

      if (truncatedMessages.length > MESSAGE_LIMIT) {
        let sliceIndex = truncatedMessages.length - MESSAGE_LIMIT;
        
        // Ensure we don't start with a 'tool' role (result) or a message that orphans a tool call.
        // If the message at sliceIndex is a tool result, we must include the previous assistant message too.
        while (sliceIndex > 0 && (
          truncatedMessages[sliceIndex].role === 'tool' || 
          (Array.isArray(truncatedMessages[sliceIndex].content) && 
           truncatedMessages[sliceIndex].content.some((c: any) => c.type === 'tool-result'))
        )) {
          sliceIndex--;
        }
        truncatedMessages = truncatedMessages.slice(sliceIndex);
      }

      const coreMessages: any[] = truncatedMessages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
        ...(m.toolResults ? { toolResults: m.toolResults } : {}),
      }));

      // Guard: SDK requires at least one message
      if (coreMessages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Xabar bo\'sh bo\'lishi mumkin emas.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // SDK v6: streamText is NOT awaited — it returns StreamTextResult synchronously
      const result = streamText({
        model: this.anthropicClient('claude-haiku-4-5'),
        system: systemPrompt,
        messages: coreMessages,
        temperature: 0.2,
        tools: {
          createOrder: tool({
            description: 'Yangi buyurtma yaratish.',
            inputSchema: z.object({
              orderName: z.string(),
              title: z.string(),
              customerName: z.string().optional(),
              customerId: z.string().optional(),
              serviceId: z.string().optional(),
              quantity: z.number().default(1),
              totalAmount: z.number(),
              depositAmount: z.number().default(0),
              paymentTypeId: z.string().optional(),
              assigneeId: z.string().optional(),
              deadlineAt: z.string().optional(),
              columnId: z.string().default(firstColId),
              notes: z.string().optional(),
              // Optional analytical tag. Must be a Department id whose filial_id
              // matches the calling employee's branchId — AI should resolve by name
              // from contextData.bolimlar before passing here.
              departmentId: z.string().optional(),
            }),
            execute: async (args) => {
              const currentEmployee = employees.find(e => e.id === employeeId);
              // Safety check: reject cross-branch department to keep reporting consistent.
              if (args.departmentId) {
                const dept = departmentsRaw.find((d: any) => d.id === args.departmentId);
                if (dept && currentEmployee?.branchId && dept.branchId !== currentEmployee.branchId) {
                  return { success: false, error: "Tanlangan bo'lim sizning filialingizga tegishli emas" };
                }
              }
              const task = await this.tasksService.create(
                {
                  ...args,
                  assignees: args.assigneeId ? JSON.stringify([args.assigneeId]) : '[]',
                  deadlineAt: args.deadlineAt ? new Date(args.deadlineAt) : null,
                  targetBranchId: currentEmployee?.branchId || null,
                  branchId: currentEmployee?.branchId || null,
                  departmentId: args.departmentId || null,
                },
                employeeId,
              );
              return { success: true, id: task.id, displayId: task.displayId };
            },
          }),
          createService: tool({
            description: "Yangi xizmat turi qo'shish.",
            inputSchema: z.object({
              name: z.string(),
              basePrice: z.number().positive(),
              unit: z.string(),
              description: z.string().optional(),
            }),
            execute: async (args) => {
              // Services are strictly branch-isolated. Use the caller's home branch;
              // refuse to create if the AI user has no branch (e.g. workspace admin).
              const callerEmployee = employees.find(e => e.id === employeeId);
              const branchId = callerEmployee?.branchId;
              if (!branchId) {
                return { success: false, error: 'Xizmat yaratish uchun aktiv filial kerak. Filialdagi xodim sifatida kiring.' };
              }
              const service = await this.prisma.service.create({
                data: {
                  tenantId,
                  branchId,
                  name: args.name,
                  basePrice: args.basePrice,
                  unit: args.unit,
                  description: args.description,
                },
              });
              return { success: true, id: service.id };
            },
          }),
          createServiceOption: tool({
            description: 'Xizmat uchun yangi optsiya yoki narx qoidasi yaratish.',
            inputSchema: z.object({
              targetServiceName: z.string(),
              optionName: z.string(),
              optionValue: z.string(),
              oldPrice: z.number(),
              newPrice: z.number(),
              note: z.string().optional(),
            }),
            execute: async (args) => {
              const service = servicesRaw.find(s =>
                s.name.toLowerCase().includes(args.targetServiceName.toLowerCase()),
              );
              if (!service) throw new Error('Xizmat topilmadi');
              const option = await this.prisma.serviceOption.create({
                data: {
                  tenantId,
                  serviceId: service.id,
                  name: args.optionName,
                  value: args.optionValue,
                  priceAdd: args.newPrice - args.oldPrice,
                },
              });
              return { success: true, id: option.id };
            },
          }),
        },
      });

      // SDK v6: toUIMessageStreamResponse() is available on StreamTextResult
      return result.toUIMessageStreamResponse();
    } catch (err: any) {
      this.logger.error('AI Error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
