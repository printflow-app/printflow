import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  // Materials CRUD
  @Get('materials')
  findAllMaterials(@Query('branchId') branchId?: string) {
    return this.inventoryService.findAllMaterials(branchId);
  }

  @Get('materials/:id')
  findOneMaterial(@Param('id') id: string) {
    return this.inventoryService.findOneMaterial(id);
  }

  @Post('materials')
  createMaterial(@Body() data: any) {
    return this.inventoryService.createMaterial(data);
  }

  @Put('materials/:id')
  updateMaterial(@Param('id') id: string, @Body() data: any) {
    return this.inventoryService.updateMaterial(id, data);
  }

  @Delete('materials/:id')
  removeMaterial(@Param('id') id: string) {
    return this.inventoryService.removeMaterial(id);
  }

  // Stock operations
  @Post('materials/:id/stock-in')
  stockIn(
    @Param('id') materialId: string,
    @Body() body: { quantity: number; note?: string; taskId?: string },
  ) {
    return this.inventoryService.stockIn(materialId, body.quantity, body.note, body.taskId);
  }

  @Post('materials/:id/stock-out')
  stockOut(
    @Param('id') materialId: string,
    @Body() body: { quantity: number; note?: string; taskId?: string },
  ) {
    return this.inventoryService.stockOut(materialId, body.quantity, body.note, body.taskId);
  }

  @Post('materials/:id/write-off')
  writeOff(
    @Param('id') materialId: string,
    @Body() body: { quantity: number; note?: string; taskId?: string },
  ) {
    return this.inventoryService.writeOff(materialId, body.quantity, body.note, body.taskId);
  }

  // Movements
  @Get('movements')
  getMovements(@Query('materialId') materialId?: string) {
    return this.inventoryService.getMovements(materialId);
  }

  // BOM deduction
  @Post('deduct-by-task')
  deductByTask(
    @Body() body: { taskId: string; serviceId: string; quantity: number; wasteQty?: number },
  ) {
    return this.inventoryService.deductByTask(body.taskId, body.serviceId, body.quantity, body.wasteQty);
  }
}
