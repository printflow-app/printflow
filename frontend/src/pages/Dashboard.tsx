import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, LogOut, ClipboardList, UserSquare2, Wallet, Settings, Menu, X, TrendingUp, PackageOpen, QrCode, Lock, Unlock, Eye, EyeOff, ShieldCheck, Handshake, BarChart3, ChevronDown, Briefcase, PieChart, Sliders, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import { employeesApi, branchesApi, billingApi } from '../api';
import logo from '../assets/logo.png';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import AICopilot from '../components/AICopilot/AICopilot';
import { OnboardingWizard, isOnboardingComplete } from '../components/OnboardingWizard';
import { OnboardingTour, isTourComplete } from '../components/OnboardingTour';
import { CommandPalette } from '../components/CommandPalette';
import { useSidebarCounts, markTabSeen } from '../hooks/useSidebarCounts';

const Moliya       = React.lazy(() => import('./Moliya'));
const Hodimlar     = React.lazy(() => import('./Hodimlar'));
const Topshiriqlar = React.lazy(() => import('./Topshiriqlar'));
const Mijozlar     = React.lazy(() => import('./Mijozlar'));
const Sozlamalar   = React.lazy(() => import('./Sozlamalar'));
const Kassa        = React.lazy(() => import('./Kassa'));
const Ombor        = React.lazy(() => import('./Ombor'));
const Davomat      = React.lazy(() => import('./Davomat'));
const Admins       = React.lazy(() => import('./Admins'));
const Billing      = React.lazy(() => import('./Billing'));
const Filiallar    = React.lazy(() => import('./Filiallar'));
const Hamkorlar    = React.lazy(() => import('./Hamkorlar'));
const Hisobotlar   = React.lazy(() => import('./Hisobotlar'));
const Qollanma     = React.lazy(() => import('./Qollanma'));

interface DashboardProps {
  currentUser: any;
  onLogout: () => void;
  onUpdateUser: (updatedFields: any) => void;
}

type TabId = 'kassa' | 'moliya' | 'hodimlar' | 'topshiriqlar' | 'mijozlar' | 'sozlamalar' | 'ombor' | 'davomat' | 'admins' | 'billing' | 'filiallar' | 'hamkorlar' | 'hisobotlar' | 'qollanma' | 'xizmatlar-katalog';
const VALID_TABS: TabId[] = ['kassa','moliya','hodimlar','topshiriqlar','mijozlar','sozlamalar','ombor','davomat','admins','billing','filiallar','hamkorlar','hisobotlar','qollanma','xizmatlar-katalog'];

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // URL → tab. URL pattern: /dashboard/<tab>. Falls back to localStorage or 'kassa'.
  const tabFromUrl = (() => {
    const match = location.pathname.match(/^\/dashboard\/([^/]+)/);
    const candidate = match?.[1] as TabId | undefined;
    if (candidate && VALID_TABS.includes(candidate)) return candidate;
    const stored = localStorage.getItem('pf_active_tab') as TabId | null;
    return stored && VALID_TABS.includes(stored) ? stored : 'kassa';
  })();

  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl);

  // Onboarding wizard — eski 3-qadamli forma (saqlangan, lekin endi default tour)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Interactive tour — faqat super-admin (yoki admin)ga, faqat birinchi tashrifda.
  // Tenant'ga bir martagina kerak — boshqa xodimlar uchun chiqarmaymiz.
  const _roleNameLower = currentUser?.role?.name?.toLowerCase?.() || '';
  const _isAdminForTour = _roleNameLower === 'admin' || _roleNameLower === 'superadmin';
  const [showTour, setShowTour] = useState<boolean>(() => {
    const tid = currentUser?.tenantId;
    return !!tid && _isAdminForTour && !isTourComplete(tid) && !isOnboardingComplete(tid);
  });

  // Collapsible sidebar groups. Persisted to localStorage so user's preference
  // survives across sessions. Default: open whichever group contains the active tab.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pf_sidebar_groups');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set<string>(); // start collapsed; effect below opens the active group
  });
  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      localStorage.setItem('pf_sidebar_groups', JSON.stringify([...next]));
      return next;
    });
  };

  // Keep activeTab in sync with the URL — handles browser back/forward + deep links.
  useEffect(() => {
    const match = location.pathname.match(/^\/dashboard\/([^/]+)/);
    const urlTab = match?.[1] as TabId | undefined;
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
    // If user lands on /dashboard (no tab), push them to the default
    if (location.pathname === '/dashboard' || location.pathname === '/dashboard/') {
      navigate(`/dashboard/${activeTab}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  // Platforma darajasidagi global ON/OFF (super-admin nazoratida)
  const [aiCopilotGlobalEnabled, setAiCopilotGlobalEnabled] = useState(false);

  useEffect(() => {
    billingApi.getSetting('AI_COPILOT_ENABLED')
      .then(r => setAiCopilotGlobalEnabled(!!r.data?.value))
      .catch(() => setAiCopilotGlobalEnabled(false));
  }, []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Global branch filter (multiBranch feature)
  const [activeBranchId, setActiveBranchId] = useState<string>(() => localStorage.getItem('pf_active_branch') || '');
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    branchesApi.findAll().then(r => {
      const list: any[] = r.data || [];
      setBranches(list);
      if (list.length === 1 && !activeBranchId) {
        setActiveBranchId(list[0].id);
        localStorage.setItem('pf_active_branch', list[0].id);
      }
      if (activeBranchId && !list.some((b: any) => b.id === activeBranchId)) {
        setActiveBranchId('');
        localStorage.removeItem('pf_active_branch');
      }
    }).catch(() => {});
  }, []);

  // Profile Form
  const [profileForm, setProfileForm] = useState({ fullName: '', login: '', password: '', confirmPassword: '' });
  const [showProfilePass, setShowProfilePass] = useState(false);
  const [showProfileConfirmPass, setShowProfileConfirmPass] = useState(false);

  // =============================================
  // PAGE LOCKING SYSTEM
  // =============================================
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem('pf_is_locked') === 'true');
  const [isLockSettingsOpen, setIsLockSettingsOpen] = useState(false);
  const [lockPin, setLockPin] = useState(() => localStorage.getItem('pf_lock_pin') || '');
  const [lockTimeout, setLockTimeout] = useState(() => Number(localStorage.getItem('pf_lock_timeout')) || 5); // Default 5 min

  // NEW: Per-page locking state
  const [lockedTabs, setLockedTabs] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('pf_locked_tabs');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState({ pin1: '', pin2: '' });
  const [showPins, setShowPins] = useState({ p1: false, p2: false, input: false });

  const idleTimerRef = useRef<any>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!lockPin || isLocked) return;

    idleTimerRef.current = setTimeout(() => {
      setIsLocked(true);
      localStorage.setItem('pf_is_locked', 'true');
    }, lockTimeout * 60 * 1000);
  }, [lockPin, isLocked, lockTimeout]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimer();

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetIdleTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const handleSetLock = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.pin1 !== newPin.pin2) {
      toast.error("PIN kodlar bir xil emas!");
      return;
    }
    if (newPin.pin1.length < 4) {
      toast.error("PIN kamida 4 ta raqam bo'lishi kerak!");
      return;
    }
    localStorage.setItem('pf_lock_pin', newPin.pin1);
    localStorage.setItem('pf_lock_timeout', lockTimeout.toString());
    setLockPin(newPin.pin1);
    toast.success("Ekran qulfi sozlamalari saqlandi!");
    setIsLockSettingsOpen(false);
  };

  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === lockPin) {
      if (pendingTab === 'settings_access') {
        setIsLockSettingsOpen(true);
        setPendingTab(null);
      } else if (pendingTab === 'profile_access') {
        setIsProfileModalOpen(true);
        setPendingTab(null);
      } else if (pendingTab) {
        // Unlock specific tab
        const next = new Set(lockedTabs);
        next.delete(pendingTab);
        setLockedTabs(next);
        localStorage.setItem('pf_locked_tabs', JSON.stringify(Array.from(next)));
        setPendingTab(null);
      } else {
        // Global unlock
        setIsLocked(false);
        localStorage.setItem('pf_is_locked', 'false');
      }
      setPinInput('');
      toast.success("Xush kelibsiz!");
    } else {
      toast.error("PIN kod noto'g'ri!");
      setPinInput('');
    }
  };

  const handleManualLock = () => {
    if (!lockPin) {
      setIsLockSettingsOpen(true);
      return;
    }
    setIsLocked(true);
    localStorage.setItem('pf_is_locked', 'true');
  };

  const toggleTabLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(lockedTabs);
    if (next.has(id)) {
      // Unlocking requires PIN
      if (lockPin) {
        setPendingTab(id);
      } else {
        // No PIN set, just unlock
        next.delete(id);
        setLockedTabs(next);
        localStorage.setItem('pf_locked_tabs', JSON.stringify(Array.from(next)));
      }
    } else {
      // Locking is free
      next.add(id);
      setLockedTabs(next);
      localStorage.setItem('pf_locked_tabs', JSON.stringify(Array.from(next)));
    }
  };

  // =============================================

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        fullName: currentUser.fullName || '',
        login: currentUser.login || '',
        password: '',
        confirmPassword: ''
      });
    }
  }, [currentUser]);

  // Fetch branches when multiBranch feature is enabled
  useEffect(() => {
    const tf = currentUser.tenantFeatures || {};
    if (tf.multiBranch) {
      // branches logic removed
    }
  }, [currentUser]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      toast.error("Parollar bir xil emas!");
      return;
    }

    try {
      const updateData: any = {
        fullName: profileForm.fullName,
      };
      if (profileForm.login && profileForm.login !== currentUser.login) {
        updateData.login = profileForm.login;
      }
      if (profileForm.password) {
        updateData.password = profileForm.password;
      }

      await employeesApi.update(currentUser.id, updateData);

      const isCredentialChanged = updateData.password || updateData.login;

      if (isCredentialChanged) {
        toast.success("Ma'lumotlar o'zgartirildi! Barcha qurilmalardan chiqish amalga oshiriladi.");
        setIsProfileModalOpen(false);
        setTimeout(() => {
          onLogout();
        }, 2000);
      } else {
        onUpdateUser({ fullName: profileForm.fullName });
        toast.success("Profil muvaffaqiyatli yangilandi!");
        setIsProfileModalOpen(false);
      }
    } catch (err) {
      toast.error("Profil yangilashda xatolik yuz berdi!");
    }
  };

  // Derived permissions for robustness (on refresh permissions might be in different fields)
  const p = currentUser.permissions || currentUser.role || {};

  useEffect(() => {
    if (activeTab === 'moliya' && !(p.canViewFinance || p.canViewKpi || p.canViewStatistics)) {
      if (p.canViewTasks) setActiveTab('topshiriqlar');
      else if (p.canViewCustomers) setActiveTab('mijozlar');
      else if (p.canViewEmployees) setActiveTab('hodimlar');
    }
  }, [p]);

  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.role?.name?.toLowerCase() === 'superadmin';
  const tf = currentUser.tenantFeatures && Object.keys(currentUser.tenantFeatures).length > 0
    ? currentUser.tenantFeatures
    : { finance: true, kanban: true, customers: true, employees: true, inventory: true, warehouse: true, attendance: true };

  // AI Copilot ko'rinishi 2 ta shartga bog'liq:
  //   1) platforma'da global yoqilgan (super-admin)
  //   2) tenant'ning tarifi (plan) AI Copilot'ni o'z ichiga oladi
  // Tarif aliaslari: ai_chat | telegram_bot | advancedBot (backend FeatureGuard bilan mos)
  const planHasAiCopilot = !!(tf.ai_chat || tf.telegram_bot || tf.advancedBot);
  const aiCopilotEnabled = aiCopilotGlobalEnabled && planHasAiCopilot;

  // Sidebar grouped into 3 logical sections for visual hierarchy.
  // Sections render with a small caps label between them.
  const navGroups: { label: string; icon: any; items: { id: string; label: string; icon: any; show: boolean; sub: string }[] }[] = [
    {
      label: 'Operatsiya',
      icon: Briefcase,
      items: [
        { id: 'kassa', label: 'Kassa', icon: Wallet, show: (p.canViewFinance || p.canAddIncome || p.canAddExpense || isAdmin) && tf.finance, sub: 'Kirim va Chiqim' },
        { id: 'topshiriqlar', label: 'Xizmatlar (Kanban)', icon: ClipboardList, show: (p.canViewTasks || isAdmin) && tf.kanban, sub: 'Buyurtmalar nazorati' },
        { id: 'mijozlar', label: 'Mijozlar Bazasi', icon: UserSquare2, show: (p.canViewCustomers || isAdmin) && tf.customers, sub: "Qarzlar va hamkorlar" },
        { id: 'ombor', label: 'Ombor', icon: PackageOpen, show: (p.canViewInventory || isAdmin) && (tf.inventory ?? tf.warehouse), sub: 'Materiallar va qoldiqlar' },
        { id: 'davomat', label: 'Davomat', icon: QrCode, show: (p.canViewAttendance || isAdmin) && tf.attendance, sub: 'QR kirim/chiqim' },
      ],
    },
    {
      label: 'Tahlil',
      icon: PieChart,
      items: [
        { id: 'moliya', label: 'Statistika', icon: TrendingUp, show: (p.canViewFinance || p.canViewKpi || p.canViewStatistics || isAdmin) && tf.finance, sub: 'Daromad va hisobotlar' },
        { id: 'hisobotlar', label: 'Hisobotlar', icon: BarChart3, show: isAdmin || p.canViewFinanceReports || p.canViewExpenseCharts || p.canViewServiceReports, sub: 'Biznes tahlil' },
      ],
    },
    {
      label: 'Boshqaruv',
      icon: Sliders,
      items: [
        { id: 'hodimlar', label: 'Xodimlar', icon: Users, show: (p.canViewEmployees || isAdmin) && tf.employees, sub: "Jamoa ro'yxati" },
        { id: 'admins', label: "Ma'muriyat", icon: ShieldCheck, show: isAdmin, sub: 'Raxbarlar boshqaruvi' },
        { id: 'hamkorlar', label: 'Hamkorlar', icon: Handshake, show: isAdmin || p.canViewVendors, sub: 'Subpudratchi va yetkazuvchilar' },
        { id: 'sozlamalar', label: 'Tizim Sozlamalari', icon: Settings, show: p.canViewSettings || isAdmin, sub: 'Filiallar va Obuna' },
      ],
    },
  ];
  // Flat list for backward-compat: places that iterate `navItems` (e.g. lock-screen logic) still work.
  const navItems = navGroups.flatMap(g => g.items);

  // Ensure the group containing the active tab is open. Runs once + whenever activeTab changes.
  useEffect(() => {
    const owner = navGroups.find(g => g.items.some(it => it.id === activeTab));
    if (owner && !openGroups.has(owner.label)) {
      setOpenGroups(prev => {
        const next = new Set(prev);
        next.add(owner.label);
        localStorage.setItem('pf_sidebar_groups', JSON.stringify([...next]));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'P' || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      e.preventDefault();
      if (activeTab !== 'sozlamalar') handleTabChange('sozlamalar');
      setTimeout(() => window.dispatchEvent(new Event('pf:open-price-list')), 50);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const { counts: sidebarCounts, refresh: refreshSidebarCounts } = useSidebarCounts(activeBranchId);

  useEffect(() => {
    markTabSeen(activeTab);
    refreshSidebarCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleTabChange = (id: any) => {
    setActiveTab(id);
    localStorage.setItem('pf_active_tab', id);
    setIsSidebarOpen(false);
    // Tabni ochganda uni "ko'rilgan" deb belgilaymiz va badge'larni yangilaymiz.
    markTabSeen(id);
    refreshSidebarCounts();
    navigate(`/dashboard/${id}`);
  };

  if (isLocked || pendingTab) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 bg-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/30 animate-bounce-slow">
            <Lock className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-2">
            {pendingTab === 'settings_access' ? 'Sozlamalarga' : pendingTab === 'profile_access' ? 'Profilga' : pendingTab ? 'Sahifaga' : 'Tizimga'} <span className="text-orange-400">Kirish</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-10">Davom etish uchun PIN kodni kiriting</p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative group">
              <input
                type={showPins.input ? "text" : "password"}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full h-16 bg-white/10 border-2 border-white/10 rounded-2xl px-6 text-center text-2xl font-bold text-white focus:bg-white/20 focus:border-orange-500 focus:outline-none transition-all placeholder:text-white/20"
                placeholder="••••"
                maxLength={8}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPins({ ...showPins, input: !showPins.input })}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                {showPins.input ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <button
              type="submit"
              className="w-full h-16 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl shadow-orange-500/20 transition-all flex items-center justify-center gap-3"
            >
              <span>TASDIQLASH</span>
              <Unlock size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingTab === 'settings_access' || pendingTab === 'profile_access') {
                  setPendingTab(null);
                } else if (pendingTab) {
                  setPendingTab(null);
                } else {
                  onLogout();
                }
              }}
              className="w-full h-12 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white transition-colors"
            >
              {pendingTab ? 'Bekor qilish' : 'Tizimdan chiqish'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans relative overflow-hidden">

      <header className="md:hidden h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src={logo} alt="PF" style={{ height: 28, width: 'auto' }} />
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">Print<span className="text-[#FF6B00]">Flow</span></h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleManualLock} className="w-9 h-9 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
            <Lock size={16} />
          </button>
          {aiCopilotEnabled && (
            <button
              onClick={() => setIsAICopilotOpen(true)}
              className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-lg shadow-md shadow-orange-500/30 hover:from-orange-500 hover:to-orange-700 transition-all"
              title="AI Yordamchi"
            >
              <Sparkles size={16} strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-9 h-9 flex items-center justify-center text-slate-600 bg-slate-50 rounded-lg"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm transition-transform duration-300 z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-16 hidden md:flex items-center justify-between px-5 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-2">
            <img src={logo} alt="PF" style={{ height: 32, width: 'auto' }} />
            <div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight leading-none">Print<span className="text-[#FF6B00]">Flow</span></h1>
              <p className="text-[10px] font-medium text-slate-400 tracking-wide mt-1">{currentUser.role?.name || 'Xodim'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (lockPin) {
                  setPendingTab('settings_access');
                } else {
                  setIsLockSettingsOpen(true);
                }
              }}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-indigo-50 rounded-lg transition-all"
              title="Qulflash sozlamalari"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={handleManualLock}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
              title="Tizimni qulflash"
            >
              <Lock size={14} />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-4 flex flex-col gap-1 overflow-y-auto custom-scroll">
          {navGroups.map((group, gi) => {
            const visibleItems = group.items.filter(it => it.show);
            if (visibleItems.length === 0) return null;
            const isOpen = openGroups.has(group.label);
            const containsActive = visibleItems.some(it => it.id === activeTab);
            // Group-level notification count = sum of all item counts in this group.
            // Faqat aktiv tab'dan tashqari sonlarni qo'shamiz — aktiv tab "ko'rilgan" hisoblanadi.
            const groupNotifications = visibleItems.reduce((sum, it) => {
              if (it.id === activeTab) return sum;
              return sum + ((sidebarCounts as any)[it.id] || 0);
            }, 0);
            return (
              <React.Fragment key={group.label}>
                {gi > 0 && <div className="my-1.5 border-t border-slate-100" />}
                {/* Group header — clickable to expand/collapse */}
                <button
                  type="button"
                  data-tour-group={group.label.toLowerCase()}
                  data-tour-open={isOpen ? '1' : '0'}
                  onClick={() => toggleGroup(group.label)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                    containsActive
                      ? 'bg-slate-500/8 text-slate-800'
                      : 'text-slate-500 hover:bg-slate-500/5 hover:text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <group.icon size={16} className={containsActive ? 'text-orange-600' : 'text-slate-400'} />
                    <span>{group.label}</span>
                    {/* Tiny badge: count of items in this group */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${containsActive ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'} normal-case tracking-normal`}>
                      {visibleItems.length}
                    </span>
                    {/* Group-level notification badge — collapsed bo'lganda ham ko'rinadi */}
                    {!isOpen && groupNotifications > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500 text-white shadow-sm shadow-orange-500/30 normal-case tracking-normal min-w-[18px] text-center animate-pulse">
                        {groupNotifications > 99 ? '99+' : groupNotifications}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-700' : 'text-slate-400'}`}
                  />
                </button>

                {/* Group items — only render when open */}
                {isOpen && visibleItems.map(item => {
                  const itemCount = (sidebarCounts as any)[item.id] || 0;
                  const showBadge = itemCount > 0 && item.id !== activeTab;
                  return (
                  <button
                    key={item.id}
                    data-tour-id={`nav-${item.id}`}
                    onClick={() => handleTabChange(item.id as any)}
                    className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 border ${activeTab === item.id
                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/25 border-orange-500'
                        : 'text-slate-600 hover:bg-slate-500/5 hover:text-slate-900 border-transparent'
                      }`}
                  >
                    <item.icon size={17} strokeWidth={activeTab === item.id ? 2.4 : 2} className={activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                    <div className="text-left flex-1">
                      <p className="leading-tight tracking-tight">{item.label}</p>
                      <p className={`text-[10px] font-normal mt-0.5 tracking-tight ${activeTab === item.id ? 'text-orange-100' : 'text-slate-400 opacity-70'}`}>{item.sub}</p>
                    </div>

                    {/* Per-item notification badge — yangilik soni */}
                    {showBadge && (
                      <span
                        className={`text-[9px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm ${
                          activeTab === item.id
                            ? 'bg-white text-orange-600'
                            : 'bg-orange-500 text-white shadow-orange-500/30 animate-pulse'
                        }`}
                        title={`${itemCount} ta yangi`}
                      >
                        {itemCount > 99 ? '99+' : itemCount}
                      </span>
                    )}

                    <div
                      onClick={(e) => toggleTabLock(item.id, e)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${lockedTabs.has(item.id)
                          ? 'bg-rose-500 text-white shadow-md'
                          : 'bg-transparent text-slate-300 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                    >
                      {lockedTabs.has(item.id) ? <Lock size={10} strokeWidth={3} /> : <Unlock size={10} />}
                    </div>
                  </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={() => {
              if (lockPin) {
                setPendingTab('profile_access');
              } else {
                setIsProfileModalOpen(true);
              }
            }}
            className="flex items-center w-full text-left gap-2.5 px-3 py-2.5 mb-2.5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-orange-300 transition-all group"
          >
            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 font-bold flex items-center justify-center shadow-inner text-[10px] border border-orange-200 group-hover:bg-orange-600 group-hover:text-white transition-colors">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight tracking-tight">{currentUser.fullName}</p>
              <p className="text-[11px] font-medium text-slate-400 tracking-wide mt-0.5 truncate group-hover:text-orange-500">Profil sozlamalari</p>
            </div>
          </button>
          <button
            onClick={() => handleTabChange('qollanma')}
            className={`flex w-full items-center justify-center gap-2 px-3 py-2.5 mb-2 rounded-xl text-[12px] font-medium transition-all ${
              activeTab === 'qollanma'
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
                : 'text-emerald-600 bg-emerald-500/8 hover:bg-emerald-500 hover:text-white'
            }`}
          >
            O'rgatuvchi qo'llanma
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium text-rose-500 bg-rose-500/8 hover:bg-rose-500 hover:text-white transition-all"
          >
            <LogOut size={14} strokeWidth={2.4} /> Chiqish
          </button>
        </div>
      </aside>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut size={24} className="text-rose-500" strokeWidth={2.5} />
              </div>
              <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight mb-1">Chiqishni tasdiqlang</h3>
              <p className="text-[11px] text-slate-500 font-semibold">Tizimdan chiqmoqchimisiz? Barcha ochiq ma'lumotlar yopiladi.</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Bekor qilish
              </button>
              <div className="w-px bg-slate-100" />
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                className="flex-1 py-4 text-[11px] font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-colors"
              >
                Ha, chiqish
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && currentUser?.tenantId && (
        <OnboardingWizard
          tenantId={currentUser.tenantId}
          branchId={activeBranchId || branches[0]?.id}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* Interactive Tour — custom non-modal, granular qadamlar, auto-rewind */}
      {showTour && currentUser?.tenantId && (
        <OnboardingTour
          tenantId={currentUser.tenantId}
          activeTab={activeTab}
          onComplete={() => setShowTour(false)}
        />
      )}

      {/* Global command palette — Ctrl+K opens it */}
      <CommandPalette />

      <main className="flex-1 flex flex-col h-[calc(100vh-3rem)] md:h-screen overflow-hidden">
        <header className="hidden md:flex h-16 px-6 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md z-10">
          <div className="flex flex-col">
            <h2 className="text-[19px] font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
              {navItems.find(i => i.id === activeTab)?.label}
              {lockedTabs.has(activeTab) && <Lock size={16} className="text-rose-500" />}
              {!lockedTabs.has(activeTab) && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>}
            </h2>
            <p className="text-[11px] font-medium text-slate-400 tracking-wide mt-0.5">
              PrintFlow • {navItems.find(i => i.id === activeTab)?.sub}
            </p>
          </div>

          <div className="flex items-center gap-3">

            {/* Ctrl+K hint — visible reminder of the command palette */}
            <button
              onClick={() => {
                // Dispatch synthetic Ctrl+K event so the palette opens via its global listener
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              className="hidden lg:flex items-center gap-2 h-9 px-3.5 rounded-full border border-slate-200 bg-white text-[12px] font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
              title="Tezkor qidiruv"
            >
              <span>Qidiruv</span>
              <kbd className="text-[10px] font-medium bg-slate-100 px-1.5 py-0.5 rounded-md">⌘K</kbd>
            </button>

            {/* Filial filtri faqat: bir nechta filial bor + foydalanuvchining filiallar ruxsati bor bo'lsa */}
            {branches.length > 1 && (isAdmin || p.canViewBranches || p.canManageBranches) && (
              <select
                value={activeBranchId}
                onChange={e => {
                  setActiveBranchId(e.target.value);
                  localStorage.setItem('pf_active_branch', e.target.value);
                }}
                className="select-minimal h-9 text-[12px] font-medium min-w-[160px]"
              >
                <option value="">Barcha filiallar</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={(e) => toggleTabLock(activeTab, e)}
              className={`group flex items-center gap-2 h-10 px-4 rounded-full text-[12px] font-medium transition-all ${lockedTabs.has(activeTab)
                  ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/25'
                  : 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600'
                }`}
            >
              {lockedTabs.has(activeTab) ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{lockedTabs.has(activeTab) ? 'Sahifa qulflangan' : 'Sahifani qulflash'}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 relative bg-slate-50/30 custom-scroll">
          {lockedTabs.has(activeTab) ? (
            <div className="absolute inset-0 z-[50] flex items-center justify-center p-8 overflow-hidden">
              {/* Content is blurred behind */}
              <div className="absolute inset-0 backdrop-blur-[40px] bg-slate-50/40 z-0"></div>

              <div className="relative z-10 w-full max-w-sm text-center animate-slide-up">
                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/10 border border-slate-100 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <Lock className="w-8 h-8 text-orange-600" strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 uppercase italic tracking-tight mb-2">Sahifa <span className="text-rose-500">Qulflangan</span></h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-8 leading-relaxed">Ushbu bo'limga kirish uchun<br />tizim PIN kodini kiriting</p>

                <form onSubmit={(e) => { e.preventDefault(); setPendingTab(activeTab); }} className="space-y-4">
                  <button
                    type="submit"
                    className="w-full h-14 bg-slate-900 hover:bg-orange-600 text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20 transition-all flex items-center justify-center gap-3"
                  >
                    <span>PIN KODNI KIRITISH</span>
                    <ShieldCheck size={16} />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <React.Suspense fallback={<LoadingSpinner fullPage />}>
              {activeTab === 'kassa' && (p.canViewFinance || p.canAddIncome || p.canAddExpense || isAdmin) && <Kassa currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'moliya' && (p.canViewFinance || p.canViewKpi || p.canViewStatistics || isAdmin) && <Moliya currentUser={currentUser} activeBranchId={activeBranchId} />}
              { activeTab === 'hodimlar' && (p.canViewEmployees || isAdmin) && <Hodimlar currentUser={currentUser} activeBranchId={activeBranchId} /> }
              {activeTab === 'topshiriqlar' && (p.canViewTasks || isAdmin) && <Topshiriqlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'mijozlar' && (p.canViewCustomers || isAdmin) && <Mijozlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'ombor' && (p.canViewInventory || isAdmin) && <Ombor currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'davomat' && (p.canViewAttendance || isAdmin) && <Davomat currentUser={currentUser} />}
              {activeTab === 'billing' && (p.canManageBilling || p.canViewBillingStatus || isAdmin) && <Billing />}
              {activeTab === 'admins' && isAdmin && <Admins currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'hamkorlar' && (isAdmin || p.canViewVendors) && <Hamkorlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'filiallar' && (isAdmin || p.canManageBranches || !!(p as any).canViewBranches) && <Filiallar currentUser={currentUser} />}
              {activeTab === 'hisobotlar' && (isAdmin || p.canViewFinanceReports || p.canViewExpenseCharts || p.canViewServiceReports) && <Hisobotlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'sozlamalar' && (p.canViewSettings || isAdmin) && <Sozlamalar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'xizmatlar-katalog' && (p.canViewServices || p.canManageServices || isAdmin) && <Sozlamalar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'qollanma' && <Qollanma />}

              {(() => {
                const SPECIAL_TABS = new Set(['qollanma', 'xizmatlar-katalog', 'filiallar', 'billing']);
                if (SPECIAL_TABS.has(activeTab)) return null;
                const item = navItems.find(i => i.id === activeTab);
                if (item?.show) return null;
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center p-10 bg-white rounded-3xl border border-slate-200">
                    <Lock size={48} className="text-slate-200 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800 uppercase italic">Kirish cheklangan</h3>
                    <p className="text-xs font-bold text-slate-400 mt-2">Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q.</p>
                  </div>
                );
              })()}
            </React.Suspense>
          )}
        </div>
      </main>

      {/* AI Copilot Drawer + FAB — gated by global super-admin toggle */}
      {aiCopilotEnabled && (
        <>
          <AICopilot
            isOpen={isAICopilotOpen}
            onClose={() => setIsAICopilotOpen(false)}
          />
          {!isAICopilotOpen && (
            <button
              onClick={() => setIsAICopilotOpen(true)}
              className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-2xl shadow-xl shadow-orange-500/40 flex items-center justify-center hover:scale-110 hover:shadow-2xl hover:shadow-orange-500/50 transition-all duration-300 hidden md:flex"
              title="PrintFlow AI Yordamchi (Xizmatlar)"
            >
              <Sparkles size={24} strokeWidth={2.2} />
            </button>
          )}
        </>
      )}

      <Modal isOpen={isLockSettingsOpen} onClose={() => setIsLockSettingsOpen(false)} title="Ekran Qulfi Sozlamalari" maxWidth="max-w-sm">
        <form onSubmit={handleSetLock} className="space-y-5">
          <div className="bg-indigo-50 p-4 rounded-2xl border border-orange-100 flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white">
              <ShieldCheck size={20} />
            </div>
            <p className="text-[10px] font-bold text-orange-700 uppercase leading-tight">PIN kod tizim xavfsizligini ta'minlash uchun xizmat qiladi.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1">Yangi PIN kod</label>
              <div className="relative">
                <input
                  type={showPins.p1 ? "text" : "password"}
                  required
                  value={newPin.pin1}
                  onChange={(e) => setNewPin({ ...newPin, pin1: e.target.value })}
                  className="input-minimal w-full text-center text-xl font-bold tracking-[0.5em]"
                  placeholder="••••"
                  maxLength={8}
                />
                <button type="button" onClick={() => setShowPins({ ...showPins, p1: !showPins.p1 })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-orange-500">
                  {showPins.p1 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1">PIN kodni tasdiqlang</label>
              <div className="relative">
                <input
                  type={showPins.p2 ? "text" : "password"}
                  required
                  value={newPin.pin2}
                  onChange={(e) => setNewPin({ ...newPin, pin2: e.target.value })}
                  className="input-minimal w-full text-center text-xl font-bold tracking-[0.5em]"
                  placeholder="••••"
                  maxLength={8}
                />
                <button type="button" onClick={() => setShowPins({ ...showPins, p2: !showPins.p2 })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-orange-500">
                  {showPins.p2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1 flex justify-between">
                <span>Avtomatik qulflash (daqiqa)</span>
                <span className="text-orange-600">{lockTimeout} min</span>
              </label>
              <input
                type="range"
                min="1"
                max="60"
                value={lockTimeout}
                onChange={(e) => setLockTimeout(Number(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-600"
              />
              <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400 uppercase">
                <span>1 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full h-14 bg-orange-600 text-white rounded-2xl font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20">
            SOZLAMALARNI SAQLASH
          </button>
        </form>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Profilni Tahrirlash" maxWidth="max-w-sm">
        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1">To'liq Ism (F.I.SH)</label>
            <input
              type="text" required
              value={profileForm.fullName}
              onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              className="input-minimal w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1">Login</label>
            <input
              type="text" required
              value={profileForm.login}
              onChange={(e) => setProfileForm({ ...profileForm, login: e.target.value })}
              className="input-minimal w-full font-mono text-xs"
            />
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Parolni o'zgartirish (ixtiyoriy)</p>
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1">Yangi Parol</label>
                <input
                  type={showProfilePass ? "text" : "password"}
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  className="input-minimal w-full font-mono text-orange-600 text-xs pr-10"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowProfilePass(!showProfilePass)} className="absolute right-3 bottom-3 text-slate-300 hover:text-orange-500">
                  {showProfilePass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest ml-1">Parolni tasdiqlang</label>
                <input
                  type={showProfileConfirmPass ? "text" : "password"}
                  value={profileForm.confirmPassword}
                  onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                  className="input-minimal w-full font-mono text-orange-600 text-xs pr-10"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowProfileConfirmPass(!showProfileConfirmPass)} className="absolute right-3 bottom-3 text-slate-300 hover:text-orange-500">
                  {showProfileConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" className="btn-primary w-full h-14 font-bold tracking-widest uppercase bg-slate-900 hover:bg-orange-600 text-white shadow-xl shadow-slate-900/10 rounded-2xl transition-all">
              O'ZGARISHLARNI SAQLASH
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
