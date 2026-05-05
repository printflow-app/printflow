import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { OvertimeService } from './overtime.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('overtime')
export class OvertimeController {
  constructor(private overtimeService: OvertimeService) {}

  @Get()
  @RequirePermissions('canViewAttendance')
  findAll(@Query('status') status?: string) {
    return this.overtimeService.findAll(status);
  }

  @Get('pending')
  @RequirePermissions('canViewAttendance')
  findPending() {
    return this.overtimeService.findPending();
  }

  @Post(':id/approve')
  @RequirePermissions('canManageAttendance')
  approve(@Param('id') id: string, @Req() req: Request) {
    const approverId = (req as any).user?.sub || 'unknown';
    return this.overtimeService.approve(id, approverId);
  }

  @Post(':id/reject')
  @RequirePermissions('canManageAttendance')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const approverId = (req as any).user?.sub || 'unknown';
    return this.overtimeService.reject(id, approverId, body?.reason);
  }
}
