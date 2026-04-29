import axios from 'axios';

// =============================================
// PrintFlow Frontend API Client
// - withCredentials: true — httpOnly cookie yuborish uchun
// - Barcha so'rovlar /api prefix'li
// =============================================

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://printflow-production-bb78.up.railway.app';
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // httpOnly cookie avtomatik yuboriladi
});

// Interceptor to handle SUBSCRIPTION_EXPIRED
api.interceptors.response.use(
  (response) => response,
  (error) => {
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
  login: (data: { workspaceSlug: string; login: string; password: string }) =>
    api.post('/auth/login', data),

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
  findAll: () => api.get('/roles'),
  create: (data: any) => api.post('/roles', data),
  update: (id: string, data: any) => api.put(`/roles/${id}`, data),
  delete: (id: string) => api.delete(`/roles/${id}`),
};

// =============================================
// CUSTOMERS
// =============================================
export const customersApi = {
  findAll: () => api.get('/customers'),
  create: (data: any) => api.post('/customers', data),
  update: (id: string, data: any) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  getCustomerTasks: (id: string) => api.get(`/customers/${id}/tasks`),
  getOrderHistory: (id: string) => api.get(`/customers/${id}/orders`),
  getTopCustomers: (limit?: number) => api.get('/customers/top', { params: limit ? { limit } : {} }),
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
  findAll: () => api.get('/tasks'),
  findOne: (id: string) => api.get(`/tasks/${id}`),
  create: (data: any, employeeId: string) =>
    api.post(`/tasks?employeeId=${employeeId}`, data),
  createBulk: (data: any, employeeId: string) =>
    api.post(`/tasks/bulk?employeeId=${employeeId}`, data),
  update: (id: string, data: any, employeeId: string) =>
    api.put(`/tasks/${id}?employeeId=${employeeId}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  logView: (id: string, employeeId: string) =>
    api.post(`/tasks/${id}/view`, { employeeId }),

  getColumns: () => api.get('/tasks/columns'),
  createColumn: (data: any) => api.post('/tasks/columns', data),
  updateColumn: (id: string, data: any) => api.put(`/tasks/columns/${id}`, data),
  deleteColumn: (id: string) => api.delete(`/tasks/columns/${id}`),
};

// =============================================
// FINANCE
// =============================================
export const financeApi = {
  getDashboard: (config?: any) => api.get('/finance/dashboard', config),
  getTransactions: (config?: any) => api.get('/finance/transactions', config),
  createTransaction: (data: any) => api.post('/finance/transactions', data),
  getDinamika: (config?: any) => api.get('/finance/dinamika', config),
  getStatsByPaymentType: (config?: any) => api.get('/finance/stats-by-payment-type', config),
  getExpenseBreakdown: (config?: any) => api.get('/finance/expense-breakdown', config),
};

// =============================================
// XIZMATLAR KATALOGI (Pricing Engine)
// =============================================
export const servicesApi = {
  findAll: () => api.get('/services'),
  findOne: (id: string) => api.get(`/services/${id}`),
  create: (data: any) => api.post('/services', data),
  update: (id: string, data: any) => api.put(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),

  addOption: (serviceId: string, data: any) =>
    api.post(`/services/${serviceId}/options`, data),
  updateOption: (optionId: string, data: any) =>
    api.put(`/services/options/${optionId}`, data),
  deleteOption: (optionId: string) =>
    api.delete(`/services/options/${optionId}`),

  addMaterial: (serviceId: string, data: any) =>
    api.post(`/services/${serviceId}/materials`, data),
  deleteMaterial: (serviceId: string, materialId: string) =>
    api.delete(`/services/${serviceId}/materials/${materialId}`),

  calculatePrice: (
    serviceId: string,
    data: {
      selectedOptionIds: string[];
      quantity: number;
      discount: number;
      coefficient: number;
    },
  ) => api.post(`/services/${serviceId}/calculate-price`, data),
};

// =============================================
// OMBOR (Inventory)
// =============================================
export const inventoryApi = {
  getMaterials: () => api.get('/inventory/materials'),
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
  refreshToken: () => api.post('/attendance/token/refresh'),
  checkIn: (data: { employeeId: string; token: string; deviceId?: string }) =>
    api.post('/attendance/checkin', data),
  checkOut: (data: { employeeId: string; token: string; deviceId?: string }) =>
    api.post('/attendance/checkout', data),
  getTodayRecords: () => api.get('/attendance/records/today'),
  getRecords: (date?: string) =>
    api.get('/attendance/records', { params: date ? { date } : {} }),
  getMonthlyRecords: (year: number, month: number) =>
    api.get('/attendance/monthly', { params: { year, month } }),
  getByEmployee: (employeeId: string) =>
    api.get(`/attendance/records/employee/${employeeId}`),
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
  getPayments: () => api.get('/billing/payments'),
  getStatus: () => api.get('/billing/status'),
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

export default api;
