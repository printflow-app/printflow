import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { FinanceService } from './finance.service';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('finance')
@RequirePermissions('canViewFinance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // "Faqat o'zi kiritgan" ruxsati yoqilgan (va admin bo'lmagan) foydalanuvchi uchun
  // o'z ID'sini qaytaradi — shu bo'yicha Kassa filtrlanadi. Aks holda undefined (hammasi).
  private ownerScope(req: Request): string | undefined {
    const user = (req as any)?.user;
    if (!user) return undefined;
    const isAdmin = user.isAdmin || user.isSuperAdmin || user.role?.toLowerCase() === 'admin';
    const perms = user.permissions || {};
    if (!isAdmin && perms.canViewOwnCashOnly) return user.sub;
    return undefined;
  }

  @Patch('transactions/:id')
  @RequirePermissions('canManageFinance')
  async updateTransaction(@Param('id') id: string, @Body() body: any) {
    return this.financeService.updateTransaction(id, body);
  }

  @Delete('transactions/:id')
  @RequirePermissions('canManageFinance')
  async deleteTransaction(@Param('id') id: string) {
    return this.financeService.deleteTransaction(id);
  }

  @Get('dashboard')
  async getDashboard(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getDashboard(start, end, branchId, departmentId, this.ownerScope(req));
  }

  @Get('transactions')
  async findAll(
    @Req() req: Request,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('branchId') branchId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('departmentId') departmentId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.financeService.findAll(start, end, branchId, page, limit, departmentId, vendorId, this.ownerScope(req));
  }

  @Post('transactions')
  async create(@Req() req: Request, @Body() body: any) {
    // Yozuvni kim kiritgani — JWT'dan olamiz (frontend'ga ishonmaymiz).
    const userId = (req as any)?.user?.sub;
    return this.financeService.createTransaction({ ...body, createdById: userId || body.createdById || null });
  }

  @Get('dinamika')
  async getDinamika(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getDinamika(start, end, branchId, departmentId, this.ownerScope(req));
  }

  @Get('stats-by-payment-type')
  async getStatsByPaymentType(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getStatsByPaymentType(start, end, branchId, departmentId, this.ownerScope(req));
  }

  @Get('expense-breakdown')
  @RequireFeature('expenseAnalytics')
  async getExpenseBreakdown(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string) {
    return this.financeService.getExpenseBreakdown(start, end, branchId, departmentId, this.ownerScope(req));
  }

  @Get('daily-summary')
  async getDailySummary(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string, @Query('vendorId') vendorId?: string) {
    return this.financeService.getDailySummary(start, end, branchId, departmentId, vendorId, this.ownerScope(req));
  }
}
