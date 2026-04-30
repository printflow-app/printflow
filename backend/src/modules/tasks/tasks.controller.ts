import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  // Kanban Column Endpoints — MUST be before :id routes!
  @Get('columns')
  getColumns() {
    return this.tasksService.getColumns();
  }

  @Post('columns')
  createColumn(@Body() body: { title: string; orderIdx: number }) {
    return this.tasksService.createColumn(body.title, body.orderIdx);
  }

  @Put('columns/:id')
  updateColumn(@Param('id') id: string, @Body() body: { title: string }) {
    return this.tasksService.updateColumn(id, body.title);
  }

  @Delete('columns/:id')
  removeColumn(@Param('id') id: string) {
    return this.tasksService.removeColumn(id);
  }

  // Task Endpoints
  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.tasksService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() data: any, @Query('employeeId') employeeId: string) {
    return this.tasksService.create(data, employeeId);
  }

  @Post('bulk')
  createBulk(@Body() data: any, @Query('employeeId') employeeId: string) {
    return this.tasksService.createBulk(data, employeeId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any, @Query('employeeId') employeeId: string) {
    return this.tasksService.update(id, data, employeeId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }

  @Post(':id/view')
  logView(@Param('id') id: string, @Body() body: { employeeId: string }) {
    return this.tasksService.logView(id, body.employeeId);
  }
}
