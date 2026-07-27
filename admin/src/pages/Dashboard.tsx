import { useState, useEffect } from 'react';
import {
  Sparkles, Building2, CreditCard, Users, Clock, MessageSquare, AlertTriangle,
  ArrowRight, TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { settingsApi } from '../api';
import { useTenants, useTenantStats } from '../hooks/queries';
import { getAttPct, getActiveModules } from '../shared/constants';

// =============================================
// PLATFORMA NAZORATI — 2026-07 redizayn.
// Chart qoidalari (dataviz): bitta o'q, ingichka marklar, hairline solid grid
// (dashsiz), bitta seriya = bitta rang, ≥2 seriyada legend. Status ranglari
// faqat holat uchun (categorical "seriya 4" sifatida ishlatilmaydi).
// =============================================

const BRAND = '#f97316';
const GRID = '#e4e7ec';
const AXIS = '#94a3b8';

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  ACTIVE:          { label: 'Faol',    dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  TRIAL:           { label: 'Trial',   dot: 'bg-orange-500',  chip: 'bg-orange-50 text-orange-700' },
  EXPIRED:         { label: 'Tugagan', dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700' },
  PENDING_PAYMENT: { label: "To'lov",  dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700' },
};
const STATUS_BAR: Record<string, string> = {
  ACTIVE: '#10b981', TRIAL: '#f97316', EXPIRED: '#f43f5e', PENDING_PAYMENT: '#f59e0b',
};

const num = (n: number) => (n ?? 0).toLocaleString('uz-UZ').replace(/,/g, ' ');
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

// ── Qurilish bloklari ───────────────────────────────────────────────

const Kpi: React.FC<{
  label: string; value: string; sub: string; icon: any; accent?: boolean; to?: string;
}> = ({ label, value, sub, icon: Icon, accent, to }) => {
  const body = (
    <div className={`h-full bg-white rounded-xl border p-4 transition-colors ${
      accent ? 'border-orange-200' : 'border-[color:var(--border)]'
    } ${to ? 'hover:border-slate-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <p className="text-[26px] leading-none font-extrabold text-slate-900 mt-2 tracking-tight">{value}</p>
          <p className="text-[11px] font-medium text-slate-400 mt-1.5 flex items-center gap-1">
            {sub}
            {to && <ArrowRight size={11} className="text-slate-300" />}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          accent ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400'
        }`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
};

const Card: React.FC<{ title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }> = ({
  title, sub, children, action, className = '',
}) => (
  <section className={`bg-white rounded-xl border border-[color:var(--border)] p-4 flex flex-col ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{title}</h2>
        {sub && <p className="text-[11px] font-medium text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const NoData: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-1.5">
    <TrendingUp size={18} className="text-slate-300" />
    <p className="text-[11px] font-semibold text-slate-400">{children || "Hali ma'lumot yo'q"}</p>
  </div>
);

const Tip: React.FC<any> = ({ active, payload, label, suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[color:var(--border)] rounded-lg shadow-lg px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {num(p.value)} {suffix}
        </p>
      ))}
    </div>
  );
};

// ── Sahifa ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: stats = {}, isLoading } = useTenantStats() as { data: any; isLoading: boolean };
  const { data: workspaces = [] } = useTenants();
  const [aiCopilotEnabled, setAiCopilotEnabled] = useState(false);
  const [aiToggleSaving, setAiToggleSaving] = useState(false);

  useEffect(() => {
    settingsApi.get('AI_COPILOT_ENABLED').then(r => setAiCopilotEnabled(!!r.data?.value)).catch(() => {});
  }, []);

  const toggleAiCopilot = async () => {
    const next = !aiCopilotEnabled;
    setAiToggleSaving(true);
    try {
      await settingsApi.update('AI_COPILOT_ENABLED', next);
      setAiCopilotEnabled(next);
    } catch (e) {
      console.error('AI Copilot toggle failed:', e);
    } finally {
      setAiToggleSaving(false);
    }
  };

  // Status taqsimoti — pie o'rniga gorizontal bar (yaqin qiymatlarni
  // taqqoslash uchun aniqroq; dataviz: "donut/pie for comparing close values" ❌)
  const statusRows = (stats.statusDistribution || []).map((s: any) => {
    const key = s.status || Object.keys(STATUS_META).find(k => STATUS_META[k].label === s.name) || '';
    return { key, nom: STATUS_META[key]?.label || s.name, soni: s.value, rang: STATUS_BAR[key] || '#94a3b8' };
  });
  const statusTotal = statusRows.reduce((a: number, c: any) => a + c.soni, 0);

  const kpis = [
    { label: 'Workspacelar', value: num(stats.totalTenants ?? 0), sub: `${stats.activeTenants ?? 0} faol`, icon: Building2, to: '/tenants' },
    { label: 'Jami daromad', value: num(stats.totalRevenue ?? 0), sub: 'UZS · tasdiqlangan', icon: CreditCard },
    { label: 'AI xarajati', value: `$${(stats.monthAiCostUsd ?? 0).toFixed(2)}`, sub: `${num(stats.monthAiMessages ?? 0)} xabar · bu oy`, icon: Sparkles, accent: true, to: '/ai-usage' },
    { label: 'Jami xodimlar', value: num(stats.totalEmployees ?? 0), sub: 'barcha workspacelarda', icon: Users },
    { label: "Kutilayotgan to'lov", value: num(stats.pendingPayments ?? 0), sub: 'tasdiqlash kerak', icon: Clock, to: '/payments' },
    { label: "Demo so'rovlar", value: num(stats.totalLeads ?? 0), sub: 'jami', icon: MessageSquare, to: '/leads' },
    { label: 'Trial tugaydi', value: num(stats.trialsExpiringSoon ?? 0), sub: '7 kun ichida', icon: AlertTriangle },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-white rounded-xl border border-[color:var(--border)] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-[104px] bg-white rounded-xl border border-[color:var(--border)] animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-xl border border-[color:var(--border)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global AI kaliti */}
      <div className="bg-white rounded-xl border border-[color:var(--border)] px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            aiCopilotEnabled ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-extrabold text-slate-900 tracking-tight">AI Copilot</p>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                aiCopilotEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {aiCopilotEnabled ? 'Faol' : "O'chiq"}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 truncate">
              {aiCopilotEnabled
                ? "Barcha workspacelarda AI yordamchi tugmasi ko'rinadi"
                : 'Hech kim AI yordamchidan foydalana olmaydi'}
            </p>
          </div>
        </div>

        <button
          onClick={toggleAiCopilot}
          disabled={aiToggleSaving}
          role="switch"
          aria-checked={aiCopilotEnabled}
          aria-label="AI Copilot global kaliti"
          className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${
            aiCopilotEnabled ? 'bg-orange-500' : 'bg-slate-300'
          } ${aiToggleSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: aiCopilotEnabled ? 'translateX(22px)' : 'translateX(2px)' }}
          />
        </button>
      </div>

      {/* KPI to'ri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => <Kpi key={k.label} {...k} />)}
      </div>

      {/* Chartlar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card title="Oylik daromad" sub="so'nggi 6 oy · UZS" className="lg:col-span-2">
          <div className="h-60">
            {(stats.revenueChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueChart} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tickFormatter={short} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} content={<Tip suffix="UZS" />} />
                  <Bar dataKey="amount" name="Daromad" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </div>
        </Card>

        <Card title="Status taqsimoti" sub={`${statusTotal} ta workspace`}>
          {statusRows.length > 0 ? (
            <div className="flex flex-col gap-2.5 pt-1">
              {statusRows.map((s: any) => {
                const pct = statusTotal ? Math.round((s.soni / statusTotal) * 100) : 0;
                return (
                  <div key={s.nom}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.rang }} />
                        {s.nom}
                      </span>
                      <span className="text-[12px] font-bold text-slate-900 font-mono">
                        {s.soni}
                        <span className="text-slate-400 font-medium ml-1.5">{pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.rang }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <NoData />}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Workspace o'sishi" sub="so'nggi 6 oy">
          <div className="h-52">
            {(stats.tenantGrowthChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.tenantGrowthChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<Tip suffix="workspace" />} />
                  <Line type="monotone" dataKey="count" name="Yangi" stroke={BRAND} strokeWidth={2}
                    dot={{ r: 3, fill: BRAND, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </div>
        </Card>

        <Card title="Demo so'rovlar" sub="so'nggi 6 oy">
          <div className="h-52">
            {(stats.leadsChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.leadsChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip content={<Tip suffix="so'rov" />} />
                  <Line type="monotone" dataKey="count" name="So'rovlar" stroke={BRAND} strokeWidth={2}
                    dot={{ r: 3, fill: BRAND, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <NoData />}
          </div>
        </Card>
      </div>

      {/* So'nggi workspacelar */}
      {workspaces.length > 0 && (
        <Card
          title="So'nggi workspacelar"
          sub={`${workspaces.length} tadan 6 tasi`}
          action={
            <Link to="/tenants" className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1">
              Barchasi <ArrowRight size={12} />
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {workspaces.slice(0, 6).map(w => {
              const meta = STATUS_META[w.status] || { label: w.status, dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' };
              return (
                <div key={w.id} className="rounded-lg border border-[color:var(--border)] p-3 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-[12px] font-extrabold shrink-0">
                        {String(w.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 truncate">{w.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate">@{w.slug}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${meta.chip}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 border-t border-[color:var(--border)] pt-2.5">
                    {[
                      { label: 'Xodim', value: num(w._count?.employees ?? 0) },
                      { label: 'Buyurtma', value: num(w.activeTasksCount ?? w._count?.tasks ?? 0) },
                      { label: 'Davomat', value: `${getAttPct(w)}%` },
                      { label: 'Modul', value: `${getActiveModules(w)}/4` },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <p className="text-[12px] font-bold text-slate-800 font-mono">{m.value}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
