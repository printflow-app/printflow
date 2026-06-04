import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Headers,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { TelegramService } from './telegram.service';
import { Public } from '../../common/decorators/public.decorator';

// =============================================
// TELEGRAM WEBHOOK
// MUST be @Public() — Telegram serveri JWT yubormaydi.
// Authentifikatsiya x-telegram-bot-api-secret-token orqali.
// =============================================

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected && secretToken !== expected) {
      throw new ForbiddenException();
    }
    await this.telegramService.handleUpdate(body);
    return { ok: true };
  }

  // DIAGNOSTIKA — bot/webhook holatini ko'rsatadi. Faqat admin/super admin.
  @Get('diagnostics')
  async diagnostics(@Req() req: Request) {
    this.assertAdmin(req);
    return this.telegramService.getDiagnostics();
  }

  // Webhook'ni qayta o'rnatish. Faqat admin/super admin.
  @Post('reset-webhook')
  async resetWebhook(@Req() req: Request) {
    this.assertAdmin(req);
    return this.telegramService.resetWebhook();
  }

  private assertAdmin(req: Request) {
    const user = (req as any)?.user;
    const isAdmin =
      !!user && (user.isAdmin || user.isSuperAdmin || user.role?.toLowerCase() === 'admin');
    if (!isAdmin) throw new ForbiddenException('Faqat administrator uchun');
  }
}
