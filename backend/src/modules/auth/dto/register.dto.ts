import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Slug rules: lowercase alphanumeric + dashes, must start/end alphanumeric, 3-32 chars.
// Mirrors what the existing Login form sends to /auth/login.
const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  tenantName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  @Matches(SLUG_REGEX, {
    message:
      'Slug faqat kichik harf, raqam va tire (-) belgilaridan iborat bo\'lishi kerak',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  workspaceSlug!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Login faqat harf, raqam, nuqta, tire va pastki chiziq qabul qiladi',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  login!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  // Telegram WebApp ichida register qilinganda — initData'dan keladigan
  // Telegram user id. Hisobni Telegram'ga bog'lash uchun (ixtiyoriy).
  @IsOptional()
  @IsString()
  @MaxLength(32)
  telegramId?: string;
}
