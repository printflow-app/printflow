import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.service.findMany({
      include: { options: true, materials: { include: { material: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: { options: true, materials: { include: { material: true } } },
    });
  }

  async create(data: any) {
    const { options, materials, ...rest } = data;
    return this.prisma.service.create({ data: rest });
  }

  async update(id: string, data: any) {
    const { options, materials, ...rest } = data;
    const updatedService = await this.prisma.service.update({
      where: { id },
      data: rest,
    });

    // Agar basePrice o'zgarsa, barcha optsiyalar narxini yangilash
    if (rest.basePrice !== undefined) {
      await this.updateOptionsPrices(id);
    }

    return updatedService;
  }

  async remove(id: string) {
    return this.prisma.service.delete({ where: { id } });
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

    // Yaxlitlash qoidasi:
    // oxirgi uchta raqam 500 dan past bo'lsa -> 000
    // 500 va undan yuqori bo'lsa -> 1000
    // Bu Math.round(val / 1000) * 1000 ga teng
    return Math.round(rawMarkup / 1000) * 1000;
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
