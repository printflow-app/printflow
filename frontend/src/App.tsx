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
      <div className="min-h-screen bg-[color:var(--background)] flex flex-col items-center justify-center p-6 font-sans text-slate-900">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 mb-8 bg-white rounded-overlay border border-[color:var(--border)] shadow-sm flex items-center justify-center p-4">
            <img src={logo} alt="PrintFlow" className="w-16 h-16 object-contain" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight mb-3 select-none">
            <span className="text-slate-900">Print</span>
            <span className="text-[color:var(--primary)]">Flow</span>
          </h1>

          <div className="w-40 h-1 bg-slate-200 rounded-full overflow-hidden mb-4 relative">
            <div className="h-full bg-[color:var(--primary)] rounded-full absolute top-0 left-0 w-1/3 animate-loadingBar" />
          </div>

          <p className="text-sm text-slate-500">Tizimga kirilmoqda...</p>
        </div>

        <style>{`
          @keyframes slideProgress {
            0% { left: -35%; width: 35%; }
            50% { width: 45%; }
            100% { left: 100%; width: 35%; }
          }
          .animate-loadingBar {
            animation: slideProgress 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-primary-100">
      {showOnboarding && (
        <div className="fixed inset-0 z-overlay bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-overlay shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">Ma'lumotlarni tahrirlang</h2>
              <p className="text-sm text-slate-500 mt-0.5">Xavfsizlik va sozlash uchun barcha maydonlarni to'ldiring</p>
            </div>
            <form onSubmit={handleOnboardingSubmit} className="p-6 space-y-4">
              <div>
                <label className="form-label">Tashkilot / workspace nomi</label>
                <input required className="input-minimal"
                  value={onboardingForm.tenantName} onChange={e => setOnboardingForm({...onboardingForm, tenantName: e.target.value})} placeholder="Ideal Print MCHJ" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Ism familiyangiz</label>
                  <input required className="input-minimal"
                    value={onboardingForm.fullName} onChange={e => setOnboardingForm({...onboardingForm, fullName: e.target.value})} placeholder="Sardor Karimov" />
                </div>
                <div>
                  <label className="form-label">Telefon raqamingiz</label>
                  <input required type="tel" inputMode="tel" className="input-minimal"
                    value={onboardingForm.phone} onChange={e => setOnboardingForm({...onboardingForm, phone: e.target.value})} placeholder="+998 90 123 45 67" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Yangi login</label>
                  <input required className="input-minimal"
                    value={onboardingForm.login} onChange={e => setOnboardingForm({...onboardingForm, login: e.target.value})} placeholder="admin_new" />
                </div>
                <div>
                  <label className="form-label">Yangi parol (ixtiyoriy)</label>
                  <input className="input-minimal"
                    type="password" value={onboardingForm.password} onChange={e => setOnboardingForm({...onboardingForm, password: e.target.value})} placeholder="********" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-card border border-slate-200">
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-[color:var(--primary)]">Diqqat:</span> Ushbu ma'lumotlar tizimga kirish va xavfsizlik uchun ishlatiladi. Saqlagandan so'ng siz dashboardga yo'naltirilasiz.
                </p>
              </div>

              <button type="submit" className="btn-primary h-lg w-full">
                Saqlash va boshlash
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
