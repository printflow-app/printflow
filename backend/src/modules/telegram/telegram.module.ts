import { Module, Global } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { OvertimeModule } from '../overtime/overtime.module';

@Global()
@Module({
  imports: [OvertimeModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
