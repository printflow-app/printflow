import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { FinanceService } from './finance.service';
import { BreakEvenService } from './break-even.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [PrismaModule, TelegramModule],
  providers: [FinanceService, BreakEvenService],
  controllers: [FinanceController],
  exports: [FinanceService, BreakEvenService],
})
export class FinanceModule {}
