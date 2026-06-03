import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, ShoppingBag,
  Minus, RefreshCw, Calendar, ChevronDown,
  Handshake, Activity, DollarSign, Wallet, Search, Package, Plus, Trash2, Download, X,
} from 'lucide-react';
import { exportMultiSheetXlsx, ExportSheet } from '../utils/exportToXlsx';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { reportsApi, financeApi, tasksApi, taskExpensesApi, kpiApi } from '../api';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useDepartments } from '../hooks/queries';
import { SkeletonStats, SkeletonCardGrid } from '../components/Skeleton';
import EmployeePerformanceTable from '../components/EmployeePerformanceTable';

// =============================================
// HISOBOTLAR — Tahliliy hisobotlar markazi
// Moliya dinamikasi, xizmat tahlili, hamkor samaradorligi,
// kirim/chiqim turlari, chiqim kategoriyalari, xodim samaradorligi.
// =============================================

const EXPENSE_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#84cc16'];

const UZ_MONTHS_SHORT = ['Yan', 'Feb', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(Math.round(n));

// Aniq raqam — yumaloqlanmaydi. Butun bo'lsa kasr ko'rsatilmaydi, aks holda
// tiyingacha (2 xona) ko'rsatiladi. Mingliklar bo'sh joy bilan ajratiladi.
const fmtNum = (n: number) => {
  const v = Number(n) || 0;
  const hasFraction = Math.abs(v % 1) > 1e-9;
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(v).replace(/,/g, ' ');
};

const fmtFull = (n: number) => `${fmtNum(n)} UZS`;

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
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : dn ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
            {up ? <TrendingUp size={11} /> : dn ? <TrendingDown size={11} /> : <Minus size={11} />}
            {up ? '+' : ''}{growth}%
          </span>
        ) : <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-400">—</span>}
      </div>
      <div>
        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{format(value)}</h3>
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
      <p className="font-bold text-slate-700">{payload[0].name}</p>
      <p className="font-bold text-orange-600">{fmtFull(payload[0].value)}</p>
    </div>
  );
};

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs space-y-1 min-w-[160px]">
      <p className="font-bold text-slate-500 text-[9px] uppercase tracking-widest">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="font-bold" style={{ color: p.color }}>{p.name}</span>
          <span className="font-bold text-slate-800 tabular-nums">{fmtNum(p.value)} UZS</span>
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
      <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
        {icon} {title}
      </h3>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sub}</p>
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
            <span className="text-[10px] font-bold text-slate-400">{total > 0 ? Math.round((entry.value / total) * 100) : 0}%</span>
            <span className="text-[10px] font-bold text-slate-700 tabular-nums whitespace-nowrap">{fmtNum(entry.value)}</span>
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
          <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 size={16} className="text-orange-500" /> Xizmat Hajmi & O'rtacha Chek
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xizmat tanlang va ko'rsatkichlarni ko'ring</p>
        </div>
        <div className="relative">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="select-minimal text-xs font-bold min-w-[200px]"
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
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Buyurtmalar</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{totalTasks}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">ta bajarilgan</p>
        </div>

        {/* Total revenue — aniq qiymat (yumaloqlanmaydi) */}
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Jami Daromad</p>
          <p className="text-lg font-bold text-emerald-700 tabular-nums leading-tight break-all">
            {fmtNum(totalRevenue)}
          </p>
          <p className="text-[10px] font-bold text-emerald-500 mt-1">UZS</p>
        </div>

        {/* Average check — aniq qiymat (yumaloqlanmaydi) */}
        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
          <p className="text-[9px] font-bold uppercase tracking-widest text-orange-500 mb-2">O'rtacha Chek</p>
          <p className="text-lg font-bold text-orange-700 tabular-nums leading-tight break-all">
            {fmtNum(avgCheck)}
          </p>
          <p className="text-[10px] font-bold text-orange-400 mt-1">UZS</p>
        </div>

        {/* Share of total */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Umumiy ulushi</p>
          <div>
            <p className="text-3xl font-bold text-slate-800 tabular-nums">{share}%</p>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${share}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Mini ranking */}
      <div className="px-5 pb-5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3">Barcha xizmatlar reytingi (daromad bo'yicha)</p>
        <div className="space-y-2">
          {[...services].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 6).map((s, i) => {
            const pct = allRevenue > 0 ? (s.totalRevenue / allRevenue) * 100 : 0;
            const isActive = s.serviceName === selectedId;
            return (
              <button key={s.serviceName} onClick={() => setSelectedId(s.serviceName)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${isActive ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                <span className={`text-[10px] font-bold w-4 ${isActive ? 'text-orange-500' : 'text-slate-400'}`}>{i + 1}</span>
                <span className={`flex-1 text-[11px] font-bold truncate ${isActive ? 'text-orange-700' : 'text-slate-700'}`}>{s.serviceName}</span>
                <span className="text-[10px] font-bold text-slate-400 tabular-nums w-10 text-right">{s.totalTasks} ta</span>
                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isActive ? 'bg-orange-500' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-[10px] font-bold tabular-nums text-right whitespace-nowrap pl-1 ${isActive ? 'text-orange-600' : 'text-slate-600'}`}>{fmtNum(s.totalRevenue)}</span>
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

const Hisobotlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const p = currentUser?.permissions || {};

  // Hisobotlar — har bo'lim uchun alohida ruxsat
  const canViewGrowthCards   = isAdmin || p.canViewGrowthCards;
  const canViewDynamics      = isAdmin || p.canViewFinanceReports;
  const canViewIncomeByType  = isAdmin || p.canViewIncomeByType;
  const canViewExpenseByType = isAdmin || p.canViewExpenseByType;
  const canViewExpenseCharts = isAdmin || p.canViewExpenseCharts;
  const canViewServiceStats  = isAdmin || p.canViewServiceReports;
  const canViewKpi           = isAdmin || p.canViewKpi;
  const canViewVendors       = isAdmin || p.canViewVendors;
  const canViewCostCalc      = isAdmin || p.canViewCostCalculator;

  // Moliyaviy API chaqiruvlari uchun yig'ma flag
  const needsFinanceData = canViewGrowthCards || canViewDynamics || canViewIncomeByType || canViewExpenseByType || canViewExpenseCharts || canViewServiceStats;

  // Branch comes ONLY from the navbar (SSOT). No mirror, no per-page selector.
  const branchId = activeBranchId || '';
  const [departmentId, setDepartmentId] = useState('');
  // Group-by-department toggle for the local breakdown card (client-side aggregation).
  const [groupByDept, setGroupByDept] = useState(false);
  const [preset, setPreset] = useState<DatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Departments — via RQ
  const { data: departments = [] } = useDepartments(branchId || undefined);

  // Tannarx Kalkulyatori
  const [costingQuery, setCostingQuery] = useState('');
  const [costingTask, setCostingTask] = useState<any>(null);
  const [costingExpenses, setCostingExpenses] = useState<any[]>([]);
  const [isSearchingCosting, setIsSearchingCosting] = useState(false);
  const [costingError, setCostingError] = useState('');
  const [expenseForm, setExpenseForm] = useState({ expenseName: '', amount: '' });
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Reset departmentId when branch changes (department from other branch is meaningless)
  useEffect(() => { setDepartmentId(''); }, [branchId]);

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

  // ============ RQ Queries — har biri o'z cache key bilan ============
  const params = getDateParams();
  const financeParams = { ...params, ...(departmentId ? { departmentId } : {}) };
  const canRunCustom = preset !== 'custom' || (!!params.start && !!params.end);

  // keepPreviousData: filter o'zgarganda eski jadval/grafiklar ko'rinib turadi,
  // har safar bo'sh skeleton'ga qaytmaydi.
  // Sof Foyda dashboard stats
  const dashStatsQuery = useQuery({
    queryKey: ['report-dashStats', financeParams],
    queryFn: async () => (await financeApi.getDashboard({ params: financeParams })).data,
    enabled: needsFinanceData && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const dashStats = dashStatsQuery.data as { totalKirim: number; totalChiqim: number; balance: number } | null;

  // O'sish ko'rsatkichlari
  const growthQuery = useQuery({
    queryKey: ['report-growth', params.branchId, departmentId],
    queryFn: async () => (await reportsApi.growthMetrics({ branchId: params.branchId, departmentId: departmentId || undefined })).data,
    enabled: canViewGrowthCards && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const growth = growthQuery.data as any;

  // Xizmat Hajmi & O'rtacha Chek
  const servicesQuery = useQuery({
    queryKey: ['report-services', params],
    queryFn: async () => (await reportsApi.servicesPerformance(params)).data || [],
    enabled: canViewServiceStats && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const services = (servicesQuery.data as any[]) || [];

  // Dinamika — daily yoki monthly (faqat biri ishlaydi)
  const dynamicsDailyQuery = useQuery({
    queryKey: ['report-dinamika-daily', financeParams],
    queryFn: async () => {
      const r = await financeApi.getDinamika({ params: financeParams });
      return (r.data || []).map((d: any) => ({
        label: dayLabel(d.name), kirim: d.kirim || 0, chiqim: d.chiqim || 0,
        hamkorlar: d.hamkorlar || 0, net: (d.kirim || 0) - (d.chiqim || 0) - (d.hamkorlar || 0),
      }));
    },
    enabled: canViewDynamics && isShortPreset && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const dynamicsMonthlyQuery = useQuery({
    queryKey: ['report-dinamika-monthly', getMonthsCount(), params.branchId, departmentId],
    queryFn: async () => {
      const r = await reportsApi.monthlyDynamics({ months: getMonthsCount(), branchId: params.branchId, departmentId: departmentId || undefined });
      return (r.data || []).map((d: any) => ({
        label: monthLabel(d.month), kirim: d.kirim || 0, chiqim: d.chiqim || 0,
        hamkorlar: d.hamkorlar || 0, net: d.net || 0,
      }));
    },
    enabled: canViewDynamics && !isShortPreset && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const dynamics = isShortPreset ? (dynamicsDailyQuery.data as any[] || []) : (dynamicsMonthlyQuery.data as any[] || []);
  const dynamicsType: 'daily' | 'monthly' = isShortPreset ? 'daily' : 'monthly';

  // Payment type stats (kirim/chiqim distribution)
  const paymentStatsQuery = useQuery({
    queryKey: ['report-paymentStats', financeParams],
    queryFn: async () => (await financeApi.getStatsByPaymentType({ params: financeParams })).data || { kirim: [], chiqim: [] },
    enabled: (canViewIncomeByType || canViewExpenseByType) && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const paymentStats = (paymentStatsQuery.data as { kirim: any[]; chiqim: any[] }) || { kirim: [], chiqim: [] };

  // Chiqim Tahlili (Expense breakdown)
  const expenseQuery = useQuery({
    queryKey: ['report-expenseBreakdown', financeParams],
    queryFn: async () => (await financeApi.getExpenseBreakdown({ params: financeParams })).data || [],
    enabled: canViewExpenseCharts && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const expenseBreakdown = (expenseQuery.data as any[]) || [];

  // Vendor profitability
  const vendorsQuery = useQuery({
    queryKey: ['report-vendors', params.start, params.end],
    queryFn: async () => (await reportsApi.vendorProfitability({ start: params.start, end: params.end })).data || [],
    enabled: canViewVendors && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const vendors = (vendorsQuery.data as any[]) || [];

  // All tasks (cost calculator + department grouping)
  const allTasksQuery = useQuery({
    queryKey: ['report-allTasks', params.branchId],
    queryFn: async () => (await tasksApi.findAll(params.branchId)).data || [],
    enabled: (canViewCostCalc || canViewGrowthCards || canViewServiceStats) && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const allTasks = (allTasksQuery.data as any[]) || [];

  // KPI + velocity
  const velocityQuery = useQuery({
    queryKey: ['report-velocity', params.start, params.end],
    queryFn: async () => (await reportsApi.employeeVelocity({ start: params.start, end: params.end })).data || [],
    enabled: canViewKpi && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const velocity = (velocityQuery.data as any[]) || [];
  const kpiQuery = useQuery({
    queryKey: ['report-kpi', params.start, params.end],
    queryFn: async () => (await kpiApi.list({ start: params.start, end: params.end })).data || [],
    enabled: canViewKpi && canRunCustom,
    placeholderData: keepPreviousData,
  });
  const kpiRows = (kpiQuery.data as any[]) || [];

  // Show a brief skeleton only on the very first render when nothing is in
  // cache yet. Once any section has data we render progressively — blocking
  // the entire page on the slowest query (KPI on Railway can be 10s+) makes
  // the app feel frozen even when most data is already back.
  const hasAnyData = !!(
    growthQuery.data || dashStatsQuery.data || servicesQuery.data ||
    dynamicsDailyQuery.data || dynamicsMonthlyQuery.data ||
    paymentStatsQuery.data || expenseQuery.data || vendorsQuery.data ||
    kpiQuery.data || velocityQuery.data
  );
  const firstLoad = !hasAnyData && [
    dashStatsQuery, growthQuery, servicesQuery, dynamicsDailyQuery, dynamicsMonthlyQuery,
    paymentStatsQuery, expenseQuery,
  ].some(q => q.isLoading && q.fetchStatus !== 'idle');

  const handleAddCostingExpense = async () => {
    if (!costingTask || !expenseForm.expenseName.trim() || !expenseForm.amount) return;
    setIsAddingExpense(true);
    try {
      await taskExpensesApi.create(costingTask.id, {
        expenseName: expenseForm.expenseName.trim(),
        amount: Number(expenseForm.amount),
      });
      setExpenseForm({ expenseName: '', amount: '' });
      const expRes = await taskExpensesApi.list(costingTask.id);
      setCostingExpenses(expRes.data || []);
    } catch { /* silent */ } finally {
      setIsAddingExpense(false);
    }
  };

  const handleDeleteCostingExpense = async (expenseId: string) => {
    if (!costingTask) return;
    try {
      await taskExpensesApi.remove(costingTask.id, expenseId);
      const expRes = await taskExpensesApi.list(costingTask.id);
      setCostingExpenses(expRes.data || []);
    } catch { /* silent */ }
  };

  const handleCostingSelect = async (taskId: string) => {
    if (!taskId) {
      setCostingTask(null);
      setCostingExpenses([]);
      return;
    }
    const found = allTasks.find(t => t.id === taskId);
    if (found) {
      setCostingTask(found);
      setIsSearchingCosting(true);
      try {
        const expRes = await taskExpensesApi.list(found.id);
        setCostingExpenses(expRes.data || []);
      } catch {
        setCostingError('Xarajatlarni yuklashda xatolik');
      } finally {
        setIsSearchingCosting(false);
      }
    }
  };

  const handleCostingSearch = async () => {
    const q = costingQuery.trim();
    if (!q) return;
    setIsSearchingCosting(true);
    setCostingTask(null);
    setCostingExpenses([]);
    setCostingError('');
    try {
      const found = allTasks.find(
        (t: any) =>
          t.displayId?.toLowerCase() === q.toLowerCase() ||
          t.orderName?.toLowerCase().includes(q.toLowerCase()) ||
          t.title?.toLowerCase().includes(q.toLowerCase()),
      );
      if (!found) {
        setCostingError(`"${q}" bo'yicha buyurtma topilmadi`);
      } else {
        setCostingTask(found);
        const expRes = await taskExpensesApi.list(found.id);
        setCostingExpenses(expRes.data || []);
      }
    } catch {
      setCostingError('Xatolik yuz berdi');
    } finally {
      setIsSearchingCosting(false);
    }
  };

  // EXPORT — barcha tahliliy jadvallarni bitta .xlsx faylga (har biri alohida sheet)
  const handleExport = () => {
    const sheets: ExportSheet<any>[] = [];

    if (services.length > 0) {
      sheets.push({
        sheetName: 'Xizmatlar',
        rows: services,
        columns: [
          { header: 'Xizmat', accessor: (s: any) => s.serviceName || s.name || '' },
          { header: 'Buyurtmalar', accessor: (s: any) => Number(s.totalTasks || s.count || 0) },
          { header: 'Daromad (UZS)', accessor: (s: any) => Number(s.totalRevenue || 0) },
          { header: "O'rtacha chek (UZS)", accessor: (s: any) => Number(s.avgCheck || 0) },
        ],
      });
    }

    if (expenseBreakdown.length > 0) {
      const total = expenseBreakdown.reduce((s, x: any) => s + Number(x.value || 0), 0);
      sheets.push({
        sheetName: 'Xarajatlar',
        rows: expenseBreakdown,
        columns: [
          { header: 'Kategoriya', accessor: (x: any) => x.name || '' },
          { header: 'Summa (UZS)', accessor: (x: any) => Number(x.value || 0) },
          { header: 'Ulush (%)', accessor: (x: any) => total > 0 ? Number(((Number(x.value || 0) / total) * 100).toFixed(2)) : 0 },
        ],
      });
    }

    if (vendors.length > 0) {
      sheets.push({
        sheetName: 'Hamkorlar',
        rows: vendors,
        columns: [
          { header: 'Hamkor', accessor: (v: any) => v.name || v.vendorName || '' },
          { header: 'Buyurtmalar', accessor: (v: any) => Number(v.taskCount || v.orders || 0) },
          { header: 'Daromad (UZS)', accessor: (v: any) => Number(v.revenue || 0) },
          { header: 'Xarajat (UZS)', accessor: (v: any) => Number(v.cost || 0) },
          { header: 'Foyda (UZS)', accessor: (v: any) => Number(v.profit || (Number(v.revenue || 0) - Number(v.cost || 0))) },
        ],
      });
    }

    if (kpiRows.length > 0) {
      sheets.push({
        sheetName: 'KPI',
        rows: kpiRows,
        columns: [
          { header: 'Xodim', accessor: (k: any) => k.employeeName || k.employee?.fullName || '' },
          { header: 'Lavozim', accessor: (k: any) => k.role || k.employee?.role?.name || '' },
          { header: 'Buyurtmalar', accessor: (k: any) => Number(k.taskCount || k.completedTasks || 0) },
          { header: 'Daromad (UZS)', accessor: (k: any) => Number(k.revenue || 0) },
          { header: 'Maosh (UZS)', accessor: (k: any) => Number(k.salary || 0) },
        ],
      });
    }

    if (dynamics.length > 0) {
      sheets.push({
        sheetName: dynamicsType === 'daily' ? 'Kunlik' : 'Oylik',
        rows: dynamics,
        columns: [
          { header: dynamicsType === 'daily' ? 'Kun' : 'Oy', accessor: (d: any) => d.label || '' },
          { header: 'Kirim (UZS)', accessor: (d: any) => Number(d.kirim || 0) },
          { header: 'Chiqim (UZS)', accessor: (d: any) => Number(d.chiqim || 0) },
          { header: 'Hamkorlar (UZS)', accessor: (d: any) => Number(d.hamkorlar || 0) },
          { header: 'Sof daromad (UZS)', accessor: (d: any) => Number(d.net || 0) },
        ],
      });
    }

    if (sheets.length === 0) {
      alert("Eksport qilish uchun ma'lumot yo'q (filtrni o'zgartirib ko'ring)");
      return;
    }

    exportMultiSheetXlsx({
      filename: `hisobot_${params.start}_${params.end}`,
      sheets,
    });
  };

  if (firstLoad) return (
    <div className="space-y-4">
      <SkeletonStats count={4} />
      <SkeletonCardGrid count={4} />
    </div>
  );

  return (
    <div className="space-y-5 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-orange-600" size={22} /> Hisobotlar & Tahlil
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Biznes ko'rsatkichlari va chuqur tahlil</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {(isAdmin || p.canExportReports) && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-all shadow-sm"
              title="Tahliliy ma'lumotlarni Excel'ga eksport qilish"
            >
              <Download size={14} /> Eksport
            </button>
          )}
          <button
            onClick={() => {
              // Force refetch all report queries
              [dashStatsQuery, growthQuery, servicesQuery, dynamicsDailyQuery, dynamicsMonthlyQuery,
               paymentStatsQuery, expenseQuery, vendorsQuery, allTasksQuery, velocityQuery, kpiQuery]
                .forEach(q => q.refetch());
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-all shadow-sm"
          >
            <RefreshCw size={14} /> Yangilash
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <Calendar size={14} /> Davr:
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-lg shadow-inner">
          {(['month', '3month', '6month', 'year', 'custom'] as DatePreset[]).map((pr) => (
            <button key={pr} onClick={() => setPreset(pr)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${preset === pr ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-800'}`}>
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
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Branch selector intentionally removed — Navbar is the single source of truth.
              Reports show data for whichever branch is active in the navbar. */}
          {branchId && departments.length > 0 && (
            <>
              <div className="relative">
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  className="select-minimal h-9 text-xs font-bold">
                  <option value="">Barcha bo'limlar</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setGroupByDept(v => !v)}
                className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition-colors ${
                  groupByDept
                    ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-orange-400'
                }`}
                title="Bo'limlar bo'yicha guruhlash"
              >
                Bo'limga guruhlash
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── O'sish ko'rsatkichlari + Sof Foyda ── */}
      {canViewGrowthCards && growth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GrowthCard label="Bu oy daromad" value={growth.revenue.current} previous={growth.revenue.previous}
            growth={growth.revenue.growth} icon={<DollarSign size={18} />} format={fmtFull} />
          <GrowthCard label="Yangi mijozlar" value={growth.newCustomers.current} previous={growth.newCustomers.previous}
            growth={growth.newCustomers.growth} icon={<Users size={18} />} format={n => String(n)} />
          <GrowthCard label="Bajarilgan buyurtmalar" value={growth.completedTasks.current} previous={growth.completedTasks.previous}
            growth={growth.completedTasks.growth} icon={<ShoppingBag size={18} />} format={n => String(n)} />
          {dashStats && (
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                <TrendingDown size={18} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-1">Jami Chiqim</p>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{fmtFull(dashStats.totalChiqim)}</h3>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sof Foyda (growth bilan birga yoki alohida) ── */}
      {canViewGrowthCards && dashStats && (
        <div className="bg-slate-900 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Sof Foyda (Davr)</p>
            <h3 className="text-2xl font-bold text-white tracking-tight">{fmtFull(dashStats.balance)}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Wallet size={22} className="text-orange-400" />
          </div>
        </div>
      )}

      {/* ── Moliyaviy Dinamika LineChart ── */}
      {canViewDynamics && dynamics.length > 0 && (
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
                <Line type="monotone" name="Hamkorlar" dataKey="hamkorlar" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                <Line type="monotone" name="Sof foyda" dataKey="net" stroke="#FF6B00" strokeWidth={3} dot={{ r: 4, fill: '#FF6B00', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ── Kirim / Chiqim turlari ── */}
      {(canViewIncomeByType || canViewExpenseByType) && (paymentStats.kirim.length > 0 || paymentStats.chiqim.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {canViewIncomeByType && (
            <Section title="Kirim Turlari" sub="To'lov turlari bo'yicha" icon={<TrendingUp size={16} className="text-emerald-500" />}>
              <PieWithLegend data={paymentStats.kirim} colors={['#10b981', '#3b82f6', '#FF6B00', '#6366f1', '#14b8a6', '#f59e0b']} />
            </Section>
          )}
          {canViewExpenseByType && (
            <Section title="Chiqim Turlari" sub="Xarajat turlari bo'yicha" icon={<TrendingDown size={16} className="text-rose-500" />}>
              <PieWithLegend data={paymentStats.chiqim} colors={['#ef4444', '#f59e0b', '#3b82f6', '#6366f1', '#ec4899', '#8b5cf6']} />
            </Section>
          )}
        </div>
      )}

      {/* ── Chiqim Tahlili ── */}
      {canViewExpenseCharts && expenseBreakdown.length > 0 && (
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
                      <p className="text-[11px] font-bold text-slate-800">{fmtFull(item.value)}</p>
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
                  <th className="text-left p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hamkor</th>
                  <th className="text-right p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xarajat</th>
                  <th className="text-right p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Daromad</th>
                  <th className="text-right p-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Marja</th>
                </tr>
              </thead>
              <tbody>
                {vendors.slice(0, 8).map((v: any) => (
                  <tr key={v.vendorId} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{v.vendorName}</div>
                      {Array.isArray(v.roles) && v.roles.length > 0 && <div className="text-[10px] text-slate-400 font-bold">{v.roles.join(', ')}</div>}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-500 tabular-nums whitespace-nowrap">{fmtNum(v.totalCost)}</td>
                    <td className="p-3 text-right font-bold text-emerald-600 tabular-nums whitespace-nowrap">{fmtNum(v.linkedRevenue)}</td>
                    <td className="p-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] ${v.marginPct >= 30 ? 'bg-emerald-50 text-emerald-700' : v.marginPct >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
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

      {/* ── Xizmat Hajmi & O'rtacha Chek ── */}
      {canViewServiceStats && services.length > 0 && (
        <ServiceStats services={services} />
      )}

      {/* ── Employee Velocity ── */}
      {canViewKpi && (
        kpiRows.length > 0 ? (
          <EmployeePerformanceTable
            rows={kpiRows}
            velocity={velocity}
            title="Xodimlar Samaradorligi"
            showBar
          />
        ) : kpiQuery.isLoading || velocityQuery.isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-orange-500" />
              <h3 className="text-sm font-bold text-slate-800">Xodimlar Samaradorligi</h3>
            </div>
            <SkeletonStats count={4} />
          </div>
        ) : kpiQuery.isError ? (
          <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6 text-center">
            <Users size={28} className="mx-auto text-rose-300 mb-2" />
            <p className="text-xs font-bold text-rose-600">Xodimlar samaradorligini yuklab bo'lmadi</p>
            <button onClick={() => { kpiQuery.refetch(); velocityQuery.refetch(); }}
              className="mt-3 px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg hover:bg-rose-100">
              Qayta urinib ko'rish
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <Users size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-500">Tanlangan davr uchun xodim samaradorligi ma'lumotlari yo'q</p>
          </div>
        )
      )}

      {/* ── Bo'limlar bo'yicha taqsimot (client-side grouping) ─────────────
          Client-side group-by on the already-loaded tasks; no extra API call.
          Activated by the "Bo'limga guruhlash" button in the filter bar. */}
      {groupByDept && allTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Package size={16} className="text-orange-500" /> Bo'limlar bo'yicha taqsimot
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Buyurtmalar va daromad — bo'limlarga guruhlangan
              </p>
            </div>
          </div>
          <div className="p-5">
            {(() => {
              // Filter to active department if one is selected, otherwise show all.
              const scope = departmentId ? allTasks.filter(t => t.departmentId === departmentId) : allTasks;
              const buckets: Record<string, { name: string; count: number; revenue: number }> = {};
              const UNTAGGED_KEY = '__untagged__';
              for (const t of scope) {
                const key = t.departmentId || UNTAGGED_KEY;
                if (!buckets[key]) {
                  const dept = departments.find((d: any) => d.id === key);
                  buckets[key] = {
                    name: dept?.name || (key === UNTAGGED_KEY ? "Bo'limsiz" : 'Noma\'lum bo\'lim'),
                    count: 0,
                    revenue: 0,
                  };
                }
                buckets[key].count += 1;
                buckets[key].revenue += Number(t.totalAmount || 0);
              }
              const rows = Object.values(buckets).sort((a, b) => b.revenue - a.revenue);
              const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0) || 1;
              if (rows.length === 0) {
                return <p className="text-xs font-bold text-slate-400">Ushbu davr uchun buyurtma topilmadi.</p>;
              }
              return (
                <div className="space-y-3">
                  {rows.map((r) => {
                    const pct = Math.round((r.revenue / totalRevenue) * 100);
                    return (
                      <div key={r.name}>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                          <span>{r.name}</span>
                          <span className="text-slate-500">
                            {r.count} ta · {new Intl.NumberFormat('uz-UZ').format(r.revenue).replace(/,/g, ' ')} UZS · {pct}%
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF6B00]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Tannarx Kalkulyatori ────────────────────────────────────────── */}
      {canViewCostCalc && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-orange-100 bg-orange-50/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Package size={16} className="text-orange-500" /> Tannarx Kalkulyatori
            </h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Buyurtma ID, nomi yoki mijoz bo'yicha tannarx va foyda tahlili
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Order Selection Dropdown */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buyurtmani tanlang</p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <select
                  value={costingTask?.id || ''}
                  onChange={(e) => handleCostingSelect(e.target.value)}
                  className="select-minimal h-11 font-bold"
                >
                  <option value="" className="font-sans">--- Buyurtmani tanlang (Joriy oy) ---</option>
                  {allTasks
                    .filter(t => {
                      const d = new Date(t.createdAt);
                      const now = new Date();
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    })
                    .map(t => (
                      <option key={t.id} value={t.id} className="font-mono">
                        {t.displayId || 'ID yo\'q'} | {t.orderName || t.title} ({t.customerName || 'Mijozsiz'})
                      </option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              
              <div className="relative flex-[0.8] hidden sm:block">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ID yoki nom bilan tezkor qidiruv..."
                  value={costingQuery}
                  onChange={e => setCostingQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCostingSearch()}
                  className="w-full h-11 pl-10 pr-4 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400 transition-all"
                />
              </div>
              <button
                onClick={handleCostingSearch}
                disabled={isSearchingCosting || !costingQuery.trim()}
                className="h-11 px-5 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap shadow-lg hidden sm:block"
              >
                {isSearchingCosting ? '...' : 'QIDIRISH'}
              </button>
            </div>
          </div>

          {/* Error */}
          {costingError && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <X size={16} strokeWidth={2.5} className="text-rose-500" />
              <p className="text-sm font-bold text-rose-600">{costingError}</p>
            </div>
          )}

          {/* Result — profitability dashboard */}
          {costingTask && (() => {
            const totalCost = costingExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
            const revenue = Number(costingTask.totalAmount) || 0;
            const netProfit = revenue - totalCost;
            const qty = Number(costingTask.quantity) || 1;
            const unitCost = totalCost / qty;
            const unitProfit = netProfit / qty;
            const margin = revenue > 0 ? (netProfit / revenue * 100) : 0;

            return (
              <div className="space-y-4 animate-fade-in">

                {/* Task identity strip */}
                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                  <span className="text-[11px] font-bold font-mono bg-white border border-orange-300 text-orange-600 px-3 py-1 rounded-lg tracking-widest shrink-0">
                    {costingTask.displayId || `#${costingTask.id.slice(-6).toUpperCase()}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate uppercase tracking-tight">
                      {costingTask.orderName ? `${costingTask.orderName} — ` : ''}{costingTask.title}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {costingTask.customerName || 'Mijoz ko\'rsatilmagan'} · {qty} dona
                    </p>
                  </div>
                </div>

                {/* Main metrics grid */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">

                  {/* Revenue + Cost */}
                  <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
                    <div className="p-4">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Umumiy Daromad</p>
                      <p className="text-xl font-bold text-slate-800 font-mono tabular-nums">{revenue.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">UZS</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Jami Xarajat</p>
                      <p className="text-xl font-bold text-slate-700 font-mono tabular-nums">{totalCost.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">UZS · {costingExpenses.length} ta moddа</p>
                    </div>
                  </div>

                  {/* Net profit hero */}
                  <div className="p-5 border-b border-slate-200">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sof Foyda</p>
                    <div className="flex items-baseline gap-4">
                      <p className={`text-3xl font-bold font-mono tracking-tight ${netProfit >= 0 ? 'text-orange-600' : 'text-rose-600'}`}>
                        {netProfit.toLocaleString()} <span className="text-sm font-bold">UZS</span>
                      </p>
                      {revenue > 0 && (
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-lg ${netProfit >= 0 ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-rose-50 text-rose-500 border border-rose-200'}`}>
                          {netProfit >= 0 ? '+' : ''}{margin.toFixed(1)}% marja
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unit metrics */}
                  <div className="grid grid-cols-2 divide-x divide-slate-200">
                    <div className="p-4">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">1 dona — Tannarx</p>
                      <p className="text-lg font-bold text-slate-700 font-mono tabular-nums">
                        {unitCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px] font-bold text-slate-400 ml-1">UZS</span>
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{qty} dona asosida</p>
                    </div>
                    <div className="p-4">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">1 donadan Foyda</p>
                      <p className={`text-lg font-bold font-mono tabular-nums ${unitProfit >= 0 ? 'text-orange-600' : 'text-rose-600'}`}>
                        {unitProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px] font-bold text-slate-400 ml-1">UZS</span>
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">UZS / dona</p>
                    </div>
                  </div>
                </div>

                {/* Add expense form */}
                <div className="border border-orange-200 rounded-xl overflow-hidden">
                  <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-200">
                    <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">Xarajat qo'shish</p>
                  </div>
                  <div className="p-4 flex gap-3">
                    <input
                      type="text"
                      placeholder="Xarajat nomi (Qog'oz, Bo'yoq...)"
                      value={expenseForm.expenseName}
                      onChange={e => setExpenseForm(f => ({ ...f, expenseName: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddCostingExpense()}
                      className="flex-1 h-10 px-3 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400 transition-all placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <input
                      type="number"
                      placeholder="Summa (UZS)"
                      value={expenseForm.amount}
                      onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddCostingExpense()}
                      className="w-36 h-10 px-3 text-xs font-bold font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400 transition-all placeholder:text-slate-400 placeholder:font-normal"
                    />
                    <button
                      onClick={handleAddCostingExpense}
                      disabled={isAddingExpense || !expenseForm.expenseName.trim() || !expenseForm.amount}
                      className="h-10 px-4 bg-orange-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 hover:bg-orange-700 transition-all active:scale-95 flex items-center gap-1.5 shadow-sm shadow-orange-500/20"
                    >
                      <Plus size={13} strokeWidth={3} /> QO'SH
                    </button>
                  </div>
                </div>

                {/* Expense breakdown table */}
                {costingExpenses.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Xarajatlar ro'yxati</p>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {costingExpenses.map((exp: any) => (
                        <div key={exp.id} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50/40 transition-colors group">
                          <div>
                            <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{exp.expenseName}</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                              {new Date(exp.createdAt).toLocaleDateString('uz-UZ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-700 font-mono tabular-nums">
                              {Number(exp.amount).toLocaleString()} UZS
                            </span>
                            <button
                              onClick={() => handleDeleteCostingExpense(exp.id)}
                              className="w-7 h-7 rounded-lg bg-rose-50 text-rose-300 hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {/* Total row */}
                      <div className="flex items-center justify-between px-4 py-3 bg-orange-50">
                        <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">Jami Xarajat</span>
                        <span className="text-sm font-bold text-slate-800 font-mono tabular-nums">
                          {totalCost.toLocaleString()} UZS
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {costingExpenses.length === 0 && (
                  <p className="text-center text-[11px] font-bold text-slate-400 py-4">
                    Xarajat yo'q — yuqorida qo'shing
                  </p>
                )}
              </div>
            );
          })()}

          {/* Empty state */}
          {!costingTask && !costingError && !isSearchingCosting && (
            <div className="py-10 flex flex-col items-center justify-center gap-2 opacity-40">
              <Package size={32} className="text-orange-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Buyurtma ID yoki nomini kiriting
              </p>
            </div>
          )}
        </div>
      </div>}

      {!needsFinanceData && !canViewKpi && !canViewVendors && !canViewCostCalc && (
        <div className="text-center py-20 text-slate-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold text-sm uppercase tracking-widest">Ruxsat yo'q</p>
          <p className="text-xs font-bold mt-1">Hisobotlarni ko'rish uchun administrator bilan bog'laning</p>
        </div>
      )}
    </div>
  );
};

export default Hisobotlar;
