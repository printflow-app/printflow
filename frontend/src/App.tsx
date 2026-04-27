import React, { useState, useEffect, useCallback } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ScanAttendance from './pages/ScanAttendance';
import Landing from './pages/Landing';
import { authApi, employeesApi } from './api';

// =============================================
// PrintFlow — Session Management
//
// Eski tizim: localStorage + plaintext parol (xavfli)
// Yangi tizim: httpOnly cookie (JWT) + server-side session
//
// Brauzer cookie'ni avtomatik yuboradi har bir API so'rovda.
// Frontend faqat user info'ni sessionStorage'da saqlaydi (token emas).
// =============================================

export interface User {
  id: string;
  fullName: string;
  role: any;
  login?: string;
  passwordVersion?: number;
  workspaceSlug?: string;
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

// =============================================
// SESSION STORAGE (token emas — faqat UI state)
// Hardcoded defaultAdmin va localStorage o'chirildi
// =============================================
const SESSION_KEY = 'pf_user_info';

function saveSession(user: User) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function loadSession(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('pf_session_expired');
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLanding, setShowLanding] = useState(true);

  // =============================================
  // STARTUP — Verify cookie session with server
  // =============================================
  useEffect(() => {
    const init = async () => {
      // Try to restore from sessionStorage first (fast)
      const cached = loadSession();

      try {
        // Verify with server: GET /api/auth/me (uses httpOnly cookie)
        const res = await authApi.me();
        const payload = res.data; // { id, tenantId, workspaceSlug, role, passwordVersion }

        if (cached && cached.id === payload.id) {
          // Cached user info is still valid — use it
          setCurrentUser(cached);
        } else {
          // Session valid but no cached info (e.g. new tab) — set minimal user
          // Full user info comes after login
          setCurrentUser(cached);
        }
      } catch {
        // Cookie invalid or expired — clear everything
        clearSession();
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // =============================================
  // TELEGRAM WEB APP AUTO LOGIN
  // =============================================
  useEffect(() => {
    if (loading || currentUser) return;

    const checkTelegramLogin = async () => {
      // @ts-ignore
      const tg = window.Telegram?.WebApp;
      const tgUser = tg?.initDataUnsafe?.user;
      const isLoggedOut = sessionStorage.getItem('pf_tg_logout');

      if (tgUser?.id && !isLoggedOut) {
        try {
          const res = await employeesApi.telegramLogin(tgUser.id.toString());
          const emp = res.data;
          if (emp) {
            const user = buildUser(emp);
            setCurrentUser(user);
            saveSession(user);
            tg.expand();
          }
        } catch {
          // Telegram login failed — show normal login page
        }
      }
    };

    checkTelegramLogin();
  }, [loading, currentUser]);

  // =============================================
  // SESSION VALIDATION — har 30 soniyada
  // =============================================
  const validateSession = useCallback(async () => {
    if (!currentUser) return;

    try {
      const res = await authApi.checkSession();
      if (!res.data.valid) {
        // Parol o'zgardi — majburiy logout
        clearSession();
        sessionStorage.setItem('pf_session_expired', 'true');
        setCurrentUser(null);
      }
    } catch {
      // Network xato — e'tiborsiz qoldiramiz
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    validateSession();
    const interval = setInterval(validateSession, 30_000);
    return () => clearInterval(interval);
  }, [currentUser, validateSession]);

  // =============================================
  // HANDLERS
  // =============================================
  const handleLogin = (user: User) => {
    saveSession(user);
    setCurrentUser(user);
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
    try {
      await authApi.logout(); // Cookie'ni server tomondan o'chiradi
    } catch {
      // Ignore network errors during logout
    }
    sessionStorage.setItem('pf_tg_logout', 'true');
    clearSession();
    setCurrentUser(null);
  };

  const isScanPage = window.location.pathname.startsWith('/attendance/scan');

  // =============================================
  // LOADING SCREEN
  // =============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-20 h-20 bg-[#FF6B00] flex items-center justify-center mb-8 shadow-2xl animate-pulse">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
        <h1 className="text-2xl font-black tracking-tight uppercase mb-2">
          Print<span className="text-[#FF6B00]">Flow</span>
        </h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
          Tizimga kirilmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-orange-100">
      {isScanPage ? (
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

// =============================================
// HELPER — API response'dan User object yasash
// =============================================
export function buildUser(emp: any): User {
  const role = emp.role || {};
  return {
    id: emp.id,
    fullName: emp.fullName,
    login: emp.login,
    passwordVersion: emp.passwordVersion || 1,
    workspaceSlug: emp.workspaceSlug,
    role,
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
