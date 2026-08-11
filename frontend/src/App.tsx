import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ScanAttendance from './pages/ScanAttendance';
import Landing from './pages/Landing';
import CookieConsent from './components/CookieConsent';

const Billing = React.lazy(() => import('./pages/Billing'));
const PublicPriceList = React.lazy(() => import('./pages/PublicPriceList'));
import { authApi, billingApi } from './api';
import logo from './assets/logo.png';

// =============================================
// PrintFlow — Session Management
// =============================================

export interface User {
  id: string;
  fullName: string;
  role: any;
  login: string;
  phone?: string;
  isFirstLogin?: boolean;
  passwordVersion?: number;
  tenantId?: string;
  tenantName?: string;
  workspaceSlug: string;
  tenantFeatures?: Record<string, boolean>;
  permissions: {
    canViewFinance: boolean;
    canAddIncome: boolean;
    canAddExpense: boolean;
    canViewTotalBalance: boolean;
    canManagePaymentTypes: boolean;
    canViewTasks: boolean;
    canCreateTask: boolean;
    canEditTask: boolean;
    canDeleteTask: boolean;
    canMoveTask: boolean;
    canManageColumns: boolean;
    canViewCustomers: boolean;
    canManageCustomers: boolean;
    canViewInventory: boolean;
    canManageInventory: boolean;
    canViewAttendance: boolean;
    canManageAttendance: boolean;
    canViewServices: boolean;
    canManageServices: boolean;
    canShowPriceList: boolean;
    canViewEmployees: boolean;
    canManageEmployees: boolean;
    canManageRoles: boolean;
    canViewSalary: boolean;
    canManageBranches: boolean;
    canViewKpi: boolean;
    canViewExpenseCharts: boolean;
    canViewSettings: boolean;
    canAssignToOtherBranches: boolean;
    canManageBilling: boolean;
    canManageNotifications: boolean;
    // Granular ruxsatlar
    canViewStatistics: boolean;
    canViewFinanceReports: boolean;
    canViewServiceReports: boolean;
    canViewVendors: boolean;
    canManageVendors: boolean;
    canManageAdmins: boolean;
    canViewRoles: boolean;
    canManageExpenseTypes: boolean;
    canManageKanbanColumns: boolean;
    canManageGeneralSettings: boolean;
    // Excel eksport ruxsatlari — sahifa-bo'yicha
    canExportFinance: boolean;
    canExportTasks: boolean;
    canExportCustomers: boolean;
    canExportInventory: boolean;
    canExportEmployees: boolean;
    canExportAttendance: boolean;
    canExportVendors: boolean;
    canExportReports: boolean;
  };
}

const SESSION_KEY = 'pf_user_info';

// =============================================
// User cache — localStorage'da saqlanadi.
//
// Nega sessionStorage emas? iOS Safari va "Add to Home Screen" PWA rejimida
// OS xotirani bo'shatsa, sessionStorage tozalanadi va user har ochishda qayta
// login qilishga majbur bo'ladi. localStorage iOS background terminate'da
// saqlanib qoladi. Bu yerda hech qanday sir yo'q — faqat user metadatasi;
// haqiqiy auth token httpOnly cookie + localStorage Bearer fallback'da.
//
// Eski sessionStorage qiymatini bir martalik migratsiya qilamiz (pastda).
// =============================================
function saveSession(user: User) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch { /* quota / private mode */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
  try { sessionStorage.removeItem(SESSION_KEY); } catch {} // eski qiymat
  try { sessionStorage.removeItem('pf_session_expired'); } catch {}
  // Bearer fallback uchun saqlangan tokenni ham tozalaymiz
  try { localStorage.removeItem('pf_token'); } catch {}
}

// IMPERSONATE handoff — super-admin panelidan "Admin sifatida kirish" bosilganda
// asosiy ilova `#impersonate=<jwt>` hash bilan ochiladi. Tokenni Bearer sifatida
// saqlaymiz va URL'dan darhol tozalaymiz (loglarga/tarixga tushmasin). Hash
// query emas — Referer sarlavhasiga ham chiqmaydi. Token topilsa true qaytadi;
// shunda `/auth/me` uni ishlatib impersonatsiya sessiyasini ochadi.
function consumeImpersonationToken(): boolean {
  try {
    const hash = window.location.hash || '';
    const m = hash.match(/[#&]impersonate=([^&]+)/);
    if (!m) return false;
    const token = decodeURIComponent(m[1]);
    if (!token) return false;
    // Avvalgi sessiya (agar bu brauzerda boshqa akkaunt ochilgan bo'lsa) o'rnini
    // impersonatsiya egallaydi — token va user cache'ni tozalab, yangisini qo'yamiz.
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    localStorage.setItem('pf_token', token);
    // Hash'ni URL'dan olib tashlaymiz (token ko'rinib turmasin).
    const clean = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', clean);
    return true;
  } catch {
    return false;
  }
}

// Eski sessionStorage qiymatini localStorage'ga ko'chiramiz — bir martalik.
// Foydalanuvchi deploy'dan oldin login qilgan bo'lsa, qaytadan kirmasligi uchun.
(function migrateSessionToLocal() {
  try {
    const oldVal = sessionStorage.getItem(SESSION_KEY);
    if (oldVal && !localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, oldVal);
    }
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
})();

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    tenantName: '',
    tenantSlug: '',
    fullName: '',
    phone: '',
    login: '',
    password: ''
  });

  useEffect(() => {
    const handleExpired = () => setSubscriptionExpired(true);
    const handleSessionExpired = () => {
      sessionStorage.setItem('pf_session_expired', 'true');
      clearSession();
      setCurrentUser(null);
    };
    
    window.addEventListener('subscription_expired', handleExpired);
    window.addEventListener('session_expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('subscription_expired', handleExpired);
      window.removeEventListener('session_expired', handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      // Telegram WebApp'ni darhol ishga tushiramiz — auth so'rovlardan OLDIN
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg) {
        tg.ready?.();
        tg.expand?.();
      }

      // IMPERSONATE — super-admin panelidan kelgan bo'lsa, hash'dagi tokenni
      // Bearer sifatida saqlaymiz. `/auth/me` cookie'ni Bearer'dan ustun
      // qo'ygani uchun, bu brauzerda eski tenant cookie'si qolgan bo'lsa u
      // impersonatsiyani "yeb" qo'yardi — shuning uchun avval logout bilan
      // eski cookie'ni tozalab, so'ng Bearer bilan kiramiz.
      const impersonating = consumeImpersonationToken();
      if (impersonating) {
        try { await authApi.logout(); } catch { /* cookie yo'q bo'lsa ham mayli */ }
      }

      try {
        // 1. Cookie yoki Bearer (localStorage) orqali sessiyani tekshiramiz.
        //    /auth/me endi ikkala transport'ni ham qabul qiladi.
        const res = await authApi.me();
        const user = res.data;

        if (user) {
          setCurrentUser(user);
          saveSession(user);
          // navigate to dashboard happens in a separate effect (we need URL stability during init)

          if (user.isFirstLogin) {
            setOnboardingForm({
              tenantName: user.tenantName || '',
              tenantSlug: user.workspaceSlug || '',
              fullName: user.fullName || '',
              phone: user.phone || '',
              login: user.login || '',
              password: ''
            });
            setShowOnboarding(true);
          }
          return;
        }

        // 2. me() null qaytardi — Telegram telegramId orqali auto-login urinish
        const tgUserId = tg?.initDataUnsafe?.user?.id;
        if (tgUserId) {
          try {
            const tgRes = await authApi.telegramAuth(String(tgUserId));
            const data = tgRes.data;
            if (data?.token) {
              localStorage.setItem('pf_token', data.token);
            }
            if (data?.user) {
              const fullUser = { ...data.user, workspaceSlug: data.workspaceSlug };
              setCurrentUser(fullUser as any);
              saveSession(fullUser as any);
              // navigate to dashboard happens in a separate effect (we need URL stability during init)
              return;
            }
          } catch {
            // Telegram bog'lanmagan — Login sahifasini ko'rsatamiz (Landing emas)
          }
          clearSession();
          setCurrentUser(null);
          // navigate to dashboard happens in a separate effect (we need URL stability during init) // Telegram WebApp ichida Landing yo'q, to'g'ridan Login
          return;
        }

        clearSession();
        setCurrentUser(null);
      } catch {
        clearSession();
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.onboarding(onboardingForm);
      const res = await authApi.me();
      if (res.data) {
        setCurrentUser(res.data);
        saveSession(res.data);
        setShowOnboarding(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const validateSession = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authApi.checkSession();
      if (!res.data.valid) {
        clearSession();
        sessionStorage.setItem('pf_session_expired', 'true');
        setCurrentUser(null);
      }
    } catch { }
  }, [currentUser]);

  useEffect(() => {
    if (!subscriptionExpired) return;
    const interval = setInterval(async () => {
      try {
        const res = await billingApi.getStatus();
        const st = res.data?.status;
        if (st === 'ACTIVE' || st === 'TRIAL') {
          setSubscriptionExpired(false);
        }
      } catch { /* ignore */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [subscriptionExpired]);

  useEffect(() => {
    if (!currentUser) return;
    validateSession();
    const interval = setInterval(validateSession, 30_000);
    return () => clearInterval(interval);
  }, [currentUser, validateSession]);

  const handleLogin = (user: User) => {
    saveSession(user);
    setCurrentUser(user);
    if (user.isFirstLogin) {
      setOnboardingForm({
        tenantName: user.tenantName || '',
        tenantSlug: user.workspaceSlug || '',
        fullName: user.fullName || '',
        phone: user.phone || '',
        login: user.login || '',
        password: ''
      });
      setShowOnboarding(true);
    }
    navigate('/dashboard');
  };

  const handleUpdateUser = (updatedFields: Partial<User>) => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updatedFields };
      saveSession(updated);
      return updated;
    });
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { }
    clearSession();
    setCurrentUser(null);
    navigate('/login');
  };

  const isScanPage = location.pathname.startsWith('/attendance/scan');
  const isPublicPricePage = location.pathname.startsWith('/price/');
  const isAlwaysPublic = isScanPage || isPublicPricePage;

  // After auth init: if user is loaded and they're on a public route, send to dashboard.
  // If user is null and they're on a protected route, send to landing/login.
  useEffect(() => {
    if (loading) return;
    if (isAlwaysPublic) return; // don't redirect off scan/price pages
    const path = location.pathname;
    const isPublic = path === '/' || path.startsWith('/login') || path.startsWith('/register');
    if (currentUser && isPublic) {
      navigate('/dashboard', { replace: true });
    } else if (!currentUser && path.startsWith('/dashboard')) {
      navigate('/', { replace: true });
    }
  }, [currentUser, loading, location.pathname, navigate, isAlwaysPublic]);

  if (loading && !isAlwaysPublic) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex flex-col items-center justify-center p-6 overflow-hidden relative font-sans text-slate-900">
        {/* Soft background glows for aesthetics */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#FF6B00]/5 rounded-full blur-[80px] pointer-events-none animate-pulse" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-slate-500/5 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Logo container - modern, rounded-2xl square box instead of circle */}
          <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
            {/* Elegant glowing background */}
            <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#FF6B00] via-amber-500 to-orange-400 rounded-2xl blur opacity-25 animate-cardGlow" />
            
            {/* Main logo card keeping original proportions */}
            <div className="absolute inset-0 bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-center p-4">
              <img src={logo} alt="PrintFlow" className="w-16 h-16 object-contain animate-logoScale" />
            </div>
          </div>

          {/* Branding with modern gradient/weight balance */}
          <h1 className="text-3xl font-black tracking-tight mb-2 select-none uppercase">
            <span className="text-slate-800">Print</span>
            <span className="text-[#FF6B00]">Flow</span>
          </h1>

          {/* Elegant Loading bar */}
          <div className="w-40 h-1 bg-slate-100 rounded-full overflow-hidden mb-4 relative border border-slate-200/50">
            <div className="h-full bg-gradient-to-r from-[#FF6B00] via-orange-500 to-amber-500 rounded-full absolute top-0 left-0 w-1/3 animate-loadingBar" />
          </div>

          {/* Muted loading text */}
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
            Tizimga kirilmoqda...
          </p>
        </div>

        {/* CSS Keyframes for custom animations */}
        <style>{`
          @keyframes slideProgress {
            0% { left: -35%; width: 35%; }
            50% { width: 45%; }
            100% { left: 100%; width: 35%; }
          }
          @keyframes logoScale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
          @keyframes cardGlow {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(1.03); }
          }
          .animate-loadingBar {
            animation: slideProgress 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          .animate-logoScale {
            animation: logoScale 2s ease-in-out infinite;
          }
          .animate-cardGlow {
            animation: cardGlow 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-orange-100">
      {showOnboarding && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-black p-6 text-white">
              <h2 className="text-xl font-bold uppercase tracking-tight">Ma'lumotlarni <span className="text-[#FF6B00]">Tahrirlang</span></h2>
              <p className="text-xs uppercase font-bold text-slate-400 tracking-widest mt-1">Xavfsizlik va sozlash uchun barcha maydonlarni to'ldiring</p>
            </div>
            <form onSubmit={handleOnboardingSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">Tashkilot / Workspace Nomi</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                  value={onboardingForm.tenantName} onChange={e => setOnboardingForm({...onboardingForm, tenantName: e.target.value})} placeholder="Ideal Print MCHJ" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Ism Familiyangiz</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    value={onboardingForm.fullName} onChange={e => setOnboardingForm({...onboardingForm, fullName: e.target.value})} placeholder="Sardor Karimov" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Telefon Raqamingiz</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    value={onboardingForm.phone} onChange={e => setOnboardingForm({...onboardingForm, phone: e.target.value})} placeholder="+998 90 123 45 67" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Yangi Login</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    value={onboardingForm.login} onChange={e => setOnboardingForm({...onboardingForm, login: e.target.value})} placeholder="admin_new" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Yangi Parol (ixtiyoriy)</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    type="password" value={onboardingForm.password} onChange={e => setOnboardingForm({...onboardingForm, password: e.target.value})} placeholder="********" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase">
                  <span className="text-[#FF6B00]">Diqqat:</span> Ushbu ma'lumotlar tizimga kirish va xavfsizlik uchun ishlatiladi. Saqlagandan so'ng siz dashboardga yo'naltirilasiz.
                </p>
              </div>

              <button type="submit" className="w-full bg-[#FF6B00] hover:bg-[#e66000] text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                Saqlash va Boshlash
              </button>
            </form>
          </div>
        </div>
      )}

      {subscriptionExpired ? (
        <React.Suspense fallback={null}>
          <Billing />
        </React.Suspense>
      ) : (
        <Routes>
          {/* Attendance QR scan — public, no auth */}
          <Route path="/attendance/scan" element={<ScanAttendance currentUser={currentUser} />} />

          {/* Public price list — mijozga ulashish uchun, auth talab qilmaydi */}
          <Route
            path="/price/:slug"
            element={
              <React.Suspense fallback={null}>
                <PublicPriceList />
              </React.Suspense>
            }
          />

          {/* Authenticated routes */}
          {currentUser ? (
            <>
              <Route
                path="/dashboard/*"
                element={
                  <Dashboard
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onUpdateUser={handleUpdateUser}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          ) : (
            <>
              <Route
                path="/"
                element={
                  <>
                    <Landing
                      onLoginClick={() => navigate('/login')}
                      onRegisterClick={() => navigate('/register')}
                    />
                    <CookieConsent />
                  </>
                }
              />
              <Route
                path="/login"
                element={
                  <Login
                    onLogin={handleLogin}
                    onBack={() => navigate('/')}
                    onRegisterClick={() => navigate('/register')}
                  />
                }
              />
              <Route
                path="/register"
                element={
                  <Register
                    onRegistered={handleLogin}
                    onBack={() => navigate('/')}
                    onSwitchToLogin={() => navigate('/login')}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      )}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export function buildUser(emp: any): User {
  const role = emp.role || {};
  return {
    id: emp.id,
    fullName: emp.fullName,
    login: emp.login,
    passwordVersion: emp.passwordVersion || 1,
    workspaceSlug: emp.workspaceSlug,
    role,
    tenantFeatures: emp.tenantFeatures || {},
    permissions: {
      canViewFinance: role.canViewFinance ?? false,
      canAddIncome: role.canAddIncome ?? false,
      canAddExpense: role.canAddExpense ?? false,
      canViewTotalBalance: role.canViewTotalBalance ?? false,
      canManagePaymentTypes: role.canManagePaymentTypes ?? false,
      canViewTasks: role.canViewTasks ?? false,
      canCreateTask: role.canCreateTask ?? false,
      canEditTask: role.canEditTask ?? false,
      canDeleteTask: role.canDeleteTask ?? false,
      canMoveTask: role.canMoveTask ?? false,
      canManageColumns: role.canManageColumns ?? false,
      canViewCustomers: role.canViewCustomers ?? false,
      canManageCustomers: role.canManageCustomers ?? false,
      canViewInventory: role.canViewInventory ?? false,
      canManageInventory: role.canManageInventory ?? false,
      canViewAttendance: role.canViewAttendance ?? false,
      canManageAttendance: role.canManageAttendance ?? false,
      canViewServices: role.canViewServices ?? false,
      canManageServices: role.canManageServices ?? false,
      canShowPriceList: role.canShowPriceList ?? false,
      canViewEmployees: role.canViewEmployees ?? false,
      canManageEmployees: role.canManageEmployees ?? false,
      canManageRoles: role.canManageRoles ?? false,
      canViewSalary: role.canViewSalary ?? false,
      canManageBranches: role.canManageBranches ?? false,
      canViewKpi: role.canViewKpi ?? false,
      canViewExpenseCharts: role.canViewExpenseCharts ?? false,
      canViewSettings: role.canViewSettings ?? false,
      canAssignToOtherBranches: role.canAssignToOtherBranches ?? false,
      canManageBilling: role.canManageBilling ?? false,
      canManageNotifications: role.canManageNotifications ?? false,
      // Granular ruxsatlar
      canViewStatistics: role.canViewStatistics ?? false,
      canViewFinanceReports: role.canViewFinanceReports ?? false,
      canViewServiceReports: role.canViewServiceReports ?? false,
      canViewVendors: role.canViewVendors ?? false,
      canManageVendors: role.canManageVendors ?? false,
      canManageAdmins: role.canManageAdmins ?? false,
      canViewRoles: role.canViewRoles ?? false,
      canManageExpenseTypes: role.canManageExpenseTypes ?? false,
      canManageKanbanColumns: role.canManageKanbanColumns ?? false,
      canManageGeneralSettings: role.canManageGeneralSettings ?? false,
      // Excel eksport ruxsatlari
      canExportFinance: role.canExportFinance ?? false,
      canExportTasks: role.canExportTasks ?? false,
      canExportCustomers: role.canExportCustomers ?? false,
      canExportInventory: role.canExportInventory ?? false,
      canExportEmployees: role.canExportEmployees ?? false,
      canExportAttendance: role.canExportAttendance ?? false,
      canExportVendors: role.canExportVendors ?? false,
      canExportReports: role.canExportReports ?? false,
    },
  };
}

export default App;
