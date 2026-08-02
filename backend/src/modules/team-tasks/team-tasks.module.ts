import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TeamTasksService } from './team-tasks.service';
import { TeamTasksController } from './team-tasks.controller';

@Module({
  imports: [PrismaModule, TelegramModule],
  providers: [TeamTasksService],
  controllers: [TeamTasksController],
  exports: [TeamTasksService],
})
export class TeamTasksModule {}
