import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Req,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { BriefingService } from './briefing.service';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RiskDetectionService } from './risk-detection.service';
import { AgentJobService } from './agent-job.service';

// SDK v6: UIMessage format sent by DefaultChatTransport
interface UIMessagePart {
  type: string;
  text?: string;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts?: UIMessagePart[];
  content?: string; // backward compat
}

interface ChatRequestBody {
  id?: string;
  messages: UIMessage[];
  trigger?: string;
  messageId?: string;
}

// AI'ni faqat SUPER ADMIN boshqaradi — workspace tarifidagi `ai_chat` moduli
// orqali. Lavozim darajasidagi `canUseAi` talabi OLIB TASHLANDI: tarif +
// global kalit + lavozim degan uch qavatli shart chalkashlik tug'dirardi.
@RequireFeature('ai_chat')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly briefingService: BriefingService,
    private readonly riskDetectionService: RiskDetectionService,
    private readonly agentJobService: AgentJobService,
  ) {}

  // =============================================
  // FON TOPSHIRIQLARI (Faza 3) — uzoq davom etadigan ishlar.
  // Odatda topshiriqni chat agenti `startJob` tool'i orqali yaratadi; bu
  // endpointlar uni kuzatish va boshqarish uchun. `POST /ai/jobs` esa
  // foydalanuvchi chatdan o'tmasdan to'g'ridan-to'g'ri topshiriq berishi
  // uchun — model chaqirilmaydi, ya'ni xabar limitidan hisoblanmaydi.
  // =============================================

  // =============================================
  // AGENT XOTIRASI (Faza 2) — agent nimani "bilib olgan"ini ko'rish va
  // kerak bo'lsa o'chirish. Yozishni agent o'zi `remember` tool'i orqali
  // qiladi; bu endpointlar nazorat uchun.
  // =============================================

  @Get('memories')
  async listMemories(@Req() req: any) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.aiService.listMemories(tenantId, sub);
  }

  @Post('memories/:id/delete')
  @HttpCode(HttpStatus.OK)
  async deleteMemory(@Req() req: any, @Param('id') id: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.aiService.deleteMemory(tenantId, sub, id);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.OK)
  async createJob(
    @Req() req: any,
    @Body() body: { topshiriq?: string; sarlavha?: string },
  ) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();

    const topshiriq = (body?.topshiriq || '').trim();
    if (topshiriq.length < 10) {
      return { success: false, error: "Topshiriq juda qisqa — nima qilish kerakligini yozing" };
    }
    return this.agentJobService.yarat(
      tenantId,
      sub,
      topshiriq,
      (body?.sarlavha || '').trim() || topshiriq,
    );
  }

  @Get('jobs')
  async listJobs(@Req() req: any, @Query('limit') limit?: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.agentJobService.royxat(tenantId, sub, limit ? Number(limit) : 20);
  }

  @Get('jobs/:id')
  async getJob(@Req() req: any, @Param('id') id: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.agentJobService.bitta(tenantId, sub, id);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelJob(@Req() req: any, @Param('id') id: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.agentJobService.bekorQil(tenantId, sub, id);
  }

  @Get('usage')
  async usage(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { used: 0, limit: 0, unlimited: false };
    return this.aiService.getUsage(tenantId);
  }

  /** Kunlik brifing — LLM'siz aggregation, xabar limitiga tegmaydi */
  @Get('briefing')
  async briefing(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();
    return this.briefingService.buildBriefing(tenantId);
  }

  // =============================================
  // XAVF KARTALARI (dashboard) — LLM'siz, deterministik korrelyatsiya.
  // Alohida ruxsat talab qilinmaydi: bu shunchaki kuzatuv ma'lumoti,
  // dashboard'ni ko'ra oladigan har kim ko'rishi mumkin.
  // =============================================

  @RequirePermissions()
  @Get('risks')
  async listRisks(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();
    return this.riskDetectionService.listOpenRisks(tenantId);
  }

  @RequirePermissions()
  @Post('risks/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismissRisk(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();
    return this.riskDetectionService.dismissRisk(tenantId, id);
  }

  // =============================================
  // AGENT AMALLARI — confirm karta oqimi + audit lentasi.
  // [TASDIQ KARTASI] tool'lar AgentAction(pending) yaratadi; frontend shu
  // endpointlar orqali tasdiqlaydi/rad etadi.
  // =============================================

  @Post('actions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmAction(@Req() req: any, @Param('id') id: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.aiService.confirmAction(tenantId, sub, id);
  }

  @Post('actions/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectAction(@Req() req: any, @Param('id') id: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.aiService.rejectAction(tenantId, sub, id);
  }

  @Get('actions')
  async listActions(@Req() req: any, @Query('limit') limit?: string) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.aiService.listActions(tenantId, sub, limit ? Number(limit) : 20);
  }

  /** Agent statistikasi — davr bo'yicha bajarilgan ishlar (Faza 5, billing'ga tegmaydi) */
  @Get('agent-stats')
  async agentStats(@Req() req: any) {
    const { tenantId, sub } = req.user || {};
    if (!tenantId || !sub) throw new UnauthorizedException();
    return this.aiService.getAgentStats(tenantId, sub);
  }

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() body: ChatRequestBody,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    // JWT payload'da `sub` bor (`id` emas) — eski `req.user?.id` doim undefined
    // bo'lib, agent xodim filialini topolmasdi.
    const employeeId = req.user?.sub;

    try {
      // Convert SDK v6 UIMessage[] → simple { role, content }[] format for backend
      const messages = (body.messages || []).map((msg) => {
        // SDK v6: text content is in parts[].text
        const textFromParts = (msg.parts || [])
          .filter((p) => p.type === 'text')
          .map((p) => p.text || '')
          .join('');

        return {
          role: msg.role,
          content: textFromParts || msg.content || '',
        };
      });

      const result = await this.aiService.streamChat(messages, tenantId, employeeId);

      // Copy headers from Web Response → Express response
      result.headers.forEach((value, key) => res.setHeader(key, value));
      res.status(result.status);

      // Pipe the ReadableStream to Express response
      if (result.body) {
        const reader = result.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        };
        pump().catch((err) => {
          console.error('Stream pipe error:', err);
          if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
        });
      } else {
        res.end();
      }
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'AI xatoligi' });
      }
    }
  }
}
