import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Public } from '../../common/decorators/public.decorator';

import { RequireFeature } from '../../common/decorators/feature.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';

// =============================================
// ATTENDANCE CONTROLLER
// checkIn / checkOut = @Public() — QR skanerlash uchun
//   (xodimning telefoni JWT cookie'ga ega emas)
// Qolgan barcha endpoint'lar JWT himoyasida
// =============================================

@UseGuards(JwtAuthGuard)
@RequireFeature('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // Joriy QR token olish (admin sahifasi uchun) — JWT protected
  @Get('token')
  getCurrentToken() {
    return this.attendanceService.getCurrentToken();
  }

  // Yangi token yaratish (manual refresh) — JWT protected
  @Post('token/refresh')
  refreshToken() {
    return this.attendanceService.getOrCreateToken();
  }

  // ⚠️ PUBLIC — QR kod orqali skanerlash (xodim telefoni JWT'ga ega emas)
  @Public()
  @Post('checkin')
  async checkIn(
    @Body() body: { employeeId: string; token: string; deviceId?: string },
  ) {
    try {
      return await this.attendanceService.checkIn(
        body.employeeId,
        body.token,
        body.deviceId,
      );
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Xatolik',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ⚠️ PUBLIC — ketish ham skanerlash orqali
  @Public()
  @Post('checkout')
  async checkOut(
    @Body() body: { employeeId: string; token: string; deviceId?: string },
  ) {
    try {
      return await this.attendanceService.checkOut(
        body.employeeId,
        body.token,
        body.deviceId,
      );
    } catch (err: any) {
      throw new HttpException(
        err.message || 'Xatolik',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // Bugungi yozuvlar
  @Get('records/today')
  getTodayRecords() {
    return this.attendanceService.getTodayRecords();
  }

  // Barcha / filtrlangan
  @Get('records')
  getRecords(@Query('date') date?: string) {
    return this.attendanceService.getRecords(date);
  }

  // Oylik jadvallar
  @Get('monthly')
  getMonthlyRecords(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    if (!year || !month)
      throw new HttpException('Year and month required', HttpStatus.BAD_REQUEST);
    return this.attendanceService.getMonthlyRecords(
      parseInt(year),
      parseInt(month),
    );
  }

  // Xodim bo'yicha
  @Get('records/employee/:employeeId')
  getByEmployee(@Param('employeeId') employeeId: string) {
    return this.attendanceService.getRecordsByEmployee(employeeId);
  }
}
