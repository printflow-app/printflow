import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Trophy, Activity, Clock, Calendar, Minus } from 'lucide-react';
import { kpiApi, reportsApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
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

const Kpi: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canViewAll = isAdmin || currentUser?.permissions?.canViewKpi;

  const [rows, setRows] = useState<KpiRow[]>([]);
  const [prevRows, setPrevRows] = useState<KpiRow[]>([]);
  const [velocity, setVelocity] = useState<VelocityRow[]>([]);
  const [me, setMe] = useState<KpiRow | null>(null);
  const [filter, setFilter] = useState<'today' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startDate = new Date();
      if (filter === 'today') {
        // same day — no shift
      } else if (filter === 'week') {
        startDate.setDate(today.getDate() - 7);
      } else {
        startDate.setDate(today.getDate() - 30);
      }

      // Previous period (same length, shifted back)
      const periodDays = filter === 'today' ? 1 : filter === 'week' ? 7 : 30;
      const prevEnd = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - periodDays + 1);

      const params = { start: localYMD(startDate), end: localYMD(today) };
      const prevParams = { start: localYMD(prevStart), end: localYMD(prevEnd) };

      const calls: Promise<any>[] = [];
      if (canViewAll) {
        calls.push(kpiApi.list(params));
        calls.push(kpiApi.list(prevParams));
        calls.push(reportsApi.employeeVelocity(params));
      } else {
        calls.push(Promise.resolve({ data: [] }));
        calls.push(Promise.resolve({ data: [] }));
        calls.push(Promise.resolve({ data: [] }));
      }
      calls.push(kpiApi.me(params));

      const [listRes, prevRes, velocityRes, meRes] = await Promise.all(calls);
      setRows(Array.isArray(listRes.data) ? listRes.data : []);
      setPrevRows(Array.isArray(prevRes.data) ? prevRes.data : []);
      setVelocity(Array.isArray(velocityRes.data) ? velocityRes.data : []);
      setMe(meRes.data || null);
    } catch (err) {
      console.error('KPI yuklashda xato:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  if (loading) return <LoadingSpinner fullPage />;

  const getVelocityData = (empId: string) => velocity.find(v => v.employeeId === empId);
  const getPrevScore = (empId: string) => prevRows.find(r => r.employeeId === empId)?.velocityScore ?? null;


  const StatCard = ({ icon, label, value, hint }: any) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100">{icon}</div>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
      {hint && <p className="text-[10px] font-bold text-slate-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Filter tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-orange-600" size={22} /> Samaradorlik
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Xodimlar samaradorligi va ish tezligi</p>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg shadow-inner">
          {(['today', 'week', 'month'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${filter === f ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
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
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sizning samaradorligingiz</p>
                <h3 className="text-lg font-black tracking-tight text-white">{me.fullName}</h3>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-2xl font-black text-orange-400">
                  {me.velocityScore}
                </div>
                {diff !== null && Math.abs(diff) >= 2 && (
                  <span className={`text-[9px] font-black ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {diff > 0 ? '▲' : '▼'} {Math.abs(diff)} oldingi davrga nisbatan
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-[11px]">
              <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Yopilgan</p><p className="font-black text-base">{me.completedTasks}</p></div>
              <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Jarayonda</p><p className="font-black text-base text-amber-400">{me.pendingTasks}</p></div>
              <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Harakatlar</p><p className="font-black text-base">{me.totalActivity}</p></div>
              <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Avg vaqt</p><p className="font-black text-base">{me.avgVelocityHours ? `${me.avgVelocityHours}h` : '—'}</p></div>
              <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Kelgan kunlar</p><p className="font-black text-base">{me.presentDays}</p></div>
              {myVel && <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Daromad</p><p className="font-black text-base text-emerald-400">{fmt(myVel.totalRevenue)}</p></div>}
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
      {canViewAll && rows.length > 0 && (
        <EmployeePerformanceTable 
          rows={rows} 
          velocity={velocity} 
          prevRows={prevRows}
          title="Samaradorlik Reytingi" 
          showTrend
        />
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
