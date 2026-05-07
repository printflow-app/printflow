import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

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
