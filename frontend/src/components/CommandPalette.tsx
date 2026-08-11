import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowRight, Wallet, ClipboardList, UserSquare2, Users,
  PackageOpen, QrCode, ShieldCheck, Handshake, Settings, TrendingUp,
  BarChart3, Building2, Sparkles,
} from 'lucide-react';

// =============================================
// Omnibox — Ctrl+K (yoki Cmd+K)
// Bitta qatordan ikkita yo'l: sahifaga o'tish YOKI Girgitton agentidan
// so'rash. Nav mos kelmasa ham, yozilgan har qanday niyat agentga ketadi
// ('pf:ai-ask' custom event — Dashboard drawer'ni ochadi, AICopilot yuboradi).
// =============================================

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: any; // lucide-react icon component (LucideIcon type)
  to: string;
  keywords: string;
}

const COMMANDS: CommandItem[] = [
  { id: 'kassa',        label: 'Kassa',                 hint: "Kirim/Chiqim tranzaksiyalari", icon: Wallet,        to: '/dashboard/kassa',        keywords: 'kassa cash money pul kirim chiqim' },
  { id: 'topshiriqlar', label: 'Xizmatlar (Kanban)',    hint: 'Buyurtmalar va vazifalar',     icon: ClipboardList, to: '/dashboard/topshiriqlar', keywords: 'topshiriq task kanban buyurtma order' },
  { id: 'mijozlar',     label: 'Mijozlar Bazasi',       hint: 'Qarz va kontaktlar',           icon: UserSquare2,   to: '/dashboard/mijozlar',     keywords: 'mijoz customer crm qarz debt' },
  { id: 'ombor',        label: 'Ombor',                 hint: 'Materiallar va qoldiqlar',     icon: PackageOpen,   to: '/dashboard/ombor',        keywords: 'ombor inventory stock material' },
  { id: 'davomat',      label: 'Davomat',               hint: 'Xodimlar kelishi-ketishi',     icon: QrCode,        to: '/dashboard/davomat',      keywords: 'davomat attendance qr time' },
  { id: 'moliya',       label: 'Statistika',            hint: 'Daromad ko\'rsatkichlari',     icon: TrendingUp,    to: '/dashboard/moliya',       keywords: 'statistika finance daromad income' },
  { id: 'hisobotlar',   label: 'Hisobotlar',            hint: 'Biznes tahlil',                icon: BarChart3,     to: '/dashboard/hisobotlar',   keywords: 'hisobot report tahlil analytics' },
  { id: 'hodimlar',     label: 'Xodimlar',              hint: 'Jamoa ro\'yxati',              icon: Users,         to: '/dashboard/hodimlar',     keywords: 'xodim employee staff team' },
  { id: 'admins',       label: "Ma'muriyat",            hint: 'Adminlar va rollar',           icon: ShieldCheck,   to: '/dashboard/admins',       keywords: 'admin role rahbar owner' },
  { id: 'hamkorlar',    label: 'Hamkorlar',             hint: 'Subpudratchi va vendor',       icon: Handshake,     to: '/dashboard/hamkorlar',    keywords: 'hamkor vendor subpudratchi partner' },
  { id: 'filiallar',    label: 'Filiallar',             hint: 'Multi-filial boshqaruvi',      icon: Building2,     to: '/dashboard/filiallar',    keywords: 'filial branch office bo\'lim' },
  { id: 'sozlamalar',   label: 'Tizim Sozlamalari',     hint: 'Konfiguratsiya va billing',    icon: Settings,      to: '/dashboard/sozlamalar',   keywords: 'sozlama setting config' },
];

// Ro'yxat elementi: nav sahifa yoki agentga yuborish qatori
type Row =
  | { kind: 'nav'; cmd: CommandItem }
  | { kind: 'agent'; text: string };

export function CommandPalette({ agentEnabled = false }: { agentEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K global listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const navs = !q
      ? COMMANDS
      : COMMANDS.filter(c =>
          c.label.toLowerCase().includes(q) ||
          c.keywords.toLowerCase().includes(q) ||
          (c.hint?.toLowerCase().includes(q) ?? false)
        );
    const out: Row[] = navs.map(cmd => ({ kind: 'nav', cmd }));
    // 3+ belgi yozilgan bo'lsa — har doim agent qatori ham bor: nav topilsa
    // oxirida, topilmasa yagona variant sifatida.
    if (agentEnabled && query.trim().length >= 3) {
      out.push({ kind: 'agent', text: query.trim() });
    }
    return out;
  }, [query, agentEnabled]);

  // Reset highlighted item when filter changes
  useEffect(() => { setActiveIndex(0); }, [query]);

  const handleSelect = (row: Row) => {
    setOpen(false);
    if (row.kind === 'nav') {
      navigate(row.cmd.to);
    } else {
      // Dashboard drawer'ni ochadi, AICopilot xabarni yuboradi
      window.dispatchEvent(new CustomEvent('pf:ai-ask', { detail: { text: row.text } }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) handleSelect(row);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[300] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={agentEnabled ? "Sahifa qidirish yoki Girgitton'dan so'rash..." : 'Sahifa qidirish...'}
            className="flex-1 bg-transparent outline-none text-base font-semibold text-slate-800 placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline-block text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-sm font-semibold text-slate-400">
              "{query}" — hech narsa topilmadi
            </div>
          ) : (
            rows.map((row, i) => {
              const isActive = i === activeIndex;
              if (row.kind === 'agent') {
                return (
                  <button
                    key="__agent__"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => handleSelect(row)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-orange-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' : 'bg-orange-100 text-orange-600'
                    }`}>
                      <Sparkles size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">
                        Girgitton'dan so'rash: <span className="text-orange-600">"{row.text}"</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">Agent javob beradi yoki amalni bajaradi</div>
                    </div>
                    {isActive && <ArrowRight size={14} className="text-orange-500" />}
                  </button>
                );
              }
              const { cmd } = row;
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => handleSelect(row)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-orange-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{cmd.label}</div>
                    {cmd.hint && <div className="text-xs text-slate-500 truncate">{cmd.hint}</div>}
                  </div>
                  {isActive && <ArrowRight size={14} className="text-orange-500" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span className="flex gap-3">
            <span>↑↓ navigatsiya</span>
            <span>Enter — tanlash</span>
            {agentEnabled && <span className="text-orange-400">Yozing → agent</span>}
          </span>
          <span>Ctrl/Cmd + K — ochish</span>
        </div>
      </div>
    </div>
  );
}
