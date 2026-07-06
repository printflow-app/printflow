import React, { useEffect, useState } from 'react';
import { Sparkles, Save, Loader2, Sunrise, BarChart3, AlarmClock, Bot, CheckCircle2, Clock, XCircle } from 'lucide-react';
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
}

const DEFAULTS: Policies = {
  dailyBriefing: { enabled: true },
  weeklyReport: { enabled: true },
  deadlineWatchdog: { enabled: true, graceDays: 1 },
};

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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${m.cls}`}>
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
        <p className="text-[11px] font-semibold text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
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
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
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
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
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
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">kun</span>
            </div>
          </Row>

          <p className="text-[10px] font-semibold text-slate-400 leading-relaxed px-1">
            Barcha avtonom amallar jurnalga yoziladi — agent nima qilgani har doim ko'rinadi.
            Xabarlar faqat tarifingizda AI/Telegram bo'lsa yuboriladi.
          </p>

          {/* Davr statistikasi — agent qancha ish qildi */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Davrda amallar</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.amallar.davrda}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Bajarilgan</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.amallar.bajarilgan}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">Avtonom</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{stats.amallar.avtonom}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI xabarlar</p>
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
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Agent jurnali — so'nggi amallar</p>
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
                      <p className="text-[12px] font-bold text-slate-700 truncate">{a.summary}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
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
