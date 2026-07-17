import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { PayrollService } from './payroll.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('payroll')
@RequirePermissions('canViewPayroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

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
