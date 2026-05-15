// =============================================
// ADMIN — Shared constants and helpers
// Extracted from the original App.tsx monolith.
// =============================================

export const STATUS_COLORS: Record<string, string> = {
  TRIAL: '#3b82f6',
  ACTIVE: '#10b981',
  EXPIRED: '#ef4444',
  PENDING_PAYMENT: '#f59e0b',
};

export const STATUS_LABELS: Record<string, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Faol',
  EXPIRED: 'Tugagan',
  PENDING_PAYMENT: "To'lov",
};

/** Attendance percentage for the day = today's check-ins / total employees */
export const getAttPct = (t: any) =>
  t._count?.employees
    ? Math.min(100, Math.round(((t.attendanceTodayCount || 0) / t._count.employees) * 100))
    : 0;

/** How many of the 4 core modules the tenant is actively using */
export const getActiveModules = (t: any) =>
  [
    (t._count?.employees || 0) > 0,
    ((t.activeTasksCount ?? t._count?.tasks) || 0) > 0,
    (t._count?.customers || 0) > 0,
    (t.attendanceTodayCount || 0) > 0,
  ].filter(Boolean).length;

// ========== UNIFIED PAGE & MODULE ACCESS ==========
export const ALLOWED_MODULES = [
  { key: 'finance',       label: 'Kassa (Moliya)',      icon: '💰', desc: 'Tranzaksiyalar va kassa' },
  { key: 'statistics',    label: 'Statistika',         icon: '📈', desc: 'Tahliliy grafiklar' },
  { key: 'reports',       label: 'Hisobotlar',         icon: '📊', desc: 'KPI va chuqur tahlillar' },
  { key: 'kanban',        label: 'Kanban (Xizmatlar)',  icon: '📋', desc: 'Buyurtmalar ish oqimi' },
  { key: 'customers',     label: 'Mijozlar bazasi',     icon: '👥', desc: 'CRM va mijozlar hisobi' },
  { key: 'employees',     label: 'Xodimlar',           icon: '👨‍🔧', desc: 'Xodimlar va rollar' },
  { key: 'administration', label: 'Ma\'muriyat',        icon: '🛡️', desc: 'Tizim nazorati' },
  { key: 'inventory',     label: 'Ombor',              icon: '📦', desc: 'Materiallar va stok' },
  { key: 'attendance',    label: 'Davomat',            icon: '🕐', desc: 'Keldi-ketdi nazorati' },
  { key: 'partners',      label: 'Hamkorlar',          icon: '🤝', desc: 'Vendor va hamkorlar' },
  { key: 'settings',      label: 'Tizim sozlamalari',   icon: '⚙️', desc: 'Tizim konfiguratsiyasi' },
  { key: 'branches',      label: 'Filiallar',          icon: '🏢', desc: 'Filiallar boshqaruvi' },
  { key: 'subscriptions', label: 'Obuna va to\'lovlar', icon: '💳', desc: 'Billing va tariflar' },
  { key: 'ai_chat',       label: 'AI Copilot',         icon: '🤖', desc: 'AI chatbot yordamchisi' },
];

export const defaultPlanForm = () => ({
  name: '', displayName: '', price3m: 0, price6m: 0, price12m: 0,
  maxEmployees: 8, maxBranches: 1, maxDepartments: 1, allowedModules: [] as string[],
  description: '', isPopular: false, sortOrder: 0,
});
