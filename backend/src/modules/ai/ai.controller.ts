import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';

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

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() body: ChatRequestBody,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    const employeeId = req.user?.id;

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
