import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.rolesService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.rolesService.findOne(id, branchId);
  }

  @Post()
  create(@Body() data: any) {
    return this.rolesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any, @Query('branchId') branchId?: string) {
    return this.rolesService.update(id, data, branchId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.rolesService.remove(id, branchId);
  }
}
