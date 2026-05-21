import { Controller, Post, Body, Get, UseGuards, Put, Param } from '@nestjs/common';
import { BillingService } from './billing.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

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

  // --- PROMO CODE ---

  @Get('promo/my-code')
  getOrCreatePromoCode() {
    return this.billingService.getOrCreateMyPromoCode();
  }

  @Get('promo/my-stats')
  getMyPromoStats() {
    return this.billingService.getMyPromoStats();
  }

  @Post('promo/validate')
  validatePromoCode(@Body() body: { code: string }) {
    return this.billingService.validatePromoCode(body.code);
  }

  // --- PLATFORM SETTINGS ---

  @Public()
  @Get('settings/payment-cards')
  getPaymentCards() {
    return this.billingService.getSetting('PAYMENT_CARDS');
  }

  // Super-admin writes platform settings (e.g. AI_COPILOT_ENABLED).
  // Tenant users have no business changing platform-wide flags.
  @Public()
  @UseGuards(SuperAdminGuard)
  @Put('platform-settings/:key')
  updatePlatformSetting(@Param('key') key: string, @Body() body: { value: any }) {
    return this.billingService.updateSetting(key, body.value);
  }

  // Super-admin reads platform settings — used by the admin dashboard so it
  // can render the current toggle state without going through tenant auth.
  @Public()
  @UseGuards(SuperAdminGuard)
  @Get('platform-settings/:key')
  async getPlatformSetting(@Param('key') key: string) {
    const value = await this.billingService.getSetting(key);
    return { value };
  }

  @Put('settings/:key')
  updateSetting(@Param('key') key: string, @Body() body: { value: any }) {
    return this.billingService.updateSetting(key, body.value);
  }

  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    const value = await this.billingService.getSetting(key);
    return { value };
  }

  // --- SUPER ADMIN: All promo codes ---
  @Get('admin/promo-codes')
  getAllPromoCodes() {
    return this.billingService.getAllPromoCodes();
  }
}
