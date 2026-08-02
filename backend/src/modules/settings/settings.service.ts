import { Injectable, BadRequestException } from '@nestjs/common';
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

  /**
   * Saqlashdan oldingi tekshiruv.
   *
   * Nega kerak: bitta workspace'da GPS koordinatalari gradus-daqiqa-soniya
   * ko'rinishida (405926.1) saqlanib qolgan — o'nlik songa aylantirilmagan.
   * Tizim uni jimgina qabul qilgan va davomat OYLAR davomida ishlamagan:
   * masofa 8000 km chiqib, xodim ofisda tursa ham rad etilgan. Xato xabari
   * esa xodimni ayblagan, sozlamani emas.
   *
   * Shuning uchun bunday qiymat bazaga umuman tushmasligi kerak.
   */
  private assertValid(key: string, value: any) {
    const num = (v: any) => {
      const n = typeof v === 'object' && v !== null ? Number(v.value) : Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    if (key === 'OFFICE_LAT' || key === 'OFFICE_LNG') {
      const n = num(value);
      const chegara = key === 'OFFICE_LAT' ? 90 : 180;
      if (isNaN(n) || Math.abs(n) > chegara) {
        throw new BadRequestException(
          `${key === 'OFFICE_LAT' ? 'Kenglik' : 'Uzunlik'} noto'g'ri: ${value?.value ?? value}. ` +
            `U -${chegara} dan ${chegara} gacha bo'lgan O'NLIK son bo'lishi kerak ` +
            `(masalan ${key === 'OFFICE_LAT' ? '41.011571' : '71.635099'}). ` +
            `Gradus-daqiqa-soniya ko'rinishini (41°00'41.7") avval o'nlik songa aylantiring.`,
        );
      }
    }

    if (key === 'OFFICE_RADIUS') {
      const n = num(value);
      if (isNaN(n) || n < 20) {
        throw new BadRequestException(
          `Radius juda kichik: ${value?.value ?? value} m. Telefon GPS aniqligi odatda ` +
            `10-50 metr, shuning uchun kamida 20 metr bo'lishi kerak — aks holda xodim ` +
            `ofis ichida turganda ham chetda ko'rinadi.`,
        );
      }
    }
  }

  async set(key: string, value: any) {
    this.assertValid(key, value);
    const valueStr = JSON.stringify(value);
    const tenantId = TenantContext.getTenantId();

    // Compound unique bo'lgani uchun {tenantId_key} ga upsert qilamiz.
    // create da tenantId explicitly berish kerak — middleware upsert.create ga inject qilmaydi.
    return this.prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { value: valueStr },
      create: { tenantId, key, value: valueStr } as any,
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

  // Bypasses tenant middleware — for public landing page reads
  async getPublic(key: string) {
    const result = await this.prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM "SystemSetting" WHERE key = ${key} LIMIT 1
    `;
    return result.length > 0 ? JSON.parse(result[0].value) : null;
  }
}
