import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('super-admin/tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get('stats/overview')
  getStats() {
    return this.tenantsService.getStats();
  }

  @Get('payments/pending')
  getPendingPayments() {
    return this.tenantsService.getPendingPayments();
  }

  @Get('payments/all')
  getAllPayments() {
    return this.tenantsService.getAllPayments();
  }

  @Post('payments/:id/approve')
  approvePayment(@Param('id') id: string, @Req() req: any) {
    const superAdminId = req.superAdmin?.sub || 'system';
    return this.tenantsService.approvePayment(id, superAdminId);
  }

  @Post('payments/:id/reject')
  rejectPayment(@Param('id') id: string) {
    return this.tenantsService.rejectPayment(id);
  }

  // Create workspace from a Lead (So'rov)
  @Post('from-lead')
  createFromLead(@Body() body: { leadId: string; slug: string; planId?: string }) {
    return this.tenantsService.createFromLead(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      slug: string;
      planId?: string;
      trialDays?: number;
      adminEmail: string;
      adminPassword: string;
    },
  ) {
    return this.tenantsService.createWithAdmin(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; planId?: string; isActive?: boolean; status?: string },
  ) {
    return this.tenantsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
