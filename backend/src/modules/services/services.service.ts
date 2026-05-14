import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Multi-Branch isolation helper.
//   '__main__' (or empty) → branchId IS NULL  (Bosh ofis / legacy data)
//   real UUID             → branchId = <UUID> (specific branch)
function normalizeBranch(branchId?: string | null): string | null {
  if (!branchId || branchId === '__main__') return null;
  return branchId;
}

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const scope = normalizeBranch(branchId);
    return this.prisma.service.findMany({
      where: { branchId: scope },
      include: { options: true, materials: { include: { material: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const service = await this.prisma.service.findFirst({
      where: { id, branchId: scope },
      include: { options: true, materials: { include: { material: true } } },
    });
    if (!service) throw new NotFoundException('Xizmat topilmadi');
    return service;
  }

  async create(data: any) {
    const { options, materials, branch, ...rest } = data;
    if (rest.branchId === undefined) {
      throw new BadRequestException('branchId majburiy: xizmat qaysi filialga tegishli ekanini ko\'rsating');
    }
    rest.branchId = normalizeBranch(rest.branchId);
    return this.prisma.service.create({ data: rest });
  }

  async update(id: string, data: any, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const existing = await this.prisma.service.findFirst({ where: { id, branchId: scope } });
    if (!existing) throw new NotFoundException('Xizmat topilmadi yoki ushbu filialga tegishli emas');

    const { options, materials, branch, ...rest } = data;
    delete rest.branchId; // cross-branch o'tkazish taqiqlangan
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

  async remove(id: string, branchId?: string) {
    const scope = normalizeBranch(branchId);
    const existing = await this.prisma.service.findFirst({ where: { id, branchId: scope } });
    if (!existing) throw new NotFoundException('Xizmat topilmadi yoki ushbu filialga tegishli emas');
    return this.prisma.service.delete({ where: { id } });
  }

  async clone(id: string, targetBranchId: string) {
    const source = await this.prisma.service.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!source) throw new NotFoundException('Xizmat topilmadi');

    const { id: _id, tenantId: _tid, createdAt: _ca, updatedAt: _ua, branchId: _bid, options, ...rest } = source as any;

    const cloned = await this.prisma.service.create({
      data: { ...rest, branchId: normalizeBranch(targetBranchId) },
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

  // Opsiyalar
  async addOption(serviceId: string, optionData: any) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) throw new Error('Xizmat topilmadi');

    const priceAdd = this.calculateRoundedPrice(
      service.basePrice,
      optionData.percentageMarkup || 0,
    );

    return this.prisma.serviceOption.create({
      data: { ...optionData, serviceId, priceAdd },
    });
  }

  async removeOption(optionId: string) {
    return this.prisma.serviceOption.delete({ where: { id: optionId } });
  }

  async updateOption(optionId: string, data: any) {
    const option = await this.prisma.serviceOption.findUnique({
      where: { id: optionId },
      include: { service: true },
    });

    if (!option) throw new Error('Optsiya topilmadi');

    const percentageMarkup =
      data.percentageMarkup !== undefined
        ? data.percentageMarkup
        : option.percentageMarkup;

    const priceAdd = this.calculateRoundedPrice(
      option.service.basePrice,
      percentageMarkup,
    );

    return this.prisma.serviceOption.update({
      where: { id: optionId },
      data: { ...data, priceAdd },
    });
  }

  // Barcha optsiyalar narxini qayta hisoblash
  async updateOptionsPrices(serviceId: string) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { options: true },
    });

    if (!service) return;

    const updates = service.options.map((option) => {
      const newPriceAdd = this.calculateRoundedPrice(
        service.basePrice,
        option.percentageMarkup,
      );
      return this.prisma.serviceOption.update({
        where: { id: option.id },
        data: { priceAdd: newPriceAdd },
      });
    });

    await Promise.all(updates);
  }

  // Narxni yaxlitlash logikasi
  calculateRoundedPrice(base: number, markupPercent: number): number {
    const rawMarkup = base * (markupPercent / 100);
    return Math.round(rawMarkup);
  }

  // BOM - Material bog'lash
  async addMaterial(serviceId: string, materialData: any) {
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

  async removeMaterial(serviceId: string, materialId: string) {
    return this.prisma.serviceMaterial.deleteMany({
      where: { serviceId, materialId },
    });
  }

  // Narx hisoblash (Pricing Engine)
  async calculatePrice(params: {
    serviceId: string;
    selectedOptionIds: string[];
    quantity: number;
    discount: number;
    coefficient: number;
  }) {
    const { serviceId, selectedOptionIds, quantity, discount, coefficient } =
      params;

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { options: true },
    });

    if (!service) throw new Error('Xizmat topilmadi');

    const selectedOptions = service.options.filter((o) =>
      selectedOptionIds.includes(o.id),
    );

    const optionsTotal = selectedOptions.reduce((sum, o) => sum + o.priceAdd, 0);
    const baseTotal = service.basePrice + optionsTotal;
    const total =
      baseTotal * quantity * (1 - (discount || 0)) * (coefficient || 1);

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
