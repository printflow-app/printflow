import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';

// =============================================
// NOTIFICATIONS CONTROLLER
// GET /api/notifications/sidebar
//   Query: branchId, topshiriqlarSince, mijozlarSince, hamkorlarSince
//   Returns: { topshiriqlar, mijozlar, hamkorlar, ombor, davomat }
// =============================================

@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get('sidebar')
  async sidebar(
    @Query('branchId') branchId: string | undefined,
    @Query('topshiriqlarSince') topshiriqlarSince: string | undefined,
    @Query('mijozlarSince') mijozlarSince: string | undefined,
    @Query('hamkorlarSince') hamkorlarSince: string | undefined,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.sub;
    return this.service.getSidebarCounts({
      branchId: branchId || undefined,
      userId,
      since: {
        topshiriqlar: topshiriqlarSince,
        mijozlar: mijozlarSince,
        hamkorlar: hamkorlarSince,
      },
    });
  }
}
