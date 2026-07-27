import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { SalaryMetricsService } from './salary-metrics.service';
import { SalarySchemeService } from './salary-scheme.service';

@Module({
  imports: [PrismaModule],
  providers: [PayrollService, SalaryMetricsService, SalarySchemeService],
  controllers: [PayrollController],
  exports: [PayrollService, SalarySchemeService],
})
export class PayrollModule {}
