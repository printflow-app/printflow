import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('plans')
export class PlansController {
  constructor(private plansService: PlansService) {}

  // Public — Landing page va billing page uchun
  @Public()
  @Get()
  findAll() {
    return this.plansService.findAll();
  }
}

// Super-Admin only CRUD
@Public()
@Controller('super-admin/plans')
@UseGuards(SuperAdminGuard)
export class PlansAdminController {
  constructor(private plansService: PlansService) {}

  @Get()
  findAll() {
    return this.plansService.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.plansService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.plansService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
