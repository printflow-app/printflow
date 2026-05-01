import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public/:key')
  async getPublic(@Param('key') key: string) {
    return this.settingsService.getPublic(key);
  }

  @Get()
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    return this.settingsService.get(key);
  }

  @Post(':key')
  async set(@Param('key') key: string, @Body() value: any) {
    return this.settingsService.set(key, value);
  }
}
