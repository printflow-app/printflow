import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { FinanceService } from './finance.service';
import { BreakEvenService } from './break-even.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('finance')
@RequirePermissions('canViewFinance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService,
    private readonly prisma: PrismaService,
    private readonly breakEven: BreakEvenService,
  ) {}

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

  // Kirim/chiqim sanasini o'zgartirish ruxsati (orqa sana). Yo'q bo'lsa — controller
  // body'dan `date`ni olib tashlaydi, natijada server joriy vaqtni ishlatadi.
  private canSetDate(req: Request): boolean {
    const user = (req as any)?.user;
    if (!user) return false;
    const isAdmin = !!(
      user.isAdmin ||
      user.isSuperAdmin ||
      (user.role && ['admin', 'superadmin'].includes(String(user.role).toLowerCase()))
    );
    return isAdmin || !!(user.permissions || {}).canSetTransactionDate;
  }

  // Kassa (cashbox) scoping. Qaytadi: {} (cheklovsiz) | { cashBoxId } | { cashBoxId: { in } }.
  // Qoida (regressiyaga qarshi xavfsiz):
  //   admin/canViewAllCashBoxes → cheklov yo'q (yoki so'ralgan kassa)
  //   aks holda → foydalanuvchiga BIRIKTIRILGAN kassalar bilan cheklanadi;
  //   agar hech biri biriktirilmagan bo'lsa (eski holat) → cheklov yo'q (hammasi ko'rinadi).
  private async cashBoxWhere(req: Request, requestedCashBoxId?: string): Promise<Record<string, any>> {
    const user = (req as any)?.user;
    if (!user) return {};
    const perms = user.permissions || {};
    const isAdmin = !!(
      user.isAdmin ||
      user.isSuperAdmin ||
      (user.role && ['admin', 'superadmin'].includes(String(user.role).toLowerCase()))
    );
    const canViewAll = isAdmin || !!perms.canViewAllCashBoxes;

    if (requestedCashBoxId) {
      if (canViewAll) return { cashBoxId: requestedCashBoxId };
      const mine = await this.prisma.cashBox.findMany({
        where: { assignedUserId: user.sub },
        select: { id: true },
      });
      const mineIds = mine.map((b) => b.id);
      if (mineIds.length === 0) return { cashBoxId: requestedCashBoxId }; // eski holat — cheklov yo'q
      if (mineIds.includes(requestedCashBoxId)) return { cashBoxId: requestedCashBoxId };
      return { cashBoxId: { in: mineIds } }; // o'ziniki bo'lmagan kassa so'ralsa — o'zinikini ko'rsatamiz
    }

    if (canViewAll) return {};
    const mine = await this.prisma.cashBox.findMany({
      where: { assignedUserId: user.sub },
      select: { id: true },
    });
    if (mine.length === 0) return {}; // eski holat — cheklov yo'q
    return { cashBoxId: { in: mine.map((b) => b.id) } };
  }

  @Patch('transactions/:id')
  @RequirePermissions('canManageFinance')
  async updateTransaction(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    // Sana ruxsati yo'q bo'lsa — date'ni o'zgartirishga yo'l qo'ymaymiz (mavjud saqlanadi).
    if (!this.canSetDate(req)) delete body.date;
    return this.financeService.updateTransaction(id, body);
  }

  @Delete('transactions/:id')
  @RequirePermissions('canManageFinance')
  async deleteTransaction(@Param('id') id: string) {
    return this.financeService.deleteTransaction(id);
  }

  // Zararsizlik nuqtasi — shu oy nolga chiqish uchun qancha kerak.
  @Get('break-even')
  getBreakEven(@Req() req: Request) {
    const tenantId = (req as any)?.user?.tenantId;
    return this.breakEven.compute(tenantId);
  }

  @Get('dashboard')
  async getDashboard(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string, @Query('cashBoxId') cashBoxId?: string) {
    const cbw = await this.cashBoxWhere(req, cashBoxId);
    return this.financeService.getDashboard(start, end, branchId, departmentId, this.ownerScope(req), cbw);
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
    @Query('cashBoxId') cashBoxId?: string,
  ) {
    const cbw = await this.cashBoxWhere(req, cashBoxId);
    return this.financeService.findAll(start, end, branchId, page, limit, departmentId, vendorId, this.ownerScope(req), cbw);
  }

  @Post('transactions')
  async create(@Req() req: Request, @Body() body: any) {
    // Yozuvni kim kiritgani — JWT'dan olamiz (frontend'ga ishonmaymiz).
    const userId = (req as any)?.user?.sub;
    // Sana ruxsati yo'q bo'lsa — orqa sana kiritishga yo'l qo'ymaymiz (server now()).
    if (!this.canSetDate(req)) delete body.date;
    return this.financeService.createTransaction({ ...body, createdById: userId || body.createdById || null });
  }

  @Get('dinamika')
  async getDinamika(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string, @Query('cashBoxId') cashBoxId?: string) {
    const cbw = await this.cashBoxWhere(req, cashBoxId);
    return this.financeService.getDinamika(start, end, branchId, departmentId, this.ownerScope(req), cbw);
  }

  @Get('stats-by-payment-type')
  async getStatsByPaymentType(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string, @Query('cashBoxId') cashBoxId?: string) {
    const cbw = await this.cashBoxWhere(req, cashBoxId);
    return this.financeService.getStatsByPaymentType(start, end, branchId, departmentId, this.ownerScope(req), cbw);
  }

  @Get('expense-breakdown')
  @RequireFeature('expenseAnalytics')
  async getExpenseBreakdown(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string, @Query('cashBoxId') cashBoxId?: string) {
    const cbw = await this.cashBoxWhere(req, cashBoxId);
    return this.financeService.getExpenseBreakdown(start, end, branchId, departmentId, this.ownerScope(req), cbw);
  }

  @Get('daily-summary')
  async getDailySummary(@Req() req: Request, @Query('start') start?: string, @Query('end') end?: string, @Query('branchId') branchId?: string, @Query('departmentId') departmentId?: string, @Query('vendorId') vendorId?: string, @Query('cashBoxId') cashBoxId?: string) {
    const cbw = await this.cashBoxWhere(req, cashBoxId);
    return this.financeService.getDailySummary(start, end, branchId, departmentId, vendorId, this.ownerScope(req), cbw);
  }
}
