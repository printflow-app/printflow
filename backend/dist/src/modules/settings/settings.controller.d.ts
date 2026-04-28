import { SettingsService } from './settings.service';
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    getAll(): Promise<Record<string, any>>;
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<{
        id: string;
        tenantId: string;
        value: string;
        key: string;
    }>;
}
