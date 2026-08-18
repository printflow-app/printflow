import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { TrendingUp, Trophy, Activity, Clock, Calendar } from 'lucide-react';
import { kpiApi, reportsApi } from '../api';
import { SkeletonTable } from '../components/Skeleton';
import { EmptyState, StatCard } from '../components/ui';
import EmployeePerformanceTable from '../components/EmployeePerformanceTable';
import KpiPlansPanel from '../components/KpiPlansPanel';

interface KpiRow {
  employeeId: string;
  fullName: string;
  roleName: string | null;
  completedTasks: number;
  movedTasks: number;
  createdTasks: number;
  totalActivity: number;
  avgVelocityHours: number | null;
  lateMinutes: number;
  presentDays: number;
  velocityScore: number;
  pendingTasks: number;
}

interface VelocityRow {
  employeeId: string;
  completedTasks: number;
  totalRevenue: number;
  deadlineMeetRate: number | null;
  velocityScore: number;
}

// Aniq raqam — yumaloqlanmaydi (mingliklar bo'sh joy bilan, kerak bo'lsa tiyingacha).
const fmtNum = (n: number) => {
  const v = Number(n) || 0;
  const hasFraction = Math.abs(v % 1) > 1e-9;
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(v).replace(/,/g, ' ');
};

const localYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const Kpi: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canViewAll = isAdmin || currentUser?.permissions?.canViewKpi;

  const [filter, setFilter] = useState<'today' | 'week' | 'month'>('month');

  // Compute params from filter (re-derived on filter change)
  const today = new Date();
  const startDate = new Date();
  if (filter === 'week') startDate.setDate(today.getDate() - 7);
  else if (filter === 'month') startDate.setDate(today.getDate() - 30);

  const periodDays = filter === 'today' ? 1 : filter === 'week' ? 7 : 30;
  const prevEnd = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - periodDays + 1);

  const bId = activeBranchId || undefined;
  const params = { start: localYMD(startDate), end: localYMD(today), branchId: bId };
  const prevParams = { start: localYMD(prevStart), end: localYMD(prevEnd), branchId: bId };

  // keepPreviousData: filter o'zgarganda eski jadval ko'rinib turadi, to'liq
  // skeleton qaytmaydi — Railway DB sekin javob bersa ham UX uziluvchan emas.
  const listQuery = useQuery({
    queryKey: ['kpi-list', params],
    queryFn: async () => (await kpiApi.list(params)).data || [],
    enabled: canViewAll,
    placeholderData: keepPreviousData,
  });
  const prevListQuery = useQuery({
    queryKey: ['kpi-list-prev', prevParams],
    queryFn: async () => (await kpiApi.list(prevParams)).data || [],
    enabled: canViewAll,
    placeholderData: keepPreviousData,
  });
  const velocityQuery = useQuery({
    queryKey: ['kpi-velocity', params.start, params.end],
    queryFn: async () => (await reportsApi.employeeVelocity({ start: params.start, end: params.end })).data || [],
    enabled: canViewAll,
    placeholderData: keepPreviousData,
  });
  const meQuery = useQuery({
    queryKey: ['kpi-me', params.start, params.end],
    queryFn: async () => (await kpiApi.me({ start: params.start, end: params.end })).data,
    placeholderData: keepPreviousData,
  });

  const rows = (listQuery.data as KpiRow[]) || [];
  const prevRows = (prevListQuery.data as KpiRow[]) || [];
  const velocity = (velocityQuery.data as VelocityRow[]) || [];
  const me = (meQuery.data as KpiRow | null) || null;
  // Render progressively — the leaderboard query can be slow on Railway, but
  // the user-specific KPI ("me") usually comes back in a few hundred ms.
  // Blocking the whole page on listQuery means switching filters feels frozen.
  const tableLoading = listQuery.isLoading || velocityQuery.isLoading;
  const firstPaintLoading = meQuery.isLoading && !meQuery.data && tableLoading && rows.length === 0;

  if (firstPaintLoading) return <SkeletonTable rows={6} cols={6} />;

  const getVelocityData = (empId: string) => velocity.find(v => v.employeeId === empId);
  const getPrevScore = (empId: string) => prevRows.find(r => r.employeeId === empId)?.velocityScore ?? null;


  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* KPI Rejalari (maqsadlar) + bajarilish progressi */}
      <KpiPlansPanel currentUser={currentUser} activeBranchId={activeBranchId} />

      {/* Filter tabs */}
      <div className="bg-white p-4 rounded-card border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="t-h2 flex items-center gap-2">
            <TrendingUp className="text-[color:var(--primary)]" size={20} /> Samaradorlik
          </h2>
          <p className="t-caption mt-0.5">Xodimlar samaradorligi va ish tezligi</p>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-control overflow-x-auto no-scrollbar">
          {(['today', 'week', 'month'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-120 ${filter === f ? 'bg-white shadow-sm text-[color:var(--primary)]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f === 'today' ? 'Bugun' : f === 'week' ? 'Hafta' : 'Oy'}
            </button>
          ))}
        </div>
      </div>

      {/* My KPI */}
      {me && (() => {
        const myVel = getVelocityData(me.employeeId);
        const myPrev = getPrevScore(me.employeeId);
        const diff = myPrev !== null ? me.velocityScore - myPrev : null;
        return (
          <div className="bg-slate-900 p-5 rounded-card text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="label-caps text-slate-400">Sizning samaradorligingiz</p>
                <h3 className="text-lg font-semibold tracking-tight text-white">{me.fullName}</h3>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-2xl font-bold text-orange-400">
                  {me.velocityScore}
                </div>
                {diff !== null && Math.abs(diff) >= 2 && (
                  <span className={`text-xs font-semibold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} oldingi davrga nisbatan
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <div><p className="label-caps text-slate-400">Yopilgan</p><p className="font-semibold text-base tabular-nums">{me.completedTasks}</p></div>
              <div><p className="label-caps text-slate-400">Jarayonda</p><p className="font-semibold text-base text-amber-400 tabular-nums">{me.pendingTasks}</p></div>
              <div><p className="label-caps text-slate-400">Harakatlar</p><p className="font-semibold text-base tabular-nums">{me.totalActivity}</p></div>
              <div><p className="label-caps text-slate-400">Avg vaqt</p><p className="font-semibold text-base tabular-nums">{me.avgVelocityHours ? `${me.avgVelocityHours}h` : '—'}</p></div>
              <div><p className="label-caps text-slate-400">Kelgan kunlar</p><p className="font-semibold text-base tabular-nums">{me.presentDays}</p></div>
              {myVel && <div><p className="label-caps text-slate-400">Daromad</p><p className="font-semibold text-base text-emerald-400 tabular-nums">{fmtNum(myVel.totalRevenue)} <span className="text-xs text-slate-400">UZS</span></p></div>}
            </div>
          </div>
        );
      })()}

      {/* Summary cards */}
      {canViewAll && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard icon={Trophy} tone="brand" label="Lider" value={rows[0]?.fullName?.split(' ')[0] || '—'} subtitle={`${rows[0]?.velocityScore || 0} ball`} />
          <StatCard icon={Activity} tone="brand" label="Jami harakatlar" value={rows.reduce((s, r) => s + r.totalActivity, 0)} />
          <StatCard icon={Calendar} tone="brand" label="Bajarilgan" value={rows.reduce((s, r) => s + r.completedTasks, 0)} />
          <StatCard icon={Clock} tone="brand" label="Kechikishlar (min)" value={rows.reduce((s, r) => s + r.lateMinutes, 0)} />
        </div>
      )}

      {/* Leaderboard with comparison & revenue */}
      {canViewAll && (
        rows.length > 0 ? (
          <EmployeePerformanceTable
            rows={rows}
            velocity={velocity}
            prevRows={prevRows}
            title="Samaradorlik Reytingi"
            showTrend
          />
        ) : tableLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : listQuery.isError || velocityQuery.isError ? (
          <EmptyState
            icon={Activity}
            title="Yuklab bo'lmadi"
            description="So'rov vaqti tugadi yoki server javob bermayapti. Filtrni qisqaroq qiling yoki qayta urinib ko'ring."
            action={{
              label: 'Qayta urinish',
              onClick: () => { listQuery.refetch(); velocityQuery.refetch(); prevListQuery.refetch(); },
            }}
          />
        ) : (
          <EmptyState
            icon={Activity}
            title="Ma'lumot yo'q"
            description="Tanlangan davr uchun KPI ma'lumotlari mavjud emas."
          />
        )
      )}

      {!canViewAll && me && (
        <div className="bg-white p-5 rounded-card border border-slate-200">
          <p className="t-caption leading-relaxed">
            Siz faqat o'zingizning samaradorlik ko'rsatkichlaringizni ko'ra olasiz. Boshqa xodimlarning ma'lumotlarini ko'rish uchun "KPI ko'rish" ruxsati kerak.
          </p>
        </div>
      )}
    </div>
  );
};

export default Kpi;
