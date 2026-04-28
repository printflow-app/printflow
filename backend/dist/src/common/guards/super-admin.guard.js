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
exports.SuperAdminGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
let SuperAdminGuard = class SuperAdminGuard {
    constructor(jwt) {
        this.jwt = jwt;
    }
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const token = req.cookies?.['pf_sa_token'] || req.headers['x-super-admin-key'];
        if (!token)
            throw new common_1.ForbiddenException('Super Admin access only');
        try {
            const payload = this.jwt.verify(token, {
                secret: process.env.SUPER_ADMIN_SECRET,
            });
            if (payload.isSuperAdmin !== true) {
                throw new common_1.ForbiddenException('Super Admin access only');
            }
            req.superAdmin = payload;
            return true;
        }
        catch {
            throw new common_1.ForbiddenException('Super Admin access only');
        }
    }
};
exports.SuperAdminGuard = SuperAdminGuard;
exports.SuperAdminGuard = SuperAdminGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], SuperAdminGuard);
//# sourceMappingURL=super-admin.guard.js.map