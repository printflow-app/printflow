import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CashboxService } from './cashbox.service';
import { CashboxController } from './cashbox.controller';

@Module({
  imports: [PrismaModule],
  providers: [CashboxService],
  controllers: [CashboxController],
  exports: [CashboxService],
})
export class CashboxModule {}
