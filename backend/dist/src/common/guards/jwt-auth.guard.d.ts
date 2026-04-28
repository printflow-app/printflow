import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
export declare class JwtAuthGuard implements CanActivate {
    private jwt;
    private reflector;
    constructor(jwt: JwtService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractToken;
}
