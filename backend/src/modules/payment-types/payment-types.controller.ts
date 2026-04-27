import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PaymentTypesService } from './payment-types.service';

@Controller('payment-types')
export class PaymentTypesController {
  constructor(private ptService: PaymentTypesService) {}

  @Get()
  findAll() {
    return this.ptService.findAll();
  }

  @Post()
  create(@Body() body: { name: string }) {
    return this.ptService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { name: string }) {
    return this.ptService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ptService.remove(id);
  }
}
