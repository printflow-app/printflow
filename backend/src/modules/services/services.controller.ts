import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get()
  findAll() {
    return this.servicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.servicesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.servicesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  // Opsiyalar
  @Post(':id/options')
  addOption(@Param('id') serviceId: string, @Body() data: any) {
    return this.servicesService.addOption(serviceId, data);
  }

  @Put('options/:optionId')
  updateOption(@Param('optionId') optionId: string, @Body() data: any) {
    return this.servicesService.updateOption(optionId, data);
  }

  @Delete('options/:optionId')
  removeOption(@Param('optionId') optionId: string) {
    return this.servicesService.removeOption(optionId);
  }

  // BOM
  @Post(':id/materials')
  addMaterial(@Param('id') serviceId: string, @Body() data: any) {
    return this.servicesService.addMaterial(serviceId, data);
  }

  @Delete(':id/materials/:materialId')
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
