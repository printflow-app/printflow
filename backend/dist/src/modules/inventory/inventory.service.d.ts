import { PrismaService } from '../../prisma/prisma.service';
export declare class InventoryService {
    private prisma;
    constructor(prisma: PrismaService);
    findAllMaterials(): Promise<({
        movements: {
            id: string;
            tenantId: string;
            createdAt: Date;
            type: string;
            taskId: string | null;
            quantity: number;
            note: string | null;
            materialId: string;
        }[];
        bom: ({
            service: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isActive: boolean;
                basePrice: number;
                unit: string;
            };
        } & {
            id: string;
            tenantId: string;
            serviceId: string;
            materialId: string;
            normPerUnit: number;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    })[]>;
    findOneMaterial(id: string): Promise<{
        movements: {
            id: string;
            tenantId: string;
            createdAt: Date;
            type: string;
            taskId: string | null;
            quantity: number;
            note: string | null;
            materialId: string;
        }[];
        bom: ({
            service: {
                id: string;
                tenantId: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                isActive: boolean;
                basePrice: number;
                unit: string;
            };
        } & {
            id: string;
            tenantId: string;
            serviceId: string;
            materialId: string;
            normPerUnit: number;
        })[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    createMaterial(data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    updateMaterial(id: string, data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    removeMaterial(id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    stockIn(materialId: string, quantity: number, note?: string, taskId?: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    stockOut(materialId: string, quantity: number, note?: string, taskId?: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    writeOff(materialId: string, quantity: number, note?: string, taskId?: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        unit: string;
        currentStock: number;
        reservedStock: number;
        minStock: number;
    }>;
    getMovements(materialId?: string): Promise<({
        material: {
            id: string;
            tenantId: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            unit: string;
            currentStock: number;
            reservedStock: number;
            minStock: number;
        };
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        type: string;
        taskId: string | null;
        quantity: number;
        note: string | null;
        materialId: string;
    })[]>;
    deductByTask(taskId: string, serviceId: string, quantity: number, wasteQty?: number): Promise<any[]>;
}
