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
import { getClientIp } from '../../common/utils/get-client-ip';

// =============================================
// ATTENDANCE CONTROLLER
// checkIn / checkOut = @Public() — QR skanerlash uchun
// (xodimning telefoni JWT cookie'ga ega emas)
// IP qatorini getClientIp orqali olib, service'ga yuboramiz.
// =============================================

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

  // Backend ko'rgan haqiqiy client IP — Sozlamalar'dagi IP detection uchun.
  // Xuddi shu IP attendance check paytida ham ishlatiladi, shuning uchun
  // ipify.org'dan farqli emas — bu yo'l yanada ishonchli.
  @Public()
  @Get('detect-ip')
  detectMyIp(@Req() req: Request) {
    const ip = getClientIp(req);
    return { ip };
  }

  // ⚠️ PUBLIC — QR kod orqali skanerlash
  @Public()
  @Post('checkin')
  async checkIn(
    @Body() body: { employeeId: string; token: string; deviceId?: string },
    @Req() req: Request,
  ) {
    try {
      const clientIp = getClientIp(req);
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
      const clientIp = getClientIp(req);
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

  // ============ SELF SERVICE — JWT-authenticated employee actions ============

  // Bugungi o'z davomatim
  @Get('my-today')
  async getMyToday(@Req() req: Request) {
    const employeeId = (req as any)?.user?.sub;
    if (!employeeId) throw new HttpException('Auth talab qilinadi', HttpStatus.UNAUTHORIZED);
    return this.attendanceService.getMyToday(employeeId);
  }

  // O'z davomat tarixim
  @Get('my-records')
  async getMyRecords(@Req() req: Request) {
    const employeeId = (req as any)?.user?.sub;
    if (!employeeId) throw new HttpException('Auth talab qilinadi', HttpStatus.UNAUTHORIZED);
    return this.attendanceService.getMyRecords(employeeId);
  }

  // Keldim/Ketdim tugmasi — bitta endpoint, ichkarida toggle
  @Post('self-mark')
  async selfMark(@Req() req: Request) {
    const employeeId = (req as any)?.user?.sub;
    if (!employeeId) throw new HttpException('Auth talab qilinadi', HttpStatus.UNAUTHORIZED);
    try {
      const clientIp = getClientIp(req);
      return await this.attendanceService.selfMark(employeeId, clientIp);
    } catch (err: any) {
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }
}
