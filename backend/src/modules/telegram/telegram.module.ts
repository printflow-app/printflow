import { Module, Global } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { OvertimeModule } from '../overtime/overtime.module';

// TelegramService endi faqat HTTP API orqali xabar yuboradi.
// OvertimeModule — bot OVERTIME_AWAITING step'ida xabar kelganda
// overtime so'rovini yaratish uchun kerak.

@Global()
@Module({
  imports: [OvertimeModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
