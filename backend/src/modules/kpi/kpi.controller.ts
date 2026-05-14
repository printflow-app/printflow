import { Controller, Get, Query, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { KpiService } from './kpi.service';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

// =============================================
// KPI CONTROLLER — `kpiTracking` feature gated
// Endpointlar:
//   GET /api/kpi/employees      — barcha xodimlar bo'yicha (canViewKpi kerak)
//   GET /api/kpi/me             — joriy foydalanuvchining o'zining KPI'si
//   GET /api/kpi/summary        — top-3 + umumiy ko'rsatkichlar
// =============================================

@Controller('kpi')
@RequireFeature('reports')
export class KpiController {
  constructor(private kpiService: KpiService) {}

  @Get('employees')
  @RequirePermissions('canViewKpi')
  async list(
    @Req() req: Request,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    if (!req) throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
    return this.kpiService.getEmployeeKpiList(start, end);
  }

  @Get('me')
  async me(
    @Req() req: Request,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const payload = (req as any).user;
    if (!payload?.sub) throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
    return this.kpiService.getMyKpi(payload.sub, start, end);
  }

  @Get('summary')
  async summary(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.kpiService.getKpiSummary(start, end);
  }
}
