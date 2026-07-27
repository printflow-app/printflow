import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authApi } from './api';
import { UIProvider } from './ui';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import Plans from './pages/Plans';
import Payments from './pages/Payments';
import Leads from './pages/Leads';
import Logos from './pages/Logos';
import PromoCodes from './pages/PromoCodes';
import TaskManager from './pages/TaskManager';
import AiUsage from './pages/AiUsage';

// =============================================
// Super Admin entry — auth gate + router
// =============================================

const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => sessionStorage.getItem('sa_auth') === 'true');
  const login = () => { sessionStorage.setItem('sa_auth', 'true'); setIsAuthenticated(true); };
  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('pf_sa_token');
    sessionStorage.removeItem('sa_auth');
    setIsAuthenticated(false);
  };
  return { isAuthenticated, login, logout };
};

export default function App() {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <UIProvider>
      {!isAuthenticated ? (
        <Login onLogin={login} />
      ) : (
        <BrowserRouter>
          <Layout onLogout={logout}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/ai-usage" element={<AiUsage />} />
              <Route path="/plans" element={<Plans />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/promo-codes" element={<PromoCodes />} />
              <Route path="/task-manager" element={<TaskManager />} />
              <Route path="/logos" element={<Logos />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      )}
    </UIProvider>
  );
}
