import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

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

  // API prefix for all routes
  app.setGlobalPrefix('api');

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

  // CORS — restricted to allowed origins only
  // CORS kelib chiqqan domenlarni qat'iy cheklash (origin: true emas!)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, bot)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: ${origin} ruxsat etilmagan`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Required for cookies
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 PrintFlow API ishga tushdi: ${await app.getUrl()}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();