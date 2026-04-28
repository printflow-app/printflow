import { PrismaService } from '../../prisma/prisma.service';
export declare class CustomersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        tasks: {
            id: string;
            tenantId: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            serviceOptions: string;
            paymentTypeId: string | null;
            customerId: string | null;
            customerName: string | null;
            orderName: string | null;
            customerPhone: string | null;
            serviceId: string | null;
            quantity: number;
            coefficient: number;
            totalAmount: number;
            depositAmount: number;
            remainingAmount: number;
            columnId: string;
            assignees: string;
            attachments: string;
            materialOverrides: string;
            deadlineAt: Date | null;
        }[];
        transactions: ({
            paymentType: {
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
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        phone: string | null;
        totalDebt: number;
        totalPaid: number;
    })[]>;
    findOne(id: string): Promise<{
        tasks: {
            id: string;
            tenantId: string;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            serviceOptions: string;
            paymentTypeId: string | null;
            customerId: string | null;
            customerName: string | null;
            orderName: string | null;
            customerPhone: string | null;
            serviceId: string | null;
            quantity: number;
            coefficient: number;
            totalAmount: number;
            depositAmount: number;
            remainingAmount: number;
            columnId: string;
            assignees: string;
            attachments: string;
            materialOverrides: string;
            deadlineAt: Date | null;
        }[];
        transactions: {
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
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        phone: string | null;
        totalDebt: number;
        totalPaid: number;
    }>;
    create(data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        phone: string | null;
        totalDebt: number;
        totalPaid: number;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        phone: string | null;
        totalDebt: number;
        totalPaid: number;
    }>;
    remove(id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        phone: string | null;
        totalDebt: number;
        totalPaid: number;
    }>;
    findByName(name: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        phone: string | null;
        totalDebt: number;
        totalPaid: number;
    }>;
    getCustomerTasks(id: string): Promise<string[]>;
}
