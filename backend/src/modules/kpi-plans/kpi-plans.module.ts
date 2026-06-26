import { Module } from '@nestjs/common';
import { KpiPlansController } from './kpi-plans.controller';
import { KpiPlansService } from './kpi-plans.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KpiPlansController],
  providers: [KpiPlansService],
  exports: [KpiPlansService],
})
export class KpiPlansModule {}
