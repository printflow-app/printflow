import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

// =============================================
// PRINTFLOW BACKEND BOOTSTRAP
// Security hardening applied:
// - httpOnly cookie auth (no localStorage exposure)
// - Global validation pipe (class-validator DTOs)
// - CORS restricted to known origins
// - Rate limiting via ThrottlerModule
// =============================================

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust the first proxy in front of the app (Railway / Vercel edge).
  // Without this, Express's req.ip returns the proxy address instead of the
  // real client IP — which breaks office Wi-Fi attendance gating.
  const httpAdapter = app.getHttpAdapter().getInstance();
  if (typeof httpAdapter.set === 'function') httpAdapter.set('trust proxy', true);

  // API prefix for all routes
  app.setGlobalPrefix('api');

  // Body limit oshirildi — task biriktirmalari (CDR/TIF) base64 sifatida saqlanadi,
  // base64 esa fayl hajmidan ~1.33x katta. 50MB limit ~37MB xom faylgacha imkon beradi.
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Enable cookie parsing (for httpOnly JWT cookies)
  app.use(cookieParser());

  // Global validation pipe — rejects requests with invalid data shapes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true,          // Auto-transform payload types
    }),
  );

  // Ishlab chiqishda Vite portlari o'zgarib turadi: 5173 band bo'lsa o'zi
  // 5174, 5175... ga o'tadi. Ilgari ro'yxatda faqat 3000 va 5173 bor edi,
  // shuning uchun boshqa portga tushgan ilova CORS'da to'xtab qolardi va
  // brauzer buni "login yoki parol xato" ko'rinishida ko'rsatardi.
  // Shu sababli dev'da HAR QANDAY localhost porti ochiq; productionda esa
  // avvalgidek qat'iy ro'yxat ishlaydi.
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: [
      ...(isDev ? [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] : []),
      'http://localhost:3000',
      'http://localhost:5173',
      /^https:\/\/printflow.*\.vercel\.app$/
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-tenant-id', 'x-super-admin-key'],
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');
  
  const url = await app.getUrl();
  console.log(`\n=============================================`);
  console.log(`🚀 PrintFlow API Muvaffaqiyatli Ishga Tushdi!`);
  console.log(`📡 Port: ${port} (Binding: 0.0.0.0)`);
  console.log(`🔗 URL: ${url}`);
  console.log(`📋 Node Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏠 Database: ${process.env.DATABASE_URL ? 'ULANGAN (HIDDEN)' : 'DATABASE_URL TOPILMADI!'}`);
  console.log(`=============================================\n`);
}

bootstrap();
// Restart