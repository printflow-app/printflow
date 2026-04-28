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
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let InventoryService = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllMaterials() {
        return this.prisma.material.findMany({
            include: {
                movements: { orderBy: { createdAt: 'desc' }, take: 5 },
                bom: { include: { service: true } },
            },
            orderBy: { name: 'asc' },
        });
    }
    async findOneMaterial(id) {
        return this.prisma.material.findUnique({
            where: { id },
            include: {
                movements: { orderBy: { createdAt: 'desc' } },
                bom: { include: { service: true } },
            },
        });
    }
    async createMaterial(data) {
        return this.prisma.material.create({ data });
    }
    async updateMaterial(id, data) {
        return this.prisma.material.update({ where: { id }, data });
    }
    async removeMaterial(id) {
        return this.prisma.material.delete({ where: { id } });
    }
    async stockIn(materialId, quantity, note, taskId) {
        const [material] = await this.prisma.$transaction([
            this.prisma.material.update({
                where: { id: materialId },
                data: { currentStock: { increment: quantity } },
            }),
            this.prisma.stockMovement.create({
                data: { materialId, type: 'kirim', quantity, note, taskId },
            }),
        ]);
        return material;
    }
    async stockOut(materialId, quantity, note, taskId) {
        const [material] = await this.prisma.$transaction([
            this.prisma.material.update({
                where: { id: materialId },
                data: { currentStock: { decrement: quantity } },
            }),
            this.prisma.stockMovement.create({
                data: { materialId, type: 'chiqim', quantity, note, taskId },
            }),
        ]);
        return material;
    }
    async writeOff(materialId, quantity, note, taskId) {
        const [material] = await this.prisma.$transaction([
            this.prisma.material.update({
                where: { id: materialId },
                data: { currentStock: { decrement: quantity } },
            }),
            this.prisma.stockMovement.create({
                data: { materialId, type: 'brak', quantity, note, taskId },
            }),
        ]);
        return material;
    }
    async getMovements(materialId) {
        return this.prisma.stockMovement.findMany({
            where: materialId ? { materialId } : undefined,
            include: { material: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async deductByTask(taskId, serviceId, quantity, wasteQty = 0) {
        const bom = await this.prisma.serviceMaterial.findMany({
            where: { serviceId },
            include: { material: true },
        });
        const results = [];
        for (const item of bom) {
            const totalDeduct = (quantity + wasteQty) * item.normPerUnit;
            const result = await this.stockOut(item.materialId, totalDeduct, `Buyurtma #${taskId} sarfi`, taskId);
            results.push(result);
        }
        return results;
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map