import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TeamTasksService } from './team-tasks.service';

@Controller('team-tasks')
export class TeamTasksController {
  constructor(private readonly service: TeamTasksService) {}

  @RequirePermissions('canViewTeamTasks')
  @Get('board')
  board(@Req() req: Request, @Query('branchId') branchId?: string) {
    const tenantId = (req as any)?.user?.tenantId;
    return this.service.board(tenantId, branchId && branchId !== '__all__' ? branchId : undefined);
  }

  @RequirePermissions('canManageTeamTasks')
  @Post()
  create(@Req() req: Request, @Body() data: any) {
    const u = (req as any)?.user;
    return this.service.create(u?.tenantId, data, u?.sub);
  }

  @RequirePermissions('canManageTeamTasks')
  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @RequirePermissions('canManageTeamTasks')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
