import { z } from 'zod/v3';
import { AgentToolDef, fmtSum } from './types';
import { fonTopshiriqYarat } from '../agent-job.util';
import { xotiraYoz, xotiraOchir, MAX_FAKT_UZUNLIGI } from '../agent-memory.util';

// =============================================
// YOZISH TOOL'LARI.
// - Pul harakati (addTransaction) — requiresConfirm: foydalanuvchi kartada
//   tasdiqlamaguncha bajarilmaydi.
// - createOrder/createService/... — suhbatda og'zaki tasdiq olinadi (mavjud
//   UX), bajarilishi auditga yoziladi.
// Hammasi mavjud servislar orqali ishlaydi — biznes-logika (qarz sinxron,
// tarix, telegram xabar) chetlab o'tilmaydi.
// =============================================

export const WRITE_TOOLS: AgentToolDef[] = [
  {
    name: 'createOrder',
    description: 'Yangi buyurtma yaratish.',
    permissions: ['canCreateTask'],
    requiresConfirm: false, // og'zaki tasdiq oqimi mavjud (prompt qoidasi)
    audit: true,
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
      columnId: z.string().optional(),
      notes: z.string().optional(),
      // Optional analytical tag. Must be a Department id whose filial_id
      // matches the calling employee's branchId — AI should resolve by name
      // from contextData.bolimlar before passing here.
      departmentId: z.string().optional(),
      // Variant qatorlari — xizmatda variant_oqlari bo'lsa to'ldiriladi.
      // Variantlar berilsa, quantity = sum(soni) avtomatik hisoblanadi.
      variants: z
        .array(
          z.object({
            atributlar: z.record(z.string(), z.string()),
            soni: z.number().positive(),
          }),
        )
        .optional(),
    }),
    summarize: (i) =>
      `Buyurtma: ${i.orderName} — ${i.customerName || 'mijoz'} , ${fmtSum(i.totalAmount)}`,
    execute: async (args, ctx) => {
      // Safety check: reject cross-branch department to keep reporting consistent.
      if (args.departmentId) {
        const dept = await ctx.services.prisma.department.findFirst({
          where: { id: args.departmentId, tenantId: ctx.tenantId },
          select: { branchId: true },
        });
        if (dept && ctx.branchId && dept.branchId !== ctx.branchId) {
          return { success: false, error: "Tanlangan bo'lim sizning filialingizga tegishli emas" };
        }
      }
      let columnId = args.columnId;
      if (!columnId) {
        const firstCol = await ctx.services.prisma.kanbanColumn.findFirst({
          where: { tenantId: ctx.tenantId },
          orderBy: { orderIdx: 'asc' },
          select: { id: true },
        });
        if (!firstCol) return { success: false, error: 'Kanban ustuni topilmadi' };
        columnId = firstCol.id;
      }
      const task = await ctx.services.tasks.create(
        {
          ...args,
          columnId,
          assignees: args.assigneeId ? JSON.stringify([args.assigneeId]) : '[]',
          deadlineAt: args.deadlineAt ? new Date(args.deadlineAt) : null,
          targetBranchId: ctx.branchId,
          branchId: ctx.branchId,
          departmentId: args.departmentId || null,
          variants: args.variants ?? undefined,
        },
        ctx.userId,
      );
      return { success: true, id: task.id, displayId: task.displayId };
    },
  },
  {
    name: 'createService',
    description: "Yangi xizmat turi qo'shish (katalogga).",
    permissions: ['canManageServices'],
    requiresConfirm: false,
    audit: true,
    inputSchema: z.object({
      name: z.string(),
      basePrice: z.number().positive(),
      unit: z.string(),
      description: z.string().optional(),
    }),
    summarize: (i) => `Yangi xizmat: ${i.name} — ${fmtSum(i.basePrice)}/${i.unit}`,
    execute: async (args, ctx) => {
      // Services are strictly branch-isolated. Use the caller's home branch;
      // refuse to create if the AI user has no branch (e.g. workspace admin).
      if (!ctx.branchId) {
        return {
          success: false,
          error: 'Xizmat yaratish uchun aktiv filial kerak. Filialdagi xodim sifatida kiring.',
        };
      }
      const service = await ctx.services.prisma.service.create({
        data: {
          tenantId: ctx.tenantId,
          branchId: ctx.branchId,
          name: args.name,
          basePrice: args.basePrice,
          unit: args.unit,
          description: args.description,
        },
      });
      return { success: true, id: service.id };
    },
  },
  {
    name: 'createServiceOption',
    description: 'Xizmat uchun yangi optsiya yoki narx qoidasi yaratish.',
    permissions: ['canManageServices'],
    requiresConfirm: false,
    audit: true,
    inputSchema: z.object({
      targetServiceName: z.string(),
      optionName: z.string(),
      optionValue: z.string(),
      oldPrice: z.number(),
      newPrice: z.number(),
      note: z.string().optional(),
    }),
    summarize: (i) => `Optsiya: ${i.targetServiceName} → ${i.optionName} (${i.optionValue})`,
    execute: async (args, ctx) => {
      const service = await ctx.services.prisma.service.findFirst({
        where: {
          tenantId: ctx.tenantId,
          name: { contains: args.targetServiceName, mode: 'insensitive' },
        },
      });
      if (!service) return { success: false, error: 'Xizmat topilmadi' };
      const option = await ctx.services.prisma.serviceOption.create({
        data: {
          tenantId: ctx.tenantId,
          serviceId: service.id,
          name: args.optionName,
          value: args.optionValue,
          priceAdd: args.newPrice - args.oldPrice,
        },
      });
      return { success: true, id: option.id };
    },
  },
  {
    name: 'addTransaction',
    description:
      "Kassaga kirim yoki chiqim kiritish. DIQQAT: bu pul amali — chaqirilganda foydalanuvchiga tasdiqlash kartasi chiqadi, natijani kutma, foydalanuvchini kartani tasdiqlashga yo'naltir.",
    permissions: ['canAddIncome', 'canAddExpense'],
    requiresConfirm: true,
    audit: true,
    inputSchema: z.object({
      type: z.enum(['kirim', 'chiqim']),
      amount: z.number().positive(),
      paymentTypeId: z.string().optional().describe("contextData.tolov_turlari'dan"),
      customerId: z.string().optional().describe("Kirim mijozdan bo'lsa"),
      customerName: z.string().optional().describe("Ro'yxatda yo'q mijoz ismi"),
      serviceType: z.string().optional().describe('Kirim izohi (xizmat nomi)'),
      expenseTypeId: z.string().optional(),
      expenseReason: z.string().optional().describe('Chiqim sababi'),
    }),
    summarize: (i) =>
      i.type === 'kirim'
        ? `KIRIM ${fmtSum(i.amount)}${i.customerName ? ` — ${i.customerName}` : ''}${i.serviceType ? ` (${i.serviceType})` : ''}`
        : `CHIQIM ${fmtSum(i.amount)}${i.expenseReason ? ` — ${i.expenseReason}` : ''}`,
    execute: async (args, ctx) => {
      // Tur bo'yicha aniq ruxsat tekshiruvi (registry darvozasi OR bilan o'tkazadi)
      if (!ctx.isAdmin) {
        if (args.type === 'kirim' && !ctx.perms?.canAddIncome) {
          return { success: false, error: "Kirim kiritish ruxsati yo'q" };
        }
        if (args.type === 'chiqim' && !ctx.perms?.canAddExpense) {
          return { success: false, error: "Chiqim kiritish ruxsati yo'q" };
        }
      }
      const tx = await ctx.services.finance.createTransaction({
        type: args.type,
        amount: args.amount,
        paymentTypeId: args.paymentTypeId || null,
        customerId: args.customerId || null,
        customerName: args.customerName || null,
        serviceType: args.serviceType || null,
        expenseTypeId: args.expenseTypeId || null,
        expenseReason: args.expenseReason || null,
        branchId: ctx.branchId,
        createdById: ctx.userId,
      });
      return { success: true, id: tx.id, summa: tx.amount, tur: tx.type };
    },
  },
  {
    name: 'addCustomer',
    description: "Yangi mijoz qo'shish (CRM bazasiga).",
    permissions: ['canManageCustomers', 'canAddCustomer'],
    requiresConfirm: false,
    audit: true,
    inputSchema: z.object({
      name: z.string().min(1).describe('Kompaniya yoki shaxs nomi'),
      phone: z.string().optional(),
    }),
    summarize: (i) => `Yangi mijoz: ${i.name}${i.phone ? ` (${i.phone})` : ''}`,
    execute: async (args, ctx) => {
      const existing = await ctx.services.prisma.customer.findFirst({
        where: { tenantId: ctx.tenantId, name: { equals: args.name, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (existing) {
        return { success: false, error: `"${existing.name}" nomli mijoz allaqachon mavjud`, id: existing.id };
      }
      const customer = await ctx.services.prisma.customer.create({
        data: {
          tenantId: ctx.tenantId,
          name: args.name,
          phone: args.phone || null,
          branchId: ctx.branchId,
        },
      });
      return { success: true, id: customer.id };
    },
  },
  {
    name: 'moveOrder',
    description:
      "Buyurtmani boshqa kanban ustuniga ko'chirish (holatini o'zgartirish). Buyurtmani searchOrders bilan top, ustun ID'sini contextData.ustunlar'dan ol.",
    permissions: ['canMoveTask'],
    requiresConfirm: false, // qaytarilishi oson amal
    audit: true,
    inputSchema: z.object({
      taskId: z.string().describe("Buyurtma ID (searchOrders'dan)"),
      columnId: z.string().describe("Yangi ustun ID (contextData.ustunlar'dan)"),
    }),
    summarize: (i) => `Buyurtmani ko'chirish → yangi ustun`,
    execute: async (args, ctx) => {
      const [task, column] = await Promise.all([
        ctx.services.prisma.task.findFirst({
          where: { id: args.taskId, tenantId: ctx.tenantId },
          select: { id: true, displayId: true, orderName: true, title: true },
        }),
        ctx.services.prisma.kanbanColumn.findFirst({
          where: { id: args.columnId, tenantId: ctx.tenantId },
          select: { id: true, title: true },
        }),
      ]);
      if (!task) return { success: false, error: 'Buyurtma topilmadi' };
      if (!column) return { success: false, error: 'Ustun topilmadi' };
      // tasks.update — tarix (TaskHistory) va boshqa yon-effektlarni o'zi yuritadi
      await ctx.services.tasks.update(task.id, { columnId: column.id }, ctx.userId);
      return {
        success: true,
        displayId: task.displayId,
        nom: task.orderName || task.title,
        yangi_holat: column.title,
      };
    },
  },
  {
    name: 'reassignTask',
    description:
      "Buyurtmani boshqa xodimga qayta tayinlash — masalan, hozirgi tayinlangan xodim ishga kelmagan bo'lsa (dashboarddagi xavf kartasidan). Buyurtmani searchOrders bilan top, yangi xodim ID'sini contextData.xodimlar'dan ol.",
    permissions: ['canEditTask', 'canMoveTask'],
    requiresConfirm: true, // pul emas, lekin mas'uliyat o'zgarishi — tasdiq kerak
    audit: true,
    inputSchema: z.object({
      taskId: z.string().describe("Buyurtma ID (searchOrders'dan)"),
      newAssigneeId: z.string().describe("Yangi mas'ul xodim ID (contextData.xodimlar'dan)"),
    }),
    summarize: (i) => `Buyurtmani yangi xodimga qayta tayinlash`,
    execute: async (args, ctx) => {
      const [task, employee] = await Promise.all([
        ctx.services.prisma.task.findFirst({
          where: { id: args.taskId, tenantId: ctx.tenantId },
          select: { id: true, displayId: true, orderName: true, title: true },
        }),
        ctx.services.prisma.employee.findFirst({
          where: { id: args.newAssigneeId, tenantId: ctx.tenantId },
          select: { id: true, fullName: true },
        }),
      ]);
      if (!task) return { success: false, error: 'Buyurtma topilmadi' };
      if (!employee) return { success: false, error: 'Xodim topilmadi' };
      await ctx.services.tasks.update(task.id, { assignees: JSON.stringify([employee.id]) }, ctx.userId);
      return {
        success: true,
        displayId: task.displayId,
        nom: task.orderName || task.title,
        yangi_masul: employee.fullName,
      };
    },
  },
  {
    name: 'sendEmployeeMessage',
    description:
      "Xodimga Telegram orqali xabar yuborish — rahbar nomidan. Masalan: \"Azizbekka ayt, ertaga 9:00 da kelsin\". Xodim ID'sini contextData.xodimlar'dan ol. Xodimning Telegram'i ulanmagan bo'lsa xabar bormaydi.",
    // Xodimga to'g'ridan-to'g'ri xabar — bu tashqariga chiqadigan amal,
    // shuning uchun xodimlarni boshqarish huquqi talab qilinadi.
    permissions: ['canManageEmployees', 'canViewEmployees'],
    // Xabar yuborilgach qaytarib bo'lmaydi va u rahbar nomidan ketadi —
    // matnni odam ko'rib tasdiqlashi shart.
    requiresConfirm: true,
    audit: true,
    inputSchema: z.object({
      employeeId: z.string().describe("Xodim ID (contextData.xodimlar'dan)"),
      text: z.string().min(1).max(1000).describe("Xabar matni — o'zbekcha, qisqa va aniq"),
    }),
    summarize: (i) => `Xodimga Telegram xabar yuborish: "${String(i.text).slice(0, 60)}"`,
    execute: async (args, ctx) => {
      const employee = await ctx.services.prisma.employee.findFirst({
        where: { id: args.employeeId, tenantId: ctx.tenantId },
        select: { id: true, fullName: true, telegramId: true },
      });
      if (!employee) return { success: false, error: 'Xodim topilmadi' };
      if (!employee.telegramId) {
        return {
          success: false,
          error: `${employee.fullName}ning Telegram akkaunti ulanmagan — xabar yuborib bo'lmaydi`,
        };
      }
      // Xodim xabar AI'dan emas, rahbariyatdan kelganini bilishi kerak —
      // aks holda u kimga javob berishini tushunmaydi.
      await ctx.services.telegram.sendMessage(
        employee.telegramId,
        `📣 *Rahbariyatdan xabar*\n\n${args.text}`,
      );
      return { success: true, kimga: employee.fullName };
    },
  },
  {
    name: 'startJob',
    description:
      "UZOQ TOPSHIRIQNI FONGA UZATISH. Foydalanuvchi bir necha bosqichli, ko'p vaqt oladigan ish "
      + "so'raganda ishlat — masalan \"barcha qarzdorlarga eslatma yubor va hisobot ber\", "
      + "\"muddati o'tgan buyurtmalarni ko'rib chiq va mas'ullarga vazifa tayinla\". "
      + "Topshiriq fonda bajariladi, natija Telegram'ga keladi. "
      + "MUHIM: bitta savolga javob berish yoki bitta amalni bajarish uchun BUNI ISHLATMA — "
      + "oddiy ishni o'zing shu yerda darhol qil. Bu faqat ko'p qadamli ish uchun.",
    // Fon topshirig'i foydalanuvchi ruxsatlari bilan ishlaydi, ya'ni o'zi
    // qo'shimcha huquq bermaydi. Shuning uchun alohida ruxsat talab qilinmaydi —
    // agent fonda ham faqat chaqiruvchi qila oladigan ishni qiladi.
    permissions: [],
    // Tasdiq kartasi CHIQMAYDI. Topshiriqning o'zi hech narsani o'zgartirmaydi —
    // u shunchaki navbatga qo'yiladi. Ichidagi xavfli amallar esa fonda
    // bajarilayotganda odatdagidek tasdiq navbatiga tushadi.
    requiresConfirm: false,
    audit: true,
    inputSchema: z.object({
      topshiriq: z
        .string()
        .min(10)
        .max(2000)
        .describe(
          "Agentga to'liq topshiriq — nima qilish kerakligi aniq va batafsil yozilsin. "
          + "Fon agenti savol berolmaydi, shuning uchun kerakli tafsilotlarni shu yerga kirit.",
        ),
      sarlavha: z
        .string()
        .min(3)
        .max(120)
        .describe("Ro'yxatda ko'rinadigan qisqa nom, masalan \"Qarzdorlarga eslatma\""),
    }),
    summarize: (i) => `Fon topshirig'i: ${i.sarlavha}`,
    execute: async (args, ctx) => {
      const res = await fonTopshiriqYarat(
        ctx.services.prisma,
        ctx.tenantId,
        ctx.userId,
        args.topshiriq,
        args.sarlavha,
      );
      if (!res.success) return res;
      return {
        ...res,
        xabar:
          "Topshiriq navbatga qo'yildi va fonda bajarila boshlaydi. "
          + "Tayyor bo'lganda natija Telegram'ga keladi.",
      };
    },
  },
  {
    name: 'remember',
    description:
      "Keyingi suhbatlarda kerak bo'ladigan faktni XOTIRAGA yozish. "
      + "Ishlat: foydalanuvchi doimiy qoida yoki afzallik aytganda (\"hisobotni doim qisqa ber\"), "
      + "yoki tashkilot haqida takrorlanadigan fakt bilib olganingda (\"Avlod Shifoxona odatda 30 kun kechikib to'laydi\"). "
      + "ISHLATMA: tizimdan tool orqali olinadigan ma'lumot uchun (qarz, buyurtma, qoldiq — bular o'zgaradi va "
      + "xotirada eskirib qoladi), yoki faqat shu suhbatga tegishli narsa uchun. "
      + "Ayni mavzuda yozuv bo'lsa u yangilanadi, nusxa yaratilmaydi.",
    // Xotira faqat agentning o'z xulqiga ta'sir qiladi — biznes ma'lumotini
    // o'zgartirmaydi, pul harakati qilmaydi. Shuning uchun alohida ruxsat yo'q.
    permissions: [],
    requiresConfirm: false,
    audit: true,
    inputSchema: z.object({
      mavzu: z
        .string()
        .min(2)
        .max(80)
        .describe("Qisqa sarlavha, masalan \"Avlod Shifoxona to'lov odati\" — takrorni aniqlash shu bo'yicha"),
      matn: z
        .string()
        .min(3)
        .max(MAX_FAKT_UZUNLIGI)
        .describe("Faktning o'zi — bir-ikki jumla, aniq va o'zicha tushunarli"),
      faqatMenga: z
        .boolean()
        .default(false)
        .describe(
          "true — bu shu foydalanuvchining shaxsiy sozlamasi (uslub, afzallik). "
          + "false — butun tashkilotga tegishli fakt.",
        ),
    }),
    summarize: (i) => `Xotiraga yozish: ${i.mavzu}`,
    execute: async (args, ctx) =>
      xotiraYoz(
        ctx.services.prisma,
        ctx.tenantId,
        ctx.userId,
        args.mavzu,
        args.matn,
        !!args.faqatMenga,
      ),
  },
  {
    name: 'forget',
    description:
      "Eskirgan yoki noto'g'ri faktni xotiradan o'chirish. Xotiradagi narsa endi to'g'ri "
      + "kelmasa, avval shuni chaqir, keyin remember bilan yangisini yoz.",
    permissions: [],
    requiresConfirm: false,
    audit: true,
    inputSchema: z.object({
      mavzu: z.string().min(2).max(80).describe("O'chiriladigan xotira mavzusi — xotirada ko'rsatilgani bilan bir xil"),
    }),
    summarize: (i) => `Xotiradan o'chirish: ${i.mavzu}`,
    execute: async (args, ctx) =>
      xotiraOchir(ctx.services.prisma, ctx.tenantId, ctx.userId, args.mavzu),
  },
];
