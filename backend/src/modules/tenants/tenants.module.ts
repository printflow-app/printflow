import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { LeadsController } from './leads.controller';
import { TenantsService } from './tenants.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [TenantsController, LeadsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
