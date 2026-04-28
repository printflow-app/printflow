import { BillingService } from './billing.service';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    submitPayment(body: any): Promise<{
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
    getStatus(): Promise<{
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
    getPaymentCards(): Promise<any>;
    updateSetting(key: string, body: {
        value: any;
    }): Promise<{
        id: string;
        value: string;
        key: string;
    }>;
    getSetting(key: string): Promise<{
        value: any;
    }>;
}
