"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContext = exports.tenantStorage = void 0;
const async_hooks_1 = require("async_hooks");
exports.tenantStorage = new async_hooks_1.AsyncLocalStorage();
class TenantContext {
    static get() {
        const store = exports.tenantStorage.getStore();
        if (!store) {
            throw new Error('TenantContext accessed outside of request scope');
        }
        return store;
    }
    static getTenantId() {
        return TenantContext.get().tenantId;
    }
    static getUserId() {
        return TenantContext.get().userId;
    }
    static getUserRole() {
        return TenantContext.get().userRole;
    }
    static run(store, callback) {
        return exports.tenantStorage.run(store, callback);
    }
    static tryGetTenantId() {
        try {
            return TenantContext.getTenantId();
        }
        catch {
            return null;
        }
    }
}
exports.TenantContext = TenantContext;
//# sourceMappingURL=tenant.context.js.map