import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { BriefingService } from './briefing.service';
import { AutonomousService } from './autonomous.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [PrismaModule, TasksModule, FinanceModule],
  controllers: [AiController],
  providers: [AiService, BriefingService, AutonomousService],
  exports: [AiService],
})
export class AiModule {}
