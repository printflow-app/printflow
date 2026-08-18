import type { BadgeVariant } from '../components/ui/Badge';

// =============================================
// STATUS → RANG XARITASI (yagona manba)
//
// Qoida (DESIGN-SYSTEM.md §1): rang ma'no tashiydi, bezak emas.
// Bir xil semantik holat butun ilovada bir xil rangda ko'rinadi.
// Yangi status paydo bo'lsa — shu faylga qo'shiladi, sahifada
// ternary yozilmaydi.
// =============================================

/** To'lov holati (buyurtma, mijoz qarzi) */
export const paymentStatusVariant: Record<string, BadgeVariant> = {
  PAID: 'success',
  TOLANGAN: 'success',
  PARTIAL: 'warning',
  QISMAN: 'warning',
  UNPAID: 'danger',
  QARZ: 'danger',
};

/** Obuna / billing holati */
export const subscriptionStatusVariant: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  TRIAL: 'info',
  PENDING: 'warning',
  EXPIRED: 'danger',
  BLOCKED: 'danger',
};

/** Davomat holati */
export const attendanceStatusVariant: Record<string, BadgeVariant> = {
  KELDI: 'success',
  KECHIKDI: 'warning',
  KELMAGAN: 'danger',
  PENDING: 'neutral',
};

/** Umumiy faollik holati */
export const activeStatusVariant: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  DONE: 'success',
  CANCELLED: 'danger',
};

const ALL_MAPS = [
  paymentStatusVariant,
  subscriptionStatusVariant,
  attendanceStatusVariant,
  activeStatusVariant,
];

/**
 * Istalgan status satri uchun Badge varianti.
 * Topilmasa 'neutral' — noma'lum holat hech qachon qizil/yashil bo'lib
 * yolg'on ma'no bermaydi.
 */
export function statusVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'neutral';
  const key = status.toUpperCase();
  for (const map of ALL_MAPS) {
    if (key in map) return map[key];
  }
  return 'neutral';
}
