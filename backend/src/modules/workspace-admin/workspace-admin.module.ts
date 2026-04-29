import { Module } from '@nestjs/common';
import { WorkspaceAdminController } from './workspace-admin.controller';
import { WorkspaceAdminService } from './workspace-admin.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceAdminController],
  providers: [WorkspaceAdminService],
  exports: [WorkspaceAdminService],
})
export class WorkspaceAdminModule {}
