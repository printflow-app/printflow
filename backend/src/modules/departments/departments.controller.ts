import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.departmentsService.findAll(req.user.tenantId, branchId);
  }

  @Post()
  create(@Request() req: any, @Body() data: { name: string; description?: string; branchId?: string }) {
    return this.departmentsService.create(req.user.tenantId, data);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.departmentsService.update(req.user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.departmentsService.remove(req.user.tenantId, id);
  }
}
