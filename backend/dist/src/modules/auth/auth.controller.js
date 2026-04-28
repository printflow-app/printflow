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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async login(body, res) {
        const { token, user } = await this.authService.login(body.workspaceSlug, body.login, body.password);
        res.cookie('pf_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
        return {
            user,
            workspaceSlug: body.workspaceSlug,
        };
    }
    logout(res) {
        res.clearCookie('pf_token', { path: '/' });
        res.clearCookie('pf_sa_token', { path: '/' });
        return { message: 'Tizimdan chiqdingiz' };
    }
    async superAdminLogin(body, res) {
        const { token } = await this.authService.superAdminLogin(body.login, body.password);
        res.cookie('pf_sa_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 4 * 60 * 60 * 1000,
            path: '/',
        });
        return { message: 'Super Admin tizimga kirdi', token };
    }
    async checkSession(req) {
        const payload = req.user;
        if (!payload)
            return { valid: false };
        const valid = await this.authService.checkSession(payload.tenantId, payload.sub, payload.passwordVersion);
        return { valid };
    }
    async me(req) {
        try {
            const token = req.cookies?.['pf_token'];
            if (!token)
                return null;
            const payload = this.authService['jwt'].verify(token, { secret: process.env.JWT_SECRET });
            const [tenant, employee] = await Promise.all([
                this.authService['prisma'].tenant.findUnique({
                    where: { id: payload.tenantId },
                    include: { plan: true }
                }),
                this.authService['prisma'].employee.findUnique({
                    where: { id: payload.sub },
                    include: { role: true }
                })
            ]);
            if (!tenant || !employee)
                return null;
            let tenantFeatures = {};
            if (tenant?.plan?.features) {
                try {
                    tenantFeatures = typeof tenant.plan.features === 'string'
                        ? JSON.parse(tenant.plan.features)
                        : tenant.plan.features;
                }
                catch { }
            }
            return {
                id: employee.id,
                fullName: employee.fullName,
                login: employee.login,
                phone: employee.phone,
                tenantId: tenant.id,
                tenantName: tenant.name,
                workspaceSlug: tenant.slug,
                role: employee.role,
                permissions: employee.role,
                isFirstLogin: employee.isFirstLogin,
                passwordVersion: employee.passwordVersion,
                tenantFeatures
            };
        }
        catch (e) {
            console.error('Me endpoint error:', e);
            return null;
        }
    }
    async onboarding(req, body) {
        const payload = req.user;
        if (!payload)
            throw new common_1.UnauthorizedException();
        return this.authService.completeOnboarding(payload.tenantId, payload.sub, body);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('super-admin/login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "superAdminLogin", null);
__decorate([
    (0, common_1.Post)('check-session'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "checkSession", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('onboarding'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "onboarding", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map