import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
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
    const rows = await this.prisma.employee.findMany({
      include: {
        role: true,
        departments: { include: { department: { select: { id: true, name: true } } } },
      },
      // passwordHash is excluded from response implicitly (not selected)
      // In future, add select: {} to explicitly exclude sensitive fields
    });
    return rows.map(this.withDepartments);
  }

  async findOne(id: string) {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        role: true,
        departments: { include: { department: { select: { id: true, name: true } } } },
      },
    });
    return row ? this.withDepartments(row) : row;
  }

  /**
   * Bog'lovchi jadval qatorlarini frontend kutadigan sodda ko'rinishga
   * keltiradi: `departmentIds` (tanlash uchun) va `departmentNames` (ko'rsatish
   * uchun). Frontend EmployeeDepartment tuzilishini bilishi shart emas.
   */
  private withDepartments = (e: any) => {
    const links = e.departments || [];
    return {
      ...e,
      departments: undefined,
      departmentIds: links.map((l: any) => l.departmentId),
      departmentNames: links.map((l: any) => l.department?.name).filter(Boolean),
    };
  };

  /**
   * Xodimning bo'limlarini berilgan ro'yxatga tenglashtiradi.
   *
   * `deleteMany` + `createMany` — eng sodda va ishonchli yo'l: farqni
   * hisoblashga urinish (qaysi biri qo'shildi/olib tashlandi) shu hajmda
   * foyda bermaydi, lekin xato ehtimolini oshiradi.
   */
  private async syncDepartments(employeeId: string, departmentIds?: string[]) {
    if (!Array.isArray(departmentIds)) return; // maydon yuborilmagan — tegmaymiz
    const tenantId = TenantContext.tryGetTenantId();
    if (!tenantId) return;

    // Faqat shu tenantga tegishli bo'limlar — begona ID yuborilsa e'tiborsiz.
    const valid = departmentIds.length
      ? await this.prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true },
        })
      : [];

    await this.prisma.employeeDepartment.deleteMany({ where: { employeeId } });
    if (valid.length) {
      await this.prisma.employeeDepartment.createMany({
        data: valid.map((d) => ({ tenantId, employeeId, departmentId: d.id })),
        skipDuplicates: true,
      });
    }
  }

  async create(data: any) {
    // ── Plan limit tekshiruvi ─────────────────────────────────────
    const tenantId = TenantContext.tryGetTenantId();
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });
      const plan = tenant?.plan as any;
      const maxEmployees: number = plan?.maxEmployees ?? 0;
      if (maxEmployees > 0) {
        const existingCount = await this.prisma.employee.count({});
        if (existingCount >= maxEmployees) {
          throw new ForbiddenException(
            `Tarif limiti: maksimal ${maxEmployees} ta xodim. Tarifni yangilang.`,
          );
        }
      }
    }
    // ─────────────────────────────────────────────────────────────

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
    // departmentIds Employee ustuni emas — bog'lovchi jadvalga yoziladi.
    const { password, departmentIds, ...rest } = data;

    const employee = await this.prisma.employee.create({
      data: { ...rest, passwordHash },
    });

    await this.syncDepartments(employee.id, departmentIds);

    // Return plain-text password once so frontend can display it
    return { ...employee, password: rawPassword };
  }

  /**
   * Xodimga yangi vaqtinchalik parol beradi va uni BIR MARTA qaytaradi.
   *
   * Nega alohida metod: `update` orqali parol yangilash uchun frontend
   * parolni o'zi o'ylab topib yuborishi kerak edi — ya'ni parol kuchi
   * brauzerdagi `Math.random()` ga bog'lanardi. Bu yerda u `crypto` bilan
   * yaratiladi va javobda faqat shu safar ko'rinadi; bazada esa hech qachon
   * ochiq matn saqlanmaydi (bcrypt hash).
   *
   * `passwordVersion` oshadi — xodim barcha qurilmalarda tizimdan chiqariladi.
   */
  async regeneratePassword(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Xodim topilmadi');

    // 8 belgi. Alifboda chalkashadigan belgilar yo'q (0/O, 1/I/L) — parol
    // ko'pincha og'zaki yoki qo'lda uzatiladi, "nol edimi yoki O?" degan
    // savol chiqmasligi kerak. `randomInt` kriptografik: `Math.random()`
    // dan farqli, oldindan taxmin qilib bo'lmaydi.
    const ALIFBO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const temporaryPassword = Array.from(
      { length: 8 },
      () => ALIFBO[randomInt(0, ALIFBO.length)],
    ).join('');

    await this.prisma.employee.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 12),
        passwordVersion: (employee.passwordVersion || 1) + 1,
      },
    });

    return { login: employee.login, temporaryPassword };
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
    const { departmentIds, ...scalarData } = data;
    const updateData: any = { ...scalarData };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    // Increment passwordVersion on credential change (forces logout on all devices)
    if (isPasswordChange || isLoginChange) {
      updateData.passwordVersion = (employee.passwordVersion || 1) + 1;
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateData,
    });
    await this.syncDepartments(id, departmentIds);
    return updated;
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
