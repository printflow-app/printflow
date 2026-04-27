import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// =============================================
// SETTINGS SERVICE — Tenant-scoped
// SystemSetting jadvalida compound unique: [tenantId, key]
// Prisma middleware tenantId'ni avtomatik inject qiladi,
// lekin upsert uchun where shartini to'g'ri ko'rsatish kerak.
// =============================================

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: string) {
    // Prisma middleware avtomatik tenantId qo'shadi findFirst'ga
    const setting = await this.prisma.systemSetting.findFirst({
      where: { key },
    });
    return setting ? JSON.parse(setting.value) : null;
  }

  async set(key: string, value: any) {
    const valueStr = JSON.stringify(value);
    const tenantId = TenantContext.getTenantId();

    // Compound unique bo'lgani uchun {tenantId_key} ga upsert qilamiz
    return this.prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { value: valueStr },
      create: { key, value: valueStr } as any,
    });
  }

  async getAll() {
    // Prisma middleware avtomatik tenantId filtrlaydi
    const settings = await this.prisma.systemSetting.findMany();
    const result: Record<string, any> = {};
    settings.forEach((s) => {
      result[s.key] = JSON.parse(s.value);
    });
    return result;
  }
}
