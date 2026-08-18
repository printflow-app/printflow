import React, { useState } from 'react';
import { TrendingUp, Filter, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { financeApi, tasksApi } from '../api';
import { useQuery } from '@tanstack/react-query';
import { SkeletonStats } from '../components/Skeleton';
import { StatCard } from '../components/ui';
import Kpi from './Kpi';

// =============================================
// STATISTIKA — Joriy operatsion ko'rsatkichlar
// Jami kirim, bajarilgan buyurtmalar + Xodimlar samaradorligi.
// Tahlil grafiklarni va chiqim hisobotlarni → Hisobotlar sahifasiga.
// =============================================

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + ' UZS';

const Moliya: React.FC<{ currentUser?: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdminRole    = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canViewFinance = !!(currentUser?.permissions?.canViewFinance || currentUser?.permissions?.canViewStatistics || isAdminRole);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Branch comes ONLY from the navbar (single source of truth via Dashboard prop).
  const effectiveBranchId = activeBranchId || '';

  const dashParams: any = {};
  if (startDate) dashParams.start = startDate;
  if (endDate) dashParams.end = endDate;
  if (effectiveBranchId) dashParams.branchId = effectiveBranchId;

  const dashboardQuery = useQuery({
    queryKey: ['moliya-dashboard', dashParams],
    queryFn: async () => (await financeApi.getDashboard({ params: dashParams })).data || { totalKirim: 0, totalChiqim: 0, balance: 0, completedTasks: 0 },
    enabled: canViewFinance,
  });
  const tasksQuery = useQuery({
    queryKey: ['moliya-tasks', effectiveBranchId],
    queryFn: async () => (await tasksApi.findAll(effectiveBranchId || undefined)).data || [],
  });

  const dashboard = (dashboardQuery.data as any) || { totalKirim: 0, totalChiqim: 0, balance: 0, completedTasks: 0 };
  const allTasksList: any[] = (tasksQuery.data as any[]) || [];
  const now = new Date();
  const pending = allTasksList.filter(t => !t.isArchived);
  const pendingOrders = pending.length;
  const overdueOrders = pending.filter(t => t.deadlineAt && new Date(t.deadlineAt) < now).length;
  const isLoading = dashboardQuery.isLoading || tasksQuery.isLoading;

  const localYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const setFilter = (type: 'all' | 'today' | 'week' | 'month') => {
    setActiveFilter(type);
    const today = new Date();
    if (type === 'today') {
      const d = localYMD(today); setStartDate(d); setEndDate(d);
    } else if (type === 'week') {
      const w = new Date(); w.setDate(w.getDate() - 7);
      setStartDate(localYMD(w)); setEndDate(localYMD(today));
    } else if (type === 'month') {
      const m = new Date(); m.setDate(m.getDate() - 30);
      setStartDate(localYMD(m)); setEndDate(localYMD(today));
    } else {
      setStartDate(''); setEndDate('');
    }
  };

  // RQ auto-handles fetching — no fetchData() needed.

  return (
    <div className="space-y-4 sm:space-y-6">
      {isLoading && <div className="absolute inset-0 z-10"><SkeletonStats count={3} /></div>}
      {isLoading ? null : (<>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-card border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="t-h2 flex items-center gap-2 px-1">
            <Filter size={18} className="text-[color:var(--primary)]" /> Filtrlar
          </h3>
          <p className="t-caption mt-0.5 px-1">Sana bo'yicha tahlil</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
          <div className="flex bg-slate-100 p-0.5 rounded-control w-full sm:w-auto overflow-x-auto no-scrollbar">
            {(['all', 'today', 'week', 'month'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-120 ${activeFilter === f ? 'bg-white shadow-sm text-[color:var(--primary)]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f === 'all' ? 'Barchasi' : f === 'today' ? 'Bugun' : f === 'week' ? 'Hafta' : 'Oy'}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* KPI Cards — Kirim + Bajarilgan + Kutilmoqda */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {canViewFinance && (
          <StatCard
            label="Jami Kirim"
            value={formatCurrency(dashboard.totalKirim)}
            icon={TrendingUp}
            tone="success"
          />
        )}

        <StatCard
          label="Bajarilgan Buyurtmalar"
          value={`${dashboard.completedTasks || 0} ta`}
          icon={CheckCircle}
          tone="brand"
        />

        <StatCard
          label="Bajarilishi Kutilmoqda"
          value={`${pendingOrders} ta`}
          icon={overdueOrders > 0 ? AlertCircle : Clock}
          tone={overdueOrders > 0 ? 'danger' : 'warning'}
          subtitle={overdueOrders > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-rose-600">
              <AlertCircle size={12} /> {overdueOrders} ta muddati o'tgan
            </span>
          ) : undefined}
        />
      </div>

      {/* Employee KPI / Samaradorlik */}
      <Kpi currentUser={currentUser} activeBranchId={activeBranchId} />
    </>)}
    </div>
  );
};

export default Moliya;
