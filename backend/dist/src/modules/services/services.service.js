"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ServicesService = class ServicesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.service.findMany({
            include: { options: true, materials: { include: { material: true } } },
            orderBy: { createdAt: 'asc' },
        });
    }
    async findOne(id) {
        return this.prisma.service.findUnique({
            where: { id },
            include: { options: true, materials: { include: { material: true } } },
        });
    }
    async create(data) {
        const { options, materials, ...rest } = data;
        return this.prisma.service.create({ data: rest });
    }
    async update(id, data) {
        const { options, materials, ...rest } = data;
        const updatedService = await this.prisma.service.update({
            where: { id },
            data: rest,
        });
        if (rest.basePrice !== undefined) {
            await this.updateOptionsPrices(id);
        }
        return updatedService;
    }
    async remove(id) {
        return this.prisma.service.delete({ where: { id } });
    }
    async addOption(serviceId, optionData) {
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
        });
        if (!service)
            throw new Error('Xizmat topilmadi');
        const priceAdd = this.calculateRoundedPrice(service.basePrice, optionData.percentageMarkup || 0);
        return this.prisma.serviceOption.create({
            data: { ...optionData, serviceId, priceAdd },
        });
    }
    async removeOption(optionId) {
        return this.prisma.serviceOption.delete({ where: { id: optionId } });
    }
    async updateOption(optionId, data) {
        const option = await this.prisma.serviceOption.findUnique({
            where: { id: optionId },
            include: { service: true },
        });
        if (!option)
            throw new Error('Optsiya topilmadi');
        const percentageMarkup = data.percentageMarkup !== undefined
            ? data.percentageMarkup
            : option.percentageMarkup;
        const priceAdd = this.calculateRoundedPrice(option.service.basePrice, percentageMarkup);
        return this.prisma.serviceOption.update({
            where: { id: optionId },
            data: { ...data, priceAdd },
        });
    }
    async updateOptionsPrices(serviceId) {
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            include: { options: true },
        });
        if (!service)
            return;
        const updates = service.options.map((option) => {
            const newPriceAdd = this.calculateRoundedPrice(service.basePrice, option.percentageMarkup);
            return this.prisma.serviceOption.update({
                where: { id: option.id },
                data: { priceAdd: newPriceAdd },
            });
        });
        await Promise.all(updates);
    }
    calculateRoundedPrice(base, markupPercent) {
        const rawMarkup = base * (markupPercent / 100);
        return Math.round(rawMarkup / 1000) * 1000;
    }
    async addMaterial(serviceId, materialData) {
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
    async removeMaterial(serviceId, materialId) {
        return this.prisma.serviceMaterial.deleteMany({
            where: { serviceId, materialId },
        });
    }
    async calculatePrice(params) {
        const { serviceId, selectedOptionIds, quantity, discount, coefficient } = params;
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            include: { options: true },
        });
        if (!service)
            throw new Error('Xizmat topilmadi');
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
};
exports.ServicesService = ServicesService;
exports.ServicesService = ServicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServicesService);
//# sourceMappingURL=services.service.js.map