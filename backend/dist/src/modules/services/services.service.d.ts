import { PrismaService } from '../../prisma/prisma.service';
export declare class ServicesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<({
        materials: ({
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
            serviceId: string;
            materialId: string;
            normPerUnit: number;
        })[];
        options: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            serviceId: string;
            value: string;
            percentageMarkup: number;
            priceAdd: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        basePrice: number;
        unit: string;
    })[]>;
    findOne(id: string): Promise<{
        materials: ({
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
            serviceId: string;
            materialId: string;
            normPerUnit: number;
        })[];
        options: {
            id: string;
            tenantId: string;
            createdAt: Date;
            name: string;
            serviceId: string;
            value: string;
            percentageMarkup: number;
            priceAdd: number;
        }[];
    } & {
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        basePrice: number;
        unit: string;
    }>;
    create(data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        basePrice: number;
        unit: string;
    }>;
    update(id: string, data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        basePrice: number;
        unit: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        isActive: boolean;
        basePrice: number;
        unit: string;
    }>;
    addOption(serviceId: string, optionData: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        serviceId: string;
        value: string;
        percentageMarkup: number;
        priceAdd: number;
    }>;
    removeOption(optionId: string): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        serviceId: string;
        value: string;
        percentageMarkup: number;
        priceAdd: number;
    }>;
    updateOption(optionId: string, data: any): Promise<{
        id: string;
        tenantId: string;
        createdAt: Date;
        name: string;
        serviceId: string;
        value: string;
        percentageMarkup: number;
        priceAdd: number;
    }>;
    updateOptionsPrices(serviceId: string): Promise<void>;
    calculateRoundedPrice(base: number, markupPercent: number): number;
    addMaterial(serviceId: string, materialData: any): Promise<{
        id: string;
        tenantId: string;
        serviceId: string;
        materialId: string;
        normPerUnit: number;
    }>;
    removeMaterial(serviceId: string, materialId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    calculatePrice(params: {
        serviceId: string;
        selectedOptionIds: string[];
        quantity: number;
        discount: number;
        coefficient: number;
    }): Promise<{
        basePrice: number;
        optionsTotal: number;
        baseTotal: number;
        quantity: number;
        discount: number;
        coefficient: number;
        total: number;
        breakdown: {
            name: string;
            value: string;
            priceAdd: number;
        }[];
    }>;
}
