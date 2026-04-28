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

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://printflow-admin.vercel.app',
        'https://printflow-v1.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
      ];
      
      // Allow if no origin (like mobile apps or curl) or if in allowed list
      if (!origin || allowedOrigins.some(ao => origin.startsWith(ao))) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Origin blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  
  const url = await app.getUrl();
  console.log(`\n=============================================`);
  console.log(`🚀 PrintFlow API Muvaffaqiyatli Ishga Tushdi!`);
  console.log(`📡 Port: ${port}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`📋 Node Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏠 Database: ${process.env.DATABASE_URL ? 'ULANGAN (HIDDEN)' : 'DATABASE_URL TOPILMADI!'}`);
  console.log(`=============================================\n`);
}

bootstrap();