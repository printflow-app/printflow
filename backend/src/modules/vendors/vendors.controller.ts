import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorOrdersService } from './vendor-orders.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('vendors')
@RequirePermissions('canViewVendors')
export class VendorsController {
  constructor(
    private vendorsService: VendorsService,
  ) {}

  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Post()
  @RequirePermissions('canManageVendors')
  create(@Body() data: any) {
    return this.vendorsService.create(data);
  }

  @Put(':id')
  @RequirePermissions('canManageVendors')
  update(@Param('id') id: string, @Body() data: any) {
    return this.vendorsService.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('canManageVendors')
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }
}
