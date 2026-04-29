import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkspaceAdminService } from './workspace-admin.service';

// =============================================
// WORKSPACE ADMIN CONTROLLER
// /api/workspace-admins
// Requires JWT + Tenant scope (via global guards)
// Only accessible to employees with canManageAdmins
// =============================================

@Controller('workspace-admins')
export class WorkspaceAdminController {
  constructor(private service: WorkspaceAdminService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { fullName: string; phone?: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id') id: string) {
    return this.service.resetPassword(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
