import { Module } from '@nestjs/common';
import { SupportBotService } from './support-bot.service';

@Module({
  providers: [SupportBotService],
  exports: [SupportBotService],
})
export class SupportBotModule {}
