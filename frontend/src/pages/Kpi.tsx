import React, { useEffect, useState } from 'react';
import { TrendingUp, Trophy, Activity, Clock, Calendar } from 'lucide-react';
import { kpiApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

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
}

const localYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const Kpi: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canViewAll = isAdmin || currentUser?.permissions?.canViewKpi;

  const [rows, setRows] = useState<KpiRow[]>([]);
  const [me, setMe] = useState<KpiRow | null>(null);
  const [filter, setFilter] = useState<'today' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startDate = new Date();
      if (filter === 'today') {
        // same day
      } else if (filter === 'week') startDate.setDate(today.getDate() - 7);
      else startDate.setDate(today.getDate() - 30);

      const params = { start: localYMD(startDate), end: localYMD(today) };
      const calls: Promise<any>[] = [];
      if (canViewAll) calls.push(kpiApi.list(params));
      else calls.push(Promise.resolve({ data: [] }));
      calls.push(kpiApi.me(params));

      const [listRes, meRes] = await Promise.all(calls);
      setRows(Array.isArray(listRes.data) ? listRes.data : []);
      setMe(meRes.data || null);
    } catch (err) {
      console.error('KPI yuklashda xato:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  if (loading) return <LoadingSpinner fullPage />;

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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <TrendingUp className="text-orange-600" size={22} /> KPI &amp; Velocity
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
      {me && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sizning KPI'ingiz</p>
              <h3 className="text-lg font-black tracking-tight">{me.fullName}</h3>
            </div>
            <div className="w-14 h-14 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-2xl font-black text-orange-400">
              {me.velocityScore}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
            <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Yopilgan</p><p className="font-black text-base">{me.completedTasks}</p></div>
            <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Harakatlar</p><p className="font-black text-base">{me.totalActivity}</p></div>
            <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Avg vaqt</p><p className="font-black text-base">{me.avgVelocityHours ? `${me.avgVelocityHours} soat` : '—'}</p></div>
            <div><p className="text-slate-400 font-black uppercase tracking-widest text-[8px]">Kelgan kunlar</p><p className="font-black text-base">{me.presentDays}</p></div>
          </div>
        </div>
      )}

      {/* Summary cards (admin/can-view) */}
      {canViewAll && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Trophy size={18} />} label="Lider" value={rows[0]?.fullName?.split(' ')[0] || '—'} hint={`${rows[0]?.velocityScore || 0} ball`} />
          <StatCard icon={<Activity size={18} />} label="Jami harakatlar" value={rows.reduce((s, r) => s + r.totalActivity, 0)} />
          <StatCard icon={<Calendar size={18} />} label="Bajarilgan" value={rows.reduce((s, r) => s + r.completedTasks, 0)} />
          <StatCard icon={<Clock size={18} />} label="Kechikishlar (min)" value={rows.reduce((s, r) => s + r.lateMinutes, 0)} />
        </div>
      )}

      {/* Leaderboard */}
      {canViewAll && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-800 tracking-tight">Reyting jadvali</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Velocity score bo'yicha tartiblangan</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">#</th>
                  <th className="text-left p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Xodim</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Yopilgan</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Harakatlar</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Avg soat</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Kechikish</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400 font-bold text-xs uppercase">Ma'lumot yo'q</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r.employeeId} className={`border-t border-slate-100 ${i < 3 ? 'bg-orange-50/30' : ''}`}>
                    <td className="p-3 font-black text-slate-600">{i + 1}</td>
                    <td className="p-3"><div className="font-black text-slate-800">{r.fullName}</div><div className="text-[10px] text-slate-400 font-bold">{r.roleName || '—'}</div></td>
                    <td className="p-3 text-right font-black text-emerald-600">{r.completedTasks}</td>
                    <td className="p-3 text-right font-bold text-slate-700">{r.totalActivity}</td>
                    <td className="p-3 text-right font-bold text-slate-700">{r.avgVelocityHours != null ? r.avgVelocityHours : '—'}</td>
                    <td className="p-3 text-right font-bold text-rose-500">{r.lateMinutes}</td>
                    <td className="p-3 text-right">
                      <span className="inline-block px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md font-black text-xs">{r.velocityScore}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!canViewAll && me && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 leading-relaxed">
            Siz faqat o'zingizning KPI ko'rsatkichlaringizni ko'ra olasiz. Boshqa xodimlarning ma'lumotlarini ko'rish uchun "KPI ko'rish" ruxsati kerak.
          </p>
        </div>
      )}
    </div>
  );
};

export default Kpi;
