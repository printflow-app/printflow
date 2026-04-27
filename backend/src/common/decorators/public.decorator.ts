import { SetMetadata } from '@nestjs/common';

// =============================================
// PUBLIC DECORATOR
// Auth guard'ni o'tkazib yuborish uchun ishlatiladi:
// - /api/auth/login
// - /api/attendance/scan/:token
// =============================================

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
