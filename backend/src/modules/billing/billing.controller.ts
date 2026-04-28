import { Controller, Post, Body, Get, UseGuards, Put, Param } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('payment')
  submitPayment(@Body() body: any) {
    return this.billingService.submitPayment(body);
  }

  @Get('status')
  getStatus() {
    return this.billingService.getTenantBillingStatus();
  }

  @Get('my-payments')
  getMyPayments() {
    return this.billingService.getMyPayments();
  }

  // --- PLATFORM SETTINGS ---

  @Public()
  @Get('settings/payment-cards')
  getPaymentCards() {
    return this.billingService.getSetting('PAYMENT_CARDS');
  }

  @Put('settings/:key')
  updateSetting(@Param('key') key: string, @Body() body: { value: any }) {
    // Note: In real app, this should be guarded for SuperAdmin only
    return this.billingService.updateSetting(key, body.value);
  }

  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    const value = await this.billingService.getSetting(key);
    return { value };
  }
}
