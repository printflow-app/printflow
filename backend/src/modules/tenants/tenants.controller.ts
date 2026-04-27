import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

// =============================================
// TENANTS CONTROLLER — Super-Admin only
// Workspace (tenant) CRUD management
// All routes protected by SuperAdminGuard
// =============================================

@Controller('super-admin/tenants')
@UseGuards(SuperAdminGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
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
      plan?: string;
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
    @Body() body: { name?: string; plan?: string; isActive?: boolean },
  ) {
    return this.tenantsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  @Get('stats/overview')
  getStats() {
    return this.tenantsService.getStats();
  }
}
