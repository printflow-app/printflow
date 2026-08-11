import React, { useEffect, useState } from 'react';
import { Sparkles, Save, Loader2, Sunrise, BarChart3, AlarmClock, Bot, CheckCircle2, Clock, XCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'react-toastify';
import { settingsApi, aiApi } from '../api';

// =============================================
// GIRGITTON AGENT SOZLAMALARI — Faza 4 (avtonom fon agentlar).
// Tenant policy'si SystemSetting AGENT_POLICIES kalitida saqlanadi;
// backend cron'lari (briefing/weekly/watchdog) shu policy'ni o'qiydi.
// Faqat admin ko'radi (Sozlamalar sahifasida gate qilinadi).
// =============================================

interface Policies {
  dailyBriefing: { enabled: boolean };
  weeklyReport: { enabled: boolean };
  deadlineWatchdog: { enabled: boolean; graceDays: number };
  riskMonitoring: { enabled: boolean };
  autoResolve: {
    enabled: boolean;
    areas: Record<string, AreaMode>;
    allowedActions: string[];
    instructions: string;
    maxPerDay: number;
  };
}

type AreaMode = 'off' | 'propose' | 'execute';

// AI mustaqil qaror qabul qila oladigan sohalar.
// Har biri alohida sozlanadi: rahbar ish taqsimotini AI'ga ishonib
// topshirib, moliyaga tegishini taqiqlashi mumkin.
const AREAS: { key: string; label: string; desc: string }[] = [
  {
    key: 'ish_taqsimoti',
    label: 'Buyurtma va ish taqsimoti',
    desc: "Muddati o'tgan buyurtmalar, qotib qolgan ishlar, mas'ul xodim kelmagan holatlar.",
  },
  {
    key: 'davomat',
    label: 'Davomat',
    desc: "Xodimlarning ishga kelmasligi bilan bog'liq muammolar.",
  },
  {
    key: 'ombor',
    label: 'Ombor va material',
    desc: "Qoldiq kamayishi, buyurtma uchun material yetishmasligi.",
  },
  {
    key: 'moliya',
    label: 'Moliya va qarz',
    desc: 'Qarzdor mijozga yangi buyurtma, eskirgan qarzlar, xarajat keskin oshishi.',
  },
];

const MODE_LABEL: Record<AreaMode, { t: string; cls: string }> = {
  off: { t: 'Tegmasin', cls: 'bg-slate-100 text-slate-500' },
  propose: { t: 'Taklif qilsin', cls: 'bg-amber-100 text-amber-700' },
  execute: { t: "O'zi bajarsin", cls: 'bg-emerald-100 text-emerald-700' },
};

const DEFAULTS: Policies = {
  dailyBriefing: { enabled: true },
  weeklyReport: { enabled: true },
  deadlineWatchdog: { enabled: true, graceDays: 1 },
  riskMonitoring: { enabled: true },
  // Avtonom hal qilish sukut bo'yicha O'CHIQ — AI hech kim so'ramasdan ish
  // taqsimlashini rahbar ONGLI ravishda yoqishi kerak, tasodifan emas.
  autoResolve: {
    enabled: false,
    areas: { ish_taqsimoti: 'propose', davomat: 'off', ombor: 'off', moliya: 'off' },
    allowedActions: ['reassignTask'],
    instructions: '',
    maxPerDay: 5,
  },
};

// AI'ga berilishi mumkin bo'lgan avtonom amallar.
// Ro'yxat qasddan qisqa: avtonom rejimda faqat ORQAGA QAYTARISH MUMKIN
// bo'lgan amallar bo'lishi kerak. Pul harakati (addTransaction) bu yerda
// yo'q va bo'lmasligi ham kerak.
const AUTO_ACTIONS: { key: string; label: string; desc: string }[] = [
  {
    key: 'reassignTask',
    label: 'Buyurtmani boshqa xodimga o\'tkazish',
    desc: "Mas'ul xodim ishga kelmagan bo'lsa, AI bugun ishda bo'lgan, xuddi shu lavozimdagi va bandligi eng kam xodimni topib, buyurtmani unga o'tkazadi.",
  },
  {
    key: 'sendEmployeeMessage',
    label: 'Xodimga Telegram xabar yuborish',
    desc: 'AI muammo yuzasidan tegishli xodimga rahbariyat nomidan xabar yozadi (masalan "buyurtma sizga o\'tkazildi").',
  },
];

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-orange-500' : 'bg-slate-200'}`}
    aria-pressed={on}
  >
    <span
      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`}
    />
  </button>
);

// Jurnal yozuvi status chipi
const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { text: string; cls: string; icon: any }> = {
    executed: { text: 'Bajarildi', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
    pending: { text: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
    rejected: { text: 'Rad etildi', cls: 'bg-slate-50 text-slate-500 border-slate-200', icon: XCircle },
    failed: { text: 'Xato', cls: 'bg-rose-50 text-rose-600 border-rose-100', icon: XCircle },
  };
  const m = map[status] || map.failed;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${m.cls}`}>
      <Icon size={10} /> {m.text}
    </span>
  );
};

export const AgentPolicySection: React.FC = () => {
  const [policies, setPolicies] = useState<Policies>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [journal, setJournal] = useState<any[]>([]);

  useEffect(() => {
    settingsApi
      .get('AGENT_POLICIES')
      .then((r) => {
        const saved = r.data || {};
        setPolicies({
          dailyBriefing: { ...DEFAULTS.dailyBriefing, ...saved.dailyBriefing },
          weeklyReport: { ...DEFAULTS.weeklyReport, ...saved.weeklyReport },
          deadlineWatchdog: { ...DEFAULTS.deadlineWatchdog, ...saved.deadlineWatchdog },
          riskMonitoring: { ...DEFAULTS.riskMonitoring, ...saved.riskMonitoring },
          autoResolve: {
            ...DEFAULTS.autoResolve,
            ...saved.autoResolve,
            // Eski saqlangan sozlamada `areas` bo'lmasligi mumkin (ilgari
            // bitta umumiy `mode` bor edi) — u holda defaults ishlaydi.
            areas: { ...DEFAULTS.autoResolve.areas, ...(saved.autoResolve?.areas || {}) },
            instructions: saved.autoResolve?.instructions ?? '',
          },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Statistika + jurnal — agent nima qilgani shaffof ko'rinadi (Faza 5)
    aiApi.getAgentStats().then((r) => setStats(r.data)).catch(() => {});
    aiApi.listActions(10).then((r) => setJournal(r.data || [])).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.set('AGENT_POLICIES', policies);
      toast.success('Agent sozlamalari saqlandi');
    } catch {
      toast.error('Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const Row: React.FC<{
    icon: any;
    title: string;
    desc: string;
    on: boolean;
    onChange: (v: boolean) => void;
    children?: React.ReactNode;
  }> = ({ icon: Icon, title, desc, on, onChange, children }) => (
    <div className="flex items-start gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${on ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="text-xs font-semibold text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
        {on && children}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
        <div>
          <h3 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles className="text-orange-600" size={22} /> Girgitton Agent
          </h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Avtonom ishlar — agent siz so'ramasdan nima qilishiga ruxsat
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white h-10 px-6 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saqlanyapti...' : 'Saqlash'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 flex justify-center">
          <Loader2 size={28} className="text-orange-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <Row
            icon={Sunrise}
            title="Kunlik brifing (Telegram)"
            desc="Har kuni 08:00 da rahbariyatga: bugungi kassa, muddati o'tgan buyurtmalar, qarzdorlar, kam qoldiq. Telegram bog'langan adminlar va moliya ko'ra oladigan xodimlarga boradi."
            on={policies.dailyBriefing.enabled}
            onChange={(v) => setPolicies({ ...policies, dailyBriefing: { enabled: v } })}
          />
          <Row
            icon={BarChart3}
            title="Haftalik hisobot (Telegram)"
            desc="Har dushanba 08:30 da: hafta kirim/chiqimi, yangi va bajarilgan buyurtmalar, qarz holati."
            on={policies.weeklyReport.enabled}
            onChange={(v) => setPolicies({ ...policies, weeklyReport: { enabled: v } })}
          />
          <Row
            icon={AlarmClock}
            title="Muddat qo'riqchisi"
            desc="Muddati o'tgan buyurtma bo'yicha mas'ul xodimning o'ziga shaxsiy Telegram eslatma yuboradi (har kuni 11:00 da tekshiradi, bitta buyurtma uchun 3 kunda bir marta). Mas'ulsiz buyurtmalar rahbariyatga boradi."
            on={policies.deadlineWatchdog.enabled}
            onChange={(v) =>
              setPolicies({ ...policies, deadlineWatchdog: { ...policies.deadlineWatchdog, enabled: v } })
            }
          >
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Muddatdan keyin kutish:
              </span>
              <input
                type="number"
                min={0}
                max={30}
                value={policies.deadlineWatchdog.graceDays}
                onChange={(e) =>
                  setPolicies({
                    ...policies,
                    deadlineWatchdog: {
                      ...policies.deadlineWatchdog,
                      graceDays: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                    },
                  })
                }
                className="w-16 h-9 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">kun</span>
            </div>
          </Row>
          <Row
            icon={ShieldAlert}
            title="Xavf nazorati (butun tizim)"
            desc="AI barcha modullarni (buyurtmalar, davomat, ombor, mijozlar) o'zaro bog'lab kuzatadi va bir-biriga ta'sir qiladigan muammolarni topadi — masalan buyurtma bugun kerak, lekin xodim kelmagan; buyurtma uchun material yetmaydi; qarzdor mijozga yangi buyurtma berilgan. Telegram xabar yubormaydi, faqat AI Copilot panelida ko'rinadi."
            on={policies.riskMonitoring.enabled}
            onChange={(v) => setPolicies({ ...policies, riskMonitoring: { enabled: v } })}
          />

          {/* AVTONOM HAL QILISH — bu yerda AI birinchi marta o'zi qaror
              qiladi, shuning uchun har tanlov nima anglatishi yonida yozilgan.
              Rahbar "nimani yoqyapman" degan savolga sahifadan javob topishi kerak. */}
          <Row
            icon={Bot}
            title="Avtonom qaror qabul qilish"
            desc="Xavf topilganda AI faqat ogohlantirib qolmaydi — vaziyatni o'zi baholab, qaror chiqaradi. Nimani, qayerda va qanchalik mustaqil qilishini quyida siz belgilaysiz. Har kuni 12:00 da ishlaydi (davomat aniq bo'lgach)."
            on={policies.autoResolve.enabled}
            onChange={(v) =>
              setPolicies({ ...policies, autoResolve: { ...policies.autoResolve, enabled: v } })
            }
          >
            <div className="mt-3 space-y-4">
              {/* SOHALAR — AI qayerda mustaqil qaror qabul qila oladi */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  AI qayerda qaror qabul qila oladi
                </p>
                <p className="text-xs font-semibold text-slate-400 mb-2 leading-relaxed">
                  <b className="text-slate-500">Tegmasin</b> — AI bu sohaga aralashmaydi, faqat ogohlantiradi. {' '}
                  <b className="text-amber-600">Taklif qilsin</b> — qaror tayyorlaydi, lekin siz tasdiqlamaguningizcha
                  hech nima o'zgarmaydi. {' '}
                  <b className="text-emerald-600">O'zi bajarsin</b> — darhol bajaradi va keyin sizga hisobot beradi.
                </p>
                <div className="space-y-2">
                  {AREAS.map((a) => {
                    const cur: AreaMode = policies.autoResolve.areas[a.key] || 'off';
                    return (
                      <div
                        key={a.key}
                        className={`p-3 rounded-xl border ${cur === 'off' ? 'border-slate-200 bg-white' : 'border-orange-200 bg-orange-50/40'}`}
                      >
                        <p className="text-sm font-bold text-slate-700">{a.label}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5 leading-relaxed">{a.desc}</p>
                        <div className="flex gap-1.5 mt-2">
                          {(['off', 'propose', 'execute'] as AreaMode[]).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() =>
                                setPolicies({
                                  ...policies,
                                  autoResolve: {
                                    ...policies.autoResolve,
                                    areas: { ...policies.autoResolve.areas, [a.key]: m },
                                  },
                                })
                              }
                              className={`h-7 px-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                                cur === m ? MODE_LABEL[m].cls : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {MODE_LABEL[m].t}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ruxsat berilgan amallar */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  AI qila oladigan amallar
                </p>
                <div className="space-y-2">
                  {AUTO_ACTIONS.map((a) => {
                    const on = policies.autoResolve.allowedActions.includes(a.key);
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() =>
                          setPolicies({
                            ...policies,
                            autoResolve: {
                              ...policies.autoResolve,
                              allowedActions: on
                                ? policies.autoResolve.allowedActions.filter((k) => k !== a.key)
                                : [...policies.autoResolve.allowedActions, a.key],
                            },
                          })
                        }
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                          on ? 'border-orange-400 bg-orange-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${
                            on ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300'
                          }`}
                        >
                          {on && <CheckCircle2 size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm font-bold ${on ? 'text-orange-700' : 'text-slate-700'}`}>
                            {a.label}
                          </span>
                          <span className="block text-xs font-semibold text-slate-400 mt-0.5 leading-relaxed">
                            {a.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {policies.autoResolve.allowedActions.length === 0 && (
                  <p className="text-xs font-bold text-rose-500 mt-2">
                    Hech bir amal tanlanmagan — AI hech narsa qila olmaydi.
                  </p>
                )}
              </div>

              {/* SIZNING QOIDALARINGIZ — tizimni har tashkilotga moslashtiradigan joy */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Sizning qoidalaringiz
                </p>
                <p className="text-xs font-semibold text-slate-400 mb-2 leading-relaxed">
                  AI qaror qilishdan oldin shu qoidalarni o'qiydi va ularga amal qiladi. O'z tilingizda,
                  oddiy jumlalar bilan yozing — har qoida yangi qatordan.
                </p>
                <textarea
                  rows={5}
                  value={policies.autoResolve.instructions}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      autoResolve: { ...policies.autoResolve, instructions: e.target.value.slice(0, 2000) },
                    })
                  }
                  placeholder={
                    "Masalan:\n" +
                    "Dizayn ishini faqat dizaynerga ber, ustaga berma.\n" +
                    "Katta mijozlar buyurtmasini eng tajribali xodimga ber.\n" +
                    "Zoxidga qo'shimcha ish berma, u allaqachon band.\n" +
                    "Muddati bugun bo'lgan ishlarni birinchi navbatda hal qil."
                  }
                  className="w-full p-3 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 leading-relaxed resize-y"
                />
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  {policies.autoResolve.instructions.length}/2000
                </p>
              </div>

              {/* Kunlik chegara */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Kuniga ko'pi bilan:
                </span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={policies.autoResolve.maxPerDay}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      autoResolve: {
                        ...policies.autoResolve,
                        maxPerDay: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-16 h-9 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500"
                />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">amal</span>
              </div>
              <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                Chegara nazorat uchun: bir kunda ko'p muammo topilsa ham AI shu sondan ortiq
                ish qilmaydi, qolganini sizga qoldiradi.
                {Object.values(policies.autoResolve.areas).some((m) => m === 'execute') && (
                  <span className="block text-amber-600 font-bold mt-1">
                    Diqqat: "O'zi bajarsin" qo'yilgan sohalarda amallar sizdan so'ramasdan
                    bajariladi. Har biri jurnalga yoziladi va Telegramga xabar keladi.
                  </span>
                )}
              </p>
            </div>
          </Row>

          <p className="text-xs font-semibold text-slate-400 leading-relaxed px-1">
            Barcha avtonom amallar jurnalga yoziladi — agent nima qilgani har doim ko'rinadi.
            Xabarlar faqat tarifingizda AI/Telegram bo'lsa yuboriladi.
          </p>

          {/* Davr statistikasi — agent qancha ish qildi */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Davrda amallar</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.amallar.davrda}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Bajarilgan</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.amallar.bajarilgan}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[11px] font-bold text-orange-600 uppercase tracking-widest">Avtonom</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.amallar.avtonom}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">AI xabarlar</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {stats.xabarlar.ishlatilgan}
                  {!stats.xabarlar.cheksiz && <span className="text-xs text-slate-400"> / {stats.xabarlar.limit}</span>}
                </p>
              </div>
            </div>
          )}

          {/* Agent jurnali — so'nggi amallar */}
          {journal.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
                <Bot size={14} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Agent jurnali — so'nggi amallar</p>
              </div>
              <div className="divide-y divide-slate-50">
                {journal.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      a.userId === 'autonomous' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {a.userId === 'autonomous' ? <Sparkles size={12} /> : <Bot size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{a.summary}</p>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5">
                        {a.userId === 'autonomous' ? 'Girgitton (avtonom)' : 'Chat orqali'} ·{' '}
                        {new Date(a.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <StatusChip status={a.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
