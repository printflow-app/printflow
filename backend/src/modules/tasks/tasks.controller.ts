import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  /**
   * Resolves the effective view mode from the JWT payload.
   *   'all'  — Admin or tasks:view_all  → return every non-archived task
   *   'own'  — tasks:view_own only      → filter by assignees contains userId
   *   fallback 'all' preserves current behaviour for roles without explicit flags
   */
  private resolveViewMode(req: Request): { viewMode: 'all' | 'own'; currentUserId?: string } {
    const user = (req as any)?.user;
    if (!user) return { viewMode: 'all' };

    const isAdmin = user.isAdmin || user.role?.toLowerCase() === 'admin';
    const perms = user.permissions || {};

    if (isAdmin || perms.canViewAllTasks) return { viewMode: 'all' };
    if (perms.canViewOwnTasks) return { viewMode: 'own', currentUserId: user.sub };

    return { viewMode: 'all' }; // default: keep existing open behaviour
  }

  // Kanban Column Endpoints — MUST be before :id routes!
  @Get('columns')
  getColumns(@Req() req: Request) {
    const { viewMode, currentUserId } = this.resolveViewMode(req);
    return this.tasksService.getColumns(viewMode, currentUserId);
  }

  @Post('columns')
  createColumn(@Body() body: { title: string; orderIdx: number }) {
    return this.tasksService.createColumn(body.title, body.orderIdx);
  }

  @Put('columns/:id')
  updateColumn(@Param('id') id: string, @Body() body: { title: string }) {
    return this.tasksService.updateColumn(id, body.title);
  }

  // NOTE: Column delete kept — only ORDER delete is disabled
  @Post('columns/:id/delete')
  removeColumn(@Param('id') id: string) {
    return this.tasksService.removeColumn(id);
  }

  @Post('backfill-ids')
  backfillIds() {
    return this.tasksService.backfillDisplayIds();
  }

  // Task Endpoints
  @Get()
  findAll(@Query('branchId') branchId?: string, @Req() req?: any) {
    const { viewMode, currentUserId } = this.resolveViewMode(req);
    return this.tasksService.findAll(branchId, viewMode, currentUserId);
  }

  @Get('archived')
  getArchived() {
    return this.tasksService.getArchived();
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

  // ARCHIVE — DELETE o'rniga. Buyurtmalar hech qachon o'chirilmaydi.
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.tasksService.archive(id);
  }

  @Post(':id/view')
  logView(@Param('id') id: string, @Body() body: { employeeId: string }) {
    return this.tasksService.logView(id, body.employeeId);
  }

  // ── Task Expense Endpoints (Tannarx xarajatlari) ──────────────────────────
  @Get(':taskId/expenses')
  getExpenses(@Param('taskId') taskId: string) {
    return this.tasksService.getExpenses(taskId);
  }

  @Post(':taskId/expenses')
  createExpense(
    @Param('taskId') taskId: string,
    @Body() body: { expenseName: string; amount: number },
  ) {
    return this.tasksService.createExpense(taskId, body);
  }

  @Delete(':taskId/expenses/:expenseId')
  deleteExpense(@Param('expenseId') expenseId: string) {
    return this.tasksService.deleteExpense(expenseId);
  }
}
