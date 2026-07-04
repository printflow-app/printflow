import { z } from 'zod/v3';
import { PrismaService } from '../../../prisma/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { FinanceService } from '../../finance/finance.service';

// =============================================
// AGENT TOOL QATLAMI — Faza 1 (AaaS transformatsiya)
// Har bir tool mavjud servis/model ustidan yupqa qatlam:
//   - permissions: rol flaglari (can*) bilan darvoza — user ko'rmaydigan
//     tool model'ga ham berilmaydi.
//   - requiresConfirm: pul/o'zgartirish amali to'g'ridan-to'g'ri bajarilmaydi,
//     AgentAction(pending) yaratiladi va frontend confirm karta ko'rsatadi.
//   - audit: bajarilgan amal AgentAction(executed) sifatida yoziladi.
// Registry data-driven — yangi tool qo'shish uchun if-shox emas,
// faqat massivga yangi deklaratsiya qo'shiladi.
// =============================================

export interface ToolServices {
  prisma: PrismaService;
  tasks: TasksService;
  finance: FinanceService;
}

export interface ToolContext {
  tenantId: string;
  /** Employee.id yoki WorkspaceAdmin.id */
  userId: string;
  /** Chaqiruvchining filiali (workspace admin uchun null) */
  branchId: string | null;
  isAdmin: boolean;
  /** Rol flaglari (canViewFinance, canCreateTask, ...) — DB'dan yangi o'qiladi */
  perms: Record<string, any>;
  services: ToolServices;
}

export interface AgentToolDef {
  name: string;
  /** Model uchun tavsif — qachon ishlatishni tushuntiradi */
  description: string;
  /** Kerakli rol flaglari — bittasi yetarli (OR). Bo'sh = hammaga ochiq. Admin doim o'tadi. */
  permissions: string[];
  /** true → AgentAction(pending) + confirm karta; execute keyin chaqiriladi */
  requiresConfirm: boolean;
  /** true → bajarilganda AgentAction(executed) audit yozuvi qoldiriladi */
  audit: boolean;
  inputSchema: z.ZodObject<any>;
  /** Confirm kartada / audit lentasida ko'rsatiladigan odam o'qiydigan tavsif */
  summarize: (input: any) => string;
  execute: (input: any, ctx: ToolContext) => Promise<any>;
}

export function hasToolPermission(def: AgentToolDef, ctx: ToolContext): boolean {
  if (ctx.isAdmin) return true;
  if (def.permissions.length === 0) return true;
  return def.permissions.some((p) => !!ctx.perms?.[p]);
}

/** So'm formatlash — confirm kartalar uchun */
export function fmtSum(n: number): string {
  return `${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')} so'm`;
}
