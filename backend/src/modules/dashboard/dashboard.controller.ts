import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Har bo'lim (finance/tasks/attendance) chaqiruvchining ruxsatiga qarab
   * backend darajasida hisoblanadi yoki `null` qaytadi — frontend gate'iga
   * ishonilmaydi (masalan canViewFinance yo'q xodim kirim/chiqim summasini
   * to'g'ridan-to'g'ri so'rov bilan ham ko'ra olmaydi).
   */
  @Get('summary')
  async summary(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException();
    const perms = req.user?.permissions || {};
    // Admin aniqlash PermissionsGuard bilan bir xil: WorkspaceAdmin bayrog'i YOKI
    // lavozim nomi 'admin'/'superadmin'. Faqat bayroqqa qarasak, "Admin" lavozimli
    // xodim (WorkspaceAdmin emas) bo'limlarni ko'rmay qolardi.
    const roleName = String(req.user?.role || '').toLowerCase();
    const isAdmin = !!req.user?.isAdmin || roleName === 'admin' || roleName === 'superadmin';
    return this.dashboardService.getSummary(tenantId, perms, isAdmin);
  }
}
