import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, LogOut, ClipboardList, UserSquare2, Wallet, Settings, Menu, X, TrendingUp, PackageOpen, QrCode, Lock, Unlock, Eye, EyeOff, ShieldCheck, Handshake, BarChart3, ChevronDown, Briefcase, PieChart, Sliders, Sparkles, FileText, Home, HelpCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { authApi, employeesApi, branchesApi, billingApi } from '../api';
import logo from '../assets/logo.png';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import AICopilot from '../components/AICopilot/AICopilot';
import { OnboardingWizard, isOnboardingComplete } from '../components/OnboardingWizard';
import { OnboardingTour, isTourComplete } from '../components/OnboardingTour';
import { PageTour } from '../components/PageTour';
import { hasPageTour } from '../components/pageTours';
import { CommandPalette } from '../components/CommandPalette';
import { ReleaseTour } from '../components/ReleaseNotes';
import { useSidebarCounts, markTabSeen } from '../hooks/useSidebarCounts';

const BoshSahifa   = React.lazy(() => import('./BoshSahifa'));
const Moliya       = React.lazy(() => import('./Moliya'));
const Hodimlar     = React.lazy(() => import('./Hodimlar'));
// Kanban va Jamoa vazifalari bitta sahifa (ikki tab) — IshlarSahifasi.
const IshlarSahifasi = React.lazy(() => import('./IshlarSahifasi'));
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
const PriceListModal = React.lazy(() =>
  import('../components/PriceListModal').then(m => ({ default: m.PriceListModal })),
);

interface DashboardProps {
  currentUser: any;
  onLogout: () => void;
  onUpdateUser: (updatedFields: any) => void;
}

type TabId = 'boshsahifa' | 'kassa' | 'moliya' | 'hodimlar' | 'topshiriqlar' | 'vazifalar' | 'mijozlar' | 'sozlamalar' | 'ombor' | 'davomat' | 'admins' | 'billing' | 'filiallar' | 'hamkorlar' | 'hisobotlar' | 'qollanma';
const VALID_TABS: TabId[] = ['boshsahifa','kassa','moliya','hodimlar','topshiriqlar','vazifalar','mijozlar','sozlamalar','ombor','davomat','admins','billing','filiallar','hamkorlar','hisobotlar','qollanma'];

/**
 * Menyudagi bandga moslash.
 *
 * Kanban va Jamoa vazifalari bitta menyu bandi ostida birlashtirilgan
 * (IshlarSahifasi), lekin ikkala URL ham saqlangan. `vazifalar` uchun
 * menyuda alohida band yo'q — shuning uchun `topshiriqlar` ga
 * moslanadi. Busiz ikki narsa buzilardi: chapdagi band yonmasdi va
 * pastda "Kirish cheklangan" bloki chiqib qolardi (band topilmagani
 * uchun ruxsat yo'q deb hisoblanardi).
 */
const menyuBandi = (t: TabId): TabId => (t === 'vazifalar' ? 'topshiriqlar' : t);

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

  // Reliz tour'i — endi o'z-o'zidan chiqmaydi, faqat foydalanuvchi ochsa.
  const [releaseTourOpen, setReleaseTourOpen] = useState(false);

  // Sahifa qo'llanmasi — faqat foydalanuvchi "Yo'l-yo'riq" ni bosganda.
  const [pageTourOpen, setPageTourOpen] = useState(false);

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

  // Omnibox'dan agentga so'rov kelganda drawer'ni ochamiz — xabarni
  // AICopilot o'zi eshitib yuboradi (pf:ai-ask, CommandPalette dispatch qiladi).
  useEffect(() => {
    const onAsk = () => setIsAICopilotOpen(true);
    window.addEventListener('pf:ai-ask', onAsk);
    return () => window.removeEventListener('pf:ai-ask', onAsk);
  }, []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Global branch filter (multiBranch feature)
  // Key is tenant-scoped: the same browser may manage multiple workspaces, and a
  // branch id from tenant A is meaningless for tenant B. A shared key let stale
  // cross-tenant ids leak in, which broke branch-scoped views (services catalog).
  const branchStorageKey = `pf_active_branch_${currentUser?.tenantId || 'unknown'}`;
  const [activeBranchId, setActiveBranchId] = useState<string>(() => localStorage.getItem(branchStorageKey) || '');
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    branchesApi.findAll().then(r => {
      const list: any[] = r.data || [];
      setBranches(list);
      // Resolve a valid active branch in one pass: drop an id that doesn't belong to
      // this tenant, then auto-select the sole branch if only one exists. Doing both
      // together avoids the gap where a stale id was reset to '' but never re-selected,
      // leaving single-branch tenants with an empty catalog and no dropdown to recover.
      let next = activeBranchId;
      if (next && !list.some((b: any) => b.id === next)) next = '';
      if (!next && list.length === 1) next = list[0].id;
      if (next !== activeBranchId) {
        setActiveBranchId(next);
        if (next) localStorage.setItem(branchStorageKey, next);
        else localStorage.removeItem(branchStorageKey);
      }
    }).catch(() => {});
  }, []);

  // Profile Form
  const [profileForm, setProfileForm] = useState({ fullName: '', login: '', password: '', confirmPassword: '' });
  const [showProfilePass, setShowProfilePass] = useState(false);
  const [showProfileConfirmPass, setShowProfileConfirmPass] = useState(false);

  // Price list — navbar tugmasi va Ctrl+Shift+P orqali ochiladigan modal.
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);

  // =============================================
  // PAGE LOCKING SYSTEM
  // PIN va sozlamalar SERVERDA akkauntga bog'lab saqlanadi (UserLockSetting) —
  // bir kompyuterdagi boshqa akkauntlarga ta'sir qilmaydi, o'sha akkaunt esa
  // istalgan qurilmada bir xil qulfga ega bo'ladi. PIN clientga qaytmaydi,
  // tekshiruv /auth/lock-settings/verify orqali. Faqat "qulflangan holat"
  // (isLocked) qurilmada qoladi — u ham user id bilan scoped.
  // =============================================
  const lockStateKey = `pf_is_locked_${currentUser?.id || 'anon'}`;
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem(lockStateKey) === 'true');
  const [isLockSettingsOpen, setIsLockSettingsOpen] = useState(false);
  const [hasLockPin, setHasLockPin] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(5); // Default 5 min

  // NEW: Per-page locking state
  const [lockedTabs, setLockedTabs] = useState<Set<string>>(new Set());

  const [pinInput, setPinInput] = useState('');
  const [newPin, setNewPin] = useState({ pin1: '', pin2: '' });
  const [showPins, setShowPins] = useState({ p1: false, p2: false, input: false });

  useEffect(() => {
    // Eski global kalitlar bir brauzerdagi BARCHA akkauntlarni qulflab qo'yardi — tozalaymiz.
    ['pf_lock_pin', 'pf_lock_timeout', 'pf_locked_tabs', 'pf_is_locked'].forEach(k => localStorage.removeItem(k));
    authApi.getLockSettings().then(r => {
      const s = r.data || {};
      setHasLockPin(!!s.hasPin);
      if (s.timeoutMinutes) setLockTimeout(s.timeoutMinutes);
      setLockedTabs(new Set(Array.isArray(s.lockedTabs) ? s.lockedTabs : []));
      if (!s.hasPin) {
        // Bu akkauntda PIN yo'q — qurilmada qolib ketgan qulf holatini ochamiz
        setIsLocked(false);
        localStorage.removeItem(lockStateKey);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idleTimerRef = useRef<any>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!hasLockPin || isLocked) return;

    idleTimerRef.current = setTimeout(() => {
      setIsLocked(true);
      localStorage.setItem(lockStateKey, 'true');
    }, lockTimeout * 60 * 1000);
  }, [hasLockPin, isLocked, lockTimeout, lockStateKey]);

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

  const handleSetLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.pin1 !== newPin.pin2) {
      toast.error("PIN kodlar bir xil emas!");
      return;
    }
    if (!/^\d{4,8}$/.test(newPin.pin1)) {
      toast.error("PIN 4-8 ta raqamdan iborat bo'lishi kerak!");
      return;
    }
    try {
      await authApi.saveLockSettings({ pin: newPin.pin1, timeoutMinutes: lockTimeout });
      setHasLockPin(true);
      setNewPin({ pin1: '', pin2: '' });
      toast.success("Ekran qulfi sozlamalari saqlandi!");
      setIsLockSettingsOpen(false);
    } catch {
      toast.error("Saqlashda xatolik yuz berdi!");
    }
  };

  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // Qulflangan tablar ro'yxatini serverga yozamiz — akkaunt bilan birga yuradi
  const persistLockedTabs = (next: Set<string>) => {
    setLockedTabs(next);
    authApi.saveLockSettings({ lockedTabs: Array.from(next) }).catch(() => {});
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = false;
    try {
      const r = await authApi.verifyLockPin(pinInput);
      valid = !!r.data?.valid;
    } catch (err: any) {
      if (err?.response?.status === 429) {
        toast.error("Juda ko'p urinish — biroz kutib qayta urining!");
      } else {
        toast.error("Tekshirib bo'lmadi — internet aloqasini tekshiring!");
      }
      return;
    }
    if (valid) {
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
        persistLockedTabs(next);
        setPendingTab(null);
      } else {
        // Global unlock
        setIsLocked(false);
        localStorage.setItem(lockStateKey, 'false');
      }
      setPinInput('');
      toast.success("Xush kelibsiz!");
    } else {
      toast.error("PIN kod noto'g'ri!");
      setPinInput('');
    }
  };

  const handleManualLock = () => {
    if (!hasLockPin) {
      setIsLockSettingsOpen(true);
      return;
    }
    setIsLocked(true);
    localStorage.setItem(lockStateKey, 'true');
  };

  const toggleTabLock = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasLockPin) {
      // Serverda PIN'siz qulf saqlanmaydi — avval PIN o'rnatish kerak
      toast.error("Avval PIN kod o'rnating!");
      setIsLockSettingsOpen(true);
      return;
    }
    const next = new Set(lockedTabs);
    if (next.has(id)) {
      // Unlocking requires PIN
      setPendingTab(id);
    } else {
      // Locking is free
      next.add(id);
      persistLockedTabs(next);
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
  // AI'ni faqat SUPER ADMIN boshqaradi: global kalit + workspace tarifidagi
  // ai_chat moduli. Lavozim darajasidagi `canUseAi` ruxsati OLIB TASHLANDI —
  // uch qavatli shart (global + tarif + lavozim) chalkash edi: super admin
  // yoqib qo'ysa ham chat ko'rinmay, sababi tushunarsiz bo'lardi.
  const aiCopilotEnabled = aiCopilotGlobalEnabled && planHasAiCopilot;

  // Sidebar grouped into 3 logical sections for visual hierarchy.
  // Sections render with a small caps label between them.
  const navGroups: { label: string; icon: any; items: { id: string; label: string; icon: any; show: boolean; sub: string }[] }[] = [
    {
      label: 'Operatsiya',
      icon: Briefcase,
      items: [
        { id: 'boshsahifa', label: 'Dashboard', icon: Home, show: true, sub: 'Umumiy holat va AI xavflar' },
        { id: 'kassa', label: 'Kassa', icon: Wallet, show: (p.canViewFinance || p.canAddIncome || p.canAddExpense || isAdmin) && tf.finance, sub: 'Kirim va Chiqim' },
        // Kanban va Jamoa vazifalari bitta bandda: ular sahifa ichida
        // tab bilan almashadi. Menyuda ikkita alohida band turgani ularni
        // bog'liq emasdek ko'rsatardi — aslida Jamoa doskasidagi
        // buyurtmalarning bosqichi aynan Kanbanda boshqariladi.
        //
        // Kanbanga ruxsati yo'q, lekin vazifalarga bor xodim ham shu
        // banddan kiradi — sahifa o'zi mos bo'limni ochadi.
        {
          id: 'topshiriqlar',
          label: 'Xizmatlar (Kanban)',
          icon: ClipboardList,
          show: ((p.canViewTasks || isAdmin) && tf.kanban) || p.canViewTeamTasks || isAdmin,
          sub: 'Buyurtmalar va jamoa vazifalari',
        },
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
      // Sahifani almashtirmasdan to'g'ridan-to'g'ri Price list modalni ochamiz (hamma uchun ochiq).
      setIsPriceListOpen(true);
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
    // Sahifa qo'llanmasi o'sha sahifaga bog'liq — boshqasiga o'tilsa
    // yopiladi, aks holda eski sahifaning qadamlari osilib qolardi.
    setPageTourOpen(false);
    // Tabni ochganda uni "ko'rilgan" deb belgilaymiz va badge'larni yangilaymiz.
    markTabSeen(id);
    refreshSidebarCounts();
    navigate(`/dashboard/${id}`);
  };

  if (isLocked || pendingTab) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-xs text-center">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-6 h-6 text-orange-400" strokeWidth={2} />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight mb-1">
            {pendingTab === 'settings_access' ? 'Sozlamalarga kirish' : pendingTab === 'profile_access' ? 'Profilga kirish' : pendingTab ? 'Sahifaga kirish' : 'Tizim qulflangan'}
          </h1>
          <p className="text-sm text-slate-400 mb-8">Davom etish uchun PIN kodni kiriting</p>

          <form onSubmit={handleUnlock} className="space-y-3">
            <div className="relative group">
              <input
                type={showPins.input ? "text" : "password"}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/15 rounded-xl px-5 text-center text-xl font-semibold tracking-[0.4em] text-white focus:bg-white/10 focus:border-orange-500 focus:outline-none transition-all placeholder:text-white/20"
                placeholder="••••"
                maxLength={8}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPins({ ...showPins, input: !showPins.input })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              >
                {showPins.input ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="submit"
              className="w-full h-12 bg-[color:var(--primary)] hover:bg-[color:var(--primary-hover)] text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <Unlock size={15} />
              <span>Ochish</span>
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
              className="w-full h-10 text-slate-500 text-sm font-medium hover:text-white transition-colors"
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

      <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-surface2 border-r border-[color:var(--border)] flex flex-col transition-transform duration-300 z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-14 hidden md:flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <img src={logo} alt="PF" style={{ height: 28, width: 'auto' }} />
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-none">Print<span className="text-[color:var(--primary)]">Flow</span></h1>
              <p className="text-xs font-medium text-slate-400 mt-0.5">{currentUser.role?.name || 'Xodim'}</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => {
                if (hasLockPin) {
                  setPendingTab('settings_access');
                } else {
                  setIsLockSettingsOpen(true);
                }
              }}
              className="icon-btn"
              title="Qulflash sozlamalari"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={handleManualLock}
              className="icon-btn"
              title="Tizimni qulflash"
            >
              <Lock size={15} />
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
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors duration-150 ${
                    containsActive
                      ? 'text-slate-800'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <group.icon size={14} className={containsActive ? 'text-[color:var(--primary)]' : 'text-slate-400'} />
                    <span>{group.label}</span>
                    {/* Group-level notification badge — collapsed bo'lganda ham ko'rinadi */}
                    {!isOpen && groupNotifications > 0 && (
                      <span className="text-xs font-semibold px-1.5 py-px rounded-md bg-orange-500 text-white normal-case tracking-normal min-w-[18px] text-center">
                        {groupNotifications > 99 ? '99+' : groupNotifications}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : 'text-slate-400'}`}
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
                    className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${menyuBandi(activeTab) === item.id
                        ? 'bg-white text-slate-900 font-semibold border border-[color:var(--border)] shadow-sm'
                        : 'text-slate-600 font-medium hover:bg-slate-900/[0.04] hover:text-slate-900 border border-transparent'
                      }`}
                  >
                    <item.icon size={16} strokeWidth={2} className={menyuBandi(activeTab) === item.id ? 'text-[color:var(--primary)]' : 'text-slate-400 group-hover:text-slate-600'} />
                    <p className="text-left flex-1 leading-tight tracking-tight truncate">{item.label}</p>

                    {/* Per-item notification badge — yangilik soni */}
                    {showBadge && (
                      <span
                        className="text-xs font-semibold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center bg-orange-500 text-white"
                        title={`${itemCount} ta yangi`}
                      >
                        {itemCount > 99 ? '99+' : itemCount}
                      </span>
                    )}

                    <div
                      onClick={(e) => toggleTabLock(item.id, e)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${lockedTabs.has(item.id)
                          ? 'bg-rose-500 text-white'
                          : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-600'
                        }`}
                    >
                      {lockedTabs.has(item.id) ? <Lock size={10} strokeWidth={2.5} /> : <Unlock size={10} />}
                    </div>
                  </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </nav>

        <div className="p-2.5 border-t border-slate-100 space-y-1">
          <button
            onClick={() => {
              if (hasLockPin) {
                setPendingTab('profile_access');
              } else {
                setIsProfileModalOpen(true);
              }
            }}
            className="flex items-center w-full text-left gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-900/[0.04] transition-colors group"
          >
            <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-semibold flex items-center justify-center text-xs">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate leading-tight">{currentUser.fullName}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">Profil sozlamalari</p>
            </div>
            <Settings size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => handleTabChange('qollanma')}
              className={`btn-ghost flex-1 ${activeTab === 'qollanma' ? 'bg-slate-100 text-slate-900' : ''}`}
            >
              Qo'llanma
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="btn-ghost flex-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut size={14} strokeWidth={2} /> Chiqish
            </button>
          </div>
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
              <h3 className="text-base font-semibold text-slate-900 tracking-tight mb-1">Chiqishni tasdiqlang</h3>
              <p className="text-sm text-slate-500">Tizimdan chiqmoqchimisiz? Barcha ochiq ma'lumotlar yopiladi.</p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Bekor qilish
              </button>
              <div className="w-px bg-slate-100" />
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                className="flex-1 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* Sahifa qo'llanmasi — joriy sahifa uchun qisqa yo'l-yo'riq */}
      {pageTourOpen && (
        <PageTour tab={activeTab} onClose={() => setPageTourOpen(false)} />
      )}

      {/* Yangilanish tour'i — "nima o'zgardi" qadamma-qadam */}
      {releaseTourOpen && currentUser?.tenantId && (
        <ReleaseTour
          tenantId={currentUser.tenantId}
          onClose={() => setReleaseTourOpen(false)}
          onNavigate={(tab) => handleTabChange(tab as TabId)}
        />
      )}

      {/* Global omnibox — Ctrl+K: sahifa qidirish yoki Girgitton'dan so'rash */}
      <CommandPalette agentEnabled={aiCopilotEnabled} />

      {/* Price list modal — navbar tugmasi yoki Ctrl+Shift+P orqali ochiladi.
          Faqat ochilganda yuklanadi (chunk eksport kutubxonalari og'ir). */}
      {isPriceListOpen && (
        <React.Suspense fallback={null}>
          <PriceListModal
            isOpen={isPriceListOpen}
            onClose={() => setIsPriceListOpen(false)}
            tenantSlug={currentUser?.workspaceSlug || ''}
            defaultBranchId={activeBranchId}
          />
        </React.Suspense>
      )}

      <main className="flex-1 flex flex-col h-[calc(100vh-3rem)] md:h-screen overflow-hidden">
        <header className="hidden md:flex h-14 px-5 items-center justify-between border-b border-[color:var(--border)] bg-white z-10">
          <h2 className="page-title flex items-center gap-2">
            {navItems.find(i => i.id === activeTab)?.label}
            {lockedTabs.has(activeTab) && <Lock size={14} className="text-rose-500" />}
          </h2>

          <div className="flex items-center gap-2">

            {/* SAHIFA QO'LLANMASI — shu sahifa nima qilishini va qaysi
                tugma nimaga kerakligini joyida ko'rsatadi. Sozlash tour'i
                (OnboardingTour) dan mustaqil: u bir martalik, bu esa
                istalgan payt ochiladi. Qo'llanmasi yo'q sahifada tugma
                ham chiqmaydi. */}
            {hasPageTour(activeTab) && !lockedTabs.has(activeTab) && (
              <button
                onClick={() => setPageTourOpen(true)}
                className="btn-outline h-sm text-slate-500"
                title="Shu sahifa bo'yicha yo'l-yo'riq"
              >
                <HelpCircle size={14} />
                <span className="hidden xl:inline">Yo'l-yo'riq</span>
              </button>
            )}

            {/* Price list — hamma uchun ochiq (ruxsat talab qilinmaydi) */}
            <button
              onClick={() => setIsPriceListOpen(true)}
              className="btn-outline h-sm"
              title="Narxnoma (Price list) — Ctrl+Shift+P"
            >
              <FileText size={14} />
              <span>Price list</span>
            </button>

            {/* Ctrl+K hint — visible reminder of the command palette */}
            <button
              onClick={() => {
                // Dispatch synthetic Ctrl+K event so the palette opens via its global listener
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              className="btn-outline h-sm hidden lg:inline-flex text-slate-500"
              title="Tezkor qidiruv"
            >
              <span>Qidiruv</span>
              <kbd className="text-xs font-medium bg-slate-100 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>

            {/* Filial filtri faqat: bir nechta filial bor + foydalanuvchining filiallar ruxsati bor bo'lsa */}
            {branches.length > 1 && (isAdmin || p.canViewBranches || p.canManageBranches) && (
              <select
                value={activeBranchId}
                onChange={e => {
                  setActiveBranchId(e.target.value);
                  if (e.target.value) localStorage.setItem(branchStorageKey, e.target.value);
                  else localStorage.removeItem(branchStorageKey);
                }}
                className="select-minimal h-control-sm w-auto min-w-[150px] text-xs"
              >
                <option value="">Barcha filiallar</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={(e) => toggleTabLock(activeTab, e)}
              className={lockedTabs.has(activeTab) ? 'btn-danger h-sm' : 'btn-outline h-sm'}
              title={lockedTabs.has(activeTab) ? 'Sahifa qulflangan' : 'Sahifani qulflash'}
            >
              {lockedTabs.has(activeTab) ? <Lock size={14} /> : <Unlock size={14} />}
              <span className="hidden xl:inline">{lockedTabs.has(activeTab) ? 'Qulflangan' : 'Qulflash'}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 relative custom-scroll">
          {lockedTabs.has(activeTab) ? (
            <div className="absolute inset-0 z-[50] flex items-center justify-center p-8 overflow-hidden">
              {/* Content is blurred behind */}
              <div className="absolute inset-0 backdrop-blur-[40px] bg-slate-50/40 z-0"></div>

              <div className="relative z-10 w-full max-w-xs text-center">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg border border-slate-100">
                  <Lock className="w-6 h-6 text-rose-500" strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight mb-1">Sahifa qulflangan</h3>
                <p className="text-sm text-slate-500 mb-6">Ushbu bo'limga kirish uchun PIN kodni kiriting</p>

                <form onSubmit={(e) => { e.preventDefault(); setPendingTab(activeTab); }}>
                  <button type="submit" className="btn-primary w-full">
                    <ShieldCheck size={15} />
                    <span>PIN kodni kiritish</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <React.Suspense fallback={<LoadingSpinner fullPage />}>
              {/* Reliz banneri OLIB TASHLANDI. U "falon sanadagi yangilanishni
                  ko'rmadingiz" deb HAR SAHIFADA tepada turardi va yopilmaguncha
                  ketmasdi — bir martalik e'lon uchun bu juda tajovuzkor edi.
                  Reliz tour'ining o'zi qoldi: uni foydalanuvchi xohlaganda
                  o'zi ochadi (`releaseTourOpen`). */}
              {activeTab === 'boshsahifa' && <BoshSahifa currentUser={currentUser} aiEnabled={aiCopilotEnabled} />}
              {activeTab === 'kassa' && (p.canViewFinance || p.canAddIncome || p.canAddExpense || isAdmin) && <Kassa currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'moliya' && (p.canViewFinance || p.canViewKpi || p.canViewStatistics || isAdmin) && <Moliya currentUser={currentUser} activeBranchId={activeBranchId} />}
              { activeTab === 'hodimlar' && (p.canViewEmployees || isAdmin) && <Hodimlar currentUser={currentUser} activeBranchId={activeBranchId} /> }
              {/* Kanban va Jamoa vazifalari — bitta sahifa, ikki tab.
                  Ikkala URL ham saqlanib qoldi: qaysi biri ochilgan bo'lsa,
                  o'sha tab tanlangan holda chiqadi (eski havolalar,
                  qo'llanma qadamlari va Ctrl+K buzilmasin). */}
              {(activeTab === 'topshiriqlar' || activeTab === 'vazifalar')
                && (p.canViewTasks || p.canViewTeamTasks || isAdmin) && (
                <IshlarSahifasi
                  currentUser={currentUser}
                  activeBranchId={activeBranchId}
                  bolim={activeTab === 'vazifalar' ? 'vazifalar' : 'kanban'}
                  onBolim={(b) => handleTabChange(b === 'vazifalar' ? 'vazifalar' : 'topshiriqlar')}
                />
              )}
              {activeTab === 'mijozlar' && (p.canViewCustomers || isAdmin) && <Mijozlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'ombor' && (p.canViewInventory || isAdmin) && <Ombor currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'davomat' && (p.canViewAttendance || isAdmin) && <Davomat currentUser={currentUser} />}
              {activeTab === 'billing' && (p.canManageBilling || p.canViewBillingStatus || isAdmin) && <Billing />}
              {activeTab === 'admins' && isAdmin && <Admins currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'hamkorlar' && (isAdmin || p.canViewVendors) && <Hamkorlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'filiallar' && (isAdmin || p.canManageBranches || !!(p as any).canViewBranches) && <Filiallar currentUser={currentUser} />}
              {activeTab === 'hisobotlar' && (isAdmin || p.canViewFinanceReports || p.canViewExpenseCharts || p.canViewServiceReports) && <Hisobotlar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'sozlamalar' && (p.canViewSettings || isAdmin) && <Sozlamalar currentUser={currentUser} activeBranchId={activeBranchId} />}
              {activeTab === 'qollanma' && <Qollanma />}

              {(() => {
                const SPECIAL_TABS = new Set(['qollanma', 'filiallar', 'billing']);
                if (SPECIAL_TABS.has(activeTab)) return null;
                const item = navItems.find(i => i.id === menyuBandi(activeTab));
                if (item?.show) return null;
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center p-10 bg-white rounded-xl border border-[color:var(--border)]">
                    <Lock size={40} className="text-slate-200 mb-4" />
                    <h3 className="text-base font-semibold text-slate-900">Kirish cheklangan</h3>
                    <p className="text-sm text-slate-500 mt-1">Ushbu bo'limni ko'rish uchun ruxsatingiz yo'q.</p>
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
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-center gap-3 mb-2">
            <ShieldCheck size={18} className="text-orange-600 flex-shrink-0" />
            <p className="text-xs text-orange-800 leading-snug">PIN kod akkauntingizga bog'lanadi va istalgan qurilmada ishlaydi.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">Yangi PIN kod</label>
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
              <label className="form-label">PIN kodni tasdiqlang</label>
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
              <label className="form-label flex justify-between">
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
              <div className="flex justify-between mt-1 text-xs text-slate-400">
                <span>1 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">
            Sozlamalarni saqlash
          </button>
        </form>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Profilni Tahrirlash" maxWidth="max-w-sm">
        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div>
            <label className="form-label">To'liq Ism (F.I.SH)</label>
            <input
              type="text" required
              value={profileForm.fullName}
              onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              className="input-minimal w-full"
            />
          </div>
          <div>
            <label className="form-label">Login</label>
            <input
              type="text" required
              value={profileForm.login}
              onChange={(e) => setProfileForm({ ...profileForm, login: e.target.value })}
              className="input-minimal w-full font-mono text-xs"
            />
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-3">Parolni o'zgartirish (ixtiyoriy)</p>
            <div className="space-y-4">
              <div className="relative">
                <label className="form-label">Yangi Parol</label>
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
                <label className="form-label">Parolni tasdiqlang</label>
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

          <div className="pt-2">
            <button type="submit" className="btn-primary w-full">
              O'zgarishlarni saqlash
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Dashboard;
