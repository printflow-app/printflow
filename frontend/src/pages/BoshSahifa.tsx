import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, ClipboardList, QrCode, ShieldAlert, ShieldCheck,
  Settings2, Check, UserSquare2, AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { dashboardApi, aiApi } from '../api';
import { SkeletonStats } from '../components/Skeleton';
import { buildRiskMessage } from '../utils/riskPrompt';

// =============================================
// BOSH SAHIFA — rol asosidagi, sozlanadigan nazorat paneli.
// Tizimdagi HAR BIR modul (moliya, buyurtmalar, davomat, mijozlar, ombor,
// hamkorlar, xodimlar) bo'yicha holat + chart. Har widget faqat foydalanuvchida
// shu bo'limni ko'rish ruxsati bo'lsa render bo'ladi; backend ham mos ravishda
// null qaytaradi (ikki qatlamli himoya).
//
// CHART QOIDALARI (dataviz):
//  - Bitta o'q, hech qachon ikki y-shkala.
//  - Ingichka marklar (2px chiziq), hairline grid, dashsiz.
//  - 2+ seriya bo'lsa legend doim bor.
//  - Nominal kategoriyalarda qiymat-ramp YO'Q — bitta seriya = bitta rang.
//  - Yaqin qiymatlarni taqqoslashda pie emas, bar.
//  - Ranglar tizim palitrasidan: brand orange + semantik emerald/rose/amber
//    + neytral slate. Boshqa hue ishlatilmaydi.
// =============================================

const BRAND = '#FF6B00';
const EMERALD = '#10b981';
const ROSE = '#f43f5e';
const GRID = '#e2e8f0';
const AXIS = '#94a3b8';

const fm = (n: number) => Math.round(n || 0).toLocaleString('uz-UZ').replace(/,/g, ' ');
const fmShort = (n: number) => {
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
};

const OY_NOMLARI = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const KUN_NOMLARI = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const todayLabel = () => {
  const d = new Date();
  return `${KUN_NOMLARI[d.getDay()]}, ${d.getDate()}-${OY_NOMLARI[d.getMonth()]}`;
};

type WidgetKey = 'risks' | 'finance' | 'tasks' | 'attendance' | 'customers' | 'inventory' | 'vendors' | 'employees';

const WIDGETS: { key: WidgetKey; label: string; perm: string | null }[] = [
  { key: 'risks', label: 'AI nazorati', perm: null },
  { key: 'finance', label: 'Moliya', perm: 'canViewFinance' },
  { key: 'tasks', label: 'Buyurtmalar', perm: 'canViewTasks' },
  { key: 'attendance', label: 'Davomat', perm: 'canViewAttendance' },
  { key: 'customers', label: 'Mijozlar va qarzdorlar', perm: 'canViewCustomers' },
  { key: 'inventory', label: 'Ombor', perm: 'canViewInventory' },
  { key: 'vendors', label: 'Hamkorlar', perm: 'canViewVendors' },
  { key: 'employees', label: 'Xodimlar', perm: 'canViewEmployees' },
];

function useWidgetVisibility(tenantId?: string) {
  const key = `pf_dashboard_widgets_${tenantId || 'unknown'}`;
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const all = Object.fromEntries(WIDGETS.map(w => [w.key, true]));
    try {
      const stored = localStorage.getItem(key);
      if (stored) return { ...all, ...JSON.parse(stored) };
    } catch {}
    return all;
  });
  const toggle = (w: WidgetKey) => {
    setVisible(prev => {
      const next = { ...prev, [w]: !prev[w] };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return { visible, toggle };
}

// ── Umumiy qurilish bloklari ────────────────────────────────────────

const Stat: React.FC<{
  label: string; value: React.ReactNode; sub?: string; icon: any;
  tone?: 'brand' | 'emerald' | 'rose' | 'amber' | 'slate' | 'dark';
}> = ({ label, value, sub, icon: Icon, tone = 'slate' }) => {
  const tones: Record<string, string> = {
    brand: 'bg-orange-50 text-orange-600 border-orange-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-100 text-slate-500 border-slate-200',
    dark: 'bg-white/10 text-white border-white/10',
  };
  const isDark = tone === 'dark';
  return (
    <div className={`p-4 rounded-xl border shadow-sm ${isDark ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 border ${tones[tone]}`}>
        <Icon size={17} />
      </div>
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${isDark ? 'text-white/50' : 'text-slate-400'}`}>{label}</p>
      <h3 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</h3>
      {sub && <p className={`text-[10px] font-semibold mt-0.5 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  );
};

const Panel: React.FC<{ title: string; sub?: string; children: React.ReactNode; className?: string }> = ({
  title, sub, children, className = '',
}) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className}`}>
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{title}</p>
      {sub && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{sub}</p>}
    </div>
    {children}
  </div>
);

const SectionTitle: React.FC<{ icon: any; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 pt-2">
    <Icon size={13} className="text-slate-400" />
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{children}</p>
    <div className="flex-1 h-px bg-slate-200" />
  </div>
);

const ChartTip: React.FC<any> = ({ active, payload, label, suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {fm(p.value)}{suffix}
        </p>
      ))}
    </div>
  );
};

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-medium text-slate-400 py-6 text-center">{children}</p>
);

// Ro'yxat qatori — nom + qiymat (jadval uslubida, tabular raqamlar)
const Row: React.FC<{ nom: string; qiymat: string; tone?: string }> = ({ nom, qiymat, tone = 'text-slate-700' }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
    <span className="text-[11px] font-semibold text-slate-600 truncate">{nom}</span>
    <span className={`text-[11px] font-bold tabular-nums whitespace-nowrap ${tone}`}>{qiymat}</span>
  </div>
);

const RISK_TONE: Record<string, { border: string; bg: string; icon: string; title: string; text: string; btn: string; dismiss: string }> = {
  critical: { border: 'border-rose-200', bg: 'bg-rose-50/60', icon: 'bg-rose-100 text-rose-600', title: 'text-rose-800', text: 'text-rose-700/90', btn: 'bg-rose-600 hover:bg-rose-700', dismiss: 'text-rose-700 hover:bg-rose-100' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50/60', icon: 'bg-amber-100 text-amber-600', title: 'text-amber-800', text: 'text-amber-700/90', btn: 'bg-amber-600 hover:bg-amber-700', dismiss: 'text-amber-700 hover:bg-amber-100' },
  info: { border: 'border-slate-200', bg: 'bg-slate-50', icon: 'bg-slate-100 text-slate-500', title: 'text-slate-700', text: 'text-slate-500', btn: 'bg-slate-700 hover:bg-slate-800', dismiss: 'text-slate-500 hover:bg-slate-100' },
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Jiddiy',
  warning: 'Ogohlantirish',
  info: "Ma'lumot",
};

// ── Sahifa ──────────────────────────────────────────────────────────

const BoshSahifa: React.FC<{ currentUser?: any; aiEnabled?: boolean }> = ({ currentUser, aiEnabled }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.role?.name?.toLowerCase() === 'superadmin';
  const p = currentUser?.permissions || currentUser?.role || {};
  const can = (perm: string | null) => (perm === null ? true : isAdmin || !!p[perm]);

  const { visible, toggle } = useWidgetVisibility(currentUser?.tenantId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<any[]>([]);

  useEffect(() => {
    dashboardApi.getSummary()
      .then(r => setS(r.data))
      .catch(() => setS(null))
      .finally(() => setLoading(false));
    aiApi.getRisks().then(r => setRisks(r.data || [])).catch(() => setRisks([]));
  }, []);

  const dismissRisk = (id: string) => {
    setRisks(prev => prev.filter(r => r.id !== id));
    aiApi.dismissRisk(id).catch(() => {});
  };
  const resolveRisk = (text: string) => {
    window.dispatchEvent(new CustomEvent('pf:ai-ask', { detail: { text } }));
  };

  const availableWidgets = WIDGETS.filter(w => can(w.perm));
  const show = (k: WidgetKey) => visible[k] && can(WIDGETS.find(w => w.key === k)!.perm);

  if (loading) return <SkeletonStats />;

  const nothingToShow = availableWidgets.every(w => !visible[w.key]) ||
    (!s?.finance && !s?.tasks && !s?.attendance && !s?.customers && !s?.inventory && !s?.vendors && !s?.employees && risks.length === 0);

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Sarlavha qatori */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{todayLabel()}</p>
        <div className="relative">
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="h-9 px-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Settings2 size={14} /> Widget'lar
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 mt-1 z-20 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-2.5 pt-1 pb-2">Ko'rsatiladigan bo'limlar</p>
                {availableWidgets.map(w => (
                  <button
                    key={w.key}
                    onClick={() => toggle(w.key)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                  >
                    <span className="text-[12px] font-semibold text-slate-700">{w.label}</span>
                    <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${visible[w.key] ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300'}`}>
                      {visible[w.key] && <Check size={11} strokeWidth={3} />}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI NAZORATI — sahifaning eng yuqorisidagi doimiy joy.
          Xavf yo'q bo'lganda ham bo'lim ko'rinadi ("hammasi joyida" kartasi),
          shunda ogohlantirish paydo bo'lganda foydalanuvchi uni aynan shu
          yerdan kutadi — sahifa ham sakrab ketmaydi. */}
      {show('risks') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle icon={ShieldAlert}>AI nazorati</SectionTitle>
            {risks.length > 0 && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                {risks.length} ta ogohlantirish
              </span>
            )}
          </div>

          {risks.length === 0 ? (
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-emerald-50 text-emerald-600 border-emerald-100 flex-shrink-0">
                <ShieldCheck size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Holat</p>
                <h3 className="text-sm font-bold tracking-tight text-slate-800">Xavf aniqlanmadi</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  AI modullarni o'zaro solishtirib fonda kuzatib turibdi
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {risks.map(r => {
                const tone = RISK_TONE[r.severity] || RISK_TONE.warning;
                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border shadow-sm flex flex-col ${tone.border} ${tone.bg}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${tone.icon}`}>
                      <ShieldAlert size={17} strokeWidth={2.5} />
                    </div>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${tone.text}`}>
                      {SEVERITY_LABEL[r.severity] || 'Ogohlantirish'}
                    </p>
                    <h3 className={`text-sm font-bold tracking-tight ${tone.title}`}>{r.title}</h3>
                    <p className={`text-[11px] font-semibold ${tone.text} mt-1 leading-snug flex-1`}>{r.message}</p>
                    <div className="flex items-center gap-2 mt-3">
                      {/* AI o'chiq bo'lsa tugma ko'rsatilmaydi — bosilsa
                          hech nima bo'lmasdi (chat umuman yuklanmagan). */}
                      {aiEnabled && (
                        <button
                          onClick={() => resolveRisk(buildRiskMessage(r.type, r.title, r.message))}
                          className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wider ${tone.btn} text-white rounded-lg transition-colors`}
                        >
                          Bartaraf etish
                        </button>
                      )}
                      <button
                        onClick={() => dismissRisk(r.id)}
                        className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wider ${tone.dismiss} rounded-lg transition-colors`}
                      >
                        Yopish
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* MOLIYA */}
      {show('finance') && s?.finance && (
        <section className="space-y-3">
          <SectionTitle icon={Wallet}>Moliya</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Bugungi kirim" value={`${fm(s.finance.kirim)}`} sub="so'm" icon={TrendingUp} tone="emerald" />
            <Stat label="Bugungi chiqim" value={`${fm(s.finance.chiqim)}`} sub="so'm" icon={TrendingDown} tone="rose" />
            <Stat label="Bugungi balans" value={`${fm(s.finance.balans)}`} sub="so'm" icon={Wallet} tone="dark" />
            <Stat label="30 kunlik sof" value={`${fm(s.finance.oylikKirim - s.finance.oylikChiqim)}`} sub={`kirim ${fmShort(s.finance.oylikKirim)} · chiqim ${fmShort(s.finance.oylikChiqim)}`} icon={TrendingUp} tone="brand" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Panel title="Kirim va chiqim" sub="so'nggi 14 kun" className="lg:col-span-2">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.finance.trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="kun" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis tickFormatter={fmShort} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<ChartTip suffix=" so'm" />} />
                    <Legend
                      verticalAlign="top" align="right" height={24} iconType="circle" iconSize={7}
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                    />
                    <Line type="monotone" dataKey="kirim" name="Kirim" stroke={EMERALD} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="chiqim" name="Chiqim" stroke={ROSE} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="To'lov turlari" sub="30 kunlik kirim">
              {s.finance.tolovTurlari.length === 0 ? (
                <EmptyNote>Kirim qayd etilmagan</EmptyNote>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={s.finance.tolovTurlari} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
                      <XAxis type="number" tickFormatter={fmShort} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="nom" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={72} />
                      <Tooltip content={<ChartTip suffix=" so'm" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Bar dataKey="summa" name="Kirim" fill={BRAND} radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        </section>
      )}

      {/* BUYURTMALAR */}
      {show('tasks') && s?.tasks && (
        <section className="space-y-3">
          <SectionTitle icon={ClipboardList}>Buyurtmalar</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Bugun yaratilgan" value={`${s.tasks.yangiBugun} ta`} icon={ClipboardList} tone="brand" />
            <Stat label="Jarayonda" value={`${s.tasks.jarayonda} ta`} icon={ClipboardList} tone="slate" />
            <Stat label="Bugun muddati" value={`${s.tasks.muddatiBugun} ta`} icon={ClipboardList} tone={s.tasks.muddatiBugun > 0 ? 'amber' : 'slate'} />
            <Stat label="Muddati o'tgan" value={`${s.tasks.kechikkan} ta`} icon={AlertTriangle} tone={s.tasks.kechikkan > 0 ? 'rose' : 'slate'} />
          </div>
          <Panel title="Bosqichlar bo'yicha taqsimot" sub="arxivlanmagan buyurtmalar">
            {s.tasks.bosqichlar.length === 0 ? (
              <EmptyNote>Kanban bosqichlari sozlanmagan</EmptyNote>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.tasks.bosqichlar} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="nom" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip content={<ChartTip suffix=" ta" />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                    <Bar dataKey="soni" name="Buyurtma" radius={[4, 4, 0, 0]} barSize={30}>
                      {s.tasks.bosqichlar.map((b: any, i: number) => (
                        // Tugallangan ustun semantik (yashil), qolganlari bitta brand rang.
                        <Cell key={i} fill={b.tugallangan ? EMERALD : BRAND} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </section>
      )}

      {/* DAVOMAT */}
      {show('attendance') && s?.attendance && (
        <section className="space-y-3">
          <SectionTitle icon={QrCode}>Davomat</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <Stat
                label="Bugun kelgan"
                value={`${s.attendance.checkedIn} / ${s.attendance.totalEmployees}`}
                sub={`${s.attendance.pct}% xodim`}
                icon={QrCode}
                tone={s.attendance.pct >= 80 ? 'emerald' : s.attendance.pct >= 50 ? 'amber' : 'rose'}
              />
              <Stat label="Kech qolgan" value={`${s.attendance.lateToday} ta`} icon={AlertTriangle} tone={s.attendance.lateToday > 0 ? 'amber' : 'slate'} />
            </div>
            <Panel title="Kelganlar" sub="so'nggi 7 kun" className="lg:col-span-2">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.attendance.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                    <XAxis dataKey="kun" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<ChartTip suffix=" ta" />} />
                    <Line type="monotone" dataKey="soni" name="Kelgan xodim" stroke={BRAND} strokeWidth={2} dot={{ r: 3, fill: BRAND, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </section>
      )}

      {/* MIJOZLAR / OMBOR / HAMKORLAR / XODIMLAR */}
      {(show('customers') || show('inventory') || show('vendors') || show('employees')) && (
        <section className="space-y-3">
          <SectionTitle icon={UserSquare2}>Baza va resurslar</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {show('customers') && s?.customers && (
              <Panel title="Mijozlar va qarzdorlar" sub={`${s.customers.total} ta mijoz · ${s.customers.qarzdorSoni} ta qarzdor`}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xl font-bold text-rose-600 tracking-tight">{fm(s.customers.qarzJami)}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">so'm qarz</span>
                </div>
                {s.customers.topQarzdorlar.length === 0 ? (
                  <EmptyNote>Qarzdorlar yo'q</EmptyNote>
                ) : (
                  <div>
                    {s.customers.topQarzdorlar.map((c: any, i: number) => (
                      <Row key={i} nom={c.nom} qiymat={`${fm(c.qarz)} so'm`} tone="text-rose-600" />
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {show('inventory') && s?.inventory && (
              <Panel title="Ombor" sub={`${s.inventory.total} ta material · ${fm(s.inventory.bandJami)} band`}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-xl font-bold tracking-tight ${s.inventory.kamQoldiqSoni > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {s.inventory.kamQoldiqSoni}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ta kam qoldiq</span>
                </div>
                {s.inventory.kamQoldiq.length === 0 ? (
                  <EmptyNote>Barcha materiallar yetarli</EmptyNote>
                ) : (
                  <div>
                    {s.inventory.kamQoldiq.map((m: any, i: number) => (
                      <Row key={i} nom={m.nom} qiymat={`${fm(m.qoldiq)} / ${fm(m.minimal)} ${m.birlik}`} tone="text-amber-600" />
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {show('vendors') && s?.vendors && (
              <Panel title="Hamkorlar" sub={`${s.vendors.total} ta hamkor`}>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Biz qarzdormiz</p>
                    <p className="text-base font-bold text-rose-600 tracking-tight">{fm(s.vendors.bizQarzdorJami)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bizga qarzdor</p>
                    <p className="text-base font-bold text-emerald-600 tracking-tight">{fm(s.vendors.ularQarzdorJami)}</p>
                  </div>
                </div>
                {s.vendors.qarzdorlar.length === 0 ? (
                  <EmptyNote>Hisob-kitob toza</EmptyNote>
                ) : (
                  <div>
                    {s.vendors.qarzdorlar.map((v: any, i: number) => (
                      <Row
                        key={i}
                        nom={v.nom}
                        qiymat={`${v.balans > 0 ? '−' : '+'}${fm(Math.abs(v.balans))} so'm`}
                        tone={v.balans > 0 ? 'text-rose-600' : 'text-emerald-600'}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {show('employees') && s?.employees && (
              <Panel title="Xodimlar" sub={`${s.employees.total} ta xodim`}>
                {s.employees.lavozimlar.length === 0 ? (
                  <EmptyNote>Xodimlar qo'shilmagan</EmptyNote>
                ) : (
                  <div>
                    {s.employees.lavozimlar.map((l: any, i: number) => (
                      <Row key={i} nom={l.nom} qiymat={`${l.soni} ta`} />
                    ))}
                  </div>
                )}
              </Panel>
            )}
          </div>
        </section>
      )}

      {nothingToShow && (
        <div className="bg-white border border-slate-200 rounded-xl py-14 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Settings2 size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-700">Ko'rsatiladigan bo'lim yo'q</p>
            <p className="text-[12px] font-medium text-slate-400 mt-0.5 max-w-xs">
              Yuqoridagi "Widget'lar" tugmasidan kerakli bo'limlarni yoqing yoki Sozlamalardan ruxsatlaringizni tekshiring.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoshSahifa;
