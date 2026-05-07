import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany();
  }

  async findOne(id: string) {
    return this.prisma.role.findUnique({ where: { id } });
  }

  // Frontend role obyektini Prisma qabul qilmaydigan maydonlardan tozalaydi:
  // - tenantId: relation scalar — Prisma update'da ruxsat etilmaydi
  // - id, tenant, employees: relation/PK maydonlari
  // - createdAt, updatedAt: avtomatik boshqariladi
  private sanitizeRoleData(data: any) {
    const {
      id: _id,
      tenantId: _t,
      tenant: _rel,
      employees: _emp,
      createdAt: _c,
      updatedAt: _u,
      ...safe
    } = data || {};
    return safe;
  }

  async create(data: any) {
    return this.prisma.role.create({ data: this.sanitizeRoleData(data) });
  }

  async update(id: string, data: any) {
    return this.prisma.role.update({
      where: { id },
      data: this.sanitizeRoleData(data),
    });
  }

  async remove(id: string) {
    return this.prisma.role.delete({ where: { id } });
  }
}
