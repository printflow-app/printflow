import { LeadsService } from './leads.service';
import { CreateLeadDto } from './create-lead.dto';
export declare class LeadsController {
    private leadsService;
    constructor(leadsService: LeadsService);
    create(body: CreateLeadDto): import(".prisma/client").Prisma.Prisma__DemoRequestClient<{
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
    updateStatus(id: string, body: {
        status: string;
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
