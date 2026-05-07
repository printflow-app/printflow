import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, ShoppingBag,
  Minus, RefreshCw, Building2, Calendar, ChevronDown, Award,
  Handshake, Activity, DollarSign, Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { reportsApi, financeApi, branchesApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

// =============================================
// HISOBOTLAR — Tahliliy hisobotlar markazi
// Moliya dinamikasi, xizmat tahlili, hamkor samaradorligi,
// kirim/chiqim turlari, chiqim kategoriyalari, xodim samaradorligi.
// =============================================

const EXPENSE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16'];

const UZ_MONTHS_SHORT = ['Yan', 'Feb', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(Math.round(n));

const fmtFull = (n: number) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(n).replace(/,/g, ' ') + ' UZS';

const localYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const mon = UZ_MONTHS_SHORT[Number(m) - 1] ?? '?';
  return `${mon} '${y.slice(2)}`;
};

const dayLabel = (val: string) => {
  try {
    const d = new Date(val);
    return `${d.getDate()} ${UZ_MONTHS_SHORT[d.getMonth()]}`;
  } catch { return val; }
};

// ── Growth Card ──────────────────────────────
const GrowthCard = ({ label, value, previous, growth, icon, format }: {
  label: string; value: number; previous: number; growth: number | null;
  icon: React.ReactNode; format: (n: number) => string;
}) => {
  const up = growth !== null && growth > 0;
  const dn = growth !== null && growth < 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">{icon}</div>
        {growth !== null ? (
          <span className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : dn ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
            {up ? <TrendingUp size={11} /> : dn ? <TrendingDown size={11} /> : <Minus size={11} />}
            {up ? '+' : ''}{growth}%
          </span>
        ) : <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-400">—</span>}
      </div>
      <div>
        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{format(value)}</h3>
        <p className="text-[10px] font-bold text-slate-400 mt-0.5">O'tgan oy: {format(previous)}</p>
      </div>
    </div>
  );
};

// ── Tooltips ─────────────────────────────────
const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-black text-slate-700">{payload[0].name}</p>
      <p className="font-bold text-orange-600">{fmtFull(payload[0].value)}</p>
    </div>
  );
};

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1 min-w-[160px]">
      <p className="font-black text-slate-500 text-[9px] uppercase tracking-widest">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="font-bold" style={{ color: p.color }}>{p.name}</span>
          <span className="font-black text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Section wrapper ──────────────────────────
const Section = ({ title, sub, icon, children, span2 = false }: {
  title: string; sub: string; icon: React.ReactNode; children: React.ReactNode; span2?: boolean;
}) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden${span2 ? ' lg:col-span-2' : ''}`}>
    <div className="p-5 border-b border-slate-100">
      <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
        {icon} {title}
      </h3>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sub}</p>
    </div>
    {children}
  </div>
);

// ── Pie with legend ──────────────────────────
const PieWithLegend = ({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) => {
  if (!data || data.length === 0) {
    return <div className="p-10 text-center text-slate-400 text-xs font-bold">Ma'lumot yo'q</div>;
  }
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="p-4 flex flex-col gap-4">
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((entry, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="flex-1 text-[11px] font-bold text-slate-700 truncate">{entry.name}</span>
            <span className="text-[10px] font-black text-slate-400">{total > 0 ? Math.round((entry.value / total) * 100) : 0}%</span>
            <span className="text-[10px] font-black text-slate-700 tabular-nums">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Service Stats selector ───────────────────
const ServiceStats = ({ services }: { services: any[] }) => {
  const [selectedId, setSelectedId] = useState<string>(services[0]?.serviceName ?? '');
  const selected = services.find(s => s.serviceName === selectedId) ?? services[0];

  const totalRevenue = selected?.totalRevenue ?? 0;
  const totalTasks = selected?.totalTasks ?? 0;
  const avgCheck = totalTasks > 0 ? Math.round(totalRevenue / totalTasks) : 0;
  const allRevenue = services.reduce((s, x) => s + (x.totalRevenue || 0), 0);
  const share = allRevenue > 0 ? Math.round((totalRevenue / allRevenue) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 size={16} className="text-orange-500" /> Xizmat Hajmi & O'rtacha Chek
          </h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Xizmat tanlang va ko'rsatkichlarni ko'ring</p>
        </div>
        <div className="relative">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 text-xs font-black border-2 border-slate-200 rounded-xl outline-none focus:border-orange-400 bg-white text-slate-700 min-w-[200px] cursor-pointer"
          >
            {services.map(s => (
              <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Orders count */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Buyurtmalar</p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">{totalTasks}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">ta bajarilgan</p>
        </div>

        {/* Total revenue */}
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Jami Daromad</p>
          <p className="text-xl font-black text-emerald-700 tabular-nums leading-tight">
            {totalRevenue >= 1_000_000
              ? `${(totalRevenue / 1_000_000).toFixed(2)} M`
              : `${Math.round(totalRevenue / 1_000)} K`}
          </p>
          <p className="text-[10px] font-bold text-emerald-500 mt-1">{fmtFull(totalRevenue)}</p>
        </div>

        {/* Average check */}
        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-2">O'rtacha Chek</p>
          <p className="text-xl font-black text-orange-700 tabular-nums leading-tight">
            {avgCheck >= 1_000_000
              ? `${(avgCheck / 1_000_000).toFixed(2)} M`
              : `${Math.round(avgCheck / 1_000)} K`}
          </p>
          <p className="text-[10px] font-bold text-orange-400 mt-1">{fmtFull(avgCheck)}</p>
        </div>

        {/* Share of total */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Umumiy ulushi</p>
          <div>
            <p className="text-3xl font-black text-slate-800 tabular-nums">{share}%</p>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${share}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Mini ranking */}
      <div className="px-5 pb-5">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Barcha xizmatlar reytingi (daromad bo'yicha)</p>
        <div className="space-y-2">
          {[...services].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6).map((s, i) => {
            const pct = allRevenue > 0 ? (s.totalRevenue / allRevenue) * 100 : 0;
            const isActive = s.serviceName === selectedId;
            return (
              <button key={s.serviceName} onClick={() => setSelectedId(s.serviceName)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${isActive ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                <span className={`text-[10px] font-black w-4 ${isActive ? 'text-orange-500' : 'text-slate-400'}`}>{i + 1}</span>
                <span className={`flex-1 text-[11px] font-black truncate ${isActive ? 'text-orange-700' : 'text-slate-700'}`}>{s.serviceName}</span>
                <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 text-right">{s.totalTasks} ta</span>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isActive ? 'bg-orange-500' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-[10px] font-black tabular-nums w-16 text-right ${isActive ? 'text-orange-600' : 'text-slate-600'}`}>{fmt(s.totalRevenue)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================
type DatePreset = 'month' | '3month' | '6month' | 'year' | 'custom';

const Hisobotlar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const p = currentUser?.permissions || {};
  const tf = currentUser?.tenantFeatures || {};

  const canViewFinance = isAdmin || p.canViewFinance || p.canViewFinanceReports;
  const canViewKpi = isAdmin || p.canViewKpi;
  const canViewVendors = isAdmin || p.canViewVendors;
  const canViewExpenseCharts = isAdmin || p.canViewExpenseCharts;
  const canViewServiceStats = isAdmin || p.canViewFinance || p.canViewServiceReports;

  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState('');
  const [preset, setPreset] = useState<DatePreset>('3month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Data
  const [growth, setGrowth] = useState<any>(null);
  const [dashStats, setDashStats] = useState<{ totalKirim: number; totalChiqim: number; balance: number } | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<any[]>([]);
  const [dynamics, setDynamics] = useState<any[]>([]);
  const [dynamicsType, setDynamicsType] = useState<'daily' | 'monthly'>('monthly');
  const [paymentStats, setPaymentStats] = useState<{ kirim: any[]; chiqim: any[] }>({ kirim: [], chiqim: [] });
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    branchesApi.findAll().then(r => setBranches(r.data || [])).catch(() => {});
  }, []);

  const getDateParams = useCallback((): { start?: string; end?: string; branchId?: string } => {
    const today = new Date();
    const bid = branchId || undefined;
    switch (preset) {
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: localYMD(start), end: localYMD(today), branchId: bid };
      }
      case '3month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        return { start: localYMD(start), end: localYMD(today), branchId: bid };
      }
      case '6month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        return { start: localYMD(start), end: localYMD(today), branchId: bid };
      }
      case 'year': {
        const start = new Date(today.getFullYear(), 0, 1);
        return { start: localYMD(start), end: localYMD(today), branchId: bid };
      }
      case 'custom':
        return { start: customStart || undefined, end: customEnd || undefined, branchId: bid };
    }
  }, [preset, customStart, customEnd, branchId]);

  const getMonthsCount = () => {
    switch (preset) { case 'month': return 1; case '3month': return 3; case '6month': return 6; case 'year': return 12; default: return 6; }
  };

  const isShortPreset = preset === 'month';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    // Reset state to avoid stale data when filter changes
    setDynamics([]);
    setPaymentStats({ kirim: [], chiqim: [] });
    setExpenseBreakdown([]);
    try {
      const params = getDateParams();

      // Skip fetch if custom preset but dates not fully set
      if (preset === 'custom' && (!params.start || !params.end)) {
        setLoading(false);
        return;
      }

      const calls: Promise<any>[] = [];

      if (canViewFinance) {
        // Dashboard stats (for Jami Chiqim + Sof Foyda)
        calls.push(financeApi.getDashboard({ params }).then(r => setDashStats(r.data)).catch(() => {}));

        // Growth metrics (month-over-month comparison)
        calls.push(reportsApi.growthMetrics({ branchId: params.branchId }).then(r => setGrowth(r.data)).catch(() => {}));

        // Services performance
        calls.push(reportsApi.servicesPerformance(params).then(r => setServices(r.data || [])).catch(() => {}));

        // Financial dynamics — daily for short periods, monthly for long
        if (isShortPreset) {
          calls.push(
            financeApi.getDinamika({ params }).then(r => {
              const raw: any[] = r.data || [];
              const normalized = raw.map(d => ({
                label: dayLabel(d.name),
                kirim: d.kirim || 0,
                chiqim: d.chiqim || 0,
                hamkorlar: 0,
                net: (d.kirim || 0) - (d.chiqim || 0),
              }));
              setDynamics(normalized);
              setDynamicsType('daily');
            }).catch(() => {})
          );
        } else {
          calls.push(
            reportsApi.monthlyDynamics({ months: getMonthsCount(), branchId: params.branchId }).then(r => {
              const normalized = (r.data || []).map((d: any) => ({
                label: monthLabel(d.month),
                kirim: d.kirim || 0,
                chiqim: d.chiqim || 0,
                hamkorlar: d.hamkorlar || 0,
                net: d.net || 0,
              }));
              setDynamics(normalized);
              setDynamicsType('monthly');
            }).catch(() => {})
          );
        }

        // Payment type stats (kirim/chiqim turlari)
        calls.push(financeApi.getStatsByPaymentType({ params }).then(r => setPaymentStats(r.data || { kirim: [], chiqim: [] })).catch(() => {}));

        // Expense breakdown (chiqim tahlili)
        if (canViewExpenseCharts) {
          calls.push(financeApi.getExpenseBreakdown({ params }).then(r => setExpenseBreakdown(r.data || [])).catch(() => {}));
        }
      }

      if (canViewVendors) {
        calls.push(reportsApi.vendorProfitability({ start: params.start, end: params.end }).then(r => setVendors(r.data || [])).catch(() => {}));
      }
      if (canViewKpi) {
        calls.push(reportsApi.employeeVelocity({ start: params.start, end: params.end }).then(r => setVelocity(r.data || [])).catch(() => {}));
      }

      await Promise.all(calls);
    } finally {
      setLoading(false);
    }
  }, [getDateParams, preset, canViewFinance, canViewKpi, canViewVendors, canViewExpenseCharts, isShortPreset, branchId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-5 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-orange-600" size={22} /> Hisobotlar & Tahlil
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Biznes ko'rsatkichlari va chuqur tahlil</p>
        </div>
        <button onClick={fetchAll} className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-all shadow-sm">
          <RefreshCw size={14} /> Yangilash
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <Calendar size={14} /> Davr:
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg shadow-inner">
          {(['month', '3month', '6month', 'year', 'custom'] as DatePreset[]).map((pr) => (
            <button key={pr} onClick={() => setPreset(pr)}
              className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${preset === pr ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>
              {pr === 'month' ? 'Bu oy' : pr === '3month' ? '3 oy' : pr === '6month' ? '6 oy' : pr === 'year' ? 'Bu yil' : 'Boshqa'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-400" />
            <span className="text-slate-400 font-bold text-xs">—</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-orange-400" />
          </div>
        )}
        {tf.multiBranch && branches.length > 1 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Building2 size={14} className="text-slate-400" />
            <div className="relative">
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-black border border-slate-200 rounded-lg outline-none focus:border-orange-400 bg-white">
                <option value="">Barcha filiallar</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* ── Growth Metrics + Finance Stats ── */}
      {(canViewFinance) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Month-over-month growth cards */}
          {canViewFinance && growth && <>
            <GrowthCard label="Bu oy daromad" value={growth.revenue.current} previous={growth.revenue.previous}
              growth={growth.revenue.growth} icon={<DollarSign size={18} />} format={fmtFull} />
            <GrowthCard label="Yangi mijozlar" value={growth.newCustomers.current} previous={growth.newCustomers.previous}
              growth={growth.newCustomers.growth} icon={<Users size={18} />} format={n => String(n)} />
            <GrowthCard label="Bajarilgan buyurtmalar" value={growth.completedTasks.current} previous={growth.completedTasks.previous}
              growth={growth.completedTasks.growth} icon={<ShoppingBag size={18} />} format={n => String(n)} />
          </>}

          {/* Jami Chiqim + Sof Foyda from dashboard */}
          {canViewFinance && dashStats && (
            <>
              <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                  <TrendingDown size={18} />
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Jami Chiqim</p>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{fmtFull(dashStats.totalChiqim)}</h3>
                </div>
              </div>
            </>
          )}
          {canViewFinance && dashStats && !growth && (
            <div className="bg-slate-900 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Sof Foyda</p>
                <h3 className="text-xl font-black text-white tracking-tight">{fmtFull(dashStats.balance)}</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sof Foyda card (when growth is shown, show separately) ── */}
      {canViewFinance && growth && dashStats && (
        <div className="bg-slate-900 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Sof Foyda (Davr)</p>
            <h3 className="text-2xl font-black text-white tracking-tight">{fmtFull(dashStats.balance)}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Wallet size={22} className="text-orange-400" />
          </div>
        </div>
      )}

      {/* ── Moliyaviy Dinamika LineChart ── */}
      {canViewFinance && dynamics.length > 0 && (
        <Section title="Moliyaviy Dinamika" sub={dynamicsType === 'daily' ? 'Kunlik kirim va chiqim' : 'Oylik kirim / chiqim / hamkor xarajati'} icon={<Activity size={16} className="text-orange-500" />} span2>
          <div className="p-4" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
              <LineChart data={dynamics} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<LineTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                <Line type="monotone" name="Kirim" dataKey="kirim" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                <Line type="monotone" name="Chiqim" dataKey="chiqim" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                {dynamicsType === 'monthly' && (
                  <Line type="monotone" name="Hamkorlar" dataKey="hamkorlar" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                )}
                <Line type="monotone" name="Sof foyda" dataKey="net" stroke="#FF6B00" strokeWidth={3} dot={{ r: 4, fill: '#FF6B00', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ── Kirim / Chiqim turlari ── */}
      {canViewFinance && (paymentStats.kirim.length > 0 || paymentStats.chiqim.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Kirim Turlari" sub="To'lov turlari bo'yicha" icon={<TrendingUp size={16} className="text-emerald-500" />}>
            <PieWithLegend data={paymentStats.kirim} colors={['#10b981', '#3b82f6', '#FF6B00', '#6366f1', '#14b8a6', '#f59e0b']} />
          </Section>
          <Section title="Chiqim Turlari" sub="Xarajat turlari bo'yicha" icon={<TrendingDown size={16} className="text-rose-500" />}>
            <PieWithLegend data={paymentStats.chiqim} colors={['#ef4444', '#f59e0b', '#3b82f6', '#6366f1', '#ec4899', '#8b5cf6']} />
          </Section>
        </div>
      )}

      {/* ── Chiqim Tahlili ── */}
      {canViewFinance && canViewExpenseCharts && expenseBreakdown.length > 0 && (
        <Section title="Chiqim Tahlili" sub="Kategoriyalar bo'yicha xarajatlar taqsimoti" icon={<TrendingDown size={16} className="text-rose-500" />} span2>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                    {expenseBreakdown.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2">
              {expenseBreakdown.map((item, i) => {
                const total = expenseBreakdown.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                return (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                      <span className="text-[11px] font-bold text-slate-600 truncate">{item.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] font-black text-slate-800">{fmtFull(item.value)}</p>
                      <p className="text-[9px] font-bold text-slate-400">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ── Hamkor Samaradorligi ── */}
      {canViewVendors && vendors.length > 0 && (
        <Section title="Hamkor Samaradorligi" sub="Subpudrat xarajati va foyda marjasi" icon={<Handshake size={16} className="text-orange-500" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Hamkor</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Xarajat</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Daromad</th>
                  <th className="text-right p-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Marja</th>
                </tr>
              </thead>
              <tbody>
                {vendors.slice(0, 8).map((v: any) => (
                  <tr key={v.vendorId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="font-black text-slate-800">{v.vendorName}</div>
                      {v.specialty && <div className="text-[10px] text-slate-400 font-bold">{v.specialty}</div>}
                    </td>
                    <td className="p-3 text-right font-black text-rose-500 tabular-nums">{fmt(v.totalCost)}</td>
                    <td className="p-3 text-right font-black text-emerald-600 tabular-nums">{fmt(v.linkedRevenue)}</td>
                    <td className="p-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-black text-[10px] ${v.marginPct >= 30 ? 'bg-emerald-50 text-emerald-700' : v.marginPct >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
                        {v.marginPct >= 0 ? '+' : ''}{v.marginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Xizmat Hajmi — select + stat cards ── */}
      {(canViewFinance || canViewServiceStats) && services.length > 0 && (
        <ServiceStats services={services} />
      )}

      {/* ── Employee Velocity ── */}
      {canViewKpi && velocity.length > 0 && (
        <Section title="Xodimlar Samaradorligi" sub="Buyurtmalar, muddatga rioya va daromad ulushi" icon={<Award size={16} className="text-orange-500" />} span2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">#</th>
                  <th className="text-left p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Xodim</th>
                  <th className="text-right p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Bajarilgan</th>
                  <th className="text-right p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Muddatga rioya</th>
                  <th className="text-right p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Avg soat</th>
                  <th className="text-right p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Daromad</th>
                  <th className="text-right p-3.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                </tr>
              </thead>
              <tbody>
                {velocity.map((emp: any, i: number) => {
                  const barPct = Math.round((emp.velocityScore / (velocity[0]?.velocityScore || 1)) * 100);
                  return (
                    <tr key={emp.employeeId} className={`border-t border-slate-100 hover:bg-orange-50/20 transition-colors ${i < 3 ? 'bg-orange-50/10' : ''}`}>
                      <td className="p-3.5 font-black text-slate-500 text-[11px]">{i + 1}</td>
                      <td className="p-3.5">
                        <div className="font-black text-slate-800">{emp.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{emp.roleName || '—'}</div>
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-600">{emp.completedTasks}</td>
                      <td className="p-3.5 text-right">
                        {emp.deadlineMeetRate !== null
                          ? <span className={`font-black ${emp.deadlineMeetRate >= 80 ? 'text-emerald-600' : emp.deadlineMeetRate >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>{emp.deadlineMeetRate}%</span>
                          : <span className="text-slate-300 font-bold">—</span>}
                      </td>
                      <td className="p-3.5 text-right font-bold text-slate-600">{emp.avgTaskHours != null ? `${emp.avgTaskHours}h` : '—'}</td>
                      <td className="p-3.5 text-right font-black text-slate-700 tabular-nums">{fmt(emp.totalRevenue)}</td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden md:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                          </div>
                          <span className="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 rounded-md font-black text-[10px] min-w-[36px] text-center">{emp.velocityScore}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {!canViewFinance && !canViewKpi && !canViewVendors && (
        <div className="text-center py-20 text-slate-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-black text-sm uppercase tracking-widest">Ruxsat yo'q</p>
          <p className="text-xs font-bold mt-1">Hisobotlarni ko'rish uchun administrator bilan bog'laning</p>
        </div>
      )}
    </div>
  );
};

export default Hisobotlar;
