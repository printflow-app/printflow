import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('dashboard')
  async getDashboard(@Query('start') start?: string, @Query('end') end?: string) {
    return this.financeService.getDashboard(start, end);
  }

  @Get('transactions')
  async findAll(@Query('start') start?: string, @Query('end') end?: string) {
    return this.financeService.findAll(start, end);
  }

  @Post('transactions')
  async create(@Body() body: any) {
    return this.financeService.createTransaction(body);
  }

  @Get('dinamika')
  async getDinamika(@Query('start') start?: string, @Query('end') end?: string) {
    return this.financeService.getDinamika(start, end);
  }

  @Get('stats-by-payment-type')
  async getStatsByPaymentType(@Query('start') start?: string, @Query('end') end?: string) {
    return this.financeService.getStatsByPaymentType(start, end);
  }
}
