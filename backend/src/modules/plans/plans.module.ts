import { Module } from '@nestjs/common';
import { PlansController, PlansAdminController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  controllers: [PlansController, PlansAdminController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
