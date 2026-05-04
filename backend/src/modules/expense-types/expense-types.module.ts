import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExpenseTypesService } from './expense-types.service';
import { ExpenseTypesController } from './expense-types.controller';

@Module({
  imports: [PrismaModule],
  providers: [ExpenseTypesService],
  controllers: [ExpenseTypesController],
  exports: [ExpenseTypesService],
})
export class ExpenseTypesModule {}
