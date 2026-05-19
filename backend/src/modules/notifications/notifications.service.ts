import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';

// =============================================
// NOTIFICATIONS SERVICE
// Sidebar nav item'lari uchun "yangilik" sonlarini hisoblaydi.
// Har bir tab uchun client localStorage'da o'z `lastSeen`'ini saqlaydi
// va backend'ga query param sifatida yuboradi. Backend bu sanadan keyin
// paydo bo'lgan elementlarni sanaydi.
// =============================================

type SinceMap = {
  topshiriqlar?: string;
  mijozlar?: string;
  hamkorlar?: string;
  ombor?: string;
  davomat?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getSidebarCounts(params: { branchId?: string; since: SinceMap; userId?: string }) {
    const tenantId = TenantContext.tryGetTenantId();
    if (!tenantId) {
      return this.empty();
    }

    const { branchId, since } = params;
    const branchFilter = branchId ? { branchId } : {};

    const toDate = (s?: string) => {
      if (!s) return undefined;
      const d = new Date(s);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const topshiriqlarSince = toDate(since.topshiriqlar);
    const mijozlarSince = toDate(since.mijozlar);
    const hamkorlarSince = toDate(since.hamkorlar);

    // Run all count queries in parallel for speed
    const [topshiriqlar, mijozlar, hamkorlar, ombor, davomat] = await Promise.all([
      // Topshiriqlar — `topshiriqlarSince`'dan keyin yaratilgan tasklar
      topshiriqlarSince
        ? this.prisma.task.count({
            where: {
              tenantId,
              isArchived: false,
              createdAt: { gt: topshiriqlarSince },
              ...branchFilter,
            } as any,
          })
        : Promise.resolve(0),

      // Mijozlar — yangi qo'shilganlar
      mijozlarSince
        ? this.prisma.customer.count({
            where: {
              tenantId,
              createdAt: { gt: mijozlarSince },
              ...branchFilter,
            } as any,
          })
        : Promise.resolve(0),

      // Hamkorlar — yangi qo'shilganlar
      hamkorlarSince
        ? this.prisma.vendor.count({
            where: {
              tenantId,
              createdAt: { gt: hamkorlarSince },
              ...branchFilter,
            } as any,
          }).catch(() => 0)
        : Promise.resolve(0),

      // Ombor — minStock dan past yoki teng materiallar (ogohlantirish)
      // Prisma raqamlar uchun field-vs-field taqqoslashni qo'llab-quvvatlamaydi,
      // shuning uchun raw SQL ishlatamiz.
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "Material"
        WHERE "tenantId" = ${tenantId}
          AND "minStock" > 0
          AND "currentStock" <= "minStock"
      `.then((r) => Number(r?.[0]?.count ?? 0)).catch(() => 0),

      // Davomat — PENDING overtime requests
      this.prisma.overtimeRequest.count({
        where: {
          tenantId,
          status: 'PENDING',
        } as any,
      }).catch(() => 0),
    ]);

    return {
      topshiriqlar,
      mijozlar,
      hamkorlar,
      ombor,
      davomat,
    };
  }

  private empty() {
    return {
      topshiriqlar: 0,
      mijozlar: 0,
      hamkorlar: 0,
      ombor: 0,
      davomat: 0,
    };
  }
}
