import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Send, Sparkles, Bot, CheckCircle2,
  Loader2, Package, Zap, ShieldCheck,
  Plus, Settings, Mic, MicOff, AlertTriangle,
  ArrowUpRight, Wallet, UserSquare2, ClipboardList, PackageOpen, ShieldAlert,
  Brain, ChevronRight, Maximize2, Minimize2
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { aiApi } from '../../api';
import { Badge } from '../ui';
import { isRiskMessage, stripRiskPrefix } from '../../utils/riskPrompt';

// =============================================
// PRINTFLOW AI COPILOT (PRO ARCHITECT VERSION)
// Handles: Orders, Services, and Service Options.
// Features: Generative UI, Tool Confirmations, Auto-Refresh.
// =============================================

const STARTER_SUGGESTIONS = [
  'Yangi buyurtma yaratish',
  "Qarzdorlarni ko'rsat",
  'Bu oy kassa holati qanday?',
  'Muddati yaqin buyurtmalar',
];

// AI ba'zan baribir markdown chiqaradi — display vaqtida tozalaymiz.
// System prompt allaqachon man qiladi, lekin defensive cleanup ham bo'lsin.
const stripMarkdown = (text: string): string =>
  text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*---+\s*$/gm, '');

// Chrome ba'zan o'zbek nutqini rus kirillida transkribe qilishi mumkin.
// Uni avtomatik O'zbek lotin yozuviga aylantiramiz.
const CYR_TO_LAT_MAP: Record<string, string> = {
  // Ruscha 'х' lotincha 'x' ga o'giriladi (masalan: xizmat, xato, yaxshi).
  // O'zbekcha 'ҳ' esa lotincha 'h' ga o'giriladi (masalan: hujjat, haqida).
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
  'ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
  'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
  'ф':'f','х':'x','ц':'s','ч':'ch','ш':'sh','щ':'sh',
  'ъ':"'",'ы':'i','ь':'','э':'e','ю':'yu','я':'ya',
  // Uzbek-specific Cyrillic letters
  'қ':'q','ў':"o'",'ғ':"g'",'ҳ':'h',
  'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo',
  'Ж':'J','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M',
  'Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U',
  'Ф':'F','Х':'X','Ц':'S','Ч':'Ch','Ш':'Sh','Щ':'Sh',
  'Ъ':"'",'Ы':'I','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
  'Қ':'Q','Ў':"O'",'Ғ':"G'",'Ҳ':'H',
};
const cyrToLat = (text: string): string =>
  text.replace(/[Ѐ-ӿ]/g, (ch) => CYR_TO_LAT_MAP[ch] ?? ch);

// =============================================
// FIKRLASH BLOKI — model javob berishdan oldin nima o'ylaganini ko'rsatadi.
//
// Nega ko'rsatamiz: fikrlashni yashirish PULNI TEJAMAYDI — model baribir
// o'ylaydi va o'sha tokenlar baribir hisoblanadi. Ya'ni ko'rsatish tekin.
// Yashirilganda esa foydalanuvchi uzoq jimlikni ko'radi va tizim qotib
// qolgandek tuyuladi; ochiq bo'lsa agent qanday xulosa chiqarayotgani
// ko'rinib turadi.
//
// Oqim davomida o'zi ochiladi, tugagach yopiladi — asosiysi javob, fikrlash
// esa ixtiyoriy tafsilot. Foydalanuvchi bir marta bossa, uning tanlovi
// ustun turadi (`qolda`).
// =============================================
const ReasoningBlock: React.FC<{ text: string; streaming: boolean }> = ({ text, streaming }) => {
  const [qolda, setQolda] = useState<boolean | null>(null);
  const ochiq = qolda ?? streaming;

  return (
    <div className="w-full rounded-card border border-slate-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setQolda(!ochiq)}
        aria-expanded={ochiq}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-slate-100 transition-colors duration-120"
      >
        <Brain
          size={16}
          className={`flex-shrink-0 text-slate-500 ${streaming ? 'animate-pulse' : ''}`}
        />
        <span className="t-label">
          {streaming ? "O'ylayapti…" : 'Fikrlash'}
        </span>
        <ChevronRight
          size={16}
          className={`ml-auto flex-shrink-0 text-slate-500 transition-transform duration-180 ${ochiq ? 'rotate-90' : ''}`}
        />
      </button>

      {ochiq && (
        <div className="px-3.5 pb-3 text-xs leading-[1.65] text-slate-600 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
};

// Build chat URL the same way as the main axios client (api/index.ts):
// - dev: '/api/ai/chat' (Vite proxy → localhost:4000)
// - prod: '<VITE_API_URL>/api/ai/chat' (Railway backend)
const rawApiUrl = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
const API_BASE = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api') : '/api';

const chatTransport = new DefaultChatTransport({
  api: `${API_BASE}/ai/chat`,
  credentials: 'include', // send httpOnly auth cookie
  headers: () => {
    const h: Record<string, string> = {};
    try {
      const raw = localStorage.getItem('pf_user_info') || sessionStorage.getItem('pf_user_info');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.tenantId) h['X-Tenant-Id'] = u.tenantId;
      }
      const bearer = localStorage.getItem('pf_token');
      if (bearer) h['Authorization'] = `Bearer ${bearer}`;
    } catch {}
    return h;
  },
});

// ── UI Components ──────────────────────────────────────────────────

const SuccessBadge: React.FC<{ text: string }> = ({ text }) => (
  <div className="mt-3 rounded-card border border-emerald-200 bg-emerald-50 p-4 animate-slide-up">
    <div className="flex items-center gap-3 text-emerald-700">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <ShieldCheck size={18} />
      </div>
      <div className="min-w-0">
         <p className="text-sm font-semibold leading-none">Muvaffaqiyatli</p>
         <p className="text-xs text-emerald-600 mt-1">{text}</p>
      </div>
    </div>
  </div>
);

const CardWrapper: React.FC<{ title: string; subtitle: string; icon: any; children: React.ReactNode; onConfirm: () => void }> = ({ title, subtitle, icon: Icon, children, onConfirm }) => (
  <div className="mt-3 rounded-overlay border border-slate-200 bg-white overflow-hidden animate-pop">
    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-control bg-primary-50 flex items-center justify-center text-[color:var(--primary)] flex-shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="label-caps text-[color:var(--primary)]">{subtitle}</p>
          <p className="t-h3 truncate">{title}</p>
        </div>
      </div>
    </div>
    <div className="p-4 space-y-4">
      {children}
      <button onClick={onConfirm} className="btn-success w-full h-lg">
        <CheckCircle2 size={16} />
        Tasdiqlash
      </button>
    </div>
  </div>
);

// ── Generative UI kartalar ─────────────────────────────────────────
// O'qish tool'lari qaytargan strukturali ma'lumot chat ichida matn emas,
// haqiqiy interfeys bo'lagi sifatida render bo'ladi. Har karta mavjud
// sahifaga deep-link beradi (sahifalar "manual rejim" bo'lib qoladi).

const fm = (n: number) => Math.round(n ?? 0).toLocaleString('en-US').replace(/,/g, ' ');

const DataCard: React.FC<{
  title: string;
  icon: any;
  children: React.ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}> = ({ title, icon: Icon, children, onOpen, openLabel }) => (
  <div className="mt-3 w-full rounded-card border border-slate-200 bg-white overflow-hidden animate-pop">
    <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
      <div className="w-7 h-7 rounded-control bg-primary-50 flex items-center justify-center text-[color:var(--primary)] flex-shrink-0">
        <Icon size={16} />
      </div>
      <p className="label-caps truncate">{title}</p>
    </div>
    <div className="px-4 py-2">{children}</div>
    {onOpen && (
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-slate-200 text-xs font-medium text-[color:var(--primary)] hover:bg-primary-50 transition-colors duration-120"
      >
        {openLabel || "Bo'limni ochish"} <ArrowUpRight size={16} />
      </button>
    )}
  </div>
);

// Ro'yxat qatori — chapda nom/izoh, o'ngda qiymat
const DataRow: React.FC<{ primary: string; secondary?: string | null; value: string; valueClass?: string }> = ({
  primary, secondary, value, valueClass,
}) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="t-body-md truncate">{primary}</p>
      {secondary && <p className="t-caption truncate mt-0.5">{secondary}</p>}
    </div>
    <p className={`text-sm font-semibold whitespace-nowrap tabular-nums ${valueClass || 'text-slate-700'}`}>{value}</p>
  </div>
);

const MoreRows: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <p className="py-2 text-center t-caption">
      + yana {count} ta
    </p>
  ) : null;

// getFinanceSummary → stat tile qatori (kirim/chiqim/balans)
const FinanceSummaryCard: React.FC<{ data: any; onOpen?: () => void }> = ({ data, onOpen }) => (
  <DataCard title={`Moliya — oxirgi ${data.davr_kun} kun`} icon={Wallet} onOpen={onOpen} openLabel="Kassani ochish">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2">
      <div className="p-3 rounded-card bg-emerald-50 border border-emerald-200 text-center">
        <p className="label-caps text-emerald-600">Kirim</p>
        <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">{fm(data.kirim)}</p>
      </div>
      <div className="p-3 rounded-card bg-rose-50 border border-rose-200 text-center">
        <p className="label-caps text-rose-600">Chiqim</p>
        <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">{fm(data.chiqim)}</p>
      </div>
      <div className="p-3 rounded-card bg-slate-50 border border-slate-200 text-center">
        <p className="label-caps">Balans</p>
        <p className="text-sm font-semibold text-slate-900 mt-1 tabular-nums">{fm(data.balans)}</p>
      </div>
    </div>
  </DataCard>
);

// getDebtors / searchCustomers → mijozlar ro'yxati
const CustomersCard: React.FC<{ title: string; items: any[]; total?: number; onOpen?: () => void }> = ({
  title, items, total, onOpen,
}) => (
  <DataCard title={title} icon={UserSquare2} onOpen={onOpen} openLabel="Mijozlarni ochish">
    {items.slice(0, 6).map((c: any) => (
      <DataRow
        key={c.id}
        primary={c.name || c.ism}
        secondary={c.phone}
        value={(c.totalDebt ?? c.qarz) > 0 ? `${fm(c.totalDebt ?? c.qarz)} so'm` : '—'}
        valueClass={(c.totalDebt ?? c.qarz) > 0 ? 'text-rose-600' : 'text-slate-500'}
      />
    ))}
    <MoreRows count={items.length - 6} />
    {typeof total === 'number' && total > 0 && (
      <div className="flex items-center justify-between py-2.5 border-t border-slate-200">
        <p className="label-caps">Jami qarz</p>
        <p className="text-sm font-semibold text-rose-600 tabular-nums">{fm(total)} so'm</p>
      </div>
    )}
  </DataCard>
);

// searchOrders / getUpcomingDeadlines → buyurtmalar ro'yxati
const OrdersCard: React.FC<{ title: string; items: any[]; onOpen?: () => void }> = ({ title, items, onOpen }) => (
  <DataCard title={title} icon={ClipboardList} onOpen={onOpen} openLabel="Kanban'ni ochish">
    {items.slice(0, 6).map((t: any, idx: number) => (
      <DataRow
        key={t.id || t.displayId || idx}
        primary={`${t.displayId ? t.displayId + ' · ' : ''}${t.nom}`}
        secondary={[t.mijoz, t.otib_ketgan ? "MUDDAT O'TGAN" : (t.muddat ? new Date(t.muddat).toLocaleDateString('uz-UZ') : null), t.holat]
          .filter(Boolean).join(' · ')}
        value={t.qoldiq > 0 ? `${fm(t.qoldiq)} so'm` : (t.jami ? `${fm(t.jami)} so'm` : '—')}
        valueClass={t.otib_ketgan ? 'text-rose-600' : 'text-slate-700'}
      />
    ))}
    <MoreRows count={items.length - 6} />
  </DataCard>
);

// getOrdersSummary → kanban ustunlari holati
const ColumnsCard: React.FC<{ items: any[]; onOpen?: () => void }> = ({ items, onOpen }) => (
  <DataCard title="Buyurtmalar holati" icon={ClipboardList} onOpen={onOpen} openLabel="Kanban'ni ochish">
    {items.map((c: any) => (
      <DataRow
        key={c.nom}
        primary={c.nom}
        secondary={c.jami_qoldiq > 0 ? `qoldiq ${fm(c.jami_qoldiq)} so'm` : null}
        value={`${c.buyurtma_soni} ta`}
        valueClass={c.bajarilgan_ustun ? 'text-emerald-600' : 'text-slate-700'}
      />
    ))}
  </DataCard>
);

// getDebtorsReport → mijoz-buyurtma darajasidagi qarz hisoboti
const DebtorsReportCard: React.FC<{ data: any; onOpen?: () => void }> = ({ data, onOpen }) => (
  <DataCard title={`Qarzdorlar hisoboti — ${data.soni} ta mijoz`} icon={UserSquare2} onOpen={onOpen} openLabel="Mijozlarni ochish">
    {(data.qarzdorlar || []).slice(0, 5).map((d: any) => (
      <div key={d.id} className="py-2 border-b border-slate-100 last:border-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="t-body-md truncate">{d.name}</p>
            {d.eng_eski_qarz_kun !== null && (
              <p className="t-caption">{d.eng_eski_qarz_kun} kundan beri</p>
            )}
          </div>
          <p className="text-sm font-semibold text-rose-600 whitespace-nowrap tabular-nums">{fm(d.totalDebt)} so'm</p>
        </div>
        {(d.buyurtmalar || []).slice(0, 4).map((b: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-2 pl-3 mt-1">
            <p className="text-xs text-slate-500 truncate">
              {b.displayId ? `${b.displayId} · ` : ''}{b.nom}
              <span className="text-slate-500"> · {b.necha_kun} kun</span>
            </p>
            <p className="text-xs font-medium text-rose-600 whitespace-nowrap tabular-nums">{fm(b.qoldiq)}</p>
          </div>
        ))}
        {(d.buyurtmalar || []).length > 4 && (
          <p className="pl-3 mt-1 t-caption">+ yana {d.buyurtmalar.length - 4} ta buyurtma</p>
        )}
      </div>
    ))}
    <MoreRows count={(data.qarzdorlar || []).length - 5} />
    <div className="flex items-center justify-between py-2.5 border-t border-slate-200">
      <p className="label-caps">Jami qarz</p>
      <p className="text-sm font-semibold text-rose-600 tabular-nums">{fm(data.jami_qarz)} so'm</p>
    </div>
  </DataCard>
);

// getVendorsReport → hamkorlar balansi (ikki yo'nalishli)
const VendorsReportCard: React.FC<{ data: any; onOpen?: () => void }> = ({ data, onOpen }) => (
  <DataCard title={`Hamkorlar — ${data.soni} ta`} icon={ClipboardList} onOpen={onOpen} openLabel="Hamkorlarni ochish">
    {(data.hamkorlar || []).slice(0, 6).map((v: any) => (
      <DataRow
        key={v.id}
        primary={v.nom}
        secondary={[
          Array.isArray(v.rollar) && v.rollar.length ? v.rollar.join(', ') : null,
          v.xarid_jami > 0 ? `xarid ${fm(v.xarid_jami)}` : null,
          v.sotuv_jami > 0 ? `sotuv ${fm(v.sotuv_jami)}` : null,
        ].filter(Boolean).join(' · ') || null}
        value={v.balans === 0 ? 'Hisob toza' : `${fm(Math.abs(v.balans))} so'm`}
        valueClass={v.balans > 0 ? 'text-rose-600' : v.balans < 0 ? 'text-emerald-600' : 'text-slate-500'}
      />
    ))}
    <MoreRows count={(data.hamkorlar || []).length - 6} />
    {(data.biz_qarzmiz_jami > 0 || data.ular_qarz_jami > 0) && (
      <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-t border-slate-200 text-xs font-medium tabular-nums">
        <span className="text-rose-600">Biz qarzmiz: {fm(data.biz_qarzmiz_jami)}</span>
        <span className="text-emerald-600">Ular qarz: {fm(data.ular_qarz_jami)}</span>
      </div>
    )}
  </DataCard>
);

// getLowStock / searchMaterials → ombor qoldiqlari
const MaterialsCard: React.FC<{ title: string; items: any[]; onOpen?: () => void }> = ({ title, items, onOpen }) => (
  <DataCard title={title} icon={PackageOpen} onOpen={onOpen} openLabel="Omborni ochish">
    {items.slice(0, 6).map((m: any, idx: number) => {
      const qoldiq = m.qoldiq ?? m.currentStock;
      const min = m.minimal ?? m.minStock;
      const low = typeof min === 'number' && min > 0 && qoldiq <= min;
      return (
        <DataRow
          key={m.id || m.nom || m.name || idx}
          primary={m.nom || m.name}
          secondary={low ? `minimal: ${fm(min)}` : null}
          value={`${fm(qoldiq)} ${m.birlik || m.unit || ''}`}
          valueClass={low ? 'text-rose-600' : 'text-slate-700'}
        />
      );
    })}
    <MoreRows count={items.length - 6} />
  </DataCard>
);

// ── Kunlik brifing (bo'sh chat holati) ─────────────────────────────
// Kun "nima muhim" bilan boshlanadi: bugungi kassa, muddatlar, qarzlar,
// ombor. Har qator bosilsa tegishli savol agentga yuboriladi.
// Xavf kartalari — butun tizimni kuzatuvchi ko'p-detektorli korrelyatsiya
// (LLM'siz, risk-detection.service.ts): Kanban x Davomat, Kanban x Ombor,
// Kanban x Mijozlar/Moliya va h.k. "Bartaraf etish" bosilganda xavf matni
// chatga yuboriladi — AI kontekstga qarab tegishli tool'ni (reassignTask va
// h.k.) taklif qiladi, [TASDIQ KARTASI] orqali bajariladi.
const RISK_TONE: Record<string, { border: string; bg: string; icon: string; title: string; text: string; btn: string }> = {
  critical: { border: 'border-rose-200', bg: 'bg-rose-50', icon: 'bg-rose-100 text-rose-600', title: 'text-rose-800', text: 'text-rose-700', btn: 'btn-danger' },
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', title: 'text-amber-800', text: 'text-amber-700', btn: 'btn-outline' },
  info: { border: 'border-slate-200', bg: 'bg-slate-50', icon: 'bg-slate-100 text-slate-500', title: 'text-slate-700', text: 'text-slate-500', btn: 'btn-outline' },
};

const RiskInsightsPanel: React.FC<{
  risks: any[];
  onResolve: (text: string) => void;
  onDismiss: (id: string) => void;
}> = ({ risks, onResolve, onDismiss }) => {
  if (risks.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {risks.map((r) => {
        const tone = RISK_TONE[r.severity] || RISK_TONE.warning;
        return (
          <div key={r.id} className={`rounded-card border ${tone.border} ${tone.bg} p-4 flex items-start gap-3 animate-slide-up`}>
            <div className={`w-8 h-8 rounded-control ${tone.icon} flex items-center justify-center flex-shrink-0`}>
              <ShieldAlert size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${tone.title}`}>{r.title}</p>
              <p className={`text-xs ${tone.text} mt-0.5 leading-snug`}>{r.message}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <button
                  onClick={() => onResolve(`Xavf: ${r.message} Buni qanday hal qilishni maslahat bera olasizmi, kerak bo'lsa o'zing bajar.`)}
                  className={`${tone.btn} h-sm`}
                >
                  Bartaraf etish
                </button>
                <button
                  onClick={() => onDismiss(r.id)}
                  className="btn-ghost h-sm"
                >
                  E'tiborsiz qoldirish
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// =============================================
// FON TOPSHIRIQLARI PANELI (Faza 3).
//
// Topshiriq daqiqalar davom etadi, shuning uchun foydalanuvchiga IKKI narsa
// kerak: (1) ish qotib qolmaganiga ishonch — jonli progress, (2) tayyor
// natijani o'qish joyi. Telegram xabari yetarli emas: hamma ham Telegram'ini
// ulamagan va chat oynasida turgan odam u yerga qarab o'tirmaydi.
//
// Faol topshiriq bo'lsa panel o'zi ochiladi va ko'zga tashlanadi; hammasi
// tugagach kichik yig'ma satrga aylanadi va chatni band qilmaydi.
// =============================================

const JOB_STATUS: Record<string, { yorliq: string; nuqta: string; matn: string; ramka: string; fon: string }> = {
  queued:    { yorliq: 'Navbatda',  nuqta: 'bg-slate-400',                matn: 'text-slate-600',   ramka: 'border-slate-200',   fon: 'bg-slate-50' },
  running:   { yorliq: 'Bajarilyapti', nuqta: 'bg-[color:var(--primary)] animate-pulse', matn: 'text-primary-700', ramka: 'border-primary-200', fon: 'bg-primary-50' },
  done:      { yorliq: 'Tayyor',    nuqta: 'bg-emerald-500',              matn: 'text-emerald-700', ramka: 'border-emerald-200', fon: 'bg-emerald-50' },
  failed:    { yorliq: 'Xatolik',   nuqta: 'bg-rose-500',                 matn: 'text-rose-700',    ramka: 'border-rose-200',    fon: 'bg-rose-50' },
  cancelled: { yorliq: 'Bekor qilindi', nuqta: 'bg-slate-300',            matn: 'text-slate-500',   ramka: 'border-slate-200',   fon: 'bg-slate-50' },
};

const JobCard: React.FC<{ job: any; onCancel: (id: string) => void }> = ({ job, onCancel }) => {
  const [ochiq, setOchiq] = useState(false);
  const st = JOB_STATUS[job.status] || JOB_STATUS.queued;
  const qadamlar: any[] = Array.isArray(job.progress) ? job.progress : [];
  const faol = job.status === 'queued' || job.status === 'running';

  // Bajarilayotgan topshiriqda oxirgi qadam sarlavha tagida ko'rinib turadi —
  // kartani ochmasdan ham "hozir nima bo'lyapti" bilinadi.
  const oxirgi = qadamlar.length ? qadamlar[qadamlar.length - 1]?.matn : null;

  return (
    <div className={`rounded-card border ${st.ramka} ${st.fon} overflow-hidden animate-slide-up`}>
      <button
        type="button"
        onClick={() => setOchiq(o => !o)}
        aria-expanded={ochiq}
        className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left hover:bg-black/[0.02] transition-colors duration-120"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${st.nuqta}`} />
        <div className="flex-1 min-w-0">
          <p className="t-h3 leading-snug">{job.sarlavha}</p>
          <p className={`text-xs font-medium mt-1 ${st.matn}`}>
            {st.yorliq}
            {job.status === 'done' && job.qadamlar > 0 && ` · ${job.qadamlar} qadam`}
          </p>
          {faol && oxirgi && (
            <p className="t-caption mt-1 leading-snug truncate">{oxirgi}</p>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`flex-shrink-0 mt-1 text-slate-500 transition-transform duration-180 ${ochiq ? 'rotate-90' : ''}`}
        />
      </button>

      {ochiq && (
        <div className="px-3.5 pb-3 space-y-2.5">
          <div>
            <p className="label-caps mb-1">Topshiriq</p>
            <p className="text-xs text-slate-600 leading-snug whitespace-pre-wrap">
              {job.topshiriq || job.sarlavha}
            </p>
          </div>

          {qadamlar.length > 0 && (
            <div>
              <p className="label-caps mb-1">Bosqichlar</p>
              <div className="space-y-1">
                {qadamlar.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0 mt-[7px]" />
                    <p className="text-xs text-slate-600 leading-snug">{q.matn}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {job.natija && (
            <div>
              <p className="label-caps mb-1">Natija</p>
              <p className="text-xs text-slate-700 leading-[1.6] whitespace-pre-wrap">
                {cyrToLat(stripMarkdown(job.natija))}
              </p>
            </div>
          )}

          {job.error && (
            <div>
              <p className="label-caps text-rose-500 mb-1">Xatolik</p>
              <p className="text-xs font-medium text-rose-600 leading-snug">{job.error}</p>
            </div>
          )}

          {/* Bekor qilish faqat navbatdagi topshiriqda: boshlangan ishni yarim
              yo'lda to'xtatish uni nomuvofiq holatda qoldirardi. */}
          {job.status === 'queued' && (
            <button onClick={() => onCancel(job.id)} className="btn-outline h-sm">
              Bekor qilish
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const FonTopshiriqlarPanel: React.FC<{
  jobs: any[];
  onCancel: (id: string) => void;
}> = ({ jobs, onCancel }) => {
  const [tarixOchiq, setTarixOchiq] = useState(false);
  if (!jobs.length) return null;

  const faol = jobs.filter(j => j.status === 'queued' || j.status === 'running');
  const tugagan = jobs.filter(j => j.status !== 'queued' && j.status !== 'running');

  return (
    <div className="px-4 pt-3 flex-shrink-0 space-y-2">
      {faol.map(j => <JobCard key={j.id} job={j} onCancel={onCancel} />)}

      {tugagan.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setTarixOchiq(o => !o)}
            className="w-full flex items-center gap-2 px-1 py-1 text-left group"
          >
            <ClipboardList size={16} className="text-slate-500 flex-shrink-0" />
            <span className="t-caption group-hover:text-slate-700 transition-colors duration-120">
              {tugagan.length} ta yakunlangan topshiriq
            </span>
            <ChevronRight
              size={16}
              className={`ml-auto flex-shrink-0 text-slate-500 transition-transform duration-180 ${tarixOchiq ? 'rotate-90' : ''}`}
            />
          </button>
          {tarixOchiq && (
            <div className="space-y-2">
              {tugagan.map(j => <JobCard key={j.id} job={j} onCancel={onCancel} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const BriefingPanel: React.FC<{ briefing: any; onAsk: (text: string) => void }> = ({ briefing: b, onAsk }) => {
  if (!b) return null;
  const allClear =
    b.buyurtmalar.otgan_soni === 0 && b.buyurtmalar.yaqin_soni === 0 &&
    b.qarzdorlar.soni === 0 && b.ombor.soni === 0;

  const Row: React.FC<{ icon: any; text: string; value: string; tone?: 'rose' | 'amber' | 'slate'; ask: string }> = ({
    icon: Icon, text, value, tone = 'slate', ask,
  }) => (
    <button
      onClick={() => onAsk(ask)}
      className="w-full flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0 text-left hover:bg-slate-50 rounded-control px-2 transition-colors duration-120"
    >
      <div className={`w-7 h-7 rounded-control flex items-center justify-center flex-shrink-0 ${
        tone === 'rose' ? 'bg-rose-100 text-rose-600' : tone === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
      }`}>
        <Icon size={16} />
      </div>
      <p className="flex-1 t-body-md min-w-0 truncate">{text}</p>
      <p className={`text-sm font-semibold whitespace-nowrap tabular-nums ${tone === 'rose' ? 'text-rose-600' : 'text-slate-700'}`}>{value}</p>
    </button>
  );

  return (
    <div className="rounded-card border border-slate-200 bg-white overflow-hidden animate-slide-up">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-primary-50 border-b border-primary-100">
        <div className="w-7 h-7 rounded-control bg-[color:var(--primary)] flex items-center justify-center text-white flex-shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <p className="label-caps text-[color:var(--primary)]">Bugungi brifing</p>
          <p className="t-caption">{new Date(b.sana).toLocaleDateString('uz-UZ')}</p>
        </div>
      </div>

      {/* Bugungi kassa — stat tile qatori */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 pt-3">
        <div className="p-2.5 rounded-card bg-emerald-50 border border-emerald-200 text-center">
          <p className="label-caps text-emerald-600">Kirim</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">{fm(b.moliya.kirim)}</p>
        </div>
        <div className="p-2.5 rounded-card bg-rose-50 border border-rose-200 text-center">
          <p className="label-caps text-rose-600">Chiqim</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">{fm(b.moliya.chiqim)}</p>
        </div>
        <div className="p-2.5 rounded-card bg-slate-50 border border-slate-200 text-center">
          <p className="label-caps">Balans</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">{fm(b.moliya.balans)}</p>
        </div>
      </div>

      <div className="px-2 py-2">
        {allClear ? (
          <p className="py-4 text-center text-sm font-medium text-emerald-600">
            ✅ Hammasi joyida
          </p>
        ) : (
          <>
            {b.buyurtmalar.otgan_soni > 0 && (
              <Row icon={AlertTriangle} tone="rose" text="Muddati o'tgan buyurtmalar" value={`${b.buyurtmalar.otgan_soni} ta`}
                ask="Muddati o'tgan buyurtmalarni ko'rsat" />
            )}
            {b.buyurtmalar.yaqin_soni > 0 && (
              <Row icon={ClipboardList} tone="amber" text="3 kun ichida muddat" value={`${b.buyurtmalar.yaqin_soni} ta`}
                ask="Muddati yaqin buyurtmalarni ko'rsat" />
            )}
            {b.qarzdorlar.soni > 0 && (
              <Row icon={UserSquare2} tone="rose" text={`Qarzdorlar (${b.qarzdorlar.soni} ta)`} value={`${fm(b.qarzdorlar.jami)} so'm`}
                ask="Qarzdorlarni ko'rsat" />
            )}
            {b.ombor.soni > 0 && (
              <Row icon={PackageOpen} tone="amber" text="Kam qoldiq materiallar" value={`${b.ombor.soni} ta`}
                ask="Kam qolgan materiallarni ko'rsat" />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// [TASDIQ KARTASI] — pul/o'zgartirish amali serverda AgentAction(pending)
// holatida turadi; foydalanuvchi shu kartada tasdiqlaydi yoki rad etadi.
// Tasdiqlangandagina backend amalni bajaradi (registry.executeConfirmedAction).
const PendingActionCard: React.FC<{
  actionId: string;
  summary: string;
  onExecuted?: () => void;
}> = ({ actionId, summary, onExecuted }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'executed' | 'rejected' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'confirm' | 'reject') => {
    setState('busy');
    setError(null);
    try {
      if (kind === 'reject') {
        await aiApi.rejectAction(actionId);
        setState('rejected');
        return;
      }
      const r = await aiApi.confirmAction(actionId);
      if (r.data?.success === false) {
        setError(r.data.error || 'Xatolik yuz berdi');
        setState('failed');
        return;
      }
      setState('executed');
      onExecuted?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Xatolik yuz berdi');
      setState('failed');
    }
  };

  if (state === 'executed') return <SuccessBadge text={summary} />;

  if (state === 'rejected') {
    return (
      <div className="mt-3 rounded-card border border-slate-200 bg-slate-50 p-4 t-caption">
        Bekor qilindi — {summary}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-overlay border border-amber-200 bg-white overflow-hidden animate-pop">
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="w-9 h-9 rounded-control bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <p className="label-caps text-amber-600">Tasdiqlash kerak</p>
          <p className="t-h3">{summary}</p>
        </div>
      </div>
      <div className="p-4">
        {state === 'failed' && (
          <p className="mb-3 text-xs font-medium text-rose-600">{error}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run('confirm')}
            disabled={state === 'busy'}
            className="btn-success flex-1"
          >
            {state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Tasdiqlash
          </button>
          <button
            onClick={() => run('reject')}
            disabled={state === 'busy'}
            className="btn-outline"
          >
            Bekor
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Copilot Component ──────────────────────────────────────────

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

type Usage = {
  used: number; limit: number; unlimited: boolean; periodEnd?: string;
  daily?: { used: number; limit: number; unlimited: boolean; resetAt?: string };
  extraCredits?: number;
};

const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, onRefresh }) => {
  // Panel yonma-yon (docked) turadimi yoki kontent ustidan ochiladimi.
  // 1536px — Tailwind 2xl chegarasi; shundan tor ekranda yonma-yon turish
  // kontentni siqib qo'yadi, shuning uchun overlay bo'ladi.
  const [isDocked, setIsDocked] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1536px)').matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1536px)');
    const on = () => setIsDocked(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // KENGAYTIRILGAN REJIM — panel butun ekranni egallaydi.
  //
  // Nega kerak: agent endi ko'p bandli hisobot, fikrlash bloki va fon
  // topshiriqlari kabi uzun natijalar beradi. 400px ustunda ular siqilib,
  // har jumla to'rt qatorga bo'linadi. Kengaytirilganda matn o'qish uchun
  // qulay ustunga (~68ch) yig'iladi — ekran kengaygani bilan satr
  // cho'zilib ketmaydi.
  //
  // Tanlov localStorage'da saqlanadi: kim uzun ish qilsa, har safar qayta
  // bosmasligi kerak.
  const [kengaytirilgan, setKengaytirilgan] = useState(() => {
    try {
      return localStorage.getItem('pf_ai_kengaytirilgan') === '1';
    } catch {
      return false;
    }
  });
  const kengaytirishniAlmashtir = useCallback(() => {
    setKengaytirilgan((v) => {
      const yangi = !v;
      try {
        localStorage.setItem('pf_ai_kengaytirilgan', yangi ? '1' : '0');
      } catch { /* private rejimda localStorage yo'q — rejim baribir ishlaydi */ }
      return yangi;
    });
  }, []);

  // Kengaytirilgan rejimda Esc panelni yopmaydi, avval oddiy holatga qaytaradi:
  // to'liq ekrandan to'g'ridan-to'g'ri yopilish kutilmagan sakrash bo'lardi.
  useEffect(() => {
    if (!isOpen) return;
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (kengaytirilgan) kengaytirishniAlmashtir();
      else onClose();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [isOpen, kengaytirilgan, kengaytirishniAlmashtir, onClose]);
  const [input, setInput] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [briefing, setBriefing] = useState<any>(null);
  const [risks, setRisks] = useState<any[]>([]);
  // Fon topshiriqlari (Faza 3) — odatda ularni chat agenti `startJob` orqali
  // yaratadi, shuning uchun ro'yxat javob tugagach ham yangilanadi.
  const [jobs, setJobs] = useState<any[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const inputRefVal = useRef<string>('');

  // Web Speech API qo'llab-quvvatlanishini brauzerda tekshiramiz
  const speechSupported = typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { inputRefVal.current = input; }, [input]);

  const fetchUsage = useCallback(async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const bearer = localStorage.getItem('pf_token');
      if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
      const raw = localStorage.getItem('pf_user_info') || sessionStorage.getItem('pf_user_info');
      if (raw) {
        try {
          const u = JSON.parse(raw);
          if (u?.tenantId) headers['X-Tenant-Id'] = u.tenantId;
        } catch {}
      }
      const r = await fetch(`${API_BASE}/ai/usage`, { credentials: 'include', headers });
      if (r.ok) setUsage(await r.json());
    } catch { /* silent */ }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const r = await aiApi.listJobs(20);
      setJobs(r.data || []);
    } catch { /* silent — topshiriqlar ro'yxati chatni to'sib qo'ymasin */ }
  }, []);

  const { messages, sendMessage, status, addToolResult } = useChat({
    transport: chatTransport,
    onFinish: ({ message }) => {
      if (message.parts?.some(p => p.type !== 'text' && p.type !== 'step-start')) {
        onRefresh?.();
      }
      // TTS o'chirilgan — AI faqat matn bilan javob beradi.
      // Har streaming tugaganida limit hisobini yangilaymiz
      fetchUsage();
    },
    onError: (err: any) => {
      // 429 — limit oshgan; SDK xabar matni ichida JSONni saqlaydi
      const msg = err?.message || '';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error === 'AI_LIMIT_REACHED') {
          setLimitError(parsed.message || 'Limit tugadi');
          fetchUsage();
          return;
        }
      } catch {}
      if (msg) setLimitError(msg);
    },
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Javob tugagach topshiriqlarni yangilaymiz: agent shu javob ichida
  // `startJob` chaqirgan bo'lishi mumkin, va yangi topshiriq darhol
  // ko'rinishi kerak — foydalanuvchi panelni qayta ochib o'tirmasin.
  //
  // Ref orqali FAQAT "yuklanayotgan → bo'sh" o'tishida ishlaydi. Shartsiz
  // qoldirilsa panel ochilishida ham bir marta ortiqcha so'rov ketardi
  // (ochilish effekti allaqachon fetchJobs chaqiradi).
  const oldingiLoading = useRef(false);
  useEffect(() => {
    const tugadi = oldingiLoading.current && !isLoading;
    oldingiLoading.current = isLoading;
    if (isOpen && tugadi) void fetchJobs();
  }, [isOpen, isLoading, fetchJobs]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      fetchUsage();
      // Brifing — LLM'siz aggregation, har ochilishda yangilanadi
      aiApi.getBriefing().then(r => setBriefing(r.data)).catch(() => setBriefing(null));
      // Xavf kartalari — Buyurtma x Davomat korrelyatsiyasi, LLM'siz
      aiApi.getRisks().then(r => setRisks(r.data || [])).catch(() => setRisks([]));
      fetchJobs();
    }
  }, [isOpen, fetchUsage, fetchJobs]);

  // Faol topshiriq bo'lsa ro'yxatni yangilab turamiz. Poll faqat shu holatda
  // ishlaydi: hamma topshiriq tugagan bo'lsa yangilanadigan narsa yo'q va
  // bekorga so'rov yubormaymiz. Panel yopiq bo'lsa ham to'xtaydi.
  //
  // Bog'liqlik `jobs` massivi emas, BOOLEAN: har fetch yangi massiv qaytaradi,
  // shuning uchun massivga bog'lansa effekt har safar qayta ishga tushib
  // intervalni nolga qaytarardi.
  const faolTopshiriqBor = jobs.some(j => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    if (!isOpen || !faolTopshiriqBor) return;
    const t = setInterval(fetchJobs, 5000);
    return () => clearInterval(t);
  }, [isOpen, faolTopshiriqBor, fetchJobs]);

  const cancelJob = useCallback((id: string) => {
    // Optimistik: karta darhol o'zgaradi, so'ng server holati bilan sinxronlanadi.
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: 'cancelled' } : j)));
    aiApi.cancelJob(id).catch(() => {}).finally(() => { void fetchJobs(); });
  }, [fetchJobs]);

  const dismissRisk = useCallback((id: string) => {
    setRisks(prev => prev.filter(r => r.id !== id));
    aiApi.dismissRisk(id).catch(() => {});
  }, []);

  const submitText = useCallback((text: string) => {
    const t = text.trim();
    // 3 belgidan qisqa — STT noto'g'ri eshitgan bo'lishi mumkin. Yubormaymiz.
    // LEKIN suhbat allaqachon boshlangan bo'lsa qisqa javob normal: xavf
    // kartasidan keyin "1" deb variant tanlanadi, tasdiqda "ha" deyiladi.
    if (t.length < 3 && messages.length === 0) {
      setInput('');
      inputRefVal.current = '';
      return;
    }
    if (t.length === 0) return;
    setLimitError(null);
    sendMessage({ text: t });
    setInput('');
    inputRefVal.current = '';
  }, [sendMessage, messages.length]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (input.trim().length < 3 && messages.length === 0) return;
    submitText(input);
  };

  // Omnibox (Ctrl+K) dan kelgan so'rov — drawer'ni Dashboard ochadi,
  // xabarni shu yerda agentga yuboramiz.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent).detail?.text;
      if (typeof text === 'string' && text.trim().length >= 3) {
        submitText(text);
      }
    };
    window.addEventListener('pf:ai-ask', onAsk);
    return () => window.removeEventListener('pf:ai-ask', onAsk);
  }, [submitText]);

  // Generative kartalardagi deep-link tugmalari uchun
  const navigate = useNavigate();

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try { rec.stop(); } catch {}
    }
    setIsListening(false);
    isListeningRef.current = false;
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    if (recognitionRef.current) return;

    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const rec = new SR();
    rec.lang = 'uz-UZ';
    // Doimiy yozish — Chrome o'zi to'xtatib qo'ymasligi uchun. 3-soniyalik silence timer'ni
    // o'zimiz boshqaramiz va shu vaqt o'tsa avtomatik yuboramiz.
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      if (recognitionRef.current !== rec) return; // Ignore events from old/stopped sessions

      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!transcript) return;
      const text = cyrToLat(transcript);
      setInput(text);
      inputRefVal.current = text;

      // Har yangi natijada 3-soniyalik silence timer reset qilinadi
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const t = inputRefVal.current.trim();
        if (t.length >= 3) {
          submitText(t);
        }
        stopListening();
      }, 3000);
    };

    rec.onerror = (e: any) => {
      if (recognitionRef.current !== rec) return;
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        setMicPermissionDenied(true);
      }
    };

    rec.onend = () => {
      if (recognitionRef.current !== rec) return;
      recognitionRef.current = null;
      setIsListening(false);
      isListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    recognitionRef.current = rec;
    setIsListening(true);
    isListeningRef.current = true;
    setMicPermissionDenied(false);
    try {
      rec.start();
    } catch {
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [speechSupported, stopListening, submitText]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Panel yopilganda yoki komponent unmount bo'lganda recognition'ni tozalaymiz
  useEffect(() => {
    if (!isOpen) {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isOpen, stopListening]);

  if (!isOpen) return null;

  const quotaPct = usage && !usage.unlimited && usage.limit > 0
    ? Math.min(100, Math.round((usage.used / usage.limit) * 100))
    : 0;
  const daily = usage?.daily;
  const dailyPct = daily && !daily.unlimited && daily.limit > 0
    ? Math.min(100, Math.round((daily.used / daily.limit) * 100))
    : 0;
  const quotaLow = !!(usage && !usage.unlimited && quotaPct >= 80) || (!!daily && !daily.unlimited && dailyPct >= 80);
  const baseLimitHit = !!(usage && !usage.unlimited && usage.used >= usage.limit) || (!!daily && !daily.unlimited && daily.used >= daily.limit);
  // Asosiy limit tugagan bo'lsa ham — qo'shimcha kredit bor ekan, yuborish hali mumkin.
  const quotaExhausted = baseLimitHit && !(usage?.extraCredits && usage.extraCredits > 0);

  return (
    <>
      {/* Mobil fon — telefonda joy yo'q, shuning uchun overlay bo'lib qoladi */}
      <div className="fixed inset-0 z-overlay bg-slate-900/60 backdrop-blur-sm md:hidden animate-fade-in" onClick={onClose} />

      {/* Desktopda panel LAYOUT ICHIDA turadi (md:static) — sahifa ustiga
          chiqmaydi, balki kontentni qisqartiradi va yonma-yon turadi.
          Shu sababli chatni doim ochiq qoldirib ishlash mumkin.
          Telefonda esa avvalgidek to'liq ekranli overlay. */}
      {/* Kichik va o'rta ekranda panel USTIDAN ochiladi, kontentni siqmaydi.
          Ilgari u `md:` (768px) dan boshlab static edi va 400px joyni o'zi
          olardi: 1366px noutbukda kontentga ~716px qolib, jadvallar ikki
          qatorga tushib ketardi. Yonma-yon turish faqat haqiqatan joy
          bo'lganda (1536px+) mantiqiy. */}
      {!isDocked && !kengaytirilgan && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-overlay bg-slate-900/20 backdrop-blur-[2px] 2xl:hidden"
        />
      )}
      <aside
        className={
          kengaytirilgan
            // Kengaytirilgan: butun ekran. Yon chegara ham, soya ham keraksiz —
            // panel ostida ko'rinadigan narsa qolmaydi.
            ? 'fixed inset-0 z-overlay bg-white flex flex-col animate-fade-in'
            : 'fixed inset-y-0 right-0 z-overlay w-full max-w-[440px] 2xl:static 2xl:z-auto 2xl:max-w-none 2xl:w-[400px] 2xl:shrink-0 2xl:h-screen bg-white border-l border-[color:var(--border)] shadow-xl 2xl:shadow-none flex flex-col animate-drawer-in'
        }
      >

        {/* Header — gradient/soya bezagi olib tashlandi (DESIGN.md: rang holat
            uchun, bezak uchun emas). Belgi bitta to'q sariq kvadrat: brend bor,
            ko'z-ko'z qilish yo'q. */}
        <div className={`flex items-center gap-3 border-b border-[color:var(--border)] bg-white flex-shrink-0 px-4 py-3 ${kengaytirilgan ? 'md:px-8' : ''}`}>
          <div className="w-9 h-9 rounded-control bg-[color:var(--primary)] flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="card-title flex items-center gap-2">
              Girgitton
              {isListening && (
                <Badge variant="danger" className="animate-pulse">Eshityapman</Badge>
              )}
            </h2>
            {usage && (
              <p className={`text-xs mt-0.5 ${
                quotaExhausted ? 'text-rose-600' : quotaLow ? 'text-amber-600' : 'text-slate-500'
              }`}>
                {daily && !daily.unlimited && daily.limit > 0
                  ? `${daily.used} / ${daily.limit} xabar, bugun`
                  : usage.unlimited
                  ? 'Cheksiz xabarlar'
                  : `${usage.used} / ${usage.limit} xabar, 30 kun davri`}
                {!!usage.extraCredits && usage.extraCredits > 0 && (
                  <span className="text-[color:var(--primary)]"> · +{usage.extraCredits} qo'shimcha</span>
                )}
              </p>
            )}
          </div>

          <button
            onClick={kengaytirishniAlmashtir}
            title={kengaytirilgan ? 'Kichraytirish' : "To'liq ekran"}
            aria-label={kengaytirilgan ? 'Kichraytirish' : "To'liq ekran"}
            className="icon-btn"
          >
            {kengaytirilgan ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            title="Yopish"
            aria-label="Yopish"
            className="icon-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quota progress bar — kunlik limit bo'lsa shu ustuvor, aks holda oylik */}
        {daily && !daily.unlimited && daily.limit > 0 ? (
          <div className="px-4 pt-2 flex-shrink-0">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  quotaExhausted ? 'bg-rose-500' : quotaLow ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          </div>
        ) : usage && !usage.unlimited && usage.limit > 0 && (
          <div className="px-4 pt-2 flex-shrink-0">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  quotaExhausted ? 'bg-rose-500' : quotaLow ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Limit reached banner */}
        {limitError && (
          <div className="mx-4 mt-3 p-3 rounded-card border border-rose-200 bg-rose-50 flex items-start gap-2 flex-shrink-0">
            <AlertTriangle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-700">AI limit tugadi</p>
              <p className="text-xs text-rose-600 mt-0.5 leading-snug">{limitError}</p>
              <a href="/dashboard/billing" className="text-xs font-medium text-[color:var(--primary)] underline mt-1 inline-block">Qo'shimcha so'rov paketi sotib olish →</a>
            </div>
            <button onClick={() => setLimitError(null)} aria-label="Yopish" className="icon-btn-sm text-rose-500 hover:bg-rose-100 hover:text-rose-700">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Fon topshiriqlari — chat oqimidan tashqarida turadi, chunki ular
            suhbat xabari emas: topshiriq javob berilgandan keyin ham davom
            etadi va lentaning tepasiga surilib ketmasligi kerak. */}
        <FonTopshiriqlarPanel jobs={jobs} onCancel={cancelJob} />

        {/* Chat window. Kengaytirilgan rejimda matn butun ekran bo'ylab
            cho'zilmaydi: uzun satr o'qishni qiyinlashtiradi, shuning uchun
            kontent ~72ch ustunga yig'iladi va markazda turadi. */}
        <div className="flex-1 overflow-y-auto scroll-smooth custom-scroll bg-[color:var(--background)]">
          <div className={`px-4 py-4 space-y-5 ${kengaytirilgan ? 'mx-auto w-full max-w-[72ch] md:px-8 md:py-8' : ''}`}>
          {messages.length === 0 && (
            briefing ? (
              <>
                <RiskInsightsPanel risks={risks} onResolve={submitText} onDismiss={dismissRisk} />
                <BriefingPanel briefing={briefing} onAsk={submitText} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
                  <Bot size={20} className="text-slate-500" />
                </div>
                <p className="t-body-md text-slate-500">Qanday yordam bera olaman?</p>
              </div>
            )
          )}

          {messages.map((msg) => {
            const rawText = msg.parts
              .filter(p => p.type === 'text')
              .map(p => (p as { type: 'text'; text: string }).text)
              .join('');
            // Assistant javoblaridagi har qanday markdown'ni tozalaymiz va kirill
            // bo'lsa O'zbek lotin'ga aylantiramiz (defensiv, system prompt allaqachon man qiladi).
            // Foydalanuvchi xabarini esa o'zgartirmaymiz.
            const textContent = msg.role === 'assistant'
              ? cyrToLat(stripMarkdown(rawText))
              : rawText;

            const toolParts = msg.parts.filter(p =>
              p.type === 'dynamic-tool' || p.type.startsWith('tool-')
            ) as any[];

            // Adaptiv fikrlash xulosasi (backend `sendReasoning` ni default
            // yoqiq holda yuboradi). Bir necha bo'lakka bo'linib kelishi
            // mumkin — qadamlar orasida ham o'ylaydi, shuning uchun birlashtiramiz.
            const reasoningParts = msg.parts.filter(p => p.type === 'reasoning') as any[];
            const reasoningText = cyrToLat(stripMarkdown(
              reasoningParts.map(p => p.text || '').join('\n\n')
            )).trim();
            const reasoningStreaming = reasoningParts.some(p => p.state === 'streaming');

            // Dashboard'dagi xavf kartasidan kelgan xabar — foydalanuvchi uni
            // yozmagan, shuning uchun "Siz" pufagi sifatida emas, neytral
            // kontekst kartasi ko'rinishida chiziladi.
            if (msg.role === 'user' && isRiskMessage(rawText)) {
              return (
                <div key={msg.id} className="animate-slide-up">
                  <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-control bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <ShieldAlert size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-amber-700 mb-0.5">
                        Dashboard'dan xavf
                      </p>
                      <p className="text-sm font-medium text-amber-900 leading-snug">
                        {stripRiskPrefix(rawText)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // FOYDALANUVCHI xabari — o'ngda, yopiq pufak. Qisqa va u kim
            // yozganini bildiradi.
            //
            // AGENT javobi — PUFAK EMAS, hujjat. Ilgari u to'yingan to'q sariq
            // gradient ustida oq yarim qalin matn edi: bir jumlaga chidasa
            // bo'lardi, lekin agent endi ko'p bandli hisobot yozadi va bunday
            // blokni o'qib bo'lmasdi. Bu DESIGN.md ning 4-tamoyilini ham
            // buzardi: to'q sariq = amal va holat rangi, bezak emas.
            //
            // Endi javob oddiy matn: neytral fon, normal og'irlik, keng
            // qatorlar orasi. To'q sariq faqat belgida qoldi.
            const foydalanuvchi = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-2 ${foydalanuvchi ? 'items-end' : 'items-start'} animate-slide-up`}
              >
                {!foydalanuvchi && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-control bg-[color:var(--primary)] flex items-center justify-center flex-shrink-0">
                      <Bot size={16} className="text-white" />
                    </div>
                    <span className="t-label">Girgitton</span>
                  </div>
                )}

                <div className={`flex flex-col gap-2 ${foydalanuvchi ? 'items-end max-w-[85%]' : 'items-start w-full'}`}>
                  {!foydalanuvchi && reasoningText && (
                    <ReasoningBlock text={reasoningText} streaming={reasoningStreaming} />
                  )}

                  {textContent && (
                    foydalanuvchi ? (
                      <div className="px-4 py-2.5 rounded-card rounded-tr-sm bg-primary-50 border border-primary-100 text-sm leading-[1.6] font-medium text-slate-800 whitespace-pre-wrap">
                        {textContent}
                      </div>
                    ) : (
                      <div className="text-sm leading-[1.75] font-normal text-slate-800 whitespace-pre-wrap">
                        {textContent}
                      </div>
                    )
                  )}

                  {toolParts.map((part: any) => {
                    const toolCallId = part.toolCallId;
                    const toolName: string = part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5);
                    const state: string = part.state;

                    if (state === 'output-available') {
                      const out = part.output as any;
                      // [TASDIQ KARTASI] — server amalni pending qilib qo'ydi,
                      // foydalanuvchi shu yerda tasdiqlaydi/rad etadi.
                      if (out?.pendingConfirm && out?.actionId) {
                        return (
                          <PendingActionCard
                            key={toolCallId}
                            actionId={out.actionId}
                            summary={out.summary || 'Amalni tasdiqlang'}
                            onExecuted={onRefresh}
                          />
                        );
                      }
                      if (out?.success === false) {
                        return (
                          <div key={toolCallId} className="mt-3 rounded-card border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-600">
                            {out.error || 'Amal bajarilmadi'}
                          </div>
                        );
                      }
                      if (toolName === 'createOrder') return <SuccessBadge key={toolCallId} text="Buyurtma yaratildi" />;
                      if (toolName === 'createService') return <SuccessBadge key={toolCallId} text="Xizmat qo'shildi" />;
                      if (toolName === 'createServiceOption') return <SuccessBadge key={toolCallId} text="Optsiya saqlandi" />;
                      if (toolName === 'addCustomer') return <SuccessBadge key={toolCallId} text="Mijoz qo'shildi" />;
                      if (toolName === 'moveOrder') return <SuccessBadge key={toolCallId} text="Buyurtma ko'chirildi" />;

                      // Generative UI — o'qish tool'lari natijasi karta bo'lib chiqadi
                      if (toolName === 'getFinanceSummary') {
                        return <FinanceSummaryCard key={toolCallId} data={out} onOpen={() => navigate('/dashboard/kassa')} />;
                      }
                      if (toolName === 'getDebtorsReport' && out?.qarzdorlar?.length) {
                        return <DebtorsReportCard key={toolCallId} data={out} onOpen={() => navigate('/dashboard/mijozlar')} />;
                      }
                      if (toolName === 'getVendorsReport' && out?.hamkorlar?.length) {
                        return <VendorsReportCard key={toolCallId} data={out} onOpen={() => navigate('/dashboard/hamkorlar')} />;
                      }
                      if (toolName === 'getDebtors' && out?.qarzdorlar?.length) {
                        return <CustomersCard key={toolCallId} title="Qarzdorlar" items={out.qarzdorlar} total={out.jami_qarz} onOpen={() => navigate('/dashboard/mijozlar')} />;
                      }
                      if (toolName === 'searchCustomers' && out?.mijozlar?.length) {
                        return <CustomersCard key={toolCallId} title="Topilgan mijozlar" items={out.mijozlar} onOpen={() => navigate('/dashboard/mijozlar')} />;
                      }
                      if (toolName === 'searchOrders' && out?.buyurtmalar?.length) {
                        return <OrdersCard key={toolCallId} title="Topilgan buyurtmalar" items={out.buyurtmalar} onOpen={() => navigate('/dashboard/topshiriqlar')} />;
                      }
                      if (toolName === 'getUpcomingDeadlines' && out?.buyurtmalar?.length) {
                        return <OrdersCard key={toolCallId} title="Yaqin muddatlar" items={out.buyurtmalar} onOpen={() => navigate('/dashboard/topshiriqlar')} />;
                      }
                      if (toolName === 'getOrdersSummary' && out?.ustunlar?.length) {
                        return <ColumnsCard key={toolCallId} items={out.ustunlar} onOpen={() => navigate('/dashboard/topshiriqlar')} />;
                      }
                      if (toolName === 'getLowStock' && out?.materiallar?.length) {
                        return <MaterialsCard key={toolCallId} title="Kam qoldiq materiallar" items={out.materiallar} onOpen={() => navigate('/dashboard/ombor')} />;
                      }
                      if (toolName === 'searchMaterials' && out?.materiallar?.length) {
                        return <MaterialsCard key={toolCallId} title="Topilgan materiallar" items={out.materiallar} onOpen={() => navigate('/dashboard/ombor')} />;
                      }
                      return null;
                    }

                    if (state !== 'input-available' && state !== 'approval-requested') return null;

                    const onConfirm = () => addToolResult({ toolCallId, output: 'confirmed' } as any);
                    const args = part.input;

                    if (toolName === 'createOrder') {
                      return (
                        <CardWrapper key={toolCallId} title="Buyurtmani Tasdiqlash" subtitle="Yangi Buyurtma" icon={Package} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200">
                                 <p className="label-caps">Nomi</p>
                                 <p className="t-body-md">{args?.orderName}</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <div className="p-3 rounded-card bg-slate-50 border border-slate-200 text-center">
                                    <p className="label-caps">Miqdor</p>
                                    <p className="t-body-md tabular-nums">{args?.quantity}</p>
                                 </div>
                                 <div className="p-3 rounded-card bg-primary-50 border border-primary-100 text-center">
                                    <p className="label-caps text-[color:var(--primary)]">Jami</p>
                                    <p className="text-sm font-semibold text-slate-900 tabular-nums">{args?.totalAmount?.toLocaleString()} UZS</p>
                                 </div>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    if (toolName === 'createService') {
                      return (
                        <CardWrapper key={toolCallId} title="Xizmatni Tasdiqlash" subtitle="Yangi Xizmat" icon={Plus} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200">
                                 <p className="label-caps">Xizmat nomi</p>
                                 <p className="t-body-md">{args?.name}</p>
                              </div>
                              <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200">
                                 <p className="label-caps">Narxi / Birlik</p>
                                 <p className="t-body-md tabular-nums">{args?.basePrice?.toLocaleString()} UZS / {args?.unit}</p>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    if (toolName === 'createServiceOption') {
                      return (
                        <CardWrapper key={toolCallId} title="Optsiya Tasdiqlash" subtitle="Yangi Optsiya" icon={Settings} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-card bg-slate-50 border border-slate-200">
                                 <p className="label-caps">Xizmat va Optsiya</p>
                                 <p className="t-body-md">{args?.targetServiceName} - {args?.optionName}</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <div className="p-3 rounded-card bg-slate-50 border border-slate-200">
                                    <p className="label-caps">Eski narx</p>
                                    <p className="text-sm font-medium text-slate-500 line-through tabular-nums">{args?.oldPrice?.toLocaleString()}</p>
                                 </div>
                                 <div className="p-3 rounded-card bg-emerald-50 border border-emerald-200">
                                    <p className="label-caps text-emerald-600">Yangi narx</p>
                                    <p className="text-sm font-semibold text-emerald-700 tabular-nums">{args?.newPrice?.toLocaleString()}</p>
                                  </div>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    return null;
                  })}
                </div>
              </div>
            );
          })}

          {/* "Siz" / "Assistant" yorliqlari olib tashlandi: agent javobi
              yuqorida nomlangan, foydalanuvchi xabari esa o'ngda va pufakda —
              kim yozgani allaqachon ko'rinib turibdi. */}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-control bg-[color:var(--primary)] flex items-center justify-center flex-shrink-0">
                <Loader2 size={16} className="text-white animate-spin" />
              </div>
              <span className="t-label">O'ylayapti…</span>
            </div>
          )}
          <div ref={chatEndRef} />
          </div>
        </div>

        {/* Footer. Kengaytirilgan rejimda yozish maydoni ham xabarlar bilan
            bir ustunda turadi — aks holda u ekran bo'ylab cho'zilib, matn
            ustunidan ajralib qolardi. */}
        <div className="flex-shrink-0 bg-white border-t border-[color:var(--border)]">
          <div className={`p-4 ${kengaytirilgan ? 'mx-auto w-full max-w-[72ch] md:px-8' : ''}`}>
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {STARTER_SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="btn-outline h-sm"
                >
                  <Zap size={12} className="text-slate-500" /> {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Dekorativ gradient blur olib tashlandi: fokus holati chegara va
              ring bilan ko'rsatiladi, xuddi tizimdagi boshqa inputlar kabi. */}
          <form onSubmit={handleFormSubmit}>
            <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-control p-1.5 pl-3 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20 transition-all duration-120">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Eshityapman...' : 'Xabar yozing...'}
                rows={1}
                className="flex-1 bg-transparent resize-none text-sm font-normal leading-relaxed text-slate-900 placeholder-slate-400 focus:outline-none py-2 min-h-[40px] max-h-[150px]"
                onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFormSubmit(e as any); } }}
                disabled={isLoading || quotaExhausted}
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isLoading || quotaExhausted || micPermissionDenied}
                  title={isListening ? "Yozishni to'xtatish" : "Ovozli yozishni boshlash"}
                  className={`icon-btn disabled:opacity-40 ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-700 text-white hover:text-white animate-pulse'
                      : ''
                  }`}
                >
                  {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
              )}
              <button type="submit" disabled={!input.trim() || isLoading || quotaExhausted} aria-label="Yuborish" className="icon-btn bg-[color:var(--primary)] hover:bg-[color:var(--primary-hover)] text-white hover:text-white disabled:bg-slate-200">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </form>

          {/* Holat satri. "Girgitton AI" imzosi olib tashlandi — nom
              headerda allaqachon turibdi, takrori shunchaki shovqin. */}
          <div className="flex items-center gap-1.5 mt-2.5 px-1">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              isListening ? 'bg-rose-500 animate-pulse' : micPermissionDenied ? 'bg-slate-300' : 'bg-emerald-500'
            }`} />
            <span className="t-caption">
              {isListening ? 'Ovoz yozilmoqda' : micPermissionDenied ? "Mikrofon ruxsati yo'q" : 'Tayyor'}
            </span>
          </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AICopilot;
