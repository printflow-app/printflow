import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Plus, Trash2, Pencil, Wallet, TrendingUp, AlertTriangle, X, Check, HelpCircle } from 'lucide-react';
import { payrollApi, rolesApi, settingsApi } from '../api';
import CurrencyInput from './CurrencyInput';

// =============================================
// MAOSH SXEMASI — lavozim uchun oylik hisobni belgilash.
//
// OQIM (ataylab bosqichma-bosqich):
//   1. Lavozim tanlanadi
//   2. "+ To'lov turi qo'shish" → Fiksa / KPI / Jarima dan biri
//   3. O'sha tur NIMA SO'RASA faqat shuni so'raydi:
//        Fiksa  → nomi + summa (+ ixtiyoriy shart)
//        KPI    → nomi + nimaga qarab + har biri uchun qancha
//        Jarima → nomi + nimaga qarab + har biri uchun qancha ushlansin
//   4. Qo'shilganlar bitta qatorli xulosa bo'lib turadi
//
// Ilgari barcha tanlovlar bir vaqtda chiqarilgan edi (6 ta tugma yonma-yon) —
// chalkash bo'lgani uchun har safar BITTA savol beriladigan qilib qayta
// yozildi. Backend o'zgarmagan.
// =============================================

type Group = 'fiksa' | 'kpi' | 'jarima';
type Kind = 'fixed' | 'per_unit' | 'percent';
type Op = 'gte' | 'lte' | 'eq';

interface Condition { metric: string; op: Op; value: number }
interface Component {
  id: string;
  label: string;
  group: Group;
  kind: Kind;
  amount?: number;
  metric?: string;
  rate?: number;
  conditions?: Condition[];
  proportional?: boolean;
}

/** Pul o'lchaydigan metrikalar — faqat ular uchun "foiz" varianti mantiqiy. */
const MONEY_METRICS = new Set(['bajarilgan_buyurtma_summasi', 'kirim_summasi']);

/**
 * KPI QAYSI SANADAN BOSHLAB HISOBLANADI.
 *
 * Tashkilot KPI'ga o'tganda, o'tishdan oldin qabul qilingan buyurtmalar
 * hisobga olinmasligi kerak — ular boshqa shartlarda olingan va ular uchun
 * KPI va'da qilinmagan. Busiz butun eski arxiv birinchi oyning maoshiga
 * qo'shilib ketadi.
 */
const KpiStartDate: React.FC = () => {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    settingsApi.get('KPI_START_DATE')
      .then((r: any) => {
        const v = typeof r.data === 'string' ? r.data : (r.data?.value || '');
        const d = v ? String(v).slice(0, 10) : '';
        setValue(d); setSaved(d);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      // OBYEKT sifatida yuboriladi, oddiy satr emas.
      //
      // Bare string bilan axios JSON content-type qo'ymaydi va backend
      // @Body() bo'sh obyekt oladi — sozlama "{}" bo'lib saqlanardi.
      // Natijada toast "saqlandi" deb chiqsa ham, sahifa yangilanganda
      // maydon bo'sh qaytardi.
      await settingsApi.set('KPI_START_DATE', { value: value || null });
      setSaved(value);
      toast.success(value ? `KPI ${value} dan boshlab hisoblanadi` : 'Cheklov olib tashlandi');
    } catch {
      toast.error('Saqlashda xatolik');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
        KPI qaysi sanadan boshlab hisoblanadi
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="input-minimal h-10 text-sm font-bold w-auto"
        />
        {value !== saved && (
          <button onClick={save} disabled={busy} className="btn-primary h-10 px-4 text-xs">
            {busy ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        )}
        {value && (
          <button
            onClick={() => setValue('')}
            className="h-10 px-3 text-[12px] font-bold text-slate-400 hover:text-rose-500"
          >
            Tozalash
          </button>
        )}
      </div>
      <p className="text-[11px] font-semibold text-slate-400 mt-2 leading-relaxed">
        {value
          ? `Shu sanadan OLDIN qabul qilingan buyurtmalar KPI'ga kirmaydi — ular boshqa shartlarda olingan. Sanadan keyin qabul qilinganlari esa BAJARILGANDA hisoblanadi.`
          : `Belgilanmasa barcha buyurtmalar hisobga olinadi, jumladan KPI joriy qilinishidan oldingilari ham.`}
      </p>
      <p className="text-[11px] font-semibold text-slate-400 mt-1.5 leading-relaxed">
        KPI buyurtma <b>topshirilganda</b> yoziladi, qabul qilinganda emas — yo'lda
        bekor bo'lgan ish uchun pul berilmaydi. Shuning uchun oy oxirida olingan
        buyurtma keyingi oy tayyor bo'lsa, KPI keyingi oyga tushadi.
      </p>
    </div>
  );
};

// =============================================
// TANLOV NIMANI ANGLATADI
//
// `explain()` "shu raqamlarda qancha chiqadi" ni ko'rsatadi. Bu yerdagi
// matnlar boshqa savolga javob beradi: "bu ko'rsatkichni tanlasam,
// xodimga aslida NIMA UCHUN pul berayotgan bo'laman?".
//
// Har birida tuzoq ham aytiladi — masalan bir buyurtmada ikki xodim
// ishlasa ikkalasiga TO'LIQ yoziladi. Buni bilmasdan "har buyurtmadan
// 50 000" qo'yilsa, xarajat kutilganidan ikki barobar chiqadi.
// =============================================
const METRIC_MEANING: Record<string, string> = {
  ish_kunlari:
    "Xodim ish grafigi bo'yicha nechta kun kelgani. Dam olish kunlari sanalmaydi — grafik Davomat sozlamalaridan olinadi.",
  norma_ish_kunlari:
    "Shu oyda grafik bo'yicha jami nechta ish kuni borligi. Har oyda har xil (26, 27...), shuning uchun shartda aniq son yozish o'rniga davomat foizini ishlatgan ma'qul.",
  davomat_foizi:
    "Kelgan kunlar grafikdagi kunlarga nisbatan foizda. 100 = hamma kun kelgan. \"To'liq davomat uchun bonus\" ni aynan shu bilan yozing — u har oyda to'g'ri ishlaydi.",
  qoldirilgan_kunlar:
    "Grafikda bor, lekin kelmagan kunlar soni. Jarima uchun qulay.",
  ish_soatlari:
    "Kelish va ketish orasidagi soatlar yig'indisi. Chiqish belgilanmagan kun hisobga kirmaydi.",
  kechikish_daqiqa:
    "Oy davomida jami necha daqiqa kechikkani. Ish boshlanish vaqti Davomat sozlamalarida belgilanadi.",
  overtime_daqiqa:
    "Ish vaqtidan tashqari ishlagan daqiqalari.",
  bajarilgan_buyurtma_soni:
    "\"Bajarildi\" ustuniga o'tgan buyurtmalar soni. DIQQAT: bir buyurtmada bir necha xodim bo'lsa, har biriga TO'LIQ bittadan yoziladi — bo'linmaydi.",
  bajarilgan_buyurtma_summasi:
    "Bajarilgan buyurtmalarning pul summasi. DIQQAT: bir buyurtmada bir necha xodim bo'lsa, har biriga TO'LIQ summa yoziladi.",
  bajarilgan_buyurtma_miqdori:
    "Bajarilgan buyurtmalardagi dona soni (500 ta vizitka = 500). Ishbay to'lov uchun.",
  kirim_summasi:
    "Shu xodim orqali kassaga tushgan pul. Sotuv menejeri uchun mos.",
};

const KIND_MEANING: Record<string, string> = {
  fixed:
    "Belgilangan summa. Shart qo'yilmasa har oy shunchaki qo'shiladi; shart qo'yilsa faqat shart bajarilganda beriladi.",
  per_unit:
    "Har bir dona uchun narx. Ko'rsatkich 10 bo'lsa va narx 5 000 bo'lsa — 50 000 so'm.",
  percent:
    "Summadan foiz. Faqat pul ko'rsatkichlarida ishlaydi (buyurtma summasi, kirim).",
};

/** Bo'limga biriktirilgan xodim uchun qo'shimcha eslatma. */
const DEPT_NOTE =
  "Xodimga Xodimlar sahifasida bo'lim biriktirilgan bo'lsa, bu ko'rsatkich faqat O'SHA bo'lim buyurtma va tushumidan hisoblanadi.";

const TYPES: { key: Group; label: string; desc: string; icon: any; tone: string }[] = [
  { key: 'fiksa', label: 'Fiksa', desc: "Qat'iy summa. Shart qo'ysangiz — faqat shart bajarilsa beriladi.", icon: Wallet, tone: 'text-slate-700 border-slate-200 hover:border-slate-400' },
  { key: 'kpi', label: 'KPI', desc: "Natijaga qarab qo'shiladi (bajarilgan buyurtma, ish soati...).", icon: TrendingUp, tone: 'text-emerald-700 border-emerald-200 hover:border-emerald-400' },
  { key: 'jarima', label: 'Jarima', desc: 'Hisoblanadi, tasdiqlasangiz ushlab qolinadi.', icon: AlertTriangle, tone: 'text-rose-700 border-rose-200 hover:border-rose-400' },
];

const OPS: { key: Op; label: string }[] = [
  { key: 'gte', label: 'kamida' },
  { key: 'lte', label: "ko'pi bilan" },
  { key: 'eq', label: 'aniq' },
];

const fm = (n: number) => Math.round(n || 0).toLocaleString('uz-UZ').replace(/,/g, ' ');
const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Tushuntirishda ishlatiladigan namunaviy qiymatlar — "10 ta buyurtma bajarsa
 * shuncha bo'ladi" deb ko'rsatish uchun. Haqiqiy hisobga ta'sir qilmaydi,
 * faqat foydalanuvchi qoidaning natijasini oldindan ko'rishi uchun.
 */
const SAMPLE: Record<string, number> = {
  ish_kunlari: 22,
  ish_soatlari: 176,
  kechikish_daqiqa: 30,
  overtime_daqiqa: 60,
  bajarilgan_buyurtma_soni: 10,
  bajarilgan_buyurtma_summasi: 50_000_000,
  bajarilgan_buyurtma_miqdori: 500,
  kirim_summasi: 50_000_000,
};

export const SalarySchemeSection: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState<string>('');
  const [components, setComponents] = useState<Component[]>([]);
  const [dirty, setDirty] = useState(false);

  // Qo'shish oqimi: picking → tur tanlanmoqda, adding → savollar to'ldirilmoqda
  const [adding, setAdding] = useState<Component | null>(null);
  const [picking, setPicking] = useState(false);
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  const { data: metrics = [] } = useQuery({
    queryKey: ['payroll-metrics'],
    queryFn: async () => (await payrollApi.metrics()).data as { key: string; label: string }[],
    staleTime: Infinity,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await rolesApi.findAll()).data as any[],
  });
  const { data: schemes = [] } = useQuery({
    queryKey: ['salary-schemes'],
    queryFn: async () => (await payrollApi.listSchemes()).data as any[],
  });

  const scheme = useMemo(
    () => schemes.find((s: any) => s.roleId === roleId) || null,
    [schemes, roleId],
  );
  const role = roles.find((r: any) => r.id === roleId);
  const metricLabel = (k?: string) => metrics.find(m => m.key === k)?.label || k || '';

  const selectRole = (id: string) => {
    setRoleId(id);
    const s = schemes.find((x: any) => x.roleId === id);
    setComponents(s?.components || []);
    setAdding(null);
    setPicking(false);
    setDirty(false);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      payrollApi.saveScheme({
        id: scheme?.id,
        name: `${role?.name} sxemasi`,
        roleId,
        components,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-schemes'] });
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Saqlandi');
      setDirty(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Saqlashda xatolik'),
  });

  const delMut = useMutation({
    mutationFn: () => payrollApi.deleteScheme(scheme!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-schemes'] });
      qc.invalidateQueries({ queryKey: ['payroll'] });
      setComponents([]);
      setDirty(false);
      toast.success("Sxema o'chirildi — maosh yana qo'lda yoziladi");
    },
  });

  const startAdd = (group: Group) => {
    setPicking(false);
    setAdding({
      id: uid(),
      label: '',
      group,
      kind: group === 'fiksa' ? 'fixed' : 'per_unit',
      amount: 0,
      rate: 0,
      conditions: [],
    });
  };

  const commitAdd = () => {
    if (!adding) return;
    if (!adding.label.trim()) return toast.warning('Nom kiriting');
    if (adding.kind === 'fixed' && !(Number(adding.amount) > 0)) return toast.warning('Summa kiriting');
    if (adding.kind !== 'fixed') {
      if (!adding.metric) return toast.warning('"Nimaga qarab" ni tanlang');
      if (!(Number(adding.rate) > 0)) return toast.warning('Miqdorni kiriting');
    }
    setComponents(prev => {
      const idx = prev.findIndex(c => c.id === adding.id);
      return idx >= 0 ? prev.map(c => (c.id === adding.id ? adding : c)) : [...prev, adding];
    });
    setAdding(null);
    setDirty(true);
  };

  const totalFiksa = components
    .filter(c => c.group === 'fiksa' && c.kind === 'fixed')
    .reduce((s, c) => s + (c.amount || 0), 0);

  /** Bitta qatorda o'qiladigan xulosa. */
  const summary = (c: Component) => {
    if (c.kind === 'fixed') return `${fm(c.amount || 0)} so'm`;
    if (c.kind === 'percent') return `${metricLabel(c.metric)} ning ${c.rate}%`;
    return `har bir "${metricLabel(c.metric).toLowerCase()}" uchun ${fm(c.rate || 0)} so'm`;
  };

  /**
   * "Bunda bunaqa bo'ladi" — kiritilgan aniq raqamlar bilan tirik tushuntirish.
   *
   * Foydalanuvchi qoidani yozayotganda uning NATIJASINI ko'rishi kerak, aks
   * holda "shart bajarilmasa nima bo'ladi", "nisbatan hisoblash nima" degan
   * savollar javobsiz qoladi va sxema noto'g'ri tuziladi. Shuning uchun har
   * holat namunaviy son bilan ko'rsatiladi.
   */
  const explain = (c: Component): { ok: string[]; no: string[]; warn?: string } => {
    const ok: string[] = [];
    const no: string[] = [];

    const conds = c.conditions || [];
    const gteCond = conds.find(x => x.op === 'gte');

    if (c.kind === 'fixed') {
      const sum = c.amount || 0;
      if (conds.length === 0) {
        ok.push(`Har oy ${fm(sum)} so'm qo'shiladi — hech qanday shartsiz.`);
      } else {
        const condText = conds
          .map(x => `${metricLabel(x.metric).toLowerCase()} ${OPS.find(o => o.key === x.op)?.label} ${fm(x.value)}`)
          .join(' va ');
        ok.push(`${condText} bo'lsa → ${fm(sum)} so'm qo'shiladi.`);

        if (c.proportional && gteCond) {
          const part = Math.max(1, Math.round(gteCond.value * 0.9));
          const got = Math.round(sum * (part / (gteCond.value || 1)));
          no.push(`${fm(part)} bo'lsa → ${fm(got)} so'm (${fm(part)}/${fm(gteCond.value)} qismi).`);
        } else {
          no.push(`Shartlardan biri bajarilmasa → 0, bu qism umuman berilmaydi.`);
        }
      }
      return { ok, no };
    }

    // Metrikaga bog'liq qatorlar (KPI / jarima)
    if (!c.metric || !c.rate) return { ok: [], no: [] };
    const label = metricLabel(c.metric).toLowerCase();
    const sample = SAMPLE[c.metric] ?? 10;
    const isFine = c.group === 'jarima';

    if (c.kind === 'percent') {
      const got = Math.round((sample * (c.rate || 0)) / 100);
      ok.push(`${label} ${fm(sample)} bo'lsa → ${fm(got)} so'm (${c.rate}%).`);
      no.push(`${label} 0 bo'lsa → 0.`);
    } else {
      const got = sample * (c.rate || 0);
      ok.push(`${fm(sample)} ${label} bo'lsa → ${fm(got)} so'm.`);
      no.push(`${label} 0 bo'lsa → 0.`);
    }

    if (conds.length > 0) {
      const condText = conds
        .map(x => `${metricLabel(x.metric).toLowerCase()} ${OPS.find(o => o.key === x.op)?.label} ${fm(x.value)}`)
        .join(' va ');
      no.push(`Shart bajarilmasa (${condText}) → bu qator umuman hisoblanmaydi.`);
    }

    return {
      ok,
      no,
      warn: isFine
        ? "Jarima avtomatik ayrilmaydi — Maosh sahifasida \"Qabul qilish\" bosganingizdagina ushlanadi."
        : undefined,
    };
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <KpiStartDate />

      {/* 1-qadam: lavozim */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">
          1. Lavozimni tanlang
        </label>
        <select
          value={roleId}
          onChange={e => selectRole(e.target.value)}
          className="select-minimal font-bold w-full max-w-sm text-sm"
        >
          <option value="">Lavozim...</option>
          {roles.map((r: any) => {
            const has = schemes.some((s: any) => s.roleId === r.id);
            return <option key={r.id} value={r.id}>{r.name}{has ? ' — sxema bor' : ''}</option>;
          })}
        </select>
        {!roleId && (
          <p className="text-[12px] font-semibold text-slate-400 mt-2">
            Sxema belgilanmagan lavozimda maosh avvalgidek qo'lda yoziladi.
          </p>
        )}
      </div>

      {roleId && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            2. {role?.name} uchun to'lov turlari
          </p>

          {components.length === 0 && !adding && !picking && (
            <p className="text-[13px] font-semibold text-slate-400 py-3">
              Hali hech narsa qo'shilmagan.
            </p>
          )}

          <div className="space-y-2">
            {components.map(c => {
              const type = TYPES.find(t => t.key === c.group)!;
              const Icon = type.icon;
              const ex = explain(c);
              const open = openInfo === c.id;
              return (
                <div key={c.id} className="bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    c.group === 'jarima' ? 'bg-rose-100 text-rose-600'
                      : c.group === 'kpi' ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-2">{type.label}</span>
                      {c.label}
                    </p>
                    <p className="text-[12px] font-semibold text-slate-500 mt-0.5">
                      {summary(c)}
                      {(c.conditions || []).map((cd, i) => (
                        <span key={i} className="text-orange-600">
                          {' · '}{metricLabel(cd.metric)} {OPS.find(o => o.key === cd.op)?.label} {fm(cd.value)}
                        </span>
                      ))}
                    </p>
                  </div>
                  <button
                    onClick={() => setOpenInfo(open ? null : c.id)}
                    title="Nima bo'ladi"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      open ? 'text-orange-600 bg-orange-50' : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50'
                    }`}
                  >
                    <HelpCircle size={14} />
                  </button>
                  {canManage && (
                    <>
                      <button onClick={() => setAdding({ ...c })} title="Tahrirlash"
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 flex items-center justify-center">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { setComponents(p => p.filter(x => x.id !== c.id)); setDirty(true); }} title="O'chirish"
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>

                {/* Qator qanday ishlashini holatlar bo'yicha ochib beradi */}
                {open && (ex.ok.length > 0 || ex.no.length > 0) && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-200 space-y-1.5">
                    {ex.ok.map((line, i) => (
                      <div key={`o${i}`} className="flex items-start gap-2">
                        <Check size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" strokeWidth={3} />
                        <p className="text-[12px] font-semibold text-slate-700 leading-snug">{line}</p>
                      </div>
                    ))}
                    {ex.no.map((line, i) => (
                      <div key={`n${i}`} className="flex items-start gap-2">
                        <X size={12} className="text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={3} />
                        <p className="text-[12px] font-semibold text-slate-500 leading-snug">{line}</p>
                      </div>
                    ))}
                    {ex.warn && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-[12px] font-semibold text-amber-800 leading-snug">{ex.warn}</p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              );
            })}
          </div>

          {/* Tur tanlash */}
          {picking && (
            <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-4 space-y-2">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mb-2">Qanday to'lov turi?</p>
              {TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => startAdd(t.key)}
                    className={`w-full flex items-start gap-3 bg-white border-2 rounded-xl px-4 py-3 text-left transition-all ${t.tone}`}>
                    <Icon size={16} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold">{t.label}</p>
                      <p className="text-[12px] font-medium text-slate-500 mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
              <button onClick={() => setPicking(false)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider pt-1">
                Bekor qilish
              </button>
            </div>
          )}

          {/* Tanlangan turga qarab savollar */}
          {adding && (
            <div className="border border-orange-200 bg-orange-50/40 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-orange-700 uppercase tracking-widest">
                {TYPES.find(t => t.key === adding.group)?.label}
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Nomi</label>
                <input
                  value={adding.label}
                  onChange={e => setAdding({ ...adding, label: e.target.value })}
                  placeholder={
                    adding.group === 'fiksa' ? 'Masalan: Asosiy oylik'
                      : adding.group === 'kpi' ? 'Masalan: Bajarilgan ish uchun'
                      : 'Masalan: Kechikish uchun'
                  }
                  className="input-minimal w-full text-sm font-bold"
                  autoFocus
                />
              </div>

              {adding.group === 'fiksa' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Summa</label>
                  <CurrencyInput
                    value={adding.amount || ''}
                    onChange={(uzs) => setAdding({ ...adding, amount: Number(uzs) || 0 })}
                    colorClass="text-emerald-600"
                    className="input-minimal font-bold w-full max-w-xs"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                      Nimaga qarab?
                    </label>
                    <select
                      value={adding.metric || ''}
                      onChange={e => {
                        const metric = e.target.value;
                        setAdding({ ...adding, metric, kind: MONEY_METRICS.has(metric) ? adding.kind : 'per_unit' });
                      }}
                      className="select-minimal font-bold w-full max-w-md text-sm"
                    >
                      <option value="">Tanlang...</option>
                      {metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>

                    {/* Tanlangan ko'rsatkich nimani anglatishi — tuzoqlari
                        bilan. Raqamli misol pastdagi "Nima bo'ladi" blokida. */}
                    {adding.metric && METRIC_MEANING[adding.metric] && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-800 leading-relaxed">
                          {METRIC_MEANING[adding.metric]}
                        </p>
                        {(adding.metric === 'bajarilgan_buyurtma_soni' ||
                          adding.metric === 'bajarilgan_buyurtma_summasi' ||
                          adding.metric === 'kirim_summasi') && (
                          <p className="text-[11px] font-semibold text-slate-700/80 mt-1.5 leading-relaxed">
                            {DEPT_NOTE}
                          </p>
                        )}
                        {adding.kind && KIND_MEANING[adding.kind] && (
                          <p className="text-[11px] font-semibold text-slate-700/80 mt-1.5 leading-relaxed">
                            <b>To'lov turi:</b> {KIND_MEANING[adding.kind]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Foiz varianti faqat pul metrikasida so'raladi */}
                  {adding.metric && MONEY_METRICS.has(adding.metric) && (
                    <div className="flex gap-2">
                      {(['per_unit', 'percent'] as Kind[]).map(k => (
                        <button key={k} onClick={() => setAdding({ ...adding, kind: k })}
                          className={`px-3 h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg border-2 transition-all ${
                            adding.kind === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'
                          }`}>
                          {k === 'percent' ? 'Foiz' : 'Har birlik uchun'}
                        </button>
                      ))}
                    </div>
                  )}

                  {adding.metric && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">
                        {adding.kind === 'percent'
                          ? 'Necha foiz?'
                          : `Har bir "${metricLabel(adding.metric).toLowerCase()}" uchun qancha?`}
                      </label>
                      {adding.kind === 'percent' ? (
                        <input type="number" min={0} step="0.1" value={adding.rate ?? ''}
                          onChange={e => setAdding({ ...adding, rate: Number(e.target.value) || 0 })}
                          className="input-minimal font-bold w-32" />
                      ) : (
                        <CurrencyInput
                          value={adding.rate || ''}
                          onChange={(uzs) => setAdding({ ...adding, rate: Number(uzs) || 0 })}
                          colorClass="text-slate-700"
                          className="input-minimal font-bold w-full max-w-xs"
                        />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Shartlar — ixtiyoriy */}
              <div className="pt-1">
                {(adding.conditions || []).map((cd, ci) => (
                  <div key={ci} className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Faqat agar</span>
                    <select value={cd.metric}
                      onChange={e => setAdding({ ...adding, conditions: adding.conditions!.map((x, i) => i === ci ? { ...x, metric: e.target.value } : x) })}
                      className="select-minimal text-xs font-bold flex-1 min-w-[170px]">
                      {metrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <select value={cd.op}
                      onChange={e => setAdding({ ...adding, conditions: adding.conditions!.map((x, i) => i === ci ? { ...x, op: e.target.value as Op } : x) })}
                      className="select-minimal text-xs font-bold w-32">
                      {OPS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <input type="number" value={cd.value}
                      onChange={e => setAdding({ ...adding, conditions: adding.conditions!.map((x, i) => i === ci ? { ...x, value: Number(e.target.value) || 0 } : x) })}
                      className="input-minimal text-xs font-bold w-20" />
                    <button onClick={() => setAdding({ ...adding, conditions: adding.conditions!.filter((_, i) => i !== ci) })}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 flex items-center justify-center">
                      <X size={13} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setAdding({
                    ...adding,
                    conditions: [...(adding.conditions || []), { metric: metrics[0]?.key || '', op: 'gte', value: 0 }],
                  })}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-wider"
                >
                  + Shart qo'shish
                </button>

                {adding.kind === 'fixed' && (adding.conditions || []).some(x => x.op === 'gte') && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={!!adding.proportional}
                      onChange={e => setAdding({ ...adding, proportional: e.target.checked })}
                      className="w-3.5 h-3.5 accent-orange-500" />
                    <span className="text-[11px] font-semibold text-slate-600">
                      Shart to'liq bajarilmasa nisbatan berilsin (22 dan 20 kun → 20/22 qismi)
                    </span>
                  </label>
                )}
              </div>

              {/* TIRIK TUSHUNTIRISH — kiritilgan raqamlar bilan "bunda bunaqa bo'ladi" */}
              {(() => {
                const ex = explain(adding);
                if (ex.ok.length === 0 && ex.no.length === 0) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      Nima bo'ladi
                    </p>
                    <div className="space-y-1.5">
                      {ex.ok.map((line, i) => (
                        <div key={`ok${i}`} className="flex items-start gap-2">
                          <Check size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" strokeWidth={3} />
                          <p className="text-[12px] font-semibold text-slate-700 leading-snug">{line}</p>
                        </div>
                      ))}
                      {ex.no.map((line, i) => (
                        <div key={`no${i}`} className="flex items-start gap-2">
                          <X size={12} className="text-slate-400 mt-0.5 flex-shrink-0" strokeWidth={3} />
                          <p className="text-[12px] font-semibold text-slate-500 leading-snug">{line}</p>
                        </div>
                      ))}
                      {ex.warn && (
                        <div className="flex items-start gap-2 pt-1.5 mt-1.5 border-t border-slate-100">
                          <AlertTriangle size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-[12px] font-semibold text-amber-800 leading-snug">{ex.warn}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2 border-t border-orange-200">
                <button onClick={() => setAdding(null)}
                  className="h-9 px-4 text-[12px] font-bold uppercase tracking-wider text-slate-500 hover:bg-white rounded-lg">
                  Bekor qilish
                </button>
                <button onClick={commitAdd}
                  className="h-9 px-5 bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                  <Check size={13} /> Qo'shish
                </button>
              </div>
            </div>
          )}

          {!adding && !picking && canManage && (
            <button onClick={() => setPicking(true)}
              className="h-10 px-4 text-[12px] font-bold uppercase tracking-wider rounded-xl border-2 border-dashed border-slate-300 text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1.5">
              <Plus size={14} /> To'lov turi qo'shish
            </button>
          )}

          {components.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <p className="text-[12px] font-semibold text-slate-600">
                Barcha shartlar bajarilganda fiksa:{' '}
                <span className="text-emerald-600 font-bold">{fm(totalFiksa)} so'm</span>
              </p>
              <div className="flex gap-2">
                {scheme && canManage && (
                  <button
                    onClick={() => {
                      if (!confirm(`"${role?.name}" sxemasi o'chirilsinmi? Maosh yana qo'lda yoziladi.`)) return;
                      delMut.mutate();
                    }}
                    className="h-10 px-4 text-[12px] font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    O'chirish
                  </button>
                )}
                <button
                  disabled={!canManage || !dirty || saveMut.isPending}
                  onClick={() => saveMut.mutate()}
                  className="h-10 px-6 bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-40"
                >
                  {saveMut.isPending ? 'Saqlanmoqda...' : dirty ? 'Saqlash' : 'Saqlangan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
