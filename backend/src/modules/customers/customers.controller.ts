import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.customersService.findAll(branchId);
  }

  @Get('top')
  getTopCustomers(@Query('limit') limit?: string) {
    return this.customersService.getTopCustomers(limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.customersService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.customersService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  // =============================================
  // B2B: Contact endpoints
  // =============================================

  @Get(':id/contacts')
  getContacts(@Param('id') id: string) {
    return this.customersService.getContacts(id);
  }

  @Post(':id/contacts')
  createContact(@Param('id') id: string, @Body() data: any) {
    return this.customersService.createContact(id, data);
  }

  @Put(':id/contacts/:contactId')
  updateContact(@Param('contactId') contactId: string, @Body() data: any) {
    return this.customersService.updateContact(contactId, data);
  }

  @Delete(':id/contacts/:contactId')
  removeContact(@Param('contactId') contactId: string) {
    return this.customersService.removeContact(contactId);
  }

  // =============================================
  // Order history & analytics
  // =============================================

  @Get(':id/tasks')
  getCustomerTasks(@Param('id') id: string) {
    return this.customersService.getCustomerTasks(id);
  }

  @Get(':id/orders')
  getOrderHistory(@Param('id') id: string) {
    return this.customersService.getOrderHistory(id);
  }

  // Recalculate totalDebt for all customers from actual task amounts
  @Post('fix-debts')
  fixDebts(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.customersService.recalculateAllDebts(tenantId);
  }
}
