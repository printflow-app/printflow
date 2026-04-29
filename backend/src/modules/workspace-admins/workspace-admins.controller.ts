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
import { WorkspaceAdminsService } from './workspace-admins.service';

@Controller('workspace-admins')
export class WorkspaceAdminsController {
  constructor(private service: WorkspaceAdminsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * POST /api/workspace-admins
   * Creates a new Workspace Admin with auto-generated login/password.
   * Returns generatedLogin + generatedPassword ONCE — show to user immediately!
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: { fullName: string; phone?: string }) {
    return this.service.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { fullName?: string; phone?: string; isActive?: boolean; password?: string },
  ) {
    return this.service.update(id, body);
  }

  /**
   * POST /api/workspace-admins/:id/regenerate-password
   * Generates a new random password for the admin — returns it once.
   */
  @Post(':id/regenerate-password')
  @HttpCode(HttpStatus.OK)
  regeneratePassword(@Param('id') id: string) {
    return this.service.regeneratePassword(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
