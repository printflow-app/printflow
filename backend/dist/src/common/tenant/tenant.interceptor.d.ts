import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { Reflector } from '@nestjs/core';
export declare class TenantInterceptor implements NestInterceptor {
    private prisma;
    private reflector;
    constructor(prisma: PrismaService, reflector: Reflector);
    intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>>;
}
