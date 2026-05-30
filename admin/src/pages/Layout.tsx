import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Package, CreditCard, Users, Tag, Image,
  LogOut, ListChecks, Bell, ShieldCheck,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useSuperAdminMe, useTenants } from '../hooks/queries';

interface NavGroup {
  label: string;
  items: { path: string; icon: any; label: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Asosiy',
    items: [
      { path: '/',        icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/tenants', icon: Building2,       label: 'Workspaces' },
    ],
  },
  {
    label: 'Sotuv & Billing',
    items: [
      { path: '/plans',       icon: Package,    label: 'Tariflar' },
      { path: '/payments',    icon: CreditCard, label: "To'lovlar" },
      { path: '/leads',       icon: Users,      label: "So'rovlar" },
      { path: '/promo-codes', icon: Tag,        label: 'Promo Kodlar' },
    ],
  },
  {
    label: 'Ish boshqaruvi',
    items: [
      { path: '/task-manager', icon: ListChecks, label: 'Task Menejer' },
    ],
  },
  {
    label: 'Brand',
    items: [
      { path: '/logos', icon: Image, label: 'Mijoz logolari' },
    ],
  },
];

const LAST_SEEN_KEY = 'pf_sa_workspaces_lastSeen';

function getLastSeen(): number {
  const raw = localStorage.getItem(LAST_SEEN_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function setLastSeen(ts: number) {
  localStorage.setItem(LAST_SEEN_KEY, String(ts));
}

export default function Layout({ onLogout, children }: { onLogout: () => void; children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: me } = useSuperAdminMe();
  const { data: tenants = [] } = useTenants();

  const currentLabel = NAV_GROUPS
    .flatMap(g => g.items)
    .find(n => n.path === location.pathname)?.label || 'Super Admin';

  // ── New workspace notifications ─────────────────────────────────────────
  const [lastSeen, setLastSeenState] = useState<number>(getLastSeen);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);

  const newWorkspaces = useMemo(() => {
    return [...tenants]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((t: any) => new Date(t.createdAt).getTime() > lastSeen);
  }, [tenants, lastSeen]);

  const recentForDropdown = useMemo(() => {
    return [...tenants]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [tenants]);

  const unseenCount = newWorkspaces.length;

  // Outside-click close
  useEffect(() => {
    if (!bellOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [bellOpen]);

  const markAllSeen = () => {
    const now = Date.now();
    setLastSeen(now);
    setLastSeenState(now);
  };

  const openTenant = (id: string) => {
    setBellOpen(false);
    markAllSeen();
    navigate('/tenants');
    // Tenants page reads its own list; selecting a specific one would require
    // shared state we don't have yet. Landing on the page is enough for now.
    void id;
  };

  const adminLogin = me?.login || 'superadmin';
  const adminInitial = adminLogin.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#f2f2f7]">
      {/* Sidebar */}
      <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-slate-200/70 flex flex-col">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-100">
          <img src={logo} alt="PF" className="h-7 w-auto drop-shadow" />
          <span className="text-base font-semibold tracking-tight text-slate-800">
            Print<span className="text-orange-500">Flow</span>
          </span>
          <span className="ml-auto text-[8px] font-semibold text-slate-400 uppercase tracking-widest">v2.5</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </div>
              {group.items.map(n => {
                const active = location.pathname === n.path;
                const Icon = n.icon;
                const isWorkspaces = n.path === '/tenants';
                return (
                  <Link
                    key={n.path}
                    to={n.path}
                    onClick={isWorkspaces ? markAllSeen : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                        : 'text-slate-600 hover:bg-slate-500/5 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                    <span className="flex-1">{n.label}</span>
                    {isWorkspaces && unseenCount > 0 && !active && (
                      <span className="text-[9px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {unseenCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Super Admin identity card */}
        <div className="px-3 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {adminInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[12px] font-bold text-slate-900 truncate">
                <ShieldCheck size={11} className="text-orange-500 flex-shrink-0" />
                <span className="truncate">{adminLogin}</span>
              </div>
              <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-slate-200/70 flex items-center justify-between px-6 sticky top-0 z-40">
          <div>
            <h1 className="text-[17px] font-semibold text-slate-900 tracking-tight">{currentLabel}</h1>
            <p className="text-[11px] font-medium text-slate-400 tracking-wide mt-0.5">
              Boshqaruv paneli
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen(o => !o)}
                className="relative flex items-center justify-center h-9 w-9 rounded-full bg-slate-500/8 hover:bg-slate-500/15 text-slate-600 hover:text-slate-900 transition-colors"
                aria-label="Bildirishnomalar"
              >
                <Bell size={16} strokeWidth={2.2} />
                {unseenCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[9px] font-bold rounded-full bg-orange-500 text-white border-2 border-white flex items-center justify-center">
                    {unseenCount > 9 ? '9+' : unseenCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Yangi workspacelar</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {unseenCount > 0 ? `${unseenCount} ta yangi` : 'Hammasini ko\'rib chiqdingiz'}
                      </p>
                    </div>
                    {unseenCount > 0 && (
                      <button
                        onClick={markAllSeen}
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-700"
                      >
                        Hammasini belgilash
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {recentForDropdown.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Workspace topilmadi
                      </div>
                    ) : (
                      recentForDropdown.map((t: any) => {
                        const isNew = new Date(t.createdAt).getTime() > lastSeen;
                        return (
                          <button
                            key={t.id}
                            onClick={() => openTenant(t.id)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                              isNew ? 'bg-orange-50/40' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                                isNew ? 'bg-orange-100 border-orange-200 text-orange-600' : 'bg-slate-100 border-slate-200 text-slate-500'
                              }`}>
                                <Building2 size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-slate-900 truncate">{t.name}</p>
                                  {isNew && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider bg-orange-500 text-white px-1.5 py-0.5 rounded">
                                      Yangi
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">@{t.slug}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {new Date(t.createdAt).toLocaleString('uz-UZ', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 h-9 px-4 rounded-full bg-slate-500/8 hover:bg-rose-500/10 text-slate-600 hover:text-rose-600 text-[13px] font-medium transition-colors"
            >
              <LogOut size={15} strokeWidth={2.2} /> Chiqish
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#f2f2f7]">{children}</main>
      </div>
    </div>
  );
}
