import { PrismaService } from '../../prisma/prisma.service';
export declare class SettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        id: string;
        tenantId: string;
        value: string;
        key: string;
    }>;
    getAll(): Promise<Record<string, any>>;
}
