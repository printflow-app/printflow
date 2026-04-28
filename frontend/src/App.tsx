import React, { useState, useEffect, useCallback } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ScanAttendance from './pages/ScanAttendance';
import Landing from './pages/Landing';
import Billing from './pages/Billing';
import { authApi } from './api';
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
    canViewEmployees: boolean;
    canManageEmployees: boolean;
    canManageRoles: boolean;
    canViewSalary: boolean;
  };
}

const SESSION_KEY = 'pf_user_info';

function saveSession(user: User) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('pf_session_expired');
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLanding, setShowLanding] = useState(true);
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
      try {
        const res = await authApi.me();
        const user = res.data;

        if (user) {
          setCurrentUser(user);
          saveSession(user);
          setShowLanding(false);
          
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
        } else {
          clearSession();
          setCurrentUser(null);
        }
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
      alert(err.response?.data?.message || 'Xatolik yuz berdi');
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
    if (!currentUser) return;
    validateSession();
    const interval = setInterval(validateSession, 30_000);
    return () => clearInterval(interval);
  }, [currentUser, validateSession]);

  const handleLogin = (user: User) => {
    saveSession(user);
    setCurrentUser(user);
    setShowLanding(false);
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
    setShowLanding(true);
  };

  const isScanPage = window.location.pathname.startsWith('/attendance/scan');

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
        <div className="relative mb-8">
          <img src={logo} alt="PrintFlow" className="w-24 h-24 object-contain animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 border-2 border-[#FF6B00]/20 border-t-[#FF6B00] rounded-full animate-spin"></div>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tight uppercase mb-2">
          Print<span className="text-[#FF6B00]">Flow</span>
        </h1>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
          Tizimga kirilmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-orange-100">
      {showOnboarding && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-black p-6 text-white">
              <h2 className="text-xl font-black uppercase tracking-tight">Ma'lumotlarni <span className="text-[#FF6B00]">Tahrirlang</span></h2>
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Xavfsizlik va sozlash uchun barcha maydonlarni to'ldiring</p>
            </div>
            <form onSubmit={handleOnboardingSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Tashkilot / Workspace Nomi</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                  value={onboardingForm.tenantName} onChange={e => setOnboardingForm({...onboardingForm, tenantName: e.target.value})} placeholder="Ideal Print MCHJ" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Ism Familiyangiz</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    value={onboardingForm.fullName} onChange={e => setOnboardingForm({...onboardingForm, fullName: e.target.value})} placeholder="Sardor Karimov" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Telefon Raqamingiz</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    value={onboardingForm.phone} onChange={e => setOnboardingForm({...onboardingForm, phone: e.target.value})} placeholder="+998 90 123 45 67" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Yangi Login</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    value={onboardingForm.login} onChange={e => setOnboardingForm({...onboardingForm, login: e.target.value})} placeholder="admin_new" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Yangi Parol (ixtiyoriy)</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none" 
                    type="password" value={onboardingForm.password} onChange={e => setOnboardingForm({...onboardingForm, password: e.target.value})} placeholder="********" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">
                  <span className="text-[#FF6B00]">Diqqat:</span> Ushbu ma'lumotlar tizimga kirish va xavfsizlik uchun ishlatiladi. Saqlagandan so'ng siz dashboardga yo'naltirilasiz.
                </p>
              </div>

              <button type="submit" className="w-full bg-[#FF6B00] hover:bg-[#e66000] text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                Saqlash va Boshlash
              </button>
            </form>
          </div>
        </div>
      )}

      {subscriptionExpired ? (
        <Billing />
      ) : isScanPage ? (
        <ScanAttendance currentUser={currentUser} />
      ) : currentUser ? (
        <Dashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
        />
      ) : showLanding ? (
        <Landing onLoginClick={() => setShowLanding(false)} />
      ) : (
        <Login onLogin={handleLogin} />
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
      canViewEmployees: role.canViewEmployees ?? false,
      canManageEmployees: role.canManageEmployees ?? false,
      canManageRoles: role.canManageRoles ?? false,
      canViewSalary: role.canViewSalary ?? false,
    },
  };
}

export default App;
