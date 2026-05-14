import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('finance')
@RequirePermissions('canViewFinance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('dashboard')
  async getDashboard(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getDashboard(start, end, branchId, departmentId);
  }

  @Get('transactions')
  async findAll(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.financeService.findAll(start, end, branchId, page, limit, departmentId);
  }

  @Post('transactions')
  async create(@Body() body: any) {
    return this.financeService.createTransaction(body);
  }

  @Get('dinamika')
  async getDinamika(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getDinamika(start, end, branchId, departmentId);
  }

  @Get('stats-by-payment-type')
  async getStatsByPaymentType(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getStatsByPaymentType(start, end, branchId, departmentId);
  }

  @Get('expense-breakdown')
  @RequireFeature('expenseAnalytics')
  async getExpenseBreakdown(@Query('start') start?: string, @Query('end') end?: string) {
    return this.financeService.getExpenseBreakdown(start, end);
  }

  @Get('daily-summary')
  async getDailySummary(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getDailySummary(start, end, branchId, departmentId);
  }
}
