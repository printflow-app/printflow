import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get()
  @RequirePermissions('canViewServices')
  findAll() {
    return this.servicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @RequirePermissions('canManageServices')
  create(@Body() data: any) {
    return this.servicesService.create(data);
  }

  @Put(':id')
  @RequirePermissions('canManageServices')
  update(@Param('id') id: string, @Body() data: any) {
    return this.servicesService.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('canManageServices')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  // Opsiyalar
  @Post(':id/options')
  @RequirePermissions('canManageServices')
  addOption(@Param('id') serviceId: string, @Body() data: any) {
    return this.servicesService.addOption(serviceId, data);
  }

  @Put('options/:optionId')
  @RequirePermissions('canManageServices')
  updateOption(@Param('optionId') optionId: string, @Body() data: any) {
    return this.servicesService.updateOption(optionId, data);
  }

  @Delete('options/:optionId')
  @RequirePermissions('canManageServices')
  removeOption(@Param('optionId') optionId: string) {
    return this.servicesService.removeOption(optionId);
  }

  // BOM
  @Post(':id/materials')
  @RequirePermissions('canManageServices')
  addMaterial(@Param('id') serviceId: string, @Body() data: any) {
    return this.servicesService.addMaterial(serviceId, data);
  }

  @Delete(':id/materials/:materialId')
  @RequirePermissions('canManageServices')
  removeMaterial(
    @Param('id') serviceId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.servicesService.removeMaterial(serviceId, materialId);
  }

  // Narx hisoblash
  @Post(':id/calculate-price')
  calculatePrice(
    @Param('id') serviceId: string,
    @Body()
    body: {
      selectedOptionIds: string[];
      quantity: number;
      discount: number;
      coefficient: number;
    },
  ) {
    return this.servicesService.calculatePrice({ serviceId, ...body });
  }
}
