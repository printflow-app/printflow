import { ExpenseTypesService } from './expense-types.service';
export declare class ExpenseTypesController {
    private service;
    constructor(service: ExpenseTypesService);
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
