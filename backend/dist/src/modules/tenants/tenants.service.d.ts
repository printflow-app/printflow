import { PrismaService } from '../../prisma/prisma.service';
export declare class TenantsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            tasks: number;
            employees: number;
            customers: number;
        };
        plan: {
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    })[]>;
    findOne(id: string): Promise<{
        totalPaid: number;
        _count: {
            tasks: number;
            employees: number;
            customers: number;
            transactions: number;
        };
        plan: {
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
        };
        payments: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            planName: string;
            duration: number;
            amount: number;
            sender: string;
            receiptUrl: string | null;
            notes: string | null;
            approvedBy: string | null;
            approvedAt: Date | null;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    }>;
    createWithAdmin(data: {
        name: string;
        slug: string;
        planId?: string;
        trialDays?: number;
        adminEmail: string;
        adminPassword: string;
        adminName?: string;
        adminPhone?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    }>;
    createFromLead(data: {
        leadId: string;
        slug: string;
        planId?: string;
    }): Promise<{
        tenant: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            slug: string;
            status: import(".prisma/client").$Enums.TenantStatus;
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
            planId: string | null;
        };
        credentials: {
            slug: string;
            login: string;
            password: string;
        };
        lead: {
            id: string;
            createdAt: Date;
            status: string;
            role: string;
            phone: string;
            firstName: string;
            lastName: string;
            companyName: string;
            telegramUser: string | null;
        };
    }>;
    update(id: string, data: {
        name?: string;
        planId?: string;
        isActive?: boolean;
        status?: string;
    }): import(".prisma/client").Prisma.Prisma__TenantClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__TenantClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    getStats(): Promise<{
        totalTenants: number;
        activeTenants: number;
        inactiveTenants: number;
        trialsExpiringSoon: number;
        totalEmployees: number;
        totalTasks: number;
        totalRevenue: number;
        approvedPaymentsCount: number;
        pendingPayments: number;
        totalLeads: number;
        statusDistribution: {
            name: string;
            value: number;
            color: string;
        }[];
        revenueChart: {
            month: string;
            amount: number;
        }[];
        leadsChart: {
            month: string;
            count: number;
        }[];
        tenantGrowthChart: {
            month: string;
            count: number;
        }[];
    }>;
    getPendingPayments(): import(".prisma/client").Prisma.PrismaPromise<({
        tenant: {
            plan: {
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
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            slug: string;
            status: import(".prisma/client").$Enums.TenantStatus;
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
            planId: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        planName: string;
        duration: number;
        amount: number;
        sender: string;
        receiptUrl: string | null;
        notes: string | null;
        approvedBy: string | null;
        approvedAt: Date | null;
    })[]>;
    getAllPayments(): import(".prisma/client").Prisma.PrismaPromise<({
        tenant: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            isActive: boolean;
            slug: string;
            status: import(".prisma/client").$Enums.TenantStatus;
            trialEndsAt: Date | null;
            subscriptionEndsAt: Date | null;
            planId: string | null;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        planName: string;
        duration: number;
        amount: number;
        sender: string;
        receiptUrl: string | null;
        notes: string | null;
        approvedBy: string | null;
        approvedAt: Date | null;
    })[]>;
    approvePayment(paymentId: string, superAdminId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    }>;
    rejectPayment(paymentId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        slug: string;
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date | null;
        subscriptionEndsAt: Date | null;
        planId: string | null;
    }>;
}
