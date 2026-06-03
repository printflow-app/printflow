import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('vendors')
@RequirePermissions('canViewVendors')
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.vendorsService.findAll(branchId);
  }

  // Ledger (Xarid/Sotuv) — static segment'ni :id dan oldin e'lon qilamiz.
  @Post('ledger')
  @RequirePermissions('canManageVendors')
  createLedgerEntry(@Body() data: any, @Query('branchId') branchId?: string) {
    return this.vendorsService.createLedgerEntry(data, branchId);
  }

  @Delete('ledger/:entryId')
  @RequirePermissions('canManageVendors')
  removeLedgerEntry(@Param('entryId') entryId: string, @Query('branchId') branchId?: string) {
    return this.vendorsService.removeLedgerEntry(entryId, branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.vendorsService.findOne(id, branchId);
  }

  @Post()
  @RequirePermissions('canManageVendors')
  create(@Body() data: any) {
    return this.vendorsService.create(data);
  }

  @Put(':id')
  @RequirePermissions('canManageVendors')
  update(@Param('id') id: string, @Body() data: any, @Query('branchId') branchId?: string) {
    return this.vendorsService.update(id, data, branchId);
  }

  @Delete(':id')
  @RequirePermissions('canManageVendors')
  remove(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.vendorsService.remove(id, branchId);
  }
}
