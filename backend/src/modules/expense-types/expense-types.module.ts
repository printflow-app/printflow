import { Module } from '@nestjs/common';
import { ExpenseTypesService } from './expense-types.service';
import { ExpenseTypesController } from './expense-types.controller';

@Module({
  providers: [ExpenseTypesService],
  controllers: [ExpenseTypesController],
  exports: [ExpenseTypesService],
})
export class ExpenseTypesModule {}
