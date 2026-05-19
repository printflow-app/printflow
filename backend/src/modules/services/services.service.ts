import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Strict branch isolation — no '__main__' fallback, no nullable bucket.
// Every Service operation requires a real Branch UUID; missing/empty → 400.
function requireBranchId(branchId: string | undefined | null, ctx: string): string {
  if (!branchId || typeof branchId !== 'string' || branchId.trim() === '' || branchId === '__main__') {
    throw new BadRequestException(`branchId majburiy (${ctx}): aktiv filialni tanlang`);
  }
  return branchId;
}

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const bId = requireBranchId(branchId, 'GET /services');
    return this.prisma.service.findMany({
      where: { branchId: bId },
      include: { options: true, materials: { include: { material: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, branchId?: string) {
    const bId = requireBranchId(branchId, 'GET /services/:id');
    const service = await this.prisma.service.findFirst({
      where: { id, branchId: bId },
      include: { options: true, materials: { include: { material: true } } },
    });
    if (!service) throw new NotFoundException('Xizmat topilmadi yoki ushbu filialga tegishli emas');
    return service;
  }

  async create(data: any) {
    const { options, materials, branch, ...rest } = data;
    const bId = requireBranchId(rest.branchId, 'POST /services');
    rest.branchId = bId;
    return this.prisma.service.create({ data: rest });
  }

  async update(id: string, data: any, branchId?: string) {
    const bId = requireBranchId(branchId, 'PUT /services/:id');
    const existing = await this.prisma.service.findFirst({ where: { id, branchId: bId } });
    if (!existing) throw new NotFoundException('Xizmat topilmadi yoki ushbu filialga tegishli emas');

    const { options, materials, branch, ...rest } = data;
    delete rest.branchId; // cross-branch transfer forbidden — use clone instead
    delete rest.tenantId;

    const updatedService = await this.prisma.service.update({
      where: { id },
      data: rest,
    });

    if (rest.basePrice !== undefined) {
      await this.updateOptionsPrices(id);
    }

    return updatedService;
  }

  // Public price list — auth'siz mijozga ko'rinadigan ro'yxat.
  // Tenant slug + ixtiyoriy branchId. Tenant interceptor public route'larda
  // o'tkazib yuborilganligi sababli tenantId'ni qo'lda WHERE'da ko'rsatamiz.
  async getPublicPriceList(slug: string, branchId?: string) {
    if (!slug) throw new BadRequestException('Slug majburiy');
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        status: true,
        branches: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, phone: true, address: true },
        },
      },
    });

    if (!tenant) throw new NotFoundException('Workspace topilmadi');
    if (!tenant.isActive || tenant.status === 'EXPIRED') {
      throw new NotFoundException('Bu workspace faol emas');
    }

    const branch = branchId
      ? tenant.branches.find((b) => b.id === branchId)
      : tenant.branches[0];
    if (!branch) throw new NotFoundException('Filial topilmadi');

    const services = await this.prisma.service.findMany({
      where: { tenantId: tenant.id, branchId: branch.id },
      select: {
        id: true,
        name: true,
        basePrice: true,
        unit: true,
        imageUrl: true,
        options: { select: { id: true, name: true, value: true, priceAdd: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Price list branding sozlamalari — admin Sozlamalar'da saqlangan.
    // Tenant interceptor public route'da ishlamasligi sababli raw SQL bilan o'qiymiz.
    let branding: any = null;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ value: string }>>`
        SELECT value FROM "SystemSetting"
        WHERE "tenantId" = ${tenant.id} AND key = 'PRICE_LIST_BRANDING'
        LIMIT 1
      `;
      if (rows.length > 0) {
        branding = JSON.parse(rows[0].value);
      }
    } catch {
      // Branding yo'q yoki noto'g'ri JSON — default rang'lar bilan ishlaymiz
    }

    return {
      tenant: { name: tenant.name, slug: tenant.slug },
      branch: {
        id: branch.id,
        name: branch.name,
        phone: branch.phone,
        address: branch.address,
      },
      branches: tenant.branches.map((b) => ({ id: b.id, name: b.name })),
      services,
      branding,
    };
  }

  async remove(id: string, branchId?: string) {
    const bId = requireBranchId(branchId, 'DELETE /services/:id');
    const existing = await this.prisma.service.findFirst({ where: { id, branchId: bId } });
    if (!existing) throw new NotFoundException('Xizmat topilmadi yoki ushbu filialga tegishli emas');
    return this.prisma.service.delete({ where: { id } });
  }

  async clone(id: string, sourceBranchId: string | undefined, targetBranchId: string) {
    const srcBranch = requireBranchId(sourceBranchId, 'POST /services/:id/clone (source)');
    const dstBranch = requireBranchId(targetBranchId, 'POST /services/:id/clone (target)');

    const source = await this.prisma.service.findFirst({
      where: { id, branchId: srcBranch },
      include: { options: true },
    });
    if (!source) throw new NotFoundException('Manba xizmat topilmadi yoki sizning filialingizga tegishli emas');

    const { id: _id, tenantId: _tid, createdAt: _ca, updatedAt: _ua, branchId: _bid, options, ...rest } = source as any;

    const cloned = await this.prisma.service.create({
      data: { ...rest, branchId: dstBranch },
    });

    if (options?.length) {
      await this.prisma.serviceOption.createMany({
        data: options.map(({ id: _oid, serviceId: _sid, tenantId: _otid, createdAt: _oca, updatedAt: _oua, ...opt }: any) => ({
          ...opt,
          serviceId: cloned.id,
        })),
      });
    }

    return cloned;
  }

  // Internal: confirm a Service belongs to the caller's branch before mutating its children.
  // Without this, anyone in Branch A could POST /services/<B>/options.
  private async assertServiceInBranch(serviceId: string, branchId: string): Promise<{ id: string; basePrice: number }> {
    const svc = await this.prisma.service.findFirst({
      where: { id: serviceId, branchId },
      select: { id: true, basePrice: true },
    });
    if (!svc) throw new ForbiddenException('Bu xizmat sizning filialingizga tegishli emas');
    return svc;
  }

  // ============ OPTIONS ============

  async addOption(serviceId: string, branchId: string | undefined, optionData: any) {
    const bId = requireBranchId(branchId, 'POST /services/:id/options');
    const service = await this.assertServiceInBranch(serviceId, bId);

    const priceAdd = this.calculateRoundedPrice(
      service.basePrice,
      optionData.percentageMarkup || 0,
    );

    return this.prisma.serviceOption.create({
      data: { ...optionData, serviceId, priceAdd },
    });
  }

  async removeOption(optionId: string, branchId?: string) {
    const bId = requireBranchId(branchId, 'DELETE /services/options/:id');
    const option = await this.prisma.serviceOption.findFirst({
      where: { id: optionId, service: { branchId: bId } },
    });
    if (!option) throw new NotFoundException('Optsiya topilmadi yoki ushbu filialga tegishli emas');
    return this.prisma.serviceOption.delete({ where: { id: optionId } });
  }

  async updateOption(optionId: string, branchId: string | undefined, data: any) {
    const bId = requireBranchId(branchId, 'PUT /services/options/:id');
    const option = await this.prisma.serviceOption.findFirst({
      where: { id: optionId, service: { branchId: bId } },
      include: { service: true },
    });
    if (!option) throw new NotFoundException('Optsiya topilmadi yoki ushbu filialga tegishli emas');

    const percentageMarkup =
      data.percentageMarkup !== undefined ? data.percentageMarkup : option.percentageMarkup;
    const priceAdd = this.calculateRoundedPrice(option.service.basePrice, percentageMarkup);

    return this.prisma.serviceOption.update({
      where: { id: optionId },
      data: { ...data, priceAdd },
    });
  }

  // Recompute priceAdd for all options of a service (called after basePrice change).
  async updateOptionsPrices(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { options: true },
    });
    if (!service) return;

    await Promise.all(
      service.options.map((option) => {
        const newPriceAdd = this.calculateRoundedPrice(service.basePrice, option.percentageMarkup);
        return this.prisma.serviceOption.update({
          where: { id: option.id },
          data: { priceAdd: newPriceAdd },
        });
      }),
    );
  }

  calculateRoundedPrice(base: number, markupPercent: number): number {
    const rawMarkup = base * (markupPercent / 100);
    return Math.round(rawMarkup);
  }

  // ============ BOM — Materials ============

  async addMaterial(serviceId: string, branchId: string | undefined, materialData: any) {
    const bId = requireBranchId(branchId, 'POST /services/:id/materials');
    await this.assertServiceInBranch(serviceId, bId);

    return this.prisma.serviceMaterial.upsert({
      where: {
        serviceId_materialId: {
          serviceId,
          materialId: materialData.materialId,
        },
      },
      update: { normPerUnit: materialData.normPerUnit },
      create: { serviceId, ...materialData },
    });
  }

  async removeMaterial(serviceId: string, materialId: string, branchId?: string) {
    const bId = requireBranchId(branchId, 'DELETE /services/:id/materials/:materialId');
    await this.assertServiceInBranch(serviceId, bId);
    return this.prisma.serviceMaterial.deleteMany({
      where: { serviceId, materialId },
    });
  }

  // ============ Pricing Engine ============

  async calculatePrice(params: {
    serviceId: string;
    branchId?: string;
    selectedOptionIds: string[];
    quantity: number;
    discount: number;
    coefficient: number;
  }) {
    const { serviceId, branchId, selectedOptionIds, quantity, discount, coefficient } = params;
    const bId = requireBranchId(branchId, 'POST /services/:id/calculate-price');

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, branchId: bId },
      include: { options: true },
    });
    if (!service) throw new NotFoundException('Xizmat topilmadi yoki ushbu filialga tegishli emas');

    const selectedOptions = service.options.filter((o) => selectedOptionIds.includes(o.id));
    const optionsTotal = selectedOptions.reduce((sum, o) => sum + o.priceAdd, 0);
    const baseTotal = service.basePrice + optionsTotal;
    const total = baseTotal * quantity * (1 - (discount || 0)) * (coefficient || 1);

    return {
      basePrice: service.basePrice,
      optionsTotal,
      baseTotal,
      quantity,
      discount,
      coefficient,
      total: Math.round(total),
      breakdown: selectedOptions.map((o) => ({
        name: o.name,
        value: o.value,
        priceAdd: o.priceAdd,
      })),
    };
  }
}
