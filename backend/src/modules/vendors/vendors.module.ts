import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorOrdersService } from './vendor-orders.service';

@Module({
  imports: [PrismaModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorOrdersService],
  exports: [VendorsService, VendorOrdersService],
})
export class VendorsModule {}
