import { tool } from 'ai';
import { AgentToolDef, ToolContext, hasToolPermission } from './types';
import { READ_TOOLS } from './read-tools';
import { WRITE_TOOLS } from './write-tools';

// =============================================
// TOOL REGISTRY — data-driven: yangi tool = massivga yangi element.
// buildAiSdkTools() joriy user ruxsatlariga qarab tool to'plamini yig'adi:
//   - ruxsat yo'q tool model'ga umuman ko'rinmaydi;
//   - requiresConfirm tool'lar bajarilmaydi — AgentAction(pending) yaratiladi,
//     frontend confirm karta ko'rsatadi, keyin executeConfirmedAction() ishlaydi;
//   - audit tool'lar har bajarilishda AgentAction(executed/failed) yozadi.
// =============================================

export const AGENT_TOOLS: AgentToolDef[] = [...READ_TOOLS, ...WRITE_TOOLS];

export function visibleTools(ctx: ToolContext): AgentToolDef[] {
  return AGENT_TOOLS.filter((d) => hasToolPermission(d, ctx));
}

/** System prompt uchun tool ro'yxati (faqat ko'rinadiganlar) */
export function describeTools(ctx: ToolContext): string {
  return visibleTools(ctx)
    .map((d) => `- ${d.name}${d.requiresConfirm ? ' [TASDIQ KARTASI]' : ''}: ${d.description}`)
    .join('\n');
}

/**
 * Faqat tasdiq talab qiladigan tool nomlari.
 *
 * Nega describeTools o'rniga shu ishlatiladi: tool nomi, tavsifi va
 * parametrlari modelga `tools` parametri orqali allaqachon to'liq yuboriladi
 * (~3600 token). describeTools o'sha ma'lumotni system prompt'da SO'ZMA-SO'Z
 * takrorlaydi — yana ~870 token, har so'rovda. Takrorda modelga yangi
 * ma'lumot yo'q; yagona qo'shimcha signal — qaysi tool tasdiq kartasi
 * chiqarishi. Shuning uchun faqat shuni yuboramiz.
 */
export function describeConfirmTools(ctx: ToolContext): string {
  const names = visibleTools(ctx)
    .filter((d) => d.requiresConfirm)
    .map((d) => d.name);
  return names.length ? names.join(', ') : 'yo\'q';
}

async function writeAudit(
  ctx: ToolContext,
  def: AgentToolDef,
  input: any,
  status: 'executed' | 'failed',
  result?: any,
  error?: string,
) {
  try {
    await ctx.services.prisma.agentAction.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        toolName: def.name,
        summary: def.summarize(input),
        input,
        status,
        result: result ?? undefined,
        error: error ?? undefined,
        executedAt: status === 'executed' ? new Date() : undefined,
      },
    });
  } catch {
    // Audit yozilmasa amalni buzmaymiz — log darajasida yetarli.
  }
}

/** ai-sdk streamText uchun tools obyekti */
export function buildAiSdkTools(ctx: ToolContext): Record<string, any> {
  const out: Record<string, any> = {};
  for (const def of visibleTools(ctx)) {
    out[def.name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (args: any) => {
        try {
          if (def.requiresConfirm) {
            const action = await ctx.services.prisma.agentAction.create({
              data: {
                tenantId: ctx.tenantId,
                userId: ctx.userId,
                toolName: def.name,
                summary: def.summarize(args),
                input: args,
                status: 'pending',
              },
            });
            return {
              pendingConfirm: true,
              actionId: action.id,
              summary: action.summary,
              xabar:
                "Tasdiqlash kartasi ko'rsatildi. Amal foydalanuvchi kartani tasdiqlagandan keyin bajariladi.",
            };
          }
          const result = await def.execute(args, ctx);
          if (def.audit) {
            const failed = result && result.success === false;
            await writeAudit(ctx, def, args, failed ? 'failed' : 'executed', result, failed ? result.error : undefined);
          }
          return result;
        } catch (e: any) {
          const msg = e?.message || 'Nomaʼlum xatolik';
          if (def.audit) await writeAudit(ctx, def, args, 'failed', undefined, msg);
          return { success: false, error: msg };
        }
      },
    });
  }
  return out;
}

/**
 * Pending AgentAction'ni bajarish (foydalanuvchi kartada tasdiqlagach).
 * Faqat amalni yaratgan user o'zi tasdiqlay oladi; ruxsat qayta tekshiriladi.
 */
export async function executeConfirmedAction(ctx: ToolContext, actionId: string) {
  const prisma = ctx.services.prisma;
  const action = await prisma.agentAction.findFirst({
    where: { id: actionId, tenantId: ctx.tenantId },
  });
  if (!action) return { success: false, error: 'Amal topilmadi' };
  // Odatda amalni faqat uni so'ragan foydalanuvchi tasdiqlaydi. ISTISNO —
  // AI avtonom yaratgan takliflar (userId='autonomous'): ularni hech kim
  // so'ramagan, shuning uchun ruxsati bor har qanday xodim tasdiqlay oladi.
  // Bu tekshiruvsiz avtonom takliflar abadiy "pending" bo'lib qolardi.
  if (action.userId !== ctx.userId && action.userId !== 'autonomous') {
    return { success: false, error: "Bu amalni faqat uni so'ragan foydalanuvchi tasdiqlay oladi" };
  }
  if (action.status !== 'pending') {
    return { success: false, error: `Amal allaqachon yakunlangan (${action.status})` };
  }

  const def = AGENT_TOOLS.find((d) => d.name === action.toolName);
  if (!def) return { success: false, error: 'Tool topilmadi' };
  if (!hasToolPermission(def, ctx)) {
    return { success: false, error: "Bu amal uchun ruxsatingiz yo'q" };
  }

  try {
    const parsed = def.inputSchema.parse(action.input);
    const result = await def.execute(parsed, ctx);
    const failed = result && result.success === false;
    await prisma.agentAction.update({
      where: { id: action.id },
      data: {
        status: failed ? 'failed' : 'executed',
        result: result ?? undefined,
        error: failed ? result.error : undefined,
        executedAt: new Date(),
      },
    });
    return failed ? result : { success: true, result, summary: action.summary };
  } catch (e: any) {
    const msg = e?.message || 'Nomaʼlum xatolik';
    await prisma.agentAction.update({
      where: { id: action.id },
      data: { status: 'failed', error: msg },
    });
    return { success: false, error: msg };
  }
}

/** Pending amalni rad etish */
export async function rejectAction(ctx: ToolContext, actionId: string) {
  const prisma = ctx.services.prisma;
  const action = await prisma.agentAction.findFirst({
    where: { id: actionId, tenantId: ctx.tenantId, userId: ctx.userId, status: 'pending' },
  });
  if (!action) return { success: false, error: 'Kutilayotgan amal topilmadi' };
  await prisma.agentAction.update({
    where: { id: action.id },
    data: { status: 'rejected' },
  });
  return { success: true };
}
