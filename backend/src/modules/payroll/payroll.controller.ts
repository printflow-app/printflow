import { Controller, Get, Post, Delete, Body, Query, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { PayrollService } from './payroll.service';
import { SalarySchemeService } from './salary-scheme.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('payroll')
@RequirePermissions('canViewPayroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly schemeService: SalarySchemeService,
  ) {}

  // ── Maosh sxemalari ───────────────────────────────────────────────

  /** Sxema muharriri uchun metrika katalogi. */
  @Get('metrics')
  listMetrics() {
    return this.schemeService.listMetrics();
  }

  @Get('schemes')
  listSchemes(@Req() req: Request) {
    return this.schemeService.list((req as any).user?.tenantId);
  }

  @Post('schemes')
  @RequirePermissions('canManagePayroll')
  saveScheme(@Req() req: Request, @Body() body: any) {
    return this.schemeService.save((req as any).user?.tenantId, body);
  }

  @Delete('schemes/:id')
  @RequirePermissions('canManagePayroll')
  removeScheme(@Req() req: Request, @Param('id') id: string) {
    return this.schemeService.remove((req as any).user?.tenantId, id);
  }

  @Get()
  async list(@Query('period') period: string, @Query('branchId') branchId?: string) {
    return this.payrollService.list(period, branchId);
  }

  @Post('save')
  @RequirePermissions('canManagePayroll')
  async save(@Body() body: any) {
    return this.payrollService.save(body);
  }

  @Post('pay')
  @RequirePermissions('canManagePayroll')
  async pay(@Req() req: Request, @Body() body: any) {
    const userId = (req as any)?.user?.sub;
    return this.payrollService.pay(body, userId);
  }

  @Post('revert')
  @RequirePermissions('canManagePayroll')
  async revert(@Body() body: any) {
    return this.payrollService.revert(body);
  }
}
