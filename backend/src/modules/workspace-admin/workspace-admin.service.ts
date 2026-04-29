import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import * as bcrypt from 'bcrypt';

// =============================================
// WORKSPACE ADMIN SERVICE
// Workspace director/owner management.
// WorkspaceAdmin has full access and does NOT
// appear in employee assignee dropdowns.
// =============================================

@Injectable()
export class WorkspaceAdminService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.workspaceAdmin.findMany({
      select: {
        id: true,
        fullName: true,
        phone: true,
        login: true,
        telegramId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // passwordHash is intentionally excluded
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const admin = await this.prisma.workspaceAdmin.findUnique({
      where: { id },
      select: {
        id: true,
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

  async create(data: { fullName: string; phone?: string }) {
    // Auto-generate login: name initials + random numbers
    const nameParts = data.fullName.trim().split(/\s+/);
    const baseLogin = nameParts.map(p => p[0]?.toLowerCase() || '').join('') +
      nameParts[nameParts.length - 1]?.toLowerCase().slice(0, 5) +
      Math.floor(100 + Math.random() * 900).toString();

    // Auto-generate strong password
    const rawPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    // Check uniqueness (within tenant context from Prisma middleware)
    const existing = await this.prisma.workspaceAdmin.findFirst({
      where: { login: baseLogin },
    });

    const login = existing ? baseLogin + Math.floor(10 + Math.random() * 90) : baseLogin;
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new NotFoundException('Tenant context yo\'q');

    const admin = await this.prisma.workspaceAdmin.create({
      data: {
        tenantId,
        fullName: data.fullName,
        phone: data.phone,
        login,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        login: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Return plaintext password ONCE (never stored in plaintext)
    return { ...admin, generatedPassword: rawPassword };
  }

  async update(id: string, data: any) {
    const admin = await this.prisma.workspaceAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin topilmadi');

    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      updateData.passwordVersion = (admin.passwordVersion || 1) + 1;
    }

    if (data.login && data.login !== admin.login) {
      const conflict = await this.prisma.workspaceAdmin.findFirst({
        where: { login: data.login },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException('Bu login band');
      }
      updateData.login = data.login;
    }

    return this.prisma.workspaceAdmin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        phone: true,
        login: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const admin = await this.prisma.workspaceAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin topilmadi');
    return this.prisma.workspaceAdmin.delete({ where: { id } });
  }

  async resetPassword(id: string) {
    const admin = await this.prisma.workspaceAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin topilmadi');

    const rawPassword = this.generatePassword();
    await this.prisma.workspaceAdmin.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(rawPassword, 12),
        passwordVersion: (admin.passwordVersion || 1) + 1,
      },
    });

    return { newPassword: rawPassword };
  }

  private generatePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@#$!';
    const all = upper + lower + digits + special;

    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += special[Math.floor(Math.random() * special.length)];
    for (let i = 0; i < 6; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
