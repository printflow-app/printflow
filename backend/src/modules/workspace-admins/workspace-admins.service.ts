import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// =============================================
// WORKSPACE ADMINS SERVICE
// Tenant-level directors/owners with full access
// Never appears in task assignee lists
// Login/Password auto-generated on creation
// =============================================

@Injectable()
export class WorkspaceAdminsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.workspaceAdmin.findMany({
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        phone: true,
        login: true,
        telegramId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // passwordHash is intentionally excluded
      },
    });
  }

  async findOne(id: string) {
    const admin = await this.prisma.workspaceAdmin.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        phone: true,
        login: true,
        telegramId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!admin) throw new NotFoundException('Admin topilmadi');
    return admin;
  }

  async create(data: { fullName: string; phone?: string; tenantId?: string }) {
    // Auto-generate login from fullName
    const baseName = data.fullName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    const suffix = Math.floor(100 + Math.random() * 900).toString();
    const login = `${baseName}${suffix}`;

    // Auto-generate a secure random password (6 digits for simplicity)
    const rawPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    const { tenantId, ...rest } = data;

    const admin = await this.prisma.workspaceAdmin.create({
      data: {
        ...rest,
        login,
        passwordHash,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    // Return raw password ONCE — store it nowhere!
    return {
      ...admin,
      generatedLogin: login,
      generatedPassword: rawPassword,
      passwordHash: undefined,
    };
  }

  async update(id: string, data: { fullName?: string; phone?: string; isActive?: boolean; password?: string }) {
    const admin = await this.prisma.workspaceAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin topilmadi');

    const updateData: any = { ...data };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    return this.prisma.workspaceAdmin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        tenantId: true,
        fullName: true,
        phone: true,
        login: true,
        telegramId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async regeneratePassword(id: string) {
    const admin = await this.prisma.workspaceAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin topilmadi');

    const rawPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    await this.prisma.workspaceAdmin.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Parol yangilandi', generatedPassword: rawPassword };
  }

  async remove(id: string) {
    const admin = await this.prisma.workspaceAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin topilmadi');
    await this.prisma.workspaceAdmin.delete({ where: { id } });
    return { message: 'Admin o\'chirildi' };
  }
}
