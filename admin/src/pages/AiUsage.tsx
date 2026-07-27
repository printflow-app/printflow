import { useMemo, useState } from 'react';
import { Sparkles, MessageSquare, DollarSign, Coins, Search, ArrowUpDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAiUsage } from '../hooks/queries';

// =============================================
// AI SARFI — qaysi workspace qancha AI ishlatgani va qancha turgani.
// Manba: AiUsageDaily (har javobdan keyin token/$ yoziladi).
// Chart qoidalari: bitta o'q, ingichka marklar, hairline grid, dashsiz.
// Bitta seriya = bitta rang (brand orange) — qiymat-ramp yo'q.
// =============================================

const BRAND = '#f97316';
const GRID = '#e4e7ec';
const AXIS = '#94a3b8';

const usd = (n: number) => `$${(n || 0).toFixed(n >= 1 ? 2 : 3)}`;
const num = (n: number) => (n || 0).toLocaleString('uz-UZ').replace(/,/g, ' ');
const tok = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n || 0);
};

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Faol', cls: 'bg-emerald-50 text-emerald-700' },
  TRIAL: { label: 'Trial', cls: 'bg-orange-50 text-orange-700' },
  EXPIRED: { label: 'Tugagan', cls: 'bg-rose-50 text-rose-700' },
  PENDING_PAYMENT: { label: "To'lov", cls: 'bg-amber-50 text-amber-700' },
};

type SortKey = 'totalCostUsd' | 'monthCostUsd' | 'totalMessages' | 'name';

const Kpi: React.FC<{ label: string; value: string; sub: string; icon: any; accent?: boolean }> = ({
  label, value, sub, icon: Icon, accent,
}) => (
  <div className={`bg-white rounded-xl border p-4 ${accent ? 'border-orange-200' : 'border-[color:var(--border)]'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className="text-[26px] leading-none font-extrabold text-slate-900 mt-2 tracking-tight">{value}</p>
        <p className="text-[11px] font-medium text-slate-400 mt-1.5">{sub}</p>
      </div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        accent ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400'
      }`}>
        <Icon size={17} />
      </div>
    </div>
  </div>
);

export default function AiUsage() {
  const { data, isLoading } = useAiUsage();
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalCostUsd');

  const rows = useMemo(() => {
    const list = (data?.rows || []) as any[];
    const filtered = q.trim()
      ? list.filter(r =>
          r.name?.toLowerCase().includes(q.toLowerCase()) ||
          r.slug?.toLowerCase().includes(q.toLowerCase()))
      : list;
    return [...filtered].sort((a, b) =>
      sortKey === 'name' ? String(a.name).localeCompare(String(b.name)) : (b[sortKey] || 0) - (a[sortKey] || 0),
    );
  }, [data, q, sortKey]);

  const totals = data?.totals || { costUsd: 0, messages: 0, monthCostUsd: 0, monthMessages: 0 };
  const trend = data?.trend || [];
  const activeCount = (data?.rows || []).filter((r: any) => r.totalMessages > 0).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-[color:var(--border)] p-4 h-[104px] animate-pulse" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-[color:var(--border)] h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI qatori */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Bu oy xarajat" value={usd(totals.monthCostUsd)} sub={`${num(totals.monthMessages)} ta xabar`} icon={DollarSign} accent />
        <Kpi label="Jami xarajat" value={usd(totals.costUsd)} sub="butun davr" icon={Sparkles} />
        <Kpi label="Jami xabarlar" value={num(totals.messages)} sub="barcha workspacelarda" icon={MessageSquare} />
        <Kpi label="AI ishlatgan" value={`${activeCount}`} sub={`${(data?.rows || []).length} ta workspacedan`} icon={Coins} />
      </div>

      {/* Kunlik trend */}
      <div className="bg-white rounded-xl border border-[color:var(--border)] p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Kunlik xabar oqimi</p>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">platforma bo'yicha, so'nggi 30 kun</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
              <XAxis dataKey="kun" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} interval={4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={38} />
              <Tooltip
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <div className="bg-white border border-[color:var(--border)] rounded-lg shadow-lg px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                      <p className="text-[12px] font-bold text-slate-900">{num(payload[0].value)} ta xabar</p>
                      <p className="text-[11px] font-semibold text-orange-600 font-mono">
                        {usd(payload[0].payload.xarajat)}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Line
                type="monotone" dataKey="xabar" name="Xabarlar" stroke={BRAND} strokeWidth={2}
                dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Workspace jadvali */}
      <div className="bg-white rounded-xl border border-[color:var(--border)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-[color:var(--border)]">
          <div>
            <p className="text-[13px] font-extrabold text-slate-900 tracking-tight">Workspace bo'yicha sarf</p>
            <p className="text-[11px] font-medium text-slate-400">{rows.length} ta yozuv</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Workspace qidirish..."
                className="h-8 w-full sm:w-52 pl-8 pr-3 text-[12px] font-medium bg-[color:var(--panel-muted)] border border-[color:var(--border)] rounded-lg outline-none focus:border-orange-400 focus:bg-white transition-colors placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={() => setSortKey(k => (k === 'totalCostUsd' ? 'monthCostUsd' : k === 'monthCostUsd' ? 'totalMessages' : k === 'totalMessages' ? 'name' : 'totalCostUsd'))}
              className="h-8 px-2.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
              title="Saralash tartibini almashtirish"
            >
              <ArrowUpDown size={13} />
              {sortKey === 'totalCostUsd' ? 'Jami $' : sortKey === 'monthCostUsd' ? 'Oylik $' : sortKey === 'totalMessages' ? 'Xabar' : 'Nom'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[color:var(--panel-muted)] border-b border-[color:var(--border)] text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="py-2.5 px-4">Workspace</th>
                <th className="py-2.5 px-4">Tarif</th>
                <th className="py-2.5 px-4 text-right">Bu oy</th>
                <th className="py-2.5 px-4 text-right">Jami xabar</th>
                <th className="py-2.5 px-4 text-right">Tokenlar</th>
                <th className="py-2.5 px-4 text-right">Kredit</th>
                <th className="py-2.5 px-4 text-right">Jami xarajat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {rows.map(r => {
                const st = STATUS[r.status] || { label: r.status, cls: 'bg-slate-100 text-slate-600' };
                const limitLabel = r.monthlyLimit === 0 ? 'cheksiz' : `${num(r.monthlyLimit)} limit`;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-[11px] font-extrabold shrink-0">
                          {String(r.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 truncate">{r.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">@{r.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 truncate">{r.planName || '—'}</span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5">{limitLabel}</p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <p className="text-[12px] font-bold text-slate-900 font-mono">{usd(r.monthCostUsd)}</p>
                      <p className="text-[10px] font-mono text-slate-400">{num(r.monthMessages)} xabar</p>
                    </td>
                    <td className="py-3 px-4 text-right text-[12px] font-bold text-slate-700 font-mono">
                      {num(r.totalMessages)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <p className="text-[11px] font-mono text-slate-600">{tok(r.totalInputTokens)} <span className="text-slate-400">in</span></p>
                      <p className="text-[11px] font-mono text-slate-600">{tok(r.totalOutputTokens)} <span className="text-slate-400">out</span></p>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {r.extraCredits > 0 ? (
                        <span className="text-[11px] font-bold font-mono text-orange-600">+{num(r.extraCredits)}</span>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[13px] font-extrabold font-mono ${r.totalCostUsd > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                        {usd(r.totalCostUsd)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Sparkles size={22} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-[12px] font-semibold text-slate-500">
                      {q ? 'Qidiruv bo\'yicha natija yo\'q' : 'AI foydalanish qayd etilmagan'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] font-medium text-slate-400 px-1">
        Xarajat Claude Haiku 4.5 narxlari asosida hisoblanadi ($1/M kirish, $5/M chiqish token).
        Bu tizim o'lchagan haqiqiy sarf — Anthropic hisobingizdagi qoldiq balans bilan bir xil emas.
      </p>
    </div>
  );
}
