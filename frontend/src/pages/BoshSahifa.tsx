import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, ClipboardList, QrCode, ShieldAlert, ShieldCheck,
  Settings2, Check, UserSquare2, AlertTriangle, Bot, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { dashboardApi, aiApi } from '../api';
import { SkeletonStats } from '../components/Skeleton';
import { buildRiskMessage } from '../utils/riskPrompt';
import { chartColors } from '../lib/chartColors';

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

// Ranglar — yagona manbadan (lib/chartColors). Sahifada xom hex yozilmaydi.
const BRAND = chartColors.primary;
const EMERALD = chartColors.success;
const ROSE = chartColors.danger;
const GRID = chartColors.grid;
const AXIS = chartColors.axis;

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
  tone?: 'brand' | 'emerald' | 'rose' | 'amber' | 'slate';
  /** `ink` — to'q ko'k to'ldirilgan karta. Guruhda faqat BITTA: yakuniy natija. */
  variant?: 'default' | 'ink';
}> = ({ label, value, sub, icon: Icon, tone = 'slate', variant = 'default' }) => {
  const tones: Record<string, string> = {
    brand: 'bg-primary-50 text-primary-600 border-primary-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const isInk = variant === 'ink';
  return (
    <div className={`rounded-card p-4 ${isInk ? 'bg-ink' : 'bg-white border border-slate-200'}`}>
      <div className={`w-9 h-9 rounded-control flex items-center justify-center mb-3 border ${isInk ? 'bg-white/10 text-white border-white/15' : tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className={`label-caps mb-0.5 ${isInk ? 'text-white/70' : ''}`}>{label}</p>
      <h3 className={`text-xl font-semibold tracking-tight tabular-nums ${isInk ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
      {sub && <p className={`mt-0.5 text-xs ${isInk ? 'text-white/60' : 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
};

const Panel: React.FC<{ title: string; sub?: string; children: React.ReactNode; className?: string }> = ({
  title, sub, children, className = '',
}) => (
  <div className={`bg-white rounded-card border border-slate-200 p-4 ${className}`}>
    <div className="mb-3">
      <p className="t-h3">{title}</p>
      {sub && <p className="t-caption mt-0.5">{sub}</p>}
    </div>
    {children}
  </div>
);

const SectionTitle: React.FC<{ icon: any; children: React.ReactNode }> = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 pt-2">
    <Icon size={16} className="text-slate-400" />
    <p className="t-h3">{children}</p>
    <div className="flex-1 h-px bg-slate-200" />
  </div>
);

const ChartTip: React.FC<any> = ({ active, payload, label, suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-control shadow-md px-3 py-2">
      <p className="label-caps mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 tabular-nums">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {fm(p.value)}{suffix}
        </p>
      ))}
    </div>
  );
};

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="t-caption py-6 text-center">{children}</p>
);

// Ro'yxat qatori — nom + qiymat (jadval uslubida, tabular raqamlar)
const Row: React.FC<{ nom: string; qiymat: string; tone?: string }> = ({ nom, qiymat, tone = 'text-slate-700' }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
    <span className="text-xs font-medium text-slate-600 truncate">{nom}</span>
    <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${tone}`}>{qiymat}</span>
  </div>
);

const RISK_TONE: Record<string, { border: string; bg: string; icon: string; title: string; text: string; btn: string; dismiss: string }> = {
  critical: { border: 'border-rose-200', bg: 'bg-rose-50/60', icon: 'bg-rose-100 text-rose-600', title: 'text-rose-800', text: 'text-rose-700/90', btn: 'btn-danger h-sm', dismiss: 'btn-ghost h-sm' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50/60', icon: 'bg-amber-100 text-amber-600', title: 'text-amber-800', text: 'text-amber-700/90', btn: 'btn-outline h-sm', dismiss: 'btn-ghost h-sm' },
  info: { border: 'border-slate-200', bg: 'bg-slate-50', icon: 'bg-slate-100 text-slate-500', title: 'text-slate-700', text: 'text-slate-500', btn: 'btn-outline h-sm', dismiss: 'btn-ghost h-sm' },
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
  // AI o'zi (hech kim so'ramasdan) qilgan ishlar — userId='autonomous'.
  // Rahbar AI nima qilganini bilib turishi kerak, aks holda avtonom rejim
  // "qora quti" ga aylanadi.
  const [aiActions, setAiActions] = useState<any[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  // AI o'zi bajarib bo'lgan ishlar — sukut bo'yicha yopiq (izohga qarang).
  const [aiTarixOchiq, setAiTarixOchiq] = useState(false);

  const loadAiActions = () => {
    aiApi.listActions(20)
      .then(r => setAiActions((r.data || []).filter((a: any) => a.userId === 'autonomous')))
      .catch(() => setAiActions([]));
  };

  useEffect(() => {
    dashboardApi.getSummary()
      .then(r => setS(r.data))
      .catch(() => setS(null))
      .finally(() => setLoading(false));
    aiApi.getRisks().then(r => setRisks(r.data || [])).catch(() => setRisks([]));
    loadAiActions();
  }, []);

  const decideAction = async (id: string, ok: boolean) => {
    setBusyAction(id);
    try {
      await (ok ? aiApi.confirmAction(id) : aiApi.rejectAction(id));
      loadAiActions();
      // Taklif bajarilgach xavf ham yo'qolgan bo'lishi mumkin.
      if (ok) aiApi.getRisks().then(r => setRisks(r.data || [])).catch(() => {});
    } finally {
      setBusyAction(null);
    }
  };

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
    (!s?.finance && !s?.tasks && !s?.attendance && !s?.customers && !s?.inventory && !s?.vendors && !s?.employees && risks.length === 0 && aiActions.length === 0);

  // AI YOZUVLARI IKKIGA BO'LINADI.
  //
  // Ilgari hammasi bir xil kattalikdagi kartochka bo'lib chiqardi va AI
  // faol ishlagan kunlarda (o'nlab eslatma) butun ekranni egallab, moliya
  // va boshqa haqiqiy ko'rsatkichlarni pastga surib yuborardi.
  //
  // Endi rahbardan AMAL talab qiladigani (tasdiq kutayotgan, bajarilmagan)
  // yuqorida to'liq ko'rinadi, AI o'zi bajarib bo'lgani esa yopiq holda
  // turadi — u hisobot, har kuni o'qish shart emas.
  const etiborKerak = aiActions.filter(a => a.status === 'pending' || a.status === 'failed');
  const bajarilgan = aiActions.filter(a => a.status !== 'pending' && a.status !== 'failed');

  // Bir xil matnli yozuvlar birlashtiriladi: AI har yugurishida "11 ta
  // muddati o'tgan buyurtma bo'yicha eslatma yuborildi" deb yozadi va bu
  // qator kuniga o'n marta takrorlanadi. Takrorni sanab ko'rsatgan
  // ma'lumotliroq va o'n barobar qisqa.
  const bajarilganGuruh: { summary: string; soni: number; vaqt: string | null }[] = [];
  for (const a of bajarilgan) {
    const bor = bajarilganGuruh.find(g => g.summary === a.summary);
    if (bor) bor.soni += 1;
    else bajarilganGuruh.push({ summary: a.summary, soni: 1, vaqt: a.createdAt || null });
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-4">
      {/* Sarlavha qatori */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps">{todayLabel()}</p>
        <div className="relative">
          <button
            onClick={() => setPickerOpen(v => !v)}
            className="btn-ghost h-sm"
          >
            <Settings2 size={16} /> Widget'lar
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-sticky" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 mt-1 z-dropdown w-60 bg-white border border-slate-200 rounded-card shadow-md p-2 animate-fade-in">
                <p className="label-caps px-2.5 pt-1 pb-2">Ko'rsatiladigan bo'limlar</p>
                {availableWidgets.map(w => (
                  <button
                    key={w.key}
                    onClick={() => toggle(w.key)}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-control hover:bg-slate-50 text-left transition-colors duration-120"
                  >
                    <span className="text-sm font-medium text-slate-700">{w.label}</span>
                    <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${visible[w.key] ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white' : 'border-slate-300'}`}>
                      {visible[w.key] && <Check size={12} />}
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
              <span className="label-caps whitespace-nowrap">
                {risks.length} ta ogohlantirish
              </span>
            )}
          </div>

          {risks.length === 0 ? (
            <div className="p-4 rounded-card border border-slate-200 bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-control flex items-center justify-center border bg-emerald-50 text-emerald-600 border-emerald-100 flex-shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="label-caps mb-0.5">Holat</p>
                <h3 className="t-h3">Xavf aniqlanmadi</h3>
                <p className="t-caption mt-0.5">
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
                    className={`p-4 rounded-card border flex flex-col ${tone.border} ${tone.bg}`}
                  >
                    <div className={`w-9 h-9 rounded-control flex items-center justify-center mb-3 ${tone.icon}`}>
                      <ShieldAlert size={18} />
                    </div>
                    <p className={`label-caps mb-0.5 ${tone.text}`}>
                      {SEVERITY_LABEL[r.severity] || 'Ogohlantirish'}
                    </p>
                    <h3 className={`text-sm font-semibold tracking-tight ${tone.title}`}>{r.title}</h3>
                    <p className={`text-xs font-normal ${tone.text} mt-1 leading-snug flex-1`}>{r.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {/* AI o'chiq bo'lsa tugma ko'rsatilmaydi — bosilsa
                          hech nima bo'lmasdi (chat umuman yuklanmagan). */}
                      {aiEnabled && (
                        <button
                          onClick={() => resolveRisk(buildRiskMessage(r.type, r.title, r.message))}
                          className={tone.btn}
                        >
                          Bartaraf etish
                        </button>
                      )}
                      <button
                        onClick={() => dismissRisk(r.id)}
                        className={tone.dismiss}
                      >
                        Yopish
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI O'ZI QILGAN ISHLAR.
              `pending` — AI taklif qildi, rahbar tasdiqlashi kerak.
              `executed` — avtonom rejim yoqilgani uchun AI o'zi bajardi;
              bu yerda u faqat hisobot beradi, chunki rahbar nima
              bo'layotganini ko'rib turishi shart. */}
          {/* E'TIBOR TALAB QILADIGANLARI — tasdiq kutayotgan va bajarilmagan
              ishlar. Faqat shular to'liq kartochka bo'lib chiqadi: ular
              ustida rahbar amal qilishi kerak. */}
          {etiborKerak.length > 0 && (
            <div className="space-y-2">
              <p className="label-caps pt-1">
                AI — e'tiboringiz kerak
              </p>
              {etiborKerak.map(a => {
                const pending = a.status === 'pending';
                const failed = a.status === 'failed';
                return (
                  <div
                    key={a.id}
                    className={`p-3.5 rounded-card border flex items-start gap-3 ${
                      pending ? 'border-amber-200 bg-amber-50/60'
                      : failed ? 'border-rose-200 bg-rose-50/60'
                      : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-control flex items-center justify-center flex-shrink-0 border ${
                      pending ? 'bg-amber-100 text-amber-600 border-amber-200'
                      : failed ? 'bg-rose-100 text-rose-600 border-rose-200'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      <Bot size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="label-caps mb-0.5">
                        {pending ? 'Tasdiq kutilmoqda'
                          : failed ? 'Bajarilmadi'
                          : a.status === 'rejected' ? 'Rad etilgan'
                          : 'AI bajardi'}
                      </p>
                      <p className="t-body-md leading-snug">{a.summary}</p>
                      {failed && a.error && (
                        <p className="text-xs font-medium text-rose-600 mt-1">{a.error}</p>
                      )}
                      {pending && (
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <button
                            disabled={busyAction === a.id}
                            onClick={() => decideAction(a.id, true)}
                            className="h-control-sm px-3 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-control transition-colors duration-120"
                          >
                            Tasdiqlash
                          </button>
                          <button
                            disabled={busyAction === a.id}
                            onClick={() => decideAction(a.id, false)}
                            className="h-control-sm px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 rounded-control transition-colors duration-120"
                          >
                            Rad etish
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI O'ZI BAJARGAN ISHLAR — yopiq hisobot.
              Bitta qatorga sig'adi; ochilganda takrorlar «×N» bilan
              birlashtirilgan qisqa ro'yxat chiqadi. */}
          {bajarilganGuruh.length > 0 && (
            <div className="rounded-card border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setAiTarixOchiq(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-120"
              >
                <div className="w-8 h-8 rounded-control flex items-center justify-center flex-shrink-0 border bg-emerald-50 text-emerald-600 border-emerald-100">
                  <Bot size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="label-caps">
                    AI bajargan ishlar
                  </p>
                  <p className="t-h3">
                    {bajarilgan.length} ta ish
                    {bajarilganGuruh.length !== bajarilgan.length && (
                      <span className="font-normal text-slate-500"> · {bajarilganGuruh.length} xil</span>
                    )}
                  </p>
                </div>
                {aiTarixOchiq
                  ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
                  : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
              </button>

              {aiTarixOchiq && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {bajarilganGuruh.map((g, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-2">
                      <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-slate-600 leading-snug flex-1 min-w-0">
                        {g.summary}
                      </p>
                      {g.soni > 1 && (
                        <span className="text-xs font-semibold text-slate-500 flex-shrink-0 tabular-nums">
                          ×{g.soni}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
            <Stat label="Bugungi balans" value={`${fm(s.finance.balans)}`} sub="so'm" icon={Wallet} tone="slate" />
            <Stat label="30 kunlik sof" value={`${fm(s.finance.oylikKirim - s.finance.oylikChiqim)}`} sub={`kirim ${fmShort(s.finance.oylikKirim)} · chiqim ${fmShort(s.finance.oylikChiqim)}`} icon={TrendingUp} variant="ink" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Panel title="Kirim va chiqim" sub="so'nggi 14 kun" className="lg:col-span-2">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.finance.trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="kun" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis tickFormatter={fmShort} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<ChartTip suffix=" so'm" />} />
                    <Legend
                      verticalAlign="top" align="right" height={24} iconType="circle" iconSize={7}
                      wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                    />
                    <Line type="monotone" dataKey="kirim" name="Kirim" stroke={EMERALD} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                    <Line type="monotone" dataKey="chiqim" name="Chiqim" stroke={ROSE} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
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
                      <CartesianGrid stroke={GRID} horizontal={false} />
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
                    <CartesianGrid stroke={GRID} vertical={false} />
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
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="kun" tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<ChartTip suffix=" ta" />} />
                    <Line type="monotone" dataKey="soni" name="Kelgan xodim" stroke={BRAND} dot={{ r: 3, fill: BRAND, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
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
                  <span className="text-xl font-semibold text-rose-600 tracking-tight tabular-nums">{fm(s.customers.qarzJami)}</span>
                  <span className="label-caps">so'm qarz</span>
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
                  <span className={`text-xl font-semibold tracking-tight tabular-nums ${s.inventory.kamQoldiqSoni > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {s.inventory.kamQoldiqSoni}
                  </span>
                  <span className="label-caps">ta kam qoldiq</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  <div>
                    <p className="label-caps">Biz qarzdormiz</p>
                    <p className="text-base font-semibold text-rose-600 tracking-tight tabular-nums">{fm(s.vendors.bizQarzdorJami)}</p>
                  </div>
                  <div>
                    <p className="label-caps">Bizga qarzdor</p>
                    <p className="text-base font-semibold text-emerald-600 tracking-tight tabular-nums">{fm(s.vendors.ularQarzdorJami)}</p>
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
        <div className="bg-white border border-slate-200 rounded-card py-14 px-4 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-card bg-slate-100 text-slate-400 flex items-center justify-center">
            <Settings2 size={20} />
          </div>
          <div className="text-center">
            <p className="t-h3">Ko'rsatiladigan bo'lim yo'q</p>
            <p className="t-caption mt-0.5 max-w-xs">
              Yuqoridagi "Widget'lar" tugmasidan kerakli bo'limlarni yoqing yoki Sozlamalardan ruxsatlaringizni tekshiring.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoshSahifa;
