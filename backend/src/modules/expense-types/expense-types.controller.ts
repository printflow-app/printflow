import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ExpenseTypesService } from './expense-types.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('expense-types')
export class ExpenseTypesController {
  constructor(private service: ExpenseTypesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('canManageExpenseTypes')
  create(@Body() body: { name: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  @RequirePermissions('canManageExpenseTypes')
  update(@Param('id') id: string, @Body() body: { name: string }) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('canManageExpenseTypes')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
