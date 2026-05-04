import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlansController, PlansAdminController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlansController, PlansAdminController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
