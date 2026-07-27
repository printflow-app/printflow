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

@RequireFeature('ai_chat')
@RequirePermissions('canUseAi')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly briefingService: BriefingService,
    private readonly riskDetectionService: RiskDetectionService,
  ) {}

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
  // Ko'rish canUseAi'ga bog'liq emas (@RequirePermissions() bo'sh massiv —
  // klass darajasidagi 'canUseAi' talabini shu route uchun bekor qiladi):
  // xavfni ko'rish va uni AI orqali hal qilish ikki xil huquq. Faqat
  // "bartaraf etish" tugmasi (frontend) canUseAi'ni tekshiradi.
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
