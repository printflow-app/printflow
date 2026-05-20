import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SuperAdminTasksController } from './super-admin-tasks.controller';
import { SuperAdminTasksService } from './super-admin-tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [SuperAdminTasksController],
  providers: [SuperAdminTasksService],
})
export class SuperAdminTasksModule {}
