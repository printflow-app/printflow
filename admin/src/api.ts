import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const authApi = {
  login: (data: { login: string; password: string }) =>
    api.post('/auth/super-admin/login', data),
  logout: () => api.post('/auth/logout'),
};

export const tenantsApi = {
  findAll: () => api.get('/super-admin/tenants'),
  findOne: (id: string) => api.get(`/super-admin/tenants/${id}`),
  create: (data: any) => api.post('/super-admin/tenants', data),
  update: (id: string, data: any) => api.put(`/super-admin/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/super-admin/tenants/${id}`),
  getStats: () => api.get('/super-admin/tenants/stats/overview'),
};

export const leadsApi = {
  findAll: () => api.get('/leads'),
  updateStatus: (id: string, status: string) => api.post(`/leads/${id}/status`, { status })
};

export default api;
