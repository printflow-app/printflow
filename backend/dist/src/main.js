"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const cookieParser = require("cookie-parser");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
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
//# sourceMappingURL=main.js.map