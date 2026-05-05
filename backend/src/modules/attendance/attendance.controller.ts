import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AttendanceService } from './attendance.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequireFeature } from '../../common/decorators/feature.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// =============================================
// ATTENDANCE CONTROLLER
// checkIn / checkOut = @Public() — QR skanerlash uchun
// (xodimning telefoni JWT cookie'ga ega emas)
// IP qatorini extractClientIp orqali olib, service'ga yuboramiz.
// =============================================

function extractClientIp(req: Request): string | null {
  const xff = (req.headers['x-forwarded-for'] as string | undefined) || null;
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first.startsWith('::ffff:') ? first.slice(7) : first;
  }
  const ip = req.ip || (req.connection as any)?.remoteAddress || null;
  return ip ? (ip.startsWith('::ffff:') ? ip.slice(7) : ip) : null;
}

@UseGuards(JwtAuthGuard)
@RequireFeature('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // Joriy QR token (admin sahifasi uchun) — JWT protected
  @Get('token')
  getCurrentToken() {
    return this.attendanceService.getCurrentToken();
  }

  // Yangi token yaratish (admin manual) — JWT protected
  @Post('token/rotate')
  rotateToken() {
    return this.attendanceService.rotateToken();
  }

  // Eski endpoint nomi bilan compat (frontend yangilanishidan oldin)
  @Post('token/refresh')
  refreshToken() {
    return this.attendanceService.rotateToken();
  }

  // ⚠️ PUBLIC — QR kod orqali skanerlash
  @Public()
  @Post('checkin')
  async checkIn(
    @Body() body: { employeeId: string; token: string; deviceId?: string },
    @Req() req: Request,
  ) {
    try {
      const clientIp = extractClientIp(req);
      return await this.attendanceService.checkIn(
        body.employeeId,
        body.token,
        body.deviceId,
        clientIp,
      );
    } catch (err: any) {
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Post('checkout')
  async checkOut(
    @Body() body: { employeeId: string; token: string; deviceId?: string },
    @Req() req: Request,
  ) {
    try {
      const clientIp = extractClientIp(req);
      return await this.attendanceService.checkOut(
        body.employeeId,
        body.token,
        body.deviceId,
        clientIp,
      );
    } catch (err: any) {
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }

  // Bugungi yozuvlar
  @Get('records/today')
  getTodayRecords() {
    return this.attendanceService.getTodayRecords();
  }

  // Filtrlangan yozuvlar
  @Get('records')
  getRecords(@Query('date') date?: string) {
    return this.attendanceService.getRecords(date);
  }

  // Oylik
  @Get('monthly')
  getMonthlyRecords(@Query('year') year: string, @Query('month') month: string) {
    if (!year || !month)
      throw new HttpException('Year and month required', HttpStatus.BAD_REQUEST);
    return this.attendanceService.getMonthlyRecords(parseInt(year), parseInt(month));
  }

  // Xodim bo'yicha
  @Get('records/employee/:employeeId')
  getByEmployee(@Param('employeeId') employeeId: string) {
    return this.attendanceService.getRecordsByEmployee(employeeId);
  }

  // Ofis IP allowlist holati (debug/UI ko'rsatish uchun)
  @Get('office-ips')
  getOfficeIps() {
    return this.attendanceService.getOfficeIps();
  }
}
