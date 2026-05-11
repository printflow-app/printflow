import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('finance')
@RequirePermissions('canViewFinance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('dashboard')
  async getDashboard(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string) {
    return this.financeService.getDashboard(start, end, branchId);
  }

  @Get('transactions')
  async findAll(
    @Query('start') start?: string, 
    @Query('end') end?: string, 
    @Query('branchId') branchId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    return this.financeService.findAll(start, end, branchId, page, limit);
  }

  @Post('transactions')
  async create(@Body() body: any) {
    return this.financeService.createTransaction(body);
  }

  @Get('dinamika')
  async getDinamika(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string) {
    return this.financeService.getDinamika(start, end, branchId);
  }

  @Get('stats-by-payment-type')
  async getStatsByPaymentType(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string) {
    return this.financeService.getStatsByPaymentType(start, end, branchId);
  }

  @Get('expense-breakdown')
  @RequireFeature('expenseAnalytics')
  async getExpenseBreakdown(@Query('start') start?: string, @Query('end') end?: string) {
    return this.financeService.getExpenseBreakdown(start, end);
  }

  @Get('daily-summary')
  async getDailySummary(@Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string) {
    return this.financeService.getDailySummary(start, end, branchId);
  }
}
