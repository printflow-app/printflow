import axios from 'axios';

// =============================================
// PrintFlow Frontend API Client
// - withCredentials: true — httpOnly cookie yuborish uchun
// - Barcha so'rovlar /api prefix'li
// =============================================

const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
const API_URL = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api') : '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // httpOnly cookie avtomatik yuboriladi
});

// Throws if no branch is currently selected. Use before calling servicesApi / vendorsApi —
// the backend will 400 anyway, but failing fast on the client gives a friendlier message.
export function assertActiveBranchId(branchId: string | undefined | null): string {
  if (!branchId) {
    throw new Error('Aktiv filial tanlanmagan');
  }
  return branchId;
}

// Request interceptor: attach X-Tenant-Id from session (defense-in-depth)
// + optional Authorization Bearer for non-cookie clients (iOS Safari, PWA, embeds).
// User cache localStorage'da — iOS PWA background terminate'da saqlanib qolishi uchun
// (eski sessionStorage variantni fallback sifatida ham o'qiymiz).
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('pf_user_info') || sessionStorage.getItem('pf_user_info');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.tenantId) {
        (config.headers as any)['X-Tenant-Id'] = user.tenantId;
      }
    }
    const bearer = localStorage.getItem('pf_token');
    if (bearer && !(config.headers as any).Authorization) {
      (config.headers as any).Authorization = `Bearer ${bearer}`;
    }
  } catch { /* storage might be blocked in private mode */ }
  return config;
});

// =============================================
// RETRY WITH BACKOFF — rate-limit (429) & transient failures
//
// Without this, a 429 (or a brief network/5xx blip) bubbles straight to React
// Query, which renders it as an empty list (components default `data` to []).
// That's the "data disappears on refresh / on some devices" bug. Here we retry
// transparently with backoff so a momentary throttle becomes a slightly delayed
// success instead of a blank screen.
//
// Safety:
//  - 429 is ALWAYS safe to retry, regardless of HTTP method: ThrottlerGuard rejects
//    the request BEFORE the handler runs, so no side effect occurred even for POST.
//  - Other transient errors (no response / 5xx) are retried ONLY for idempotent
//    reads (GET/HEAD) — never for POST/PUT/PATCH/DELETE, to avoid double-submits.
// =============================================
const MAX_RETRIES = 3;

function computeRetryDelay(error: any, attempt: number): number {
  // Honor server's Retry-After (seconds) when present (throttler sets it).
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (retryAfter !== undefined) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs)) return Math.min(secs * 1000, 15_000);
  }
  // Exponential backoff with jitter, capped at 8s.
  return Math.min(500 * 2 ** (attempt - 1), 8_000) + Math.floor(Math.random() * 300);
}

// Interceptor: retry first, then handle SUBSCRIPTION_EXPIRED / session expiry.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg: any = error.config;
    if (cfg) {
      const status = error.response?.status;
      const method = String(cfg.method || 'get').toLowerCase();
      const idempotent = method === 'get' || method === 'head';
      const isThrottled = status === 429;
      const isTransient = !error.response || (status >= 500 && status < 600);
      const retryable = isThrottled || (isTransient && idempotent);

      cfg.__retryCount = cfg.__retryCount || 0;
      if (retryable && cfg.__retryCount < MAX_RETRIES) {
        cfg.__retryCount += 1;
        await new Promise((resolve) => setTimeout(resolve, computeRetryDelay(error, cfg.__retryCount)));
        return api(cfg);
      }
    }

    if (error.response?.status === 403 && error.response?.data?.message === 'SUBSCRIPTION_EXPIRED') {
      window.dispatchEvent(new CustomEvent('subscription_expired'));
    }
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('session_expired'));
    }
    return Promise.reject(error);
  }
);

// =============================================
// AUTH — Login, Logout, Session
// =============================================
export const authApi = {
  // Workspace login: { workspaceSlug, login, password }
  // telegramId — Telegram WebApp ichida login qilinganda yuboriladi; backend
  // hisobni Telegram'ga avtomatik bog'laydi (botda alohida login shart emas).
  login: (data: { workspaceSlug: string; login: string; password: string; telegramId?: string }) =>
    api.post('/auth/login', data),

  // Self-serve tenant registration → creates Tenant + Admin + default Branch atomically,
  // returns { token, user, workspaceSlug } in the same shape as login().
  register: (data: {
    tenantName: string;
    workspaceSlug: string;
    fullName: string;
    login: string;
    password: string;
    phone?: string;
    telegramId?: string;
  }) => api.post('/auth/register', data),

  logout: () => api.post('/auth/logout'),

  // Joriy foydalanuvchi (JWT payload'dan, DB query yo'q)
  me: () => api.get('/auth/me'),

  // Parol versiyasini tekshirish (30 soniyada bir)
  checkSession: () => api.post('/auth/check-session'),

  // Super-admin login (alohida panel uchun)
  superAdminLogin: (data: { email: string; password: string }) =>
    api.post('/auth/super-admin/login', data),

  // Birinchi marta kirganda ma'lumotlarni to'ldirish
  onboarding: (data: {
    tenantName: string;
    tenantSlug: string;
    fullName: string;
    phone: string;
    login: string;
    password?: string;
  }) => api.post('/auth/onboarding', data),

  // Telegram WebApp orqali auto-login (frontend Telegram.WebApp.initDataUnsafe.user.id'ni yuboradi)
  telegramAuth: (telegramId: string) =>
    api.post('/auth/telegram', { telegramId }),

  // Ekran qulfi — akkauntga bog'liq (serverda saqlanadi, istalgan qurilmada bir xil).
  // PIN hech qachon clientga qaytmaydi — faqat hasPin + verify endpoint.
  getLockSettings: () => api.get('/auth/lock-settings'),
  saveLockSettings: (data: { pin?: string; timeoutMinutes?: number; lockedTabs?: string[] }) =>
    api.post('/auth/lock-settings', data),
  verifyLockPin: (pin: string) => api.post('/auth/lock-settings/verify', { pin }),
};

// =============================================
// EMPLOYEES
// =============================================
export const employeesApi = {
  findAll: () => api.get('/employees'),
  create: (data: any) => api.post('/employees', data),
  update: (id: string, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),

  // Telegram orqali auto-login (bot tomonidan)
  telegramLogin: (telegramId: string) =>
    api.post('/employees/telegram-login', { telegramId }),
};

// =============================================
// ROLES
// =============================================
export const rolesApi = {
  findAll: (branchId?: string) => api.get('/roles', { params: branchId ? { branchId } : {} }),
  create: (data: any) => api.post('/roles', data),
  update: (id: string, data: any, branchId?: string) =>
    api.put(`/roles/${id}`, data, { params: branchId ? { branchId } : {} }),
  delete: (id: string, branchId?: string) =>
    api.delete(`/roles/${id}`, { params: branchId ? { branchId } : {} }),
};

// =============================================
// CUSTOMERS
// =============================================
export const customersApi = {
  findAll: (branchId?: string, includeDetails = false) =>
    api.get('/customers', {
      params: {
        ...(branchId ? { branchId } : {}),
        ...(includeDetails ? { includeDetails: 'true' } : {}),
      },
    }),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  getCustomerTasks: (id: string) => api.get(`/customers/${id}/tasks`),
  getOrderHistory: (id: string) => api.get(`/customers/${id}/orders`),
  getDetails: (id: string) => api.get(`/customers/${id}/details`),
  getTopCustomers: (limit?: number) => api.get('/customers/top', { params: limit ? { limit } : {} }),

  // B2B Contacts
  getContacts: (id: string) => api.get(`/customers/${id}/contacts`),
  createContact: (id: string, data: { name: string; phone?: string; role?: string; email?: string }) =>
    api.post(`/customers/${id}/contacts`, data),
  updateContact: (id: string, contactId: string, data: any) =>
    api.put(`/customers/${id}/contacts/${contactId}`, data),
  deleteContact: (id: string, contactId: string) =>
    api.delete(`/customers/${id}/contacts/${contactId}`),
};

// =============================================
// PAYMENT TYPES
// =============================================
export const paymentTypesApi = {
  findAll: () => api.get('/payment-types'),
  create: (data: any) => api.post('/payment-types', data),
  update: (id: string, data: any) => api.put(`/payment-types/${id}`, data),
  delete: (id: string) => api.delete(`/payment-types/${id}`),
};

// =============================================
// EXPENSE TYPES
// =============================================
export const expenseTypesApi = {
  findAll: () => api.get('/expense-types'),
  create: (data: any) => api.post('/expense-types', data),
  update: (id: string, data: any) => api.put(`/expense-types/${id}`, data),
  delete: (id: string) => api.delete(`/expense-types/${id}`),
};

// =============================================
// TASKS & KANBAN
// =============================================
export const tasksApi = {
  findAll: (branchId?: string) => api.get('/tasks', { params: branchId ? { branchId } : {} }),
  findOne: (id: string) => api.get(`/tasks/${id}`),
  create: (data: any, employeeId: string) =>
    api.post(`/tasks?employeeId=${employeeId}`, data),
  createBulk: (data: any, employeeId: string) =>
    api.post(`/tasks/bulk?employeeId=${employeeId}`, data),
  update: (id: string, data: any, employeeId: string) =>
    api.put(`/tasks/${id}?employeeId=${employeeId}`, data),
  archive: (id: string) => api.post(`/tasks/${id}/archive`),
  // Buyurtmani butunlay o'chirish — faqat admin (backend tekshiradi).
  remove: (id: string) => api.delete(`/tasks/${id}`),
  getArchived: () => api.get('/tasks/archived'),
  logView: (id: string, employeeId: string) =>
    api.post(`/tasks/${id}/view`, { employeeId }),
  // Yangi attachment qo'shish — butun massiv qayta yuborilmaydi, faqat yangi fayl.
  // onProgress callback upload jarayonining % ni qaytaradi (0..100).
  appendAttachment: (
    id: string,
    attachment: { name: string; url: string },
    onProgress?: (pct: number) => void,
  ) =>
    api.post(`/tasks/${id}/attachments`, attachment, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    }),
  backfillIds: () => api.post('/tasks/backfill-ids'),

  getColumns: (branchId?: string) => {
    const params: any = {};
    if (branchId) params.branchId = branchId;
    return api.get('/tasks/columns', { params });
  },
  createColumn: (data: any) => api.post('/tasks/columns', data),
  updateColumn: (id: string, data: any) => api.put(`/tasks/columns/${id}`, data),
  deleteColumn: (id: string, branchId?: string) =>
    api.post(`/tasks/columns/${id}/delete`, null, { params: branchId ? { branchId } : {} }),
};

// =============================================
// TASK EXPENSES — Tannarx xarajatlari (Costing)
// =============================================
export const taskExpensesApi = {
  list: (taskId: string) =>
    api.get(`/tasks/${taskId}/expenses`),
  create: (taskId: string, data: { expenseName: string; amount: number }) =>
    api.post(`/tasks/${taskId}/expenses`, data),
  remove: (taskId: string, expenseId: string) =>
    api.delete(`/tasks/${taskId}/expenses/${expenseId}`),
};

// =============================================
// VENDORS / HAMKORLAR (Subcontractors)
// =============================================
// Strict isolation — every call must carry activeBranchId. The backend now
// returns 400 if branchId is missing.
export const vendorsApi = {
  findAll: (branchId: string) =>
    api.get('/vendors', { params: { branchId } }),
  findOne: (id: string, branchId: string) =>
    api.get(`/vendors/${id}`, { params: { branchId } }),
  create: (data: any) => api.post('/vendors', data), // branchId must be in body
  update: (id: string, data: any, branchId: string) =>
    api.put(`/vendors/${id}`, data, { params: { branchId } }),
  remove: (id: string, branchId: string) =>
    api.delete(`/vendors/${id}`, { params: { branchId } }),
  // Ledger (naqdsiz qarz/haq): Xarid (we_owe) yoki Sotuv (they_owe)
  createLedgerEntry: (data: any, branchId: string) =>
    api.post('/vendors/ledger', data, { params: { branchId } }),
  removeLedgerEntry: (entryId: string, branchId: string) =>
    api.delete(`/vendors/ledger/${entryId}`, { params: { branchId } }),
};

// =============================================
// FINANCE
// =============================================
export const financeApi = {
  getDashboard: (config?: any) => api.get('/finance/dashboard', config),
  getBreakEven: () => api.get('/finance/break-even'),
  getTransactions: (config?: any) => api.get('/finance/transactions', config),
  createTransaction: (data: any) => api.post('/finance/transactions', data),
  updateTransaction: (id: string, data: any) => api.patch(`/finance/transactions/${id}`, data),
  deleteTransaction: (id: string) => api.delete(`/finance/transactions/${id}`),
  getDinamika: (config?: any) => api.get('/finance/dinamika', config),
  getStatsByPaymentType: (config?: any) => api.get('/finance/stats-by-payment-type', config),
  getExpenseBreakdown: (config?: any) => api.get('/finance/expense-breakdown', config),
  getDailySummary: (config?: any) => api.get('/finance/daily-summary', config),
};

// =============================================
// KASSALAR (Cashboxes) — ko'p kassali tizim + kassalararo topshirish
// =============================================
export const cashBoxApi = {
  // Ko'rinadigan kassalar + har biriga hisoblangan balans.
  list: (branchId?: string) => api.get('/cashboxes', { params: branchId ? { branchId } : {} }),
  create: (data: { name: string; type?: string; branchId?: string | null; assignedUserId?: string | null }) =>
    api.post('/cashboxes', data),
  update: (id: string, data: any) => api.patch(`/cashboxes/${id}`, data),
  remove: (id: string) => api.delete(`/cashboxes/${id}`),

  // Topshirishlar (kassalararo)
  listTransfers: (params?: { direction?: 'incoming' | 'outgoing'; status?: string }) =>
    api.get('/cashboxes/transfers', { params: params || {} }),
  createTransfer: (data: { fromCashBoxId: string; toCashBoxId: string; amount: number; note?: string; paymentTypeId?: string }) =>
    api.post('/cashboxes/transfers', data),
  accept: (id: string) => api.post(`/cashboxes/transfers/${id}/accept`),
  reject: (id: string) => api.post(`/cashboxes/transfers/${id}/reject`),
  pendingCount: () => api.get('/cashboxes/pending-count'),
};

// =============================================
// MAOSH (Payroll) — oylik hisob-kitob
// =============================================
export const payrollApi = {
  // Berilgan oy (YYYY-MM) uchun barcha xodimlar maosh qatori
  list: (period: string, branchId?: string) =>
    api.get('/payroll', { params: { period, ...(branchId ? { branchId } : {}) } }),
  // Fiksa/bonus/jarima saqlash (qoralama)
  save: (data: { employeeId: string; period: string; fixedSalary?: number; bonus?: number; bonusNote?: string; penalty?: number; penaltyNote?: string }) =>
    api.post('/payroll/save', data),
  // To'lash (Kassadan chiqim)
  pay: (data: { employeeId: string; period: string }) => api.post('/payroll/pay', data),
  // To'lovni bekor qilish
  revert: (data: { employeeId: string; period: string }) => api.post('/payroll/revert', data),

  // ── Maosh sxemalari (lavozim bo'yicha avtomatik hisob) ──────────────
  // Metrika katalogi — sxema muharririda tanlanadigan o'lchovlar
  metrics: () => api.get('/payroll/metrics'),
  listSchemes: () => api.get('/payroll/schemes'),
  saveScheme: (data: any) => api.post('/payroll/schemes', data),
  deleteScheme: (id: string) => api.delete(`/payroll/schemes/${id}`),
};

// =============================================
// XIZMATLAR KATALOGI (Pricing Engine)
// =============================================
// Strict isolation — every read/mutation must carry activeBranchId.
export const servicesApi = {
  findAll: (branchId: string) =>
    api.get('/services', { params: { branchId } }),
  findOne: (id: string, branchId: string) =>
    api.get(`/services/${id}`, { params: { branchId } }),
  create: (data: any) => api.post('/services', data), // branchId in body
  update: (id: string, data: any, branchId: string) =>
    api.put(`/services/${id}`, data, { params: { branchId } }),
  delete: (id: string, branchId: string) =>
    api.delete(`/services/${id}`, { params: { branchId } }),

  addOption: (serviceId: string, data: any, branchId: string) =>
    api.post(`/services/${serviceId}/options`, data, { params: { branchId } }),
  updateOption: (optionId: string, data: any, branchId: string) =>
    api.put(`/services/options/${optionId}`, data, { params: { branchId } }),
  deleteOption: (optionId: string, branchId: string) =>
    api.delete(`/services/options/${optionId}`, { params: { branchId } }),

  addMaterial: (serviceId: string, data: any, branchId: string) =>
    api.post(`/services/${serviceId}/materials`, data, { params: { branchId } }),
  deleteMaterial: (serviceId: string, materialId: string, branchId: string) =>
    api.delete(`/services/${serviceId}/materials/${materialId}`, { params: { branchId } }),

  // Source branch is the caller's active branch; target is chosen in the dialog.
  clone: (id: string, sourceBranchId: string, targetBranchId: string) =>
    api.post(`/services/${id}/clone`, { targetBranchId }, { params: { branchId: sourceBranchId } }),

  calculatePrice: (
    serviceId: string,
    data: {
      selectedOptionIds: string[];
      quantity: number;
      discount: number;
      coefficient: number;
    },
    branchId: string,
  ) => api.post(`/services/${serviceId}/calculate-price`, data, { params: { branchId } }),
};

// =============================================
// OMBOR (Inventory)
// =============================================
export const inventoryApi = {
  getMaterials: (branchId?: string) => api.get('/inventory/materials', { params: branchId ? { branchId } : {} }),
  getMaterial: (id: string) => api.get(`/inventory/materials/${id}`),
  createMaterial: (data: any) => api.post('/inventory/materials', data),
  updateMaterial: (id: string, data: any) =>
    api.put(`/inventory/materials/${id}`, data),
  deleteMaterial: (id: string) => api.delete(`/inventory/materials/${id}`),

  stockIn: (id: string, data: { quantity: number; note?: string }) =>
    api.post(`/inventory/materials/${id}/stock-in`, data),
  stockOut: (id: string, data: { quantity: number; note?: string }) =>
    api.post(`/inventory/materials/${id}/stock-out`, data),
  writeOff: (id: string, data: { quantity: number; note?: string }) =>
    api.post(`/inventory/materials/${id}/write-off`, data),

  getMovements: (materialId?: string) =>
    api.get('/inventory/movements', {
      params: materialId ? { materialId } : {},
    }),
  deductByTask: (data: {
    taskId: string;
    serviceId: string;
    quantity: number;
    wasteQty?: number;
  }) => api.post('/inventory/deduct-by-task', data),
};

// =============================================
// DAVOMAT (Attendance)
// =============================================
export const attendanceApi = {
  getToken: () => api.get('/attendance/token'),
  rotateToken: () => api.post('/attendance/token/rotate'),
  // Eski nom — back-compat
  refreshToken: () => api.post('/attendance/token/rotate'),
  checkIn: (data: { employeeId: string; token: string; deviceId?: string; lat?: number; lng?: number }) =>
    api.post('/attendance/checkin', data),
  checkOut: (data: { employeeId: string; token: string; deviceId?: string; lat?: number; lng?: number }) =>
    api.post('/attendance/checkout', data),
  getTodayRecords: () => api.get('/attendance/records/today'),
  getRecords: (date?: string) =>
    api.get('/attendance/records', { params: date ? { date } : {} }),
  getMonthlyRecords: (year: number, month: number) =>
    api.get('/attendance/monthly', { params: { year, month } }),
  getByEmployee: (employeeId: string) =>
    api.get(`/attendance/records/employee/${employeeId}`),

  // Self-service (auth-based, no QR token) — GPS required
  getMyToday: () => api.get('/attendance/my-today'),
  getMyRecords: () => api.get('/attendance/my-records'),
  selfMark: (data: { lat?: number; lng?: number }) => api.post('/attendance/self-mark', data),

  // Admin: qo'lda davomat kiritish (qurilmasiz xodimlar uchun)
  manualMark: (data: { employeeId: string; date: string; checkIn?: string; checkOut?: string }) =>
    api.post('/attendance/manual', data),
};

// =============================================
// ORTIQCHA ISH (Overtime) — Telegram + Admin approval
// =============================================
export const overtimeApi = {
  findAll: (status?: string) =>
    api.get('/overtime', { params: status ? { status } : {} }),
  findPending: () => api.get('/overtime/pending'),
  approve: (id: string) => api.post(`/overtime/${id}/approve`),
  reject: (id: string, reason?: string) =>
    api.post(`/overtime/${id}/reject`, { reason }),
  create: (data: { date: string; minutes: number; message: string }) =>
    api.post('/overtime', data),
};

// =============================================
// TIZIM SOZLAMALARI (Settings)
// =============================================
export const settingsApi = {
  getAll: () => api.get('/settings'),
  get: (key: string) => api.get(`/settings/${key}`),
  set: (key: string, value: any) => api.post(`/settings/${key}`, value),
};

// =============================================
// BILLING
// =============================================
export const billingApi = {
  submitPayment: (data: any) => api.post('/billing/payment', data),
  submitAiTopupPurchase: (data: any) => api.post('/billing/ai-topup', data),
  getPayments: () => api.get('/billing/payments'),
  getStatus: () => api.get('/billing/status'),
  getMyPayments: () => api.get('/billing/my-payments'),
  // Promo code
  getOrCreatePromoCode: () => api.get('/billing/promo/my-code'),
  getMyPromoStats: () => api.get('/billing/promo/my-stats'),
  validatePromoCode: (code: string) => api.post('/billing/promo/validate', { code }),
  // Platform settings (super-admin controlled, read-only for tenants)
  getSetting: (key: string) => api.get(`/billing/settings/${key}`),
};

// =============================================
// KPI (Xodimlar samaradorligi)
// =============================================
export const kpiApi = {
  list: (params?: { start?: string; end?: string; branchId?: string }) =>
    api.get('/kpi/employees', { params }),
  me: (params?: { start?: string; end?: string }) =>
    api.get('/kpi/me', { params }),
  summary: (params?: { start?: string; end?: string; branchId?: string }) =>
    api.get('/kpi/summary', { params }),
};

// =============================================
// KPI PLANS (Rejalar / maqsadlar — lavozim shabloni + xodim override)
// =============================================
export const kpiPlansApi = {
  metrics: () => api.get('/kpi-plans/metrics'),
  list: () => api.get('/kpi-plans'),
  create: (data: {
    scope: 'role' | 'employee';
    roleId?: string;
    employeeId?: string;
    metricKey: string;
    targetValue: number;
    branchId?: string;
  }) => api.post('/kpi-plans', data),
  update: (id: string, data: { targetValue?: number; isActive?: boolean; metricKey?: string }) =>
    api.put(`/kpi-plans/${id}`, data),
  delete: (id: string) => api.delete(`/kpi-plans/${id}`),
  progress: (params?: { month?: string; branchId?: string }) =>
    api.get('/kpi-plans/progress', { params }),
  myProgress: (params?: { month?: string }) =>
    api.get('/kpi-plans/my-progress', { params }),
};

// =============================================
// BRANCHES (Multi-Filial)
// =============================================
export const branchesApi = {
  findAll: () => api.get('/branches'),
  create: (data: { name: string; address?: string; phone?: string; managerEmployeeId?: string }) =>
    api.post('/branches', data),
  update: (id: string, data: any) => api.put(`/branches/${id}`, data),
  delete: (id: string) => api.delete(`/branches/${id}`),
};


// =============================================
// WORKSPACE ADMINS
// =============================================
export const workspaceAdminsApi = {
  findAll: () => api.get('/workspace-admins'),
  create: (data: { fullName: string; phone?: string }) => api.post('/workspace-admins', data),
  update: (id: string, data: any) => api.put(`/workspace-admins/${id}`, data),
  delete: (id: string) => api.delete(`/workspace-admins/${id}`),
  resetPassword: (id: string) => api.post(`/workspace-admins/${id}/reset-password`),
};

// =============================================
// REPORTS (Business Intelligence)
// =============================================
export const reportsApi = {
  servicesPerformance: (params?: { start?: string; end?: string; branchId?: string }) =>
    api.get('/reports/services-performance', { params }),
  vendorProfitability: (params?: { start?: string; end?: string }) =>
    api.get('/reports/vendor-profitability', { params }),
  employeeVelocity: (params?: { start?: string; end?: string }) =>
    api.get('/reports/employee-velocity', { params }),
  growthMetrics: (params?: { branchId?: string; departmentId?: string }) =>
    api.get('/reports/growth-metrics', { params }),
  monthlyDynamics: (params?: { months?: number; branchId?: string; departmentId?: string }) =>
    api.get('/reports/monthly-dynamics', { params }),
};


// =============================================
// SIDEBAR NOTIFICATIONS
// =============================================
export const notificationsApi = {
  /**
   * Sidebar tab'lari uchun "yangilik" sonlari.
   * Har bir tab uchun localStorage'dagi lastSeen sanasini yuboramiz,
   * backend shu sanadan keyin paydo bo'lgan elementlarni sanaydi.
   */
  getSidebarCounts: (params: {
    branchId?: string;
    topshiriqlarSince?: string;
    mijozlarSince?: string;
    hamkorlarSince?: string;
  }) => api.get('/notifications/sidebar', { params }),
};

// =============================================
// AI COPILOT
// =============================================
export const departmentsApi = {
  findAll: (branchId: string) => api.get('/departments', { params: { branchId } }),
  create: (data: { name: string; branchId: string }) => api.post('/departments', data),
  update: (id: string, data: { name: string }, branchId: string) => api.put(`/departments/${id}`, data, { params: { branchId } }),
  remove: (id: string, branchId: string) => api.delete(`/departments/${id}`, { params: { branchId } }),
};

export const aiApi = {
  /**
   * Sends chat messages to the backend and returns a raw fetch Response
   * with SSE streaming. Use this with a ReadableStream reader.
   */
  streamChat: async (messages: Array<{ role: string; content: string }>) => {
    const raw = localStorage.getItem('pf_user_info') || sessionStorage.getItem('pf_user_info');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (raw) {
      try {
        const user = JSON.parse(raw);
        if (user?.tenantId) headers['X-Tenant-Id'] = user.tenantId;
      } catch { /**/ }
    }
    const bearer = localStorage.getItem('pf_token');
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

    const baseUrl = (import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app'));
    const url = baseUrl ? `${baseUrl.replace(/\/api$/, '')}/api/ai/chat` : '/api/ai/chat';

    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ messages }),
    });
  },

  // Agent amallari — [TASDIQ KARTASI] tool'lari AgentAction(pending) yaratadi;
  // karta tugmalari shu endpointlarni chaqiradi.
  confirmAction: (id: string) => api.post(`/ai/actions/${id}/confirm`),
  rejectAction: (id: string) => api.post(`/ai/actions/${id}/reject`),
  listActions: (limit = 20) => api.get('/ai/actions', { params: { limit } }),

  // Kunlik brifing — LLM'siz aggregation (xabar limitiga tegmaydi)
  getBriefing: () => api.get('/ai/briefing'),

  // Xavf kartalari — LLM'siz korrelyatsiya (Buyurtma x Davomat), xabar limitiga tegmaydi
  getRisks: () => api.get('/ai/risks'),
  dismissRisk: (id: string) => api.post(`/ai/risks/${id}/dismiss`),

  // Agent statistikasi — davr bo'yicha bajarilgan ishlar (Faza 5)
  getAgentStats: () => api.get('/ai/agent-stats'),
};

// Bosh sahifa — bitta so'rovda kirim/chiqim + buyurtmalar + davomat holati.
// Har bo'lim faqat ruxsat bo'lsa keladi (backend darajasida cheklangan).
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary'),
};

export default api;

// Jamoa doskasi — operatsion vazifalar + buyurtmalar birga.
export const teamTasksApi = {
  board: (branchId?: string) => api.get('/team-tasks/board', { params: branchId ? { branchId } : {} }),
  create: (data: any) => api.post('/team-tasks', data),
  update: (id: string, data: any) => api.put(`/team-tasks/${id}`, data),
  remove: (id: string) => api.delete(`/team-tasks/${id}`),
};
