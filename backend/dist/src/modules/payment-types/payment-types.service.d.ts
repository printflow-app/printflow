import { PrismaService } from '../../prisma/prisma.service';
export declare class PaymentTypesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }[]>;
    create(data: {
        name: string;
    }): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }>;
    update(id: string, data: {
        name: string;
    }): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }>;
}
