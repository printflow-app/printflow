import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Public } from '../../common/decorators/public.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateLeadDto } from './create-lead.dto';

@Controller('leads')
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  // Public — Landing page'dan so'rov yuborish (NO auth required)
  @Public()
  @Post()
  create(@Body() body: CreateLeadDto) {
    return this.leadsService.create(body);
  }

  // Super-Admin only — barcha so'rovlarni ko'rish
  @Public()
  @UseGuards(SuperAdminGuard)
  @Get()
  findAll() {
    return this.leadsService.findAll();
  }

  // Super-Admin only — statusni o'zgartirish
  @Public()
  @UseGuards(SuperAdminGuard)
  @Post(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.leadsService.updateStatus(id, body.status);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id);
  }
}
