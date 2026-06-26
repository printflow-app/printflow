import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { KpiPlansService } from './kpi-plans.service';

// =============================================
// KPI PLANS CONTROLLER
// Barcha route'lar JwtAuthGuard + TenantInterceptor ostida (global).
// Setup (CRUD) — rahbar/admin; progress — hamma o'zinikini ko'radi.
// =============================================
@Controller('kpi-plans')
export class KpiPlansController {
  constructor(private service: KpiPlansService) {}

  // Mavjud metrikalar ro'yxati (frontend label/unit uchun)
  @Get('metrics')
  getMetrics() {
    return this.service.getMetrics();
  }

  // Joriy (yoki tanlangan) oy uchun barcha xodimlar progressi — rahbar / statistika
  @Get('progress')
  getProgress(@Query('month') month?: string, @Query('branchId') branchId?: string) {
    return this.service.getProgress(month, branchId);
  }

  // O'z rejam — Dashboard "Mening rejalarim"
  @Get('my-progress')
  getMyProgress(@Req() req: any, @Query('month') month?: string) {
    const employeeId = req?.user?.sub;
    if (!employeeId) return null;
    return this.service.getMyProgress(employeeId, month);
  }

  // Reja ro'yxati (setup paneli)
  @Get()
  listPlans() {
    return this.service.listPlans();
  }

  @Post()
  createPlan(@Body() data: any, @Req() req: any) {
    return this.service.createPlan(data, req?.user?.sub);
  }

  @Put(':id')
  updatePlan(@Param('id') id: string, @Body() data: any) {
    return this.service.updatePlan(id, data);
  }

  @Delete(':id')
  removePlan(@Param('id') id: string) {
    return this.service.removePlan(id);
  }
}
