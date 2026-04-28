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
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const bcrypt = require("bcrypt");
let EmployeesService = class EmployeesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.employee.findMany({
            include: { role: true },
        });
    }
    async findOne(id) {
        return this.prisma.employee.findUnique({
            where: { id },
            include: { role: true },
        });
    }
    async create(data) {
        if (!data.login) {
            let baseLogin = data.fullName.toLowerCase().replace(/\s+/g, '_');
            baseLogin += Math.floor(100 + Math.random() * 900).toString();
            data.login = baseLogin;
        }
        const rawPassword = data.password || Math.floor(100000 + Math.random() * 900000).toString();
        const passwordHash = await bcrypt.hash(rawPassword, 12);
        const { password, ...rest } = data;
        return this.prisma.employee.create({
            data: { ...rest, passwordHash },
        });
    }
    async update(id, data) {
        const employee = await this.prisma.employee.findUnique({ where: { id } });
        if (!employee)
            throw new Error('Xodim topilmadi');
        const isPasswordChange = data.password !== undefined;
        const isLoginChange = data.login !== undefined && data.login !== employee.login;
        if (isLoginChange) {
            const existing = await this.prisma.employee.findFirst({
                where: { login: data.login },
            });
            if (existing && existing.id !== id) {
                throw new Error('Bu login band, boshqasini tanlang');
            }
        }
        const updateData = { ...data };
        if (data.password) {
            updateData.passwordHash = await bcrypt.hash(data.password, 12);
            delete updateData.password;
        }
        if (isPasswordChange || isLoginChange) {
            updateData.passwordVersion = (employee.passwordVersion || 1) + 1;
        }
        return this.prisma.employee.update({
            where: { id },
            data: updateData,
        });
    }
    async remove(id) {
        return this.prisma.employee.delete({ where: { id } });
    }
    async findByLogin(login) {
        return this.prisma.employee.findFirst({
            where: { login },
            include: { role: true },
        });
    }
    async checkSession(employeeId, passwordVersion) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: employeeId },
        });
        if (!employee)
            return false;
        const dbVersion = employee.passwordVersion || 1;
        const tokenVersion = passwordVersion || 1;
        return dbVersion === tokenVersion;
    }
    async findByTelegramId(telegramId) {
        return this.prisma.employee.findFirst({
            where: { telegramId },
            include: { role: true },
        });
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map