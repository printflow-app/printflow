import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Package, CreditCard, Users, Tag, Image,
  LogOut, ListChecks, Bell, ShieldCheck, Sparkles, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useSuperAdminMe, useTenants } from '../hooks/queries';

// =============================================
// SUPER-ADMIN QOBIG'I — 2026-07 redizayn.
// Konsol registri: tig'iz navigatsiya reli, sokin sirtlar, aniq holatlar.
// Ranglar o'zgarmagan (brand orange + semantik + slate) — struktura,
// tipografika, ritm va interaktiv holatlar qayta qurildi.
// =============================================

interface NavGroup {
  label: string;
  items: { path: string; icon: any; label: string; hint?: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Nazorat',
    items: [
      { path: '/',         icon: LayoutDashboard, label: 'Dashboard',  hint: 'Platforma ko\'rsatkichlari' },
      { path: '/tenants',  icon: Building2,       label: 'Workspaces', hint: 'Mijoz hisoblari' },
      { path: '/ai-usage', icon: Sparkles,        label: 'AI sarfi',   hint: 'Foydalanish va xarajat' },
    ],
  },
  {
    label: 'Sotuv & billing',
    items: [
      { path: '/plans',       icon: Package,    label: 'Tariflar' },
      { path: '/payments',    icon: CreditCard, label: "To'lovlar" },
      { path: '/leads',       icon: Users,      label: "So'rovlar" },
      { path: '/promo-codes', icon: Tag,        label: 'Promo kodlar' },
    ],
  },
  {
    label: 'Ish boshqaruvi',
    items: [
      { path: '/task-manager', icon: ListChecks, label: 'Task menejer' },
      { path: '/logos',        icon: Image,      label: 'Mijoz logolari' },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items);
const LAST_SEEN_KEY = 'pf_sa_workspaces_lastSeen';
const RAIL_KEY = 'pf_sa_rail_collapsed';

const getLastSeen = () => Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
const setLastSeen = (ts: number) => localStorage.setItem(LAST_SEEN_KEY, String(ts));

export default function Layout({ onLogout, children }: { onLogout: () => void; children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: me } = useSuperAdminMe();
  const { data: tenants = [] } = useTenants();

  const current = ALL_ITEMS.find(n => n.path === location.pathname);

  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(RAIL_KEY) === '1');
  const toggleRail = () => {
    setCollapsed(c => {
      localStorage.setItem(RAIL_KEY, c ? '0' : '1');
      return !c;
    });
  };

  const [lastSeen, setLastSeenState] = useState<number>(getLastSeen);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const sortedTenants = useMemo(
    () => [...tenants].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [tenants],
  );
  const unseenCount = useMemo(
    () => sortedTenants.filter((t: any) => new Date(t.createdAt).getTime() > lastSeen).length,
    [sortedTenants, lastSeen],
  );

  useEffect(() => {
    if (!bellOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setBellOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [bellOpen]);

  const markAllSeen = () => {
    const now = Date.now();
    setLastSeen(now);
    setLastSeenState(now);
  };

  const adminLogin = me?.login || 'superadmin';
  const adminInitial = adminLogin.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-[color:var(--bg)]">
      {/* Klaviatura foydalanuvchilari uchun — kontentga o'tish */}
      <a
        href="#sa-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-slate-900 focus:text-white focus:text-xs focus:font-semibold"
      >
        Kontentga o'tish
      </a>

      {/* ── Navigatsiya reli ─────────────────────────────────────────
          sticky + h-screen: sahifa (window) scroll qilganda rel joyida
          turadi, lekin scroll konteyner BODY bo'ladi — shu sababli
          brauzerning o'z scrollbari, PageDown/End tugmalari va sichqoncha
          g'ildiragi sahifaning istalgan joyida ishlaydi. */}
      <aside
        className={`${collapsed ? 'w-[68px]' : 'w-[236px]'} shrink-0 bg-white border-r border-[color:var(--border)] flex flex-col transition-[width] duration-200 ease-out sticky top-0 h-screen`}
      >
        <div className={`h-14 flex items-center border-b border-[color:var(--border)] ${collapsed ? 'justify-center px-2' : 'px-4 gap-2.5'}`}>
          <img src={logo} alt="PrintFlow logotipi" className="h-6 w-auto shrink-0" />
          {!collapsed && (
            <>
              <span className="text-[15px] font-extrabold tracking-tight text-slate-900">
                Print<span className="text-orange-500">Flow</span>
              </span>
              <span className="ml-auto text-[9px] font-bold text-slate-400 font-mono">v2.5</span>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Asosiy navigatsiya">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              {!collapsed && (
                <div className="px-2.5 pb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {group.label}
                </div>
              )}
              {collapsed && gi > 0 && <div className="mx-3 my-2 h-px bg-[color:var(--border)]" />}

              <div className="space-y-0.5">
                {group.items.map(n => {
                  const active = location.pathname === n.path;
                  const Icon = n.icon;
                  const isWorkspaces = n.path === '/tenants';
                  return (
                    <Link
                      key={n.path}
                      to={n.path}
                      onClick={isWorkspaces ? markAllSeen : undefined}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? n.label : undefined}
                      className={`group relative flex items-center rounded-lg text-[13px] font-semibold transition-colors duration-150 ${
                        collapsed ? 'justify-center h-10' : 'gap-2.5 px-2.5 h-9'
                      } ${
                        active
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {/* Aktiv indikator — chap chekkadagi tayoqcha */}
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-orange-500" />
                      )}
                      <Icon size={17} strokeWidth={active ? 2.4 : 2} className="shrink-0" />
                      {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                      {isWorkspaces && unseenCount > 0 && !active && (
                        <span
                          className={`text-[9px] font-bold font-mono bg-orange-500 text-white rounded-full flex items-center justify-center ${
                            collapsed
                              ? 'absolute top-1 right-1 min-w-[15px] h-[15px] px-1'
                              : 'min-w-[18px] h-[18px] px-1'
                          }`}
                        >
                          {unseenCount > 9 ? '9+' : unseenCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Identifikatsiya + rel yig'ish */}
        <div className="p-2 border-t border-[color:var(--border)] space-y-1">
          <div className={`flex items-center rounded-lg bg-[color:var(--panel-muted)] border border-[color:var(--border)] ${collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-2'}`}>
            <div className="w-7 h-7 rounded-lg bg-orange-500 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
              {adminInitial}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[12px] font-bold text-slate-900 truncate">
                  <ShieldCheck size={11} className="text-orange-500 shrink-0" />
                  <span className="truncate">{adminLogin}</span>
                </div>
                <p className="text-[9px] font-bold tracking-[0.1em] text-slate-400 uppercase">Super admin</p>
              </div>
            )}
          </div>

          <button
            onClick={toggleRail}
            className={`w-full flex items-center h-8 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors ${
              collapsed ? 'justify-center' : 'gap-2 px-2.5'
            }`}
            aria-label={collapsed ? 'Panelni ochish' : 'Panelni yig\'ish'}
          >
            {collapsed ? <PanelLeft size={15} /> : <><PanelLeftClose size={15} /> Yig'ish</>}
          </button>
        </div>
      </aside>

      {/* ── Asosiy ustun ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-[color:var(--border)] flex items-center justify-between px-5 gap-4 sticky top-0 z-30">
          <div className="min-w-0">
            <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight truncate">
              {current?.label || 'Super admin'}
            </h1>
            {current?.hint && (
              <p className="text-[11px] font-medium text-slate-400 truncate">{current.hint}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(o => !o)}
                aria-label={`Bildirishnomalar${unseenCount ? `, ${unseenCount} ta yangi` : ''}`}
                aria-expanded={bellOpen}
                className={`relative flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${
                  bellOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Bell size={16} strokeWidth={2.2} />
                {unseenCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 text-[9px] font-bold font-mono rounded-full bg-orange-500 text-white border-2 border-white flex items-center justify-center">
                    {unseenCount > 9 ? '9+' : unseenCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-[320px] bg-white border border-[color:var(--border)] rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.10)] overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                    <div>
                      <p className="text-[12px] font-bold text-slate-900">Yangi workspacelar</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                        {unseenCount > 0 ? `${unseenCount} ta ko'rilmagan` : "Hammasi ko'rib chiqilgan"}
                      </p>
                    </div>
                    {unseenCount > 0 && (
                      <button onClick={markAllSeen} className="text-[10px] font-bold text-orange-600 hover:text-orange-700">
                        Belgilash
                      </button>
                    )}
                  </div>

                  <div className="max-h-[340px] overflow-y-auto">
                    {sortedTenants.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <Building2 size={20} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-[11px] font-semibold text-slate-400">Workspace topilmadi</p>
                      </div>
                    ) : (
                      sortedTenants.slice(0, 8).map((t: any) => {
                        const isNew = new Date(t.createdAt).getTime() > lastSeen;
                        return (
                          <button
                            key={t.id}
                            onClick={() => { setBellOpen(false); markAllSeen(); navigate('/tenants'); }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-[color:var(--border)] last:border-0 ${
                              isNew ? 'bg-orange-50/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isNew ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
                              }`}>
                                <Building2 size={13} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[12px] font-bold text-slate-900 truncate">{t.name}</p>
                                  {isNew && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider bg-orange-500 text-white px-1 py-px rounded">
                                      Yangi
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono truncate">@{t.slug}</p>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(t.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[color:var(--border)] mx-1" />

            <button
              onClick={onLogout}
              className="flex items-center gap-2 h-9 px-3 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 text-[12px] font-semibold transition-colors"
            >
              <LogOut size={15} strokeWidth={2.2} /> Chiqish
            </button>
          </div>
        </header>

        <main id="sa-main" className="flex-1 p-5">
          <div className="max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
