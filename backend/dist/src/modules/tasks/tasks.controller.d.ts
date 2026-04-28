import { TasksService } from './tasks.service';
export declare class TasksController {
    private tasksService;
    constructor(tasksService: TasksService);
    getColumns(): Promise<({
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
    } & {
        id: string;
        tenantId: string;
        title: string;
        orderIdx: number;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    createColumn(body: {
        title: string;
        orderIdx: number;
    }): Promise<{
        id: string;
        tenantId: string;
        title: string;
        orderIdx: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateColumn(id: string, body: {
        title: string;
    }): Promise<{
        id: string;
        tenantId: string;
        title: string;
        orderIdx: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    removeColumn(id: string): Promise<{
        id: string;
        tenantId: string;
        title: string;
        orderIdx: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): Promise<({
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
        column: {
            id: string;
            tenantId: string;
            title: string;
            orderIdx: number;
            createdAt: Date;
            updatedAt: Date;
        };
        histories: ({
            employee: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                login: string;
                passwordHash: string;
                fullName: string;
                phone: string | null;
                telegramId: string | null;
                deviceId: string | null;
                passwordVersion: number;
                isFirstLogin: boolean;
                roleId: string;
                baseSalary: number;
                givenAmount: number;
                workDebt: number;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            taskId: string;
            employeeId: string | null;
            action: string;
            details: string | null;
            note: string | null;
        })[];
    } & {
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
    })[]>;
    findOne(id: string): Promise<{
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
        column: {
            id: string;
            tenantId: string;
            title: string;
            orderIdx: number;
            createdAt: Date;
            updatedAt: Date;
        };
        histories: ({
            employee: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                login: string;
                passwordHash: string;
                fullName: string;
                phone: string | null;
                telegramId: string | null;
                deviceId: string | null;
                passwordVersion: number;
                isFirstLogin: boolean;
                roleId: string;
                baseSalary: number;
                givenAmount: number;
                workDebt: number;
            };
        } & {
            id: string;
            tenantId: string;
            createdAt: Date;
            taskId: string;
            employeeId: string | null;
            action: string;
            details: string | null;
            note: string | null;
        })[];
    } & {
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
    }>;
    create(data: any, employeeId: string): Promise<{
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
    }>;
    createBulk(data: any, employeeId: string): Promise<any[]>;
    update(id: string, data: any, employeeId: string): Promise<{
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
    }>;
    remove(id: string): Promise<{
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
    }>;
    logView(id: string, body: {
        employeeId: string;
    }): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        taskId: string;
        employeeId: string | null;
        action: string;
        details: string | null;
        note: string | null;
    }>;
}
