import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Public } from '../../common/decorators/public.decorator';

// =============================================
// EMPLOYEES CONTROLLER
// All routes protected by global JwtAuthGuard + TenantInterceptor.
// Hardcoded credentials REMOVED. Password handling → AuthModule (bcrypt).
// =============================================

@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  create(@Body() data: any) {
    return this.employeesService.create(data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.employeesService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }

  // Session tekshirish — frontend har 30 soniyada chaqiradi
  // TenantInterceptor aktiv bo'ladi (authed route)
  @Post('check-session')
  async checkSession(@Body() body: { employeeId: string; passwordVersion: number }) {
    const valid = await this.employeesService.checkSession(
      body.employeeId,
      body.passwordVersion,
    );
    return { valid };
  }

  // ⚠️ PUBLIC — Bot Telegram orqali chaqiradi (JWT yo'q)
  // Faqat telegramId bilan employee topiladi, parol tekshirilmaydi
  @Public()
  @Post('telegram-login')
  async telegramLogin(@Body() body: { telegramId: string }) {
    return this.employeesService.findByTelegramId(body.telegramId.toString());
  }

  // NOTE: /login endpoint REMOVED → use /api/auth/login (JWT + httpOnly cookie)
  // NOTE: SHARQ_MASTER_RESET_777 REMOVED → use super-admin panel
}
