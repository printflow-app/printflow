import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
