import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://printflow-production-bb78.up.railway.app/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Interceptor: inject SA token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pf_sa_token');
  if (token) {
    config.headers['x-super-admin-key'] = token;
  }
  return config;
});

// Interceptor: handle 401/403 gracefully
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Don't auto-redirect for login request itself
      const url = error.config?.url || '';
      if (!url.includes('/auth/')) {
        console.warn('[Admin API] Auth error:', error.response?.data?.message);
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: { login: string; password: string }) =>
    api.post('/auth/super-admin/login', data),
  logout: () => api.post('/auth/logout'),
};

export const tenantsApi = {
  findAll: () => api.get('/super-admin/tenants'),
  findOne: (id: string) => api.get(`/super-admin/tenants/${id}`),
  create: (data: any) => api.post('/super-admin/tenants', data),
  createFromLead: (data: { leadId: string; slug: string; planId?: string }) =>
    api.post('/super-admin/tenants/from-lead', data),
  update: (id: string, data: any) => api.put(`/super-admin/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/super-admin/tenants/${id}`),
  getStats: () => api.get('/super-admin/tenants/stats/overview'),
  getPendingPayments: () => api.get('/super-admin/tenants/payments/pending'),
  getAllPayments: () => api.get('/super-admin/tenants/payments/all'),
  approvePayment: (id: string) => api.post(`/super-admin/tenants/payments/${id}/approve`),
  rejectPayment: (id: string) => api.post(`/super-admin/tenants/payments/${id}/reject`),
  getPromoCodes: () => api.get('/billing/admin/promo-codes'),
};

export const plansApi = {
  findAll: () => api.get('/super-admin/plans'),
  create: (data: any) => api.post('/super-admin/plans', data),
  update: (id: string, data: any) => api.put(`/super-admin/plans/${id}`, data),
  delete: (id: string) => api.delete(`/super-admin/plans/${id}`),
};

export const leadsApi = {
  findAll: () => api.get('/leads'),
  updateStatus: (id: string, status: string) => api.post(`/leads/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/leads/${id}`),
};

export const settingsApi = {
  get: (key: string) => api.get(`/billing/settings/${key}`),
  update: (key: string, value: any) => api.put(`/billing/settings/${key}`, { value }),
};

export default api;
