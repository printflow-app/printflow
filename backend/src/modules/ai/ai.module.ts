import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { BriefingService } from './briefing.service';
import { AutonomousService } from './autonomous.service';
import { RiskDetectionService } from './risk-detection.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { FinanceModule } from '../finance/finance.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, TasksModule, FinanceModule, SettingsModule],
  controllers: [AiController],
  providers: [AiService, BriefingService, AutonomousService, RiskDetectionService],
  exports: [AiService],
})
export class AiModule {}
