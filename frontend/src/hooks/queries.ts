// =============================================
// SHARED REACT QUERY HOOKS
// Tipik resurslar uchun (branches, departments, employees, customers, etc.)
// Pages bularni import qilib oddiy `useBranches()` chaqirish bilan ishlatadi.
// Cache key'lari standardlashtirilgan — invalidation aniq.
// =============================================
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  branchesApi, employeesApi, customersApi, paymentTypesApi, expenseTypesApi,
  departmentsApi, vendorsApi, servicesApi, tasksApi, rolesApi, inventoryApi,
} from '../api';

// Query keys — bir joyda. Mutation'lardan keyin invalidate qilish uchun ishlatiladi.
export const qk = {
  branches:        ['branches'] as const,
  employees:       ['employees'] as const,
  roles:           (branchId?: string)            => ['roles', branchId ?? 'all'] as const,
  customers:       (branchId?: string)            => ['customers', branchId ?? 'all'] as const,
  paymentTypes:    ['paymentTypes'] as const,
  expenseTypes:    ['expenseTypes'] as const,
  departments:     (branchId: string)             => ['departments', branchId] as const,
  vendors:         (branchId: string)             => ['vendors', branchId] as const,
  services:        (branchId: string)             => ['services', branchId] as const,
  taskColumns:     (branchId?: string)            => ['taskColumns', branchId ?? 'all'] as const,
  tasks:           (branchId?: string)            => ['tasks', branchId ?? 'all'] as const,
};

// -------- BRANCHES (tenant-wide, no branch filter) --------
export function useBranches() {
  return useQuery({
    queryKey: qk.branches,
    queryFn: async () => (await branchesApi.findAll()).data as any[],
    staleTime: 5 * 60_000, // branches rarely change → 5min fresh
  });
}

// -------- EMPLOYEES (tenant-wide) --------
export function useEmployees() {
  return useQuery({
    queryKey: qk.employees,
    queryFn: async () => (await employeesApi.findAll()).data as any[],
    staleTime: 60_000,
  });
}

// -------- ROLES (branch-scoped) --------
export function useRoles(branchId?: string) {
  return useQuery({
    queryKey: qk.roles(branchId),
    queryFn: async () => (await rolesApi.findAll(branchId)).data as any[],
    staleTime: 5 * 60_000,
  });
}

// -------- CUSTOMERS (branch-scoped) --------
export function useCustomers(branchId?: string, includeDetails = false) {
  return useQuery({
    queryKey: includeDetails
      ? ['customers', branchId ?? 'all', 'detailed']
      : qk.customers(branchId),
    queryFn: async () => (await customersApi.findAll(branchId, includeDetails)).data as any[],
    staleTime: 60_000,
  });
}

// Top customers by revenue/volume (tenant-wide)
export function useTopCustomers(limit = 10) {
  return useQuery({
    queryKey: ['customers', 'top', limit],
    queryFn: async () => (await customersApi.getTopCustomers(limit)).data as any[],
    staleTime: 2 * 60_000,
  });
}

// -------- PAYMENT TYPES (tenant-wide) --------
export function usePaymentTypes() {
  return useQuery({
    queryKey: qk.paymentTypes,
    queryFn: async () => (await paymentTypesApi.findAll()).data as any[],
    staleTime: 5 * 60_000,
  });
}

// -------- EXPENSE TYPES (tenant-wide) --------
export function useExpenseTypes() {
  return useQuery({
    queryKey: qk.expenseTypes,
    queryFn: async () => (await expenseTypesApi.findAll()).data as any[],
    staleTime: 5 * 60_000,
  });
}

// -------- DEPARTMENTS (branch-scoped) --------
// `branchId` must be a real UUID. Disabled until provided.
export function useDepartments(branchId: string | undefined) {
  return useQuery({
    queryKey: qk.departments(branchId || ''),
    queryFn: async () => (await departmentsApi.findAll(branchId as any)).data as any[],
    // branchId bo'lmasa ham so'raymiz — backend bunday holatda tenantning
    // barcha bo'limlarini qaytaradi. Ilgari so'rov umuman yuborilmasdi va
    // bo'lim tanlash maydonlari yashirinib qolardi.
    staleTime: 5 * 60_000,
  });
}

// -------- VENDORS (branch-scoped, strict isolation) --------
export function useVendors(branchId: string | undefined) {
  const valid = !!branchId;
  return useQuery({
    queryKey: qk.vendors(branchId || ''),
    queryFn: async () => (await vendorsApi.findAll(branchId!)).data as any[],
    enabled: valid,
    staleTime: 2 * 60_000,
  });
}

// -------- SERVICES (branch-scoped, strict isolation) --------
export function useServices(branchId: string | undefined) {
  const valid = !!branchId;
  return useQuery({
    queryKey: qk.services(branchId || ''),
    queryFn: async () => (await servicesApi.findAll(branchId!)).data as any[],
    enabled: valid,
    staleTime: 2 * 60_000,
  });
}

// -------- TASK KANBAN COLUMNS (branch-scoped) --------
// staleTime — Topshiriqlar tabini yopib qaytganda darhol cache'dan ko'rsatish uchun.
// invalidate qachon chaqirilsa, baribir refetch bo'ladi (mutatsiya va auto-refresh).
export function useTaskColumns(branchId?: string) {
  return useQuery({
    queryKey: qk.taskColumns(branchId),
    queryFn: async () => (await tasksApi.getColumns(branchId)).data as any[],
    staleTime: 10_000,
  });
}

// -------- TASKS (branch-scoped) --------
export function useTasks(branchId?: string) {
  return useQuery({
    queryKey: qk.tasks(branchId),
    queryFn: async () => (await tasksApi.findAll(branchId)).data as any[],
    staleTime: 10_000,
  });
}

// -------- INVENTORY: Materials (branch-scoped) --------
export function useMaterials(branchId?: string) {
  return useQuery({
    queryKey: ['materials', branchId ?? 'all'],
    queryFn: async () => (await inventoryApi.getMaterials(branchId)).data as any[],
  });
}

// -------- INVENTORY: Stock Movements (tenant-wide) --------
export function useStockMovements() {
  return useQuery({
    queryKey: ['movements'],
    queryFn: async () => (await inventoryApi.getMovements()).data as any[],
  });
}

// =============================================
// INVALIDATION HELPER
// Mutatsiya'lardan keyin: `invalidateAfterMutation(qc, 'tasks', branchId)` chaqiring.
// Kerakli cache key'lar tozalanadi, RQ ularni qaytadan yuklaydi.
// =============================================
export function useInvalidate() {
  const qc = useQueryClient();
  return {
    branches:     () => qc.invalidateQueries({ queryKey: qk.branches }),
    employees:    () => qc.invalidateQueries({ queryKey: qk.employees }),
    roles:        () => qc.invalidateQueries({ queryKey: ['roles'] }),
    customers:    () => qc.invalidateQueries({ queryKey: ['customers'] }),
    paymentTypes: () => qc.invalidateQueries({ queryKey: qk.paymentTypes }),
    expenseTypes: () => qc.invalidateQueries({ queryKey: qk.expenseTypes }),
    departments:  () => qc.invalidateQueries({ queryKey: ['departments'] }),
    vendors:      () => qc.invalidateQueries({ queryKey: ['vendors'] }),
    services:     () => qc.invalidateQueries({ queryKey: ['services'] }),
    taskColumns:  () => qc.invalidateQueries({ queryKey: ['taskColumns'] }),
    tasks:        () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    materials:    () => qc.invalidateQueries({ queryKey: ['materials'] }),
    movements:    () => qc.invalidateQueries({ queryKey: ['movements'] }),
    all:          () => qc.invalidateQueries(),
  };
}
