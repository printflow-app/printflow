import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantsApi, plansApi, leadsApi, settingsApi, platformApi, taskManagerApi, authApi } from '../api';

// =============================================
// ADMIN PANEL — Shared React Query hooks
// =============================================

export const qk = {
  me:             ['admin', 'me'] as const,
  tenants:        ['admin', 'tenants'] as const,
  tenantStats:    ['admin', 'tenant-stats'] as const,
  tenant:         (id: string) => ['admin', 'tenant', id] as const,
  plans:          ['admin', 'plans'] as const,
  leads:          ['admin', 'leads'] as const,
  pendingPayments: ['admin', 'payments', 'pending'] as const,
  allPayments:    ['admin', 'payments', 'all'] as const,
  setting:        (key: string) => ['admin', 'setting', key] as const,
  promoCodes:     ['admin', 'promo-codes'] as const,
  clientLogos:    ['admin', 'client-logos'] as const,
  taskFunnels:    ['admin', 'task-funnels'] as const,
  aiUsage:        ['admin', 'ai-usage'] as const,
};

// -------- AI USAGE (workspace bo'yicha sarf) --------
export function useAiUsage() {
  return useQuery({
    queryKey: qk.aiUsage,
    queryFn: async () => (await tenantsApi.getAiUsage()).data as any,
    staleTime: 60_000,
  });
}

// -------- SUPER ADMIN IDENTITY --------
export function useSuperAdminMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await authApi.me()).data as { id: string; login: string; createdAt?: string } | null,
    staleTime: 5 * 60_000,
  });
}

// -------- TENANTS --------
export function useTenants() {
  return useQuery({
    queryKey: qk.tenants,
    queryFn: async () => (await tenantsApi.findAll()).data as any[],
  });
}

export function useTenantStats() {
  return useQuery({
    queryKey: qk.tenantStats,
    queryFn: async () => (await tenantsApi.getStats()).data,
    staleTime: 60_000,
  });
}

// -------- PLANS --------
export function usePlans() {
  return useQuery({
    queryKey: qk.plans,
    queryFn: async () => (await plansApi.findAll()).data as any[],
    staleTime: 5 * 60_000,
  });
}

// -------- LEADS --------
export function useLeads() {
  return useQuery({
    queryKey: qk.leads,
    queryFn: async () => (await leadsApi.findAll()).data as any[],
  });
}

// -------- PAYMENTS --------
export function usePendingPayments() {
  return useQuery({
    queryKey: qk.pendingPayments,
    queryFn: async () => (await tenantsApi.getPendingPayments()).data as any[],
  });
}

export function useAllPayments() {
  return useQuery({
    queryKey: qk.allPayments,
    queryFn: async () => (await tenantsApi.getAllPayments()).data as any[],
  });
}

// -------- SETTINGS --------
export function useSetting(key: string) {
  return useQuery({
    queryKey: qk.setting(key),
    queryFn: async () => (await settingsApi.get(key)).data,
    staleTime: 5 * 60_000,
  });
}

// -------- PROMO CODES --------
export function usePromoCodes() {
  return useQuery({
    queryKey: qk.promoCodes,
    queryFn: async () => (await tenantsApi.getPromoCodes()).data as any[],
  });
}

// -------- CLIENT LOGOS --------
export function useClientLogos() {
  return useQuery({
    queryKey: qk.clientLogos,
    queryFn: async () => (await platformApi.getClientLogos()).data as any,
    staleTime: 5 * 60_000,
  });
}

// -------- TASK MANAGER --------
export function useTaskFunnels() {
  return useQuery({
    queryKey: qk.taskFunnels,
    queryFn: async () => (await taskManagerApi.listFunnels()).data as any[],
  });
}

// =============================================
// Invalidation helper — mutatsiyalardan keyin
// =============================================
export function useInvalidate() {
  const qc = useQueryClient();
  return {
    tenants:         () => qc.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
    tenantStats:     () => qc.invalidateQueries({ queryKey: qk.tenantStats }),
    plans:           () => qc.invalidateQueries({ queryKey: qk.plans }),
    leads:           () => qc.invalidateQueries({ queryKey: qk.leads }),
    payments:        () => qc.invalidateQueries({ queryKey: ['admin', 'payments'] }),
    settings:        () => qc.invalidateQueries({ queryKey: ['admin', 'setting'] }),
    promoCodes:      () => qc.invalidateQueries({ queryKey: qk.promoCodes }),
    clientLogos:     () => qc.invalidateQueries({ queryKey: qk.clientLogos }),
    taskFunnels:     () => qc.invalidateQueries({ queryKey: qk.taskFunnels }),
    all:             () => qc.invalidateQueries(),
  };
}
