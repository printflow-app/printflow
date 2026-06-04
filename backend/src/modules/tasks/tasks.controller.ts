import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, ForbiddenException } from '@nestjs/common';
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
  async getColumns(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
  ) {
    try {
      const { viewMode, currentUserId } = this.resolveViewMode(req);
      return await this.tasksService.getColumns(viewMode, currentUserId, branchId);
    } catch (err) {
      console.error('[TasksController] getColumns error:', err);
      throw err;
    }
  }

  @Post('columns')
  createColumn(@Body() body: { title: string; orderIdx: number; branchId?: string }) {
    return this.tasksService.createColumn(body.title, body.orderIdx, body.branchId);
  }

  @Put('columns/:id')
  updateColumn(
    @Param('id') id: string,
    @Body() body: { title: string; branchId?: string },
  ) {
    return this.tasksService.updateColumn(id, body.title, body.branchId);
  }

  @Post('columns/:id/delete')
  removeColumn(@Param('id') id: string, @Query('branchId') branchId?: string) {
    return this.tasksService.removeColumn(id, branchId);
  }

  @Post('backfill-ids')
  backfillIds() {
    return this.tasksService.backfillDisplayIds();
  }

  // Task Endpoints
  @Get()
  async findAll(@Query('branchId') branchId?: string, @Req() req?: any) {
    try {
      const { viewMode, currentUserId } = this.resolveViewMode(req);
      return await this.tasksService.findAll(branchId, viewMode, currentUserId);
    } catch (err) {
      console.error('[TasksController] findAll error:', err);
      throw err;
    }
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

  // ARCHIVE — oddiy foydalanuvchilar uchun. Buyurtma arxivga ko'chiriladi (o'chmaydi).
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.tasksService.archive(id);
  }

  // HARD DELETE — buyurtmani butunlay o'chirish. Faqat workspace admin / super admin.
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any)?.user;
    const isAdmin =
      !!user && (user.isAdmin || user.isSuperAdmin || user.role?.toLowerCase() === 'admin');
    if (!isAdmin) {
      throw new ForbiddenException("Buyurtmani butunlay o'chirish faqat administrator uchun ruxsat etilgan");
    }
    return this.tasksService.remove(id);
  }

  @Post(':id/view')
  logView(@Param('id') id: string, @Body() body: { employeeId: string }) {
    return this.tasksService.logView(id, body.employeeId);
  }

  // Yangi attachment qo'shish — alohida TaskAttachment row sifatida.
  // Body: { name, url } (url = base64 data URL).
  @Post(':id/attachments')
  appendAttachment(
    @Param('id') id: string,
    @Body() body: { name: string; url: string },
  ) {
    return this.tasksService.appendAttachment(id, body);
  }

  // Bitta attachmentni o'chirish (mas: foydalanuvchi noto'g'ri faylni yukladi).
  // taskId URL'da REST aniqligi uchun — handler attachmentId orqali boradi.
  @Delete(':taskId/attachments/:attachmentId')
  deleteAttachment(@Param('attachmentId') attachmentId: string) {
    return this.tasksService.deleteAttachment(attachmentId);
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
