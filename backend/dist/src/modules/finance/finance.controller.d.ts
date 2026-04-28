import { FinanceService } from './finance.service';
export declare class FinanceController {
    private readonly financeService;
    constructor(financeService: FinanceService);
    getDashboard(start?: string, end?: string): Promise<{
        totalKirim: number;
        totalChiqim: number;
        balance: number;
    }>;
    findAll(start?: string, end?: string): Promise<({
        paymentType: {
            id: string;
            tenantId: string;
            name: string;
        };
        customer: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            phone: string | null;
            totalDebt: number;
            totalPaid: number;
        };
        expenseType: {
            id: string;
            tenantId: string;
            name: string;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        amount: number;
        date: Date;
        type: string;
        paymentTypeId: string | null;
        customerId: string | null;
        customerName: string | null;
        serviceType: string | null;
        taskId: string | null;
        expenseReason: string | null;
        expenseTypeId: string | null;
        employeeId: string | null;
    })[]>;
    create(body: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        amount: number;
        date: Date;
        type: string;
        paymentTypeId: string | null;
        customerId: string | null;
        customerName: string | null;
        serviceType: string | null;
        taskId: string | null;
        expenseReason: string | null;
        expenseTypeId: string | null;
        employeeId: string | null;
    }>;
    getDinamika(start?: string, end?: string): Promise<any[]>;
    getStatsByPaymentType(start?: string, end?: string): Promise<{
        kirim: {
            name: string;
            value: number;
        }[];
        chiqim: {
            name: string;
            value: number;
        }[];
    }>;
}
