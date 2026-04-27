import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ExpenseTypesService } from './expense-types.service';

@Controller('expense-types')
export class ExpenseTypesController {
  constructor(private service: ExpenseTypesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() body: { name: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { name: string }) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
