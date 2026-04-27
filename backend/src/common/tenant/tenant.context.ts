import { AsyncLocalStorage } from 'async_hooks';

// =============================================
// TENANT CONTEXT — AsyncLocalStorage
// Har bir HTTP request uchun tenant izolyatsiyasi
// =============================================

export interface TenantStore {
  tenantId: string;
  userId: string;
  userRole: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export class TenantContext {
  static get(): TenantStore {
    const store = tenantStorage.getStore();
    if (!store) {
      throw new Error('TenantContext accessed outside of request scope');
    }
    return store;
  }

  static getTenantId(): string {
    return TenantContext.get().tenantId;
  }

  static getUserId(): string {
    return TenantContext.get().userId;
  }

  static getUserRole(): string {
    return TenantContext.get().userRole;
  }

  /**
   * Runs a callback within a specific tenant context.
   * Used during login (before JWT is set) and seeding.
   */
  static run<T>(store: TenantStore, callback: () => T): T {
    return tenantStorage.run(store, callback);
  }

  /**
   * Safely try to get tenantId — returns null if outside request scope.
   * Used in Prisma middleware to skip non-request contexts (seeds, migrations).
   */
  static tryGetTenantId(): string | null {
    try {
      return TenantContext.getTenantId();
    } catch {
      return null;
    }
  }
}
