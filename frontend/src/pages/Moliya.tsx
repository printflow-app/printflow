import React, { useState } from 'react';
import { TrendingUp, Filter, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { financeApi, tasksApi } from '../api';
import { useQuery } from '@tanstack/react-query';
import { SkeletonStats } from '../components/Skeleton';
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 px-1">
            <Filter size={18} className="text-[#FF6B00]" /> Filtrlar
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 px-1">Sana bo'yicha tahlil</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
          <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto shadow-inner">
            {(['all', 'today', 'week', 'month'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeFilter === f ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}
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
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125" />
          <div className="relative">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3 border border-emerald-200 shadow-sm">
              <TrendingUp size={18} />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Jami Kirim</p>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">{formatCurrency(dashboard.totalKirim)}</h3>
          </div>
        </div>
        )}

        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125" />
          <div className="relative">
            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3 border border-blue-200 shadow-sm">
              <CheckCircle size={18} />
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Bajarilgan Buyurtmalar</p>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">{dashboard.completedTasks || 0} ta</h3>
          </div>
        </div>

        <div className={`bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden group ${
          overdueOrders > 0 ? 'border-rose-200' : 'border-amber-100'
        }`}>
          <div className={`absolute top-0 right-0 w-24 h-24 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125 ${
            overdueOrders > 0 ? 'bg-rose-50' : 'bg-amber-50'
          }`} />
          <div className="relative">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 border shadow-sm ${
              overdueOrders > 0
                ? 'bg-rose-100 text-rose-600 border-rose-200'
                : 'bg-amber-100 text-amber-600 border-amber-200'
            }`}>
              {overdueOrders > 0 ? <AlertCircle size={18} /> : <Clock size={18} />}
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Bajarilishi Kutilmoqda</p>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">{pendingOrders} ta</h3>
            {overdueOrders > 0 && (
              <p className="text-[9px] font-bold text-rose-500 mt-0.5 flex items-center gap-1">
                <AlertCircle size={10} /> {overdueOrders} ta muddati o'tgan
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Employee KPI / Samaradorlik */}
      <Kpi currentUser={currentUser} activeBranchId={activeBranchId} />
    </>)}
    </div>
  );
};

export default Moliya;
