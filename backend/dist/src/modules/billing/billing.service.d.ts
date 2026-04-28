import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
export declare class BillingService {
    private prisma;
    private telegramService;
    constructor(prisma: PrismaService, telegramService: TelegramService);
    submitPayment(data: {
        planName: string;
        duration: number;
        amount: number;
        sender: string;
        receiptUrl?: string;
        notes?: string;
    }): Promise<{
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
    }>;
    getMyPayments(): Promise<{
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
    }[]>;
    getTenantBillingStatus(): Promise<{
        id: string;
        name: string;
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
        status: import(".prisma/client").$Enums.TenantStatus;
        trialEndsAt: Date;
        subscriptionEndsAt: Date;
        planId: string;
    }>;
    getSetting(key: string): Promise<any>;
    updateSetting(key: string, value: any): Promise<{
        id: string;
        value: string;
        key: string;
    }>;
}
