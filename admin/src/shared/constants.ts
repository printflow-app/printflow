// =============================================
// ADMIN — Shared constants and helpers
// Extracted from the original App.tsx monolith.
// =============================================

import {
  Wallet, TrendingUp, BarChart3, ClipboardList, UserSquare2, Users,
  ShieldCheck, PackageOpen, Clock, Handshake, Settings, Building2,
  CreditCard, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
// `icon` — Lucide component (rendered by callers as <mod.icon size={...} />)
export const ALLOWED_MODULES: { key: string; label: string; icon: LucideIcon; desc: string }[] = [
  { key: 'finance',       label: 'Kassa (Moliya)',      icon: Wallet,        desc: 'Tranzaksiyalar va kassa' },
  { key: 'statistics',    label: 'Statistika',          icon: TrendingUp,    desc: 'Tahliliy grafiklar' },
  { key: 'reports',       label: 'Hisobotlar',          icon: BarChart3,     desc: 'KPI va chuqur tahlillar' },
  { key: 'kanban',        label: 'Kanban (Xizmatlar)',  icon: ClipboardList, desc: 'Buyurtmalar ish oqimi' },
  { key: 'customers',     label: 'Mijozlar bazasi',     icon: UserSquare2,   desc: 'CRM va mijozlar hisobi' },
  { key: 'employees',     label: 'Xodimlar',            icon: Users,         desc: 'Xodimlar va rollar' },
  { key: 'administration', label: 'Ma\'muriyat',        icon: ShieldCheck,   desc: 'Tizim nazorati' },
  { key: 'inventory',     label: 'Ombor',               icon: PackageOpen,   desc: 'Materiallar va stok' },
  { key: 'attendance',    label: 'Davomat',             icon: Clock,         desc: 'Keldi-ketdi nazorati' },
  { key: 'partners',      label: 'Hamkorlar',           icon: Handshake,     desc: 'Vendor va hamkorlar' },
  { key: 'settings',      label: 'Tizim sozlamalari',   icon: Settings,      desc: 'Tizim konfiguratsiyasi' },
  { key: 'branches',      label: 'Filiallar',           icon: Building2,     desc: 'Filiallar boshqaruvi' },
  { key: 'subscriptions', label: 'Obuna va to\'lovlar', icon: CreditCard,    desc: 'Billing va tariflar' },
  { key: 'ai_chat',       label: 'AI Copilot',          icon: Sparkles,      desc: 'AI chatbot yordamchisi' },
];

// Yagona tarif tizimi: admin faqat oylik baza narxni kiritadi,
// umumiy narx shu bazadan avtomatik hisoblanadi.
//
// 6 OYLIK VARIANT OLIB TASHLANDI — endi faqat 12 oylik taklif qilinadi.
export const PLAN_DURATION_DISCOUNTS = { 12: 0.10 } as const;

/** 6 oylik narx eski yozuvlardan qayta hisoblash uchun ishlatilgan chegirma. */
export const ESKI_6OY_CHEGIRMA = 0.05;

export const computePlanPrices = (monthlyPrice: number) => ({
  price3m: Math.round(monthlyPrice * 3),
  // 6 oylik endi sotilmaydi. Bazadagi ustun qoldirildi (tarixiy to'lovlar
  // unga tayanadi), lekin qiymat 0 ga tushiriladi: eskirgan narx keyinchalik
  // "bor ekan" deb ko'rinib qolmasin.
  price6m: 0,
  price12m: Math.round(monthlyPrice * 12 * (1 - PLAN_DURATION_DISCOUNTS[12])),
});

export const defaultPlanForm = () => ({
  name: '', displayName: '', monthlyPrice: 500000,
  maxEmployees: 8, maxBranches: 1, maxDepartments: 1,
  aiMessagesPerMonth: 100,
  allowedModules: [] as string[],
  description: '', isPopular: false, sortOrder: 0,
});
