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
// GPS koordinatalari body'dan olinadi va service'ga uzatiladi.
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

  // ⚠️ PUBLIC — QR kod orqali skanerlash (GPS koordinatalari bilan)
  @Public()
  @Post('checkin')
  async checkIn(
    @Body() body: { employeeId: string; token: string; deviceId?: string; lat?: number; lng?: number },
  ) {
    try {
      return await this.attendanceService.checkIn(
        body.employeeId,
        body.token,
        body.deviceId,
        body.lat,
        body.lng,
      );
    } catch (err: any) {
      if (err?.status) throw err;
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }

  @Public()
  @Post('checkout')
  async checkOut(
    @Body() body: { employeeId: string; token: string; deviceId?: string; lat?: number; lng?: number },
  ) {
    try {
      return await this.attendanceService.checkOut(
        body.employeeId,
        body.token,
        body.deviceId,
        body.lat,
        body.lng,
      );
    } catch (err: any) {
      if (err?.status) throw err;
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

  // Admin: qo'lda davomat kiritish (qurilmasiz xodimlar uchun)
  @Post('manual')
  async adminManualMark(
    @Body() body: { employeeId: string; date: string; checkIn?: string; checkOut?: string },
  ) {
    try {
      return await this.attendanceService.adminManualMark(body);
    } catch (err: any) {
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }

  // Keldim/Ketdim tugmasi — bitta endpoint, ichkarida toggle (GPS bilan)
  @Post('self-mark')
  async selfMark(
    @Body() body: { lat: number; lng: number },
    @Req() req: Request,
  ) {
    const employeeId = (req as any)?.user?.sub;
    if (!employeeId) throw new HttpException('Auth talab qilinadi', HttpStatus.UNAUTHORIZED);
    try {
      return await this.attendanceService.selfMark(employeeId, body.lat, body.lng);
    } catch (err: any) {
      if (err?.status) throw err;
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }

  // Adashib bosilgan "kettim"ni bekor qilish. GPS talab qilinmaydi —
  // xodim allaqachon shu joyda ekani kelishda tekshirilgan.
  @Post('self-undo-checkout')
  async selfUndoCheckOut(@Req() req: Request) {
    const employeeId = (req as any)?.user?.sub;
    if (!employeeId) throw new HttpException('Auth talab qilinadi', HttpStatus.UNAUTHORIZED);
    try {
      return await this.attendanceService.selfUndoCheckOut(employeeId);
    } catch (err: any) {
      if (err?.status) throw err;
      throw new HttpException(err.message || 'Xatolik', HttpStatus.BAD_REQUEST);
    }
  }
}
