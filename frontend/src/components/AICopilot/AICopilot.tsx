import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Send, Sparkles, Bot, User, CheckCircle2,
  Loader2, Package, Zap, ShieldCheck,
  Plus, Settings, Mic, MicOff, AlertTriangle,
  ArrowUpRight, Wallet, UserSquare2, ClipboardList, PackageOpen
} from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { aiApi } from '../../api';

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
  <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex items-center gap-3 text-emerald-700">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
        <ShieldCheck size={18} strokeWidth={2.5} />
      </div>
      <div>
         <p className="text-[11px] font-bold uppercase tracking-widest leading-none">Muvaffaqiyatli</p>
         <p className="text-[10px] font-bold text-emerald-600/80 mt-0.5">{text}</p>
      </div>
    </div>
  </div>
);

const CardWrapper: React.FC<{ title: string; subtitle: string; icon: any; children: React.ReactNode; onConfirm: () => void }> = ({ title, subtitle, icon: Icon, children, onConfirm }) => (
  <div className="mt-3 rounded-[32px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
    <div className="flex items-center justify-between px-6 py-5 bg-slate-50/50 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
          <Icon size={20} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{subtitle}</p>
          <p className="text-[14px] font-bold text-slate-900 tracking-tight">{title}</p>
        </div>
      </div>
    </div>
    <div className="p-6 space-y-4">
      {children}
      <button
        onClick={onConfirm}
        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
      >
        <CheckCircle2 size={16} strokeWidth={2.5} />
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
  <div className="mt-3 w-full rounded-[24px] border border-slate-200 bg-white shadow-lg shadow-slate-200/40 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
    <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
      <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
        <Icon size={14} strokeWidth={2.5} />
      </div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
    </div>
    <div className="px-4 py-2">{children}</div>
    {onOpen && (
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-slate-100 text-[10px] font-bold text-orange-600 uppercase tracking-widest hover:bg-orange-50 transition-colors"
      >
        {openLabel || "Bo'limni ochish"} <ArrowUpRight size={12} strokeWidth={2.5} />
      </button>
    )}
  </div>
);

// Ro'yxat qatori — chapda nom/izoh, o'ngda qiymat
const DataRow: React.FC<{ primary: string; secondary?: string | null; value: string; valueClass?: string }> = ({
  primary, secondary, value, valueClass,
}) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-bold text-slate-800 truncate">{primary}</p>
      {secondary && <p className="text-[10px] font-semibold text-slate-400 truncate mt-0.5">{secondary}</p>}
    </div>
    <p className={`text-[12px] font-bold whitespace-nowrap ${valueClass || 'text-slate-700'}`}>{value}</p>
  </div>
);

const MoreRows: React.FC<{ count: number }> = ({ count }) =>
  count > 0 ? (
    <p className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
      + yana {count} ta
    </p>
  ) : null;

// getFinanceSummary → stat tile qatori (kirim/chiqim/balans)
const FinanceSummaryCard: React.FC<{ data: any; onOpen?: () => void }> = ({ data, onOpen }) => (
  <DataCard title={`Moliya — oxirgi ${data.davr_kun} kun`} icon={Wallet} onOpen={onOpen} openLabel="Kassani ochish">
    <div className="grid grid-cols-3 gap-2 py-2">
      <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Kirim</p>
        <p className="text-[13px] font-bold text-slate-900 mt-1">{fm(data.kirim)}</p>
      </div>
      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-center">
        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Chiqim</p>
        <p className="text-[13px] font-bold text-slate-900 mt-1">{fm(data.chiqim)}</p>
      </div>
      <div className="p-3 rounded-2xl bg-slate-900 text-center">
        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Balans</p>
        <p className="text-[13px] font-bold text-white mt-1">{fm(data.balans)}</p>
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
        valueClass={(c.totalDebt ?? c.qarz) > 0 ? 'text-rose-600' : 'text-slate-400'}
      />
    ))}
    <MoreRows count={items.length - 6} />
    {typeof total === 'number' && total > 0 && (
      <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jami qarz</p>
        <p className="text-[13px] font-bold text-rose-600">{fm(total)} so'm</p>
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
      <div key={d.id} className="py-2 border-b border-slate-50 last:border-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-slate-800 truncate">{d.name}</p>
            {d.eng_eski_qarz_kun !== null && (
              <p className="text-[10px] font-semibold text-slate-400">{d.eng_eski_qarz_kun} kundan beri</p>
            )}
          </div>
          <p className="text-[12px] font-bold text-rose-600 whitespace-nowrap">{fm(d.totalDebt)} so'm</p>
        </div>
        {(d.buyurtmalar || []).slice(0, 4).map((b: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-2 pl-3 mt-1">
            <p className="text-[11px] text-slate-500 truncate">
              {b.displayId ? `${b.displayId} · ` : ''}{b.nom}
              <span className="text-slate-400"> · {b.necha_kun} kun</span>
            </p>
            <p className="text-[11px] font-semibold text-rose-500 whitespace-nowrap">{fm(b.qoldiq)}</p>
          </div>
        ))}
        {(d.buyurtmalar || []).length > 4 && (
          <p className="pl-3 mt-1 text-[10px] font-semibold text-slate-400">+ yana {d.buyurtmalar.length - 4} ta buyurtma</p>
        )}
      </div>
    ))}
    <MoreRows count={(data.qarzdorlar || []).length - 5} />
    <div className="flex items-center justify-between py-2.5 border-t border-slate-100">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jami qarz</p>
      <p className="text-[13px] font-bold text-rose-600">{fm(data.jami_qarz)} so'm</p>
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
        valueClass={v.balans > 0 ? 'text-rose-600' : v.balans < 0 ? 'text-emerald-600' : 'text-slate-400'}
      />
    ))}
    <MoreRows count={(data.hamkorlar || []).length - 6} />
    {(data.biz_qarzmiz_jami > 0 || data.ular_qarz_jami > 0) && (
      <div className="flex items-center justify-between py-2.5 border-t border-slate-100 text-[11px] font-bold">
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
      className="w-full flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 text-left hover:bg-slate-50 rounded-xl px-2 transition-colors"
    >
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
        tone === 'rose' ? 'bg-rose-100 text-rose-500' : tone === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
      }`}>
        <Icon size={13} strokeWidth={2.5} />
      </div>
      <p className="flex-1 text-[12px] font-bold text-slate-700 min-w-0 truncate">{text}</p>
      <p className={`text-[12px] font-bold whitespace-nowrap ${tone === 'rose' ? 'text-rose-600' : 'text-slate-700'}`}>{value}</p>
    </button>
  );

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white shadow-lg shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-orange-50/60 border-b border-orange-100">
        <div className="w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center text-white">
          <Sparkles size={14} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Bugungi brifing</p>
          <p className="text-[10px] font-semibold text-slate-400">{new Date(b.sana).toLocaleDateString('uz-UZ')}</p>
        </div>
      </div>

      {/* Bugungi kassa — stat tile qatori */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
          <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Kirim</p>
          <p className="text-[12px] font-bold text-slate-900 mt-0.5">{fm(b.moliya.kirim)}</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-100 text-center">
          <p className="text-[8px] font-bold text-rose-500 uppercase tracking-widest">Chiqim</p>
          <p className="text-[12px] font-bold text-slate-900 mt-0.5">{fm(b.moliya.chiqim)}</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-slate-900 text-center">
          <p className="text-[8px] font-bold text-white/50 uppercase tracking-widest">Balans</p>
          <p className="text-[12px] font-bold text-white mt-0.5">{fm(b.moliya.balans)}</p>
        </div>
      </div>

      <div className="px-2 py-2">
        {allClear ? (
          <p className="py-4 text-center text-[11px] font-bold text-emerald-600 uppercase tracking-widest">
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
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
        Bekor qilindi — {summary}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[28px] border border-amber-200 bg-white shadow-xl shadow-amber-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-3 px-5 py-4 bg-amber-50/60 border-b border-amber-100">
        <div className="w-9 h-9 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
          <ShieldCheck size={18} strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Tasdiqlash kerak</p>
          <p className="text-[13px] font-bold text-slate-900 tracking-tight">{summary}</p>
        </div>
      </div>
      <div className="p-4">
        {state === 'failed' && (
          <p className="mb-3 text-[11px] font-bold text-rose-600">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => run('confirm')}
            disabled={state === 'busy'}
            className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
          >
            {state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} strokeWidth={2.5} />}
            Tasdiqlash
          </button>
          <button
            onClick={() => run('reject')}
            disabled={state === 'busy'}
            className="h-11 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 text-[11px] font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-[0.98]"
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

type Usage = { used: number; limit: number; unlimited: boolean; periodEnd?: string };

const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, onRefresh }) => {
  const [input, setInput] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [briefing, setBriefing] = useState<any>(null);
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
    }
  }, [isOpen, fetchUsage]);

  const submitText = useCallback((text: string) => {
    const t = text.trim();
    // 3 belgidan qisqa — STT noto'g'ri eshitgan bo'lishi mumkin. Yubormaymiz.
    if (t.length < 3) {
      setInput('');
      inputRefVal.current = '';
      return;
    }
    setLimitError(null);
    sendMessage({ text: t });
    setInput('');
    inputRefVal.current = '';
  }, [sendMessage]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().length < 3 || isLoading) return;
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
  const quotaLow = !!(usage && !usage.unlimited && quotaPct >= 80);
  const quotaExhausted = !!(usage && !usage.unlimited && usage.used >= usage.limit);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm md:hidden animate-in fade-in duration-300" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-[70] w-full md:w-[460px] bg-white border-l border-slate-200 shadow-[-20px_0_50px_rgba(0,0,0,0.15)] flex flex-col animate-in slide-in-from-right duration-500 ease-out">

        {/* Header */}
        <div className="relative flex items-center gap-4 px-6 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-md flex-shrink-0">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/30">
              <Sparkles size={22} className="text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 uppercase">
              Girgitton
              {isListening && (
                <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] rounded-md shadow-sm animate-pulse">Eshityapman</span>
              )}
            </h2>
            {usage && (
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
                quotaExhausted ? 'text-rose-500' : quotaLow ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {usage.unlimited
                  ? 'Cheksiz xabarlar'
                  : `${usage.used} / ${usage.limit} xabar — 30 kun davri`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="ml-auto w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Quota progress bar */}
        {usage && !usage.unlimited && usage.limit > 0 && (
          <div className="px-6 pt-2 flex-shrink-0">
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
          <div className="mx-6 mt-3 p-3 rounded-2xl border border-rose-200 bg-rose-50 flex items-start gap-2 flex-shrink-0">
            <AlertTriangle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-rose-700">AI limit tugadi</p>
              <p className="text-[10px] font-bold text-rose-600 mt-0.5 leading-snug">{limitError}</p>
              <a href="/billing" className="text-[10px] font-bold text-orange-600 underline mt-1 inline-block">Tarifni yangilash →</a>
            </div>
            <button onClick={() => setLimitError(null)} className="text-rose-400 hover:text-rose-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Chat window */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scroll-smooth custom-scroll bg-slate-50/30">
          {messages.length === 0 && (
            briefing ? (
              <BriefingPanel briefing={briefing} onAsk={submitText} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
                <Bot size={48} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Qanday yordam bera olaman?</p>
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

            return (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-md ${
                  msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
                }`}>
                  {msg.role === 'user' ? <User size={16} strokeWidth={2.5} /> : <Bot size={16} strokeWidth={2.5} />}
                </div>

                <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                  {textContent && (
                    <div className={`px-5 py-4 rounded-[26px] text-[13px] leading-[1.6] font-semibold shadow-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'
                        : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-tl-sm'
                    }`}>
                      {textContent}
                    </div>
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
                          <div key={toolCallId} className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5 text-[11px] font-bold text-rose-600">
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
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nomi</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.orderName}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Miqdor</p>
                                    <p className="text-[12px] font-bold text-slate-800">{args?.quantity}</p>
                                 </div>
                                 <div className="p-3 rounded-2xl bg-slate-900 text-white text-center">
                                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Jami</p>
                                    <p className="text-[12px] font-bold">{args?.totalAmount?.toLocaleString()} UZS</p>
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
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xizmat nomi</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.name}</p>
                              </div>
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Narxi / Birlik</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.basePrice?.toLocaleString()} UZS / {args?.unit}</p>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    if (toolName === 'createServiceOption') {
                      return (
                        <CardWrapper key={toolCallId} title="Optsiya Tasdiqlash" subtitle="Yangi Optsiya" icon={Settings} onConfirm={onConfirm}>
                           <div className="space-y-3">
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Xizmat va Optsiya</p>
                                 <p className="text-[12px] font-bold text-slate-800">{args?.targetServiceName} - {args?.optionName}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                 <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Eski narx</p>
                                    <p className="text-[12px] font-bold text-slate-400 line-through">{args?.oldPrice?.toLocaleString()}</p>
                                 </div>
                                 <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Yangi narx</p>
                                    <p className="text-[12px] font-bold text-emerald-700">{args?.newPrice?.toLocaleString()}</p>
                                  </div>
                              </div>
                           </div>
                        </CardWrapper>
                      );
                    }

                    return null;
                  })}

                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2">{msg.role === 'user' ? 'Siz' : 'Assistant'}</span>
                </div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-4">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg"><Bot size={16} className="text-white" strokeWidth={2.5} /></div>
              <div className="px-6 py-4 rounded-3xl rounded-tl-sm bg-orange-400 text-white flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-[11px] font-bold uppercase tracking-widest">O'ylayapman...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-6 bg-white border-t border-slate-100">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {STARTER_SUGGESTIONS.map((suggestion, i) => (
                <button key={i} onClick={() => setInput(suggestion)} className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl hover:border-orange-500 hover:text-orange-600 transition-all uppercase tracking-tight group">
                  <Zap size={10} className="text-orange-400" /> {suggestion}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-[32px] blur opacity-0 group-focus-within:opacity-10 transition duration-500" />
            <div className="relative flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[28px] p-2 pl-6 focus-within:bg-white focus-within:border-orange-500 transition-all duration-300">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Eshityapman...' : 'Xabar yozing...'}
                rows={1}
                className="flex-1 bg-transparent resize-none text-[14px] text-slate-800 placeholder:text-slate-400 font-semibold focus:outline-none py-3 min-h-[44px] max-h-[150px]"
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
                  className={`w-11 h-11 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-90 mb-0.5 ${
                    isListening
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-xl shadow-rose-500/25 animate-pulse'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40'
                  }`}
                >
                  {isListening ? <Mic size={18} strokeWidth={2.5} /> : <MicOff size={18} strokeWidth={2.5} />}
                </button>
              )}
              <button type="submit" disabled={!input.trim() || isLoading || quotaExhausted} className="w-11 h-11 flex-shrink-0 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white flex items-center justify-center transition-all shadow-xl shadow-orange-500/25 active:scale-90 mb-0.5">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
              {isListening ? 'Ovoz yozilmoqda' : micPermissionDenied ? "Mikrofon ruxsati yo'q" : 'Tayyor'}
            </div>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Girgitton AI</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AICopilot;
