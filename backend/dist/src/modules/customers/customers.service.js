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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let CustomersService = class CustomersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.customer.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                transactions: {
                    include: { paymentType: true },
                    orderBy: { date: 'desc' },
                },
                tasks: true,
            },
        });
    }
    async findOne(id) {
        return this.prisma.customer.findUnique({
            where: { id },
            include: { tasks: true, transactions: true },
        });
    }
    async create(data) {
        return this.prisma.customer.create({ data });
    }
    async update(id, data) {
        return this.prisma.customer.update({ where: { id }, data });
    }
    async remove(id) {
        return this.prisma.customer.delete({ where: { id } });
    }
    async findByName(name) {
        return this.prisma.customer.findFirst({ where: { name } });
    }
    async getCustomerTasks(id) {
        if (!id)
            return [];
        const tasks = await this.prisma.task.findMany({
            where: { customerId: id },
            select: { title: true },
            distinct: ['title'],
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return tasks.map(t => t.title);
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map