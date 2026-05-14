import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.departmentsService.findAll(branchId);
  }

  @Post()
  create(@Body() body: { name: string; branchId: string }) {
    return this.departmentsService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name: string },
    @Query('branchId') branchId?: string,
  ) {
    return this.departmentsService.update(id, body, branchId!);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.departmentsService.remove(id, branchId!);
  }
}
