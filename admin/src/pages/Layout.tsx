import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Package, CreditCard, Users, Tag, Image, LogOut, ListChecks } from 'lucide-react';
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
                return (
                  <Link
                    key={n.path}
                    to={n.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25'
                        : 'text-slate-600 hover:bg-slate-500/5 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-3 border-t border-slate-100 text-[10px] font-medium text-slate-400 tracking-wide">
          Super Admin · PrintFlow
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
          <button
            onClick={onLogout}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-slate-500/8 hover:bg-rose-500/10 text-slate-600 hover:text-rose-600 text-[13px] font-medium transition-colors"
          >
            <LogOut size={15} strokeWidth={2.2} /> Chiqish
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#f2f2f7]">{children}</main>
      </div>
    </div>
  );
}
