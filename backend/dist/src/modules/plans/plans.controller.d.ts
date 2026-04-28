import { PlansService } from './plans.service';
export declare class PlansController {
    private plansService;
    constructor(plansService: PlansService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        displayName: string;
        price3m: number;
        price6m: number;
        price12m: number;
        maxEmployees: number;
        features: string;
        description: string | null;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    }[]>;
}
export declare class PlansAdminController {
    private plansService;
    constructor(plansService: PlansService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            tenants: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        displayName: string;
        price3m: number;
        price6m: number;
        price12m: number;
        maxEmployees: number;
        features: string;
        description: string | null;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    })[]>;
    findOne(id: string): import(".prisma/client").Prisma.Prisma__PlanClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        displayName: string;
        price3m: number;
        price6m: number;
        price12m: number;
        maxEmployees: number;
        features: string;
        description: string | null;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    }, null, import("@prisma/client/runtime/library").DefaultArgs>;
    create(data: any): import(".prisma/client").Prisma.Prisma__PlanClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        displayName: string;
        price3m: number;
        price6m: number;
        price12m: number;
        maxEmployees: number;
        features: string;
        description: string | null;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, data: any): import(".prisma/client").Prisma.Prisma__PlanClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        displayName: string;
        price3m: number;
        price6m: number;
        price12m: number;
        maxEmployees: number;
        features: string;
        description: string | null;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__PlanClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        displayName: string;
        price3m: number;
        price6m: number;
        price12m: number;
        maxEmployees: number;
        features: string;
        description: string | null;
        isPopular: boolean;
        isActive: boolean;
        sortOrder: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
