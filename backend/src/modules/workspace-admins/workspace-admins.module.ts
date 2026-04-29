import { Module } from '@nestjs/common';
import { WorkspaceAdminsController } from './workspace-admins.controller';
import { WorkspaceAdminsService } from './workspace-admins.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceAdminsController],
  providers: [WorkspaceAdminsService],
  exports: [WorkspaceAdminsService],
})
export class WorkspaceAdminsModule {}
