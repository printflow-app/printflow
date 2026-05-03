import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('vendors')
@RequirePermissions('canViewVendors')
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  // =============================================
  // Vendor CRUD
  // =============================================

  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.vendorsService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.vendorsService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }

  // Vendor payment — balansni oshirish (qarz to'lash)
  @Post(':id/pay')
  payVendor(@Param('id') id: string, @Body() body: { amount: number }) {
    return this.vendorsService.payVendor(id, body.amount);
  }

  // =============================================
  // OrderVendorCost — buyurtmaga subpudrat xarajati
  // =============================================

  @Get('order-costs/:taskId')
  getOrderCosts(@Param('taskId') taskId: string) {
    return this.vendorsService.getOrderCosts(taskId);
  }

  @Post('order-costs/:taskId')
  addOrderCost(@Param('taskId') taskId: string, @Body() data: any) {
    return this.vendorsService.addOrderCost(taskId, data);
  }

  @Delete('order-costs/entry/:costId')
  removeOrderCost(@Param('costId') costId: string) {
    return this.vendorsService.removeOrderCost(costId);
  }
}
