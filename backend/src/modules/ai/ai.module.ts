import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [PrismaModule, TasksModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
