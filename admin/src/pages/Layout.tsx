import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Package, CreditCard, Users, Tag, Image, LogOut, ListChecks, ChevronRight } from 'lucide-react';
import logo from '../assets/logo.png';

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

export default function Layout({ onLogout, children }: { onLogout: () => void; children: React.ReactNode }) {
  const location = useLocation();
  const currentLabel = NAV_GROUPS
    .flatMap(g => g.items)
    .find(n => n.path === location.pathname)?.label || 'Super Admin';

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800/80 z-20">
        {/* Sidebar Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/40">
          <img src={logo} alt="PF" className="h-8 w-auto drop-shadow-md brightness-110" />
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-white leading-tight">
              Print<span className="text-orange-500">Flow</span>
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5">SUPER ADMIN</span>
          </div>
          <span className="ml-auto text-[8px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-wider">v2.5</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 py-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(n => {
                  const active = location.pathname === n.path;
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.path}
                      to={n.path}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 group ${
                        active
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} strokeWidth={active ? 2.5 : 2} />
                        <span>{n.label}</span>
                      </div>
                      {active ? (
                        <ChevronRight size={12} className="text-white opacity-80" strokeWidth={3} />
                      ) : (
                        <ChevronRight size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-slate-400 transition-all duration-200" strokeWidth={2} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/20 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
          PrintFlow © 2026
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-950">
        {/* Header */}
        <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-850 flex items-center justify-between px-8 sticky top-0 z-10">
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight">{currentLabel}</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Tizim Boshqaruvi
            </p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-800 bg-slate-900 hover:bg-rose-950/20 hover:border-rose-900/30 text-slate-400 hover:text-rose-400 text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-200"
          >
            <LogOut size={13} strokeWidth={2.5} />
            <span>Chiqish</span>
          </button>
        </header>

        {/* Child Views */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
