"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const public_decorator_1 = require("../decorators/public.decorator");
let JwtAuthGuard = class JwtAuthGuard {
    constructor(jwt, reflector) {
        this.jwt = jwt;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const req = context.switchToHttp().getRequest();
        const token = this.extractToken(req);
        if (!token) {
            throw new common_1.UnauthorizedException('Autentifikatsiya talab etiladi');
        }
        try {
            const payload = this.jwt.verify(token, {
                secret: process.env.JWT_SECRET,
            });
            req['user'] = payload;
            req._tenantPayload = {
                tenantId: payload.tenantId,
                userId: payload.sub,
                userRole: payload.role,
            };
            return true;
        }
        catch {
            throw new common_1.UnauthorizedException('Token yaroqsiz yoki muddati o\'tgan');
        }
    }
    extractToken(req) {
        const cookieToken = req.cookies?.['pf_token'];
        if (cookieToken)
            return cookieToken;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.slice(7);
        }
        return null;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        core_1.Reflector])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map