import { PaymentTypesService } from './payment-types.service';
export declare class PaymentTypesController {
    private ptService;
    constructor(ptService: PaymentTypesService);
    findAll(): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }[]>;
    create(body: {
        name: string;
    }): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }>;
    update(id: string, body: {
        name: string;
    }): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }>;
    remove(id: string): Promise<{
        id: string;
        tenantId: string;
        name: string;
    }>;
}
