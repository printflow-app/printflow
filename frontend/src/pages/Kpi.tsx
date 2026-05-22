import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { TrendingUp, Trophy, Activity, Clock, Calendar } from 'lucide-react';
import { kpiApi, reportsApi } from '../api';
import { SkeletonTable } from '../components/Skeleton';
import EmployeePerformanceTable from '../components/EmployeePerformanceTable';

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

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);

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


  const StatCard = ({ icon, label, value, hint }: any) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100">{icon}</div>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
      {hint && <p className="text-[10px] font-bold text-slate-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Filter tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-orange-600" size={22} /> Samaradorlik
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xodimlar samaradorligi va ish tezligi</p>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg shadow-inner">
          {(['today', 'week', 'month'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${filter === f ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
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
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Sizning samaradorligingiz</p>
                <h3 className="text-lg font-bold tracking-tight text-white">{me.fullName}</h3>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-2xl font-bold text-orange-400">
                  {me.velocityScore}
                </div>
                {diff !== null && Math.abs(diff) >= 2 && (
                  <span className={`text-[9px] font-bold ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} oldingi davrga nisbatan
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-[11px]">
              <div><p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Yopilgan</p><p className="font-bold text-base">{me.completedTasks}</p></div>
              <div><p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Jarayonda</p><p className="font-bold text-base text-amber-400">{me.pendingTasks}</p></div>
              <div><p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Harakatlar</p><p className="font-bold text-base">{me.totalActivity}</p></div>
              <div><p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Avg vaqt</p><p className="font-bold text-base">{me.avgVelocityHours ? `${me.avgVelocityHours}h` : '—'}</p></div>
              <div><p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Kelgan kunlar</p><p className="font-bold text-base">{me.presentDays}</p></div>
              {myVel && <div><p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Daromad</p><p className="font-bold text-base text-emerald-400">{fmt(myVel.totalRevenue)}</p></div>}
            </div>
          </div>
        );
      })()}

      {/* Summary cards */}
      {canViewAll && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard icon={<Trophy size={18} />} label="Lider" value={rows[0]?.fullName?.split(' ')[0] || '—'} hint={`${rows[0]?.velocityScore || 0} ball`} />
          <StatCard icon={<Activity size={18} />} label="Jami harakatlar" value={rows.reduce((s, r) => s + r.totalActivity, 0)} />
          <StatCard icon={<Calendar size={18} />} label="Bajarilgan" value={rows.reduce((s, r) => s + r.completedTasks, 0)} />
          <StatCard icon={<Clock size={18} />} label="Kechikishlar (min)" value={rows.reduce((s, r) => s + r.lateMinutes, 0)} />
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
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Activity size={28} className="text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-rose-600 uppercase tracking-tight mb-2">Yuklab bo'lmadi</h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed mb-4">
              So'rov vaqti tugadi yoki server javob bermayapti. Filtrni qisqaroq qiling yoki qayta urinib ko'ring.
            </p>
            <button onClick={() => { listQuery.refetch(); velocityQuery.refetch(); prevListQuery.refetch(); }}
              className="px-4 py-2 bg-orange-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-orange-700">
              Qayta urinish
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Activity size={28} className="text-orange-400" />
            </div>
            <h3 className="text-base font-bold text-slate-700 uppercase tracking-tight mb-2">Ma'lumot yo'q</h3>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
              Tanlangan davr uchun KPI ma'lumotlari mavjud emas.
            </p>
          </div>
        )
      )}

      {!canViewAll && me && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 leading-relaxed">
            Siz faqat o'zingizning samaradorlik ko'rsatkichlaringizni ko'ra olasiz. Boshqa xodimlarning ma'lumotlarini ko'rish uchun "KPI ko'rish" ruxsati kerak.
          </p>
        </div>
      )}
    </div>
  );
};

export default Kpi;
