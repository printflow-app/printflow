import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('services-performance')
  @RequirePermissions('canViewFinance')
  servicesPerformance(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reports.getServicesPerformance(start, end, branchId);
  }

  @Get('vendor-profitability')
  @RequirePermissions('canViewVendors')
  vendorProfitability(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.reports.getVendorProfitability(start, end);
  }

  @Get('employee-velocity')
  @RequirePermissions('canViewKpi')
  employeeVelocity(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.reports.getEmployeeVelocity(start, end);
  }

  @Get('growth-metrics')
  @RequirePermissions('canViewFinance')
  growthMetrics(@Query('branchId') branchId?: string) {
    return this.reports.getGrowthMetrics(branchId);
  }

  @Get('monthly-dynamics')
  @RequirePermissions('canViewFinance')
  monthlyDynamics(
    @Query('months') months?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reports.getMonthlyDynamics(months ? Number(months) : 6, branchId);
  }
}
