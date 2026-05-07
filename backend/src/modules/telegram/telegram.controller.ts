import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
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
}
