import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { PaymentTypesService } from './payment-types.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('payment-types')
export class PaymentTypesController {
  constructor(private ptService: PaymentTypesService) {}

  @Get()
  findAll() {
    return this.ptService.findAll();
  }

  @Post()
  @RequirePermissions('canManagePaymentTypes')
  create(@Body() body: { name: string }) {
    return this.ptService.create(body);
  }

  @Put(':id')
  @RequirePermissions('canManagePaymentTypes')
  update(@Param('id') id: string, @Body() body: { name: string }) {
    return this.ptService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('canManagePaymentTypes')
  remove(@Param('id') id: string) {
    return this.ptService.remove(id);
  }
}
