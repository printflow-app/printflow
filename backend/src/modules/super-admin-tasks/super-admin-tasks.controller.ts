import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminTasksService } from './super-admin-tasks.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('super-admin/task-manager')
@UseGuards(SuperAdminGuard)
export class SuperAdminTasksController {
  constructor(private service: SuperAdminTasksService) {}

  // ── Funnels ───────────────────────────────────────────────────────────────
  @Get('funnels')
  listFunnels() {
    return this.service.listFunnels();
  }

  @Post('funnels')
  createFunnel(@Body() body: { name: string; color?: string; sortOrder?: number }) {
    return this.service.createFunnel(body);
  }

  @Put('funnels/:id')
  updateFunnel(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; sortOrder?: number },
  ) {
    return this.service.updateFunnel(id, body);
  }

  @Delete('funnels/:id')
  deleteFunnel(@Param('id') id: string) {
    return this.service.deleteFunnel(id);
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  @Post('tasks')
  createTask(
    @Body()
    body: {
      funnelId: string;
      title: string;
      description?: string;
      deadlineAt?: string | null;
      status?: string;
    },
  ) {
    return this.service.createTask(body);
  }

  @Put('tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      deadlineAt?: string | null;
      status?: string;
      funnelId?: string;
      sortOrder?: number;
    },
  ) {
    return this.service.updateTask(id, body);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string) {
    return this.service.deleteTask(id);
  }
}
