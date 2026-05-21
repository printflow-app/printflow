import { useState, useEffect } from 'react';
import { Sparkles, Building2, CreditCard, Users, Clock, MessageSquare, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { settingsApi } from '../api';
import { useTenants, useTenantStats } from '../hooks/queries';
import { getAttPct, getActiveModules } from '../shared/constants';

const CUSTOM_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',           // Emerald-500
  TRIAL: '#3b82f6',            // Blue-500
  EXPIRED: '#f43f5e',          // Rose-500
  PENDING_PAYMENT: '#f59e0b',  // Amber-500
};

const CUSTOM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Faol',
  TRIAL: 'Trial',
  EXPIRED: 'Tugagan',
  PENDING_PAYMENT: "To'lov",
};

export default function Dashboard() {
  const { data: stats = {} } = useTenantStats() as { data: any };
  const { data: workspaces = [] } = useTenants();
  const [aiCopilotEnabled, setAiCopilotEnabled] = useState<boolean>(false);
  const [aiToggleSaving, setAiToggleSaving] = useState<boolean>(false);

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

  const kpis = [
    { label: 'Jami Workspacelar', value: stats.totalTenants ?? 0, sub: `${stats.activeTenants ?? 0} faol`, icon: Building2 },
    { label: "Jami Daromad (UZS)", value: (stats.totalRevenue ?? 0).toLocaleString(), sub: 'tasdiqlangan to\'lovlar', icon: CreditCard },
    { label: 'Jami Xodimlar', value: stats.totalEmployees ?? 0, sub: 'barcha workspacelarda', icon: Users },
    { label: "Kutilayotgan To'lovlar", value: stats.pendingPayments ?? 0, sub: 'tasdiqlash kerak', icon: Clock },
    { label: "Demo So'rovlar", value: stats.totalLeads ?? 0, sub: 'jami so\'rovlar', icon: MessageSquare },
    { label: 'Trial Tugaydi', value: stats.trialsExpiringSoon ?? 0, sub: '7 kun ichida', icon: AlertTriangle },
  ];

  const chartCard = (title: string, children: React.ReactNode) => (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">{title}</p>
      {children}
    </div>
  );

  const formatTooltip = ({ active, payload, label }: any, suffix: string = '') => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 text-slate-800 p-2.5 rounded-lg shadow-lg text-xs font-semibold">
          <p className="text-slate-400 text-[9px] uppercase tracking-wider">{label}</p>
          <p className="text-xs font-bold text-orange-500 mt-0.5">
            {payload[0].value?.toLocaleString()} {suffix}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Global Feature Toggles */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            aiCopilotEnabled
              ? 'bg-orange-500 text-white'
              : 'bg-slate-100 text-slate-400 border border-slate-200'
          }`}>
            <Sparkles size={18} className={aiCopilotEnabled ? 'animate-pulse' : ''} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
              AI Copilot (Global)
              {aiCopilotEnabled && (
                <span className="text-[8px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Faol
                </span>
              )}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {aiCopilotEnabled
                ? 'Yoqilgan — barcha workspacelarda AI yordamchi tugmasi ko\'rinadi'
                : 'O\'chirilgan — hech kim AI yordamchidan foydalana olmaydi'}
            </div>
          </div>
        </div>

        <button
          onClick={toggleAiCopilot}
          disabled={aiToggleSaving}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${
            aiCopilotEnabled ? 'bg-orange-500' : 'bg-slate-300'
          } ${aiToggleSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        >
          <div
            className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200"
            style={{ left: aiCopilotEnabled ? '22px' : '2px' }}
          />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{k.label}</span>
                <span className="text-2xl font-black text-slate-900 tracking-tight block leading-none">{k.value}</span>
                <span className="text-[11px] text-slate-500 font-medium block">{k.sub}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                <Icon size={18} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {chartCard('Oylik Daromad (MRR)',
            <div className="h-60">
              {(stats.revenueChart?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.revenueChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} content={props => formatTooltip(props, 'UZS')} />
                    <Bar dataKey="amount" name="Daromad" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-slate-400 text-xs">Ma'lumot yo'q</div>}
            </div>
          )}
        </div>

        <div>
          {chartCard('Status Taqsimoti',
            <div className="flex flex-col h-full justify-between">
              <div className="h-40 relative flex items-center justify-center">
                {(stats.statusDistribution?.length ?? 0) > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={68} paddingAngle={3} dataKey="value">
                        {stats.statusDistribution.map((e: any, i: number) => {
                          const statusKey = e.status || Object.keys(CUSTOM_STATUS_LABELS).find(k => CUSTOM_STATUS_LABELS[k] === e.name) || '';
                          const color = CUSTOM_STATUS_COLORS[statusKey] || e.color || '#475569';
                          return <Cell key={i} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip content={props => formatTooltip(props, 'ta')} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-slate-400 text-xs">Ma'lumot yo'q</div>}

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Jami</span>
                  <span className="text-lg font-black text-slate-900 tracking-tight">
                    {(stats.statusDistribution || []).reduce((acc: number, curr: any) => acc + curr.value, 0)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mt-2">
                {(stats.statusDistribution || []).map((s: any, i: number) => {
                  const statusKey = s.status || Object.keys(CUSTOM_STATUS_LABELS).find(k => CUSTOM_STATUS_LABELS[k] === s.name) || '';
                  const color = CUSTOM_STATUS_COLORS[statusKey] || s.color || '#475569';
                  const label = CUSTOM_STATUS_LABELS[statusKey] || s.name;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs font-semibold border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-slate-500">{label}</span>
                      </div>
                      <span className="font-bold text-slate-900">{s.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {chartCard("Workspace O'sishi",
          <div className="h-52">
            {(stats.tenantGrowthChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.tenantGrowthChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} allowDecimals={false} />
                  <Tooltip content={props => formatTooltip(props, 'workspace')} />
                  <Line type="monotone" dataKey="count" name="Yangi Tenantlar" stroke="#f97316" strokeWidth={2} dot={{ r: 3, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-400 text-xs">Ma'lumot yo'q</div>}
          </div>
        )}

        {chartCard("Demo So'rovlar (Leads)",
          <div className="h-52">
            {(stats.leadsChart?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.leadsChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} allowDecimals={false} />
                  <Tooltip content={props => formatTooltip(props, "so'rov")} />
                  <Line type="monotone" dataKey="count" name="So'rovlar" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-400 text-xs">Ma'lumot yo'q</div>}
          </div>
        )}
      </div>

      {/* Recent Workspace Activity */}
      {workspaces.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">So'nggi Workspacelar</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.slice(0, 6).map(w => {
              const label = CUSTOM_STATUS_LABELS[w.status] || w.status;
              const attPct = getAttPct(w);
              const modules = getActiveModules(w);

              const dotColor =
                w.status === 'ACTIVE' ? 'bg-emerald-500' :
                w.status === 'TRIAL' ? 'bg-blue-500' :
                w.status === 'EXPIRED' ? 'bg-rose-500' : 'bg-amber-500';

              return (
                <div key={w.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 truncate">{w.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">@{w.slug}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      {label}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 border-t border-slate-100 pt-3 text-center">
                    {[
                      { label: 'Xodim', value: w._count?.employees ?? 0 },
                      { label: 'Buyurtma', value: w.activeTasksCount ?? w._count?.tasks ?? 0 },
                      { label: 'Davomat', value: `${attPct}%` },
                      { label: 'Modullar', value: `${modules}/4` },
                    ].map((m, idx) => (
                      <div key={idx} className={idx < 3 ? 'border-r border-slate-100' : ''}>
                        <p className="text-xs font-bold text-slate-800">{m.value}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mt-1">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
