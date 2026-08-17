import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// =============================================
// PRISMA XATOLARINI TUSHUNARLI JAVOBGA AYLANTIRISH
//
// Muammo: Prisma xatosi NestJS uchun oddiy `Error` — u ushlanmasa 500
// "Internal server error" bo'lib chiqadi. Foydalanuvchi ham, biz ham
// sababni ko'rmaymiz. Aynan shu sababdan "buyurtma yaratilmayapti"
// degan shikoyat kelganda, ekranda hech qanday foydali ma'lumot
// bo'lmagan va sababni faqat Railway logidan qidirishga to'g'ri kelgan.
//
// Endi har bir tanish Prisma kodi o'z HTTP statusi va o'zbekcha izohi
// bilan qaytadi. Xato baribir logga to'liq yoziladi — diagnostika
// yo'qolmaydi, faqat foydalanuvchi ko'radigan qismi tushunarli bo'ladi.
// =============================================

/** FK nomidan qaysi maydon ekanini ajratamiz: `Task_paymentTypeId_fkey (index)` → `paymentTypeId`. */
function fkMaydon(meta: any): string | null {
  const xom = String(meta?.field_name ?? meta?.target ?? '');
  const m = /_([A-Za-z0-9]+)_fkey/.exec(xom);
  return m ? m[1] : null;
}

/** Maydon nomi → foydalanuvchi tilidagi nom. */
const MAYDON_NOMI: Record<string, string> = {
  paymentTypeId: "to'lov turi",
  columnId: 'bosqich (kanban ustuni)',
  serviceId: 'xizmat',
  customerId: 'mijoz',
  customerContactId: 'vakil',
  departmentId: "bo'lim",
  branchId: 'filial',
  executorBranchId: 'bajaruvchi filial',
  vendorId: 'hamkor',
  employeeId: 'xodim',
  assigneeId: "mas'ul",
  roleId: 'rol',
  cashBoxId: 'kassa',
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(xato: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<any>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Amalni bajarib bo\'lmadi';
    let code = xato.code;

    switch (xato.code) {
      // Bog'liq yozuv topilmadi — deyarli har doim bo'sh/eskirgan ID yuborilgan.
      case 'P2003': {
        const maydon = fkMaydon(xato.meta);
        const nom = (maydon && MAYDON_NOMI[maydon]) || 'tanlangan qiymat';
        status = HttpStatus.BAD_REQUEST;
        message = `Saqlab bo'lmadi: ${nom} tanlanmagan yoki mavjud emas. Uni tekshirib, qaytadan urinib ko'ring.`;
        break;
      }

      // Takrorlanuvchi qiymat.
      case 'P2002': {
        const maydonlar = Array.isArray(xato.meta?.target)
          ? (xato.meta.target as string[]).join(', ')
          : String(xato.meta?.target ?? '');
        status = HttpStatus.CONFLICT;
        message = maydonlar
          ? `Bunday yozuv allaqachon mavjud (${maydonlar}).`
          : 'Bunday yozuv allaqachon mavjud.';
        break;
      }

      // O'zgartirmoqchi bo'lgan yozuv yo'q.
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Yozuv topilmadi — u o\'chirilgan bo\'lishi mumkin.';
        break;

      // Baza sxemasi koddan orqada qolgan (migratsiya qo'llanmagan).
      // Bu foydalanuvchi xatosi emas — 500 bo'lib qoladi, lekin sabab aytiladi.
      case 'P2022':
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message =
          'Baza sxemasi eskirgan (migratsiya qo\'llanmagan). Iltimos, administratorga xabar bering.';
        break;

      // Ulanish muammolari.
      case 'P1001':
      case 'P1017':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Baza bilan aloqa uzildi. Bir necha soniyadan keyin qayta urinib ko\'ring.';
        break;

      default:
        code = xato.code;
    }

    // To'liq xato HAR DOIM logga — diagnostika imkoniyati yo'qolmasin.
    this.logger.error(
      `${req?.method} ${req?.url} → ${code}: ${String(xato.message).split('\n').filter(Boolean).pop()}`,
    );

    res.status(status).json({
      statusCode: status,
      message,
      error: code,
      path: req?.url,
    });
  }
}
