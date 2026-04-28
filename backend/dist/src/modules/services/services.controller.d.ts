import { ServicesService } from './services.service';
export declare class ServicesController {
    private servicesService;
    constructor(servicesService: ServicesService);
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
    addOption(serviceId: string, data: any): Promise<{
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
    addMaterial(serviceId: string, data: any): Promise<{
        id: string;
        tenantId: string;
        serviceId: string;
        materialId: string;
        normPerUnit: number;
    }>;
    removeMaterial(serviceId: string, materialId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    calculatePrice(serviceId: string, body: {
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
