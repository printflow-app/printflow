import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { CashboxService, CashUser } from './cashbox.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('cashboxes')
@RequirePermissions('canViewFinance')
export class CashboxController {
  constructor(private readonly cashboxService: CashboxService) {}

  // JWT payload'idan joriy foydalanuvchining kassa ruxsat profilini quradi.
  private cashUser(req: Request): CashUser {
    const user = (req as any)?.user || {};
    const perms = user.permissions || {};
    const isAdmin = !!(
      user.isAdmin ||
      user.isSuperAdmin ||
      (user.role && ['admin', 'superadmin'].includes(String(user.role).toLowerCase()))
    );
    return {
      userId: user.sub,
      isAdmin,
      canViewAll: isAdmin || !!perms.canViewAllCashBoxes,
      canManage: isAdmin || !!perms.canManageCashBoxes,
      canTransfer: isAdmin || !!perms.canTransferCash,
    };
  }

  @Get()
  async list(@Req() req: Request, @Query('branchId') branchId?: string) {
    return this.cashboxService.list(this.cashUser(req), branchId);
  }

  @Get('pending-count')
  async pendingCount(@Req() req: Request) {
    const count = await this.cashboxService.pendingCount(this.cashUser(req));
    return { count };
  }

  @Get('transfers')
  async listTransfers(
    @Req() req: Request,
    @Query('direction') direction?: string,
    @Query('status') status?: string,
  ) {
    return this.cashboxService.listTransfers(this.cashUser(req), { direction, status });
  }

  @Post()
  @RequirePermissions('canManageCashBoxes')
  async create(@Req() req: Request, @Body() body: any) {
    return this.cashboxService.create(this.cashUser(req), body);
  }

  @Patch(':id')
  @RequirePermissions('canManageCashBoxes')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.cashboxService.update(this.cashUser(req), id, body);
  }

  @Delete(':id')
  @RequirePermissions('canManageCashBoxes')
  async remove(@Req() req: Request, @Param('id') id: string) {
    return this.cashboxService.remove(this.cashUser(req), id);
  }

  @Post('transfers')
  @RequirePermissions('canTransferCash')
  async createTransfer(@Req() req: Request, @Body() body: any) {
    return this.cashboxService.createTransfer(this.cashUser(req), body);
  }

  // Accept/reject — canViewFinance yetarli; qabul huquqi servisda tekshiriladi
  // (target kassaning egasi YOKI canManageCashBoxes).
  @Post('transfers/:id/accept')
  async accept(@Req() req: Request, @Param('id') id: string) {
    return this.cashboxService.accept(this.cashUser(req), id);
  }

  @Post('transfers/:id/reject')
  async reject(@Req() req: Request, @Param('id') id: string) {
    return this.cashboxService.reject(this.cashUser(req), id);
  }
}
