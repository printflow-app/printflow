import { PrismaService } from '../../prisma/prisma.service';
export declare class LeadsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        status: string;
        role: string;
        phone: string;
        firstName: string;
        lastName: string;
        companyName: string;
        telegramUser: string | null;
    }[]>;
    create(data: {
        firstName: string;
        lastName: string;
        companyName: string;
        role: string;
        phone: string;
        telegramUser?: string;
    }): import(".prisma/client").Prisma.Prisma__DemoRequestClient<{
        id: string;
        createdAt: Date;
        status: string;
        role: string;
        phone: string;
        firstName: string;
        lastName: string;
        companyName: string;
        telegramUser: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateStatus(id: string, status: string): import(".prisma/client").Prisma.Prisma__DemoRequestClient<{
        id: string;
        createdAt: Date;
        status: string;
        role: string;
        phone: string;
        firstName: string;
        lastName: string;
        companyName: string;
        telegramUser: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__DemoRequestClient<{
        id: string;
        createdAt: Date;
        status: string;
        role: string;
        phone: string;
        firstName: string;
        lastName: string;
        companyName: string;
        telegramUser: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
