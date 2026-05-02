import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// =============================================
// EMPLOYEES SERVICE
// passwordHash field ishlatiladi (password emas).
// Parol o'zgarganda bcrypt hash saqlanadi.
// =============================================

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.employee.findMany({
      include: { role: true },
      // passwordHash is excluded from response implicitly (not selected)
      // In future, add select: {} to explicitly exclude sensitive fields
    });
  }

  async findOne(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  async create(data: any) {
    // Auto-generate login if not provided
    if (!data.login) {
      let baseLogin = data.fullName.toLowerCase().replace(/\s+/g, '_');
      baseLogin += Math.floor(100 + Math.random() * 900).toString();
      data.login = baseLogin;
    }

    // Hash password before storing
    const rawPassword = data.password || Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    // Remove plaintext password from data, use hash
    const { password, ...rest } = data;

    const employee = await this.prisma.employee.create({
      data: { ...rest, passwordHash },
    });

    // Return plain-text password once so frontend can display it
    return { ...employee, password: rawPassword };
  }

  async update(id: string, data: any) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new Error('Xodim topilmadi');

    // Detect credential changes for forced logout
    const isPasswordChange = data.password !== undefined;
    const isLoginChange = data.login !== undefined && data.login !== employee.login;

    // Check login uniqueness within tenant (compound unique enforced by schema)
    if (isLoginChange) {
      const existing = await this.prisma.employee.findFirst({
        where: { login: data.login },
      });
      if (existing && existing.id !== id) {
        throw new Error('Bu login band, boshqasini tanlang');
      }
    }

    // Hash new password if provided
    const updateData: any = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    // Increment passwordVersion on credential change (forces logout on all devices)
    if (isPasswordChange || isLoginChange) {
      updateData.passwordVersion = (employee.passwordVersion || 1) + 1;
    }

    return this.prisma.employee.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.employee.delete({ where: { id } });
  }

  async findByLogin(login: string) {
    return this.prisma.employee.findFirst({
      where: { login },
      include: { role: true },
    });
  }

  async checkSession(employeeId: string, passwordVersion: number): Promise<boolean> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId },
    });
    if (!employee) return false;
    const dbVersion = employee.passwordVersion || 1;
    const tokenVersion = passwordVersion || 1;
    return dbVersion === tokenVersion;
  }

  async findByTelegramId(telegramId: string) {
    return this.prisma.employee.findFirst({
      where: { telegramId },
      include: { role: true },
    });
  }
}
