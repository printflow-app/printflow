import { Module, Global } from '@nestjs/common';
import { TelegramService } from './telegram.service';

// TelegramService endi faqat HTTP API orqali xabar yuboradi.
// node-telegram-bot-api olib tashlandi — bot/ papkasida Telegraf.js ishlatiladi.

@Global()
@Module({
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
