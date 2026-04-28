import { AsyncLocalStorage } from 'async_hooks';
export interface TenantStore {
    tenantId: string;
    userId: string;
    userRole: string;
}
export declare const tenantStorage: AsyncLocalStorage<TenantStore>;
export declare class TenantContext {
    static get(): TenantStore;
    static getTenantId(): string;
    static getUserId(): string;
    static getUserRole(): string;
    static run<T>(store: TenantStore, callback: () => T): T;
    static tryGetTenantId(): string | null;
}
