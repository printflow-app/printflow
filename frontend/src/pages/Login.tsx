import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, Building2, Eye, EyeOff, AlertTriangle, ChevronLeft } from 'lucide-react';
import { authApi } from '../api';
import { buildUser, User } from '../App';
import logo from '../assets/logo.png';

interface LoginProps {
  onLogin: (user: User) => void;
  onBack?: () => void;
  onRegisterClick?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onBack, onRegisterClick }) => {
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check forced-logout flag
    if (sessionStorage.getItem('pf_session_expired') === 'true') {
      setSessionExpired(true);
      sessionStorage.removeItem('pf_session_expired');
    }

    // Pre-fill workspace from URL path: /t/SLUG → ...
    const match = window.location.pathname.match(/^\/t\/([^/]+)/);
    if (match) setWorkspaceSlug(match[1]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const slug = workspaceSlug.trim().toLowerCase();
    if (!slug) {
      setError('Workspace nomi ko\'rsatilmagan.');
      setLoading(false);
      return;
    }

    try {
      // Telegram WebApp ichida ochilgan bo'lsa — telegram user id'ni ham yuboramiz.
      // Backend hisobni Telegram'ga bog'laydi; keyingi safar avtomatik login bo'ladi
      // va botda alohida ro'yxatdan o'tish shart emas.
      const tgId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const res = await authApi.login({
        workspaceSlug: slug,
        login: username.trim(),
        password,
        ...(tgId ? { telegramId: String(tgId) } : {}),
      });

      // Server httpOnly cookie qo'yadi, lekin Telegram WebApp / iOS Safari kabi
      // 3rd-party cookie bloklangan brauzerlarda Bearer fallback uchun
      // tokenni localStorage'ga ham saqlaymiz.
      const { user, token } = res.data;
      if (token) localStorage.setItem('pf_token', token);
      onLogin(buildUser({ ...user, workspaceSlug: slug }));
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (typeof msg === 'string') {
        setError(msg);
      } else if (Array.isArray(msg)) {
        setError(msg.join(', '));
      } else {
        setError('Login, parol yoki workspace nomi xato.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      {/* Background grid */}
      <div className="pf-animated-grid" />

      {onBack && (
        <button
          onClick={onBack}
          className="btn-outline absolute top-6 left-6 z-fab"
        >
          <ChevronLeft size={16} />
          Bosh sahifa
        </button>
      )}

      <div className="w-full max-w-md relative z-sticky">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="relative w-24 h-24 mx-auto mb-6 group">
            <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-2xl group-hover:bg-primary-500/20 transition-all duration-500" />
            <img src={logo} alt="PrintFlow" className="relative w-full h-full object-contain hover:scale-110 transition-transform duration-300" />
          </div>
          <h1 className="t-display mb-1.5">
            Print<span className="text-[color:var(--primary)]">Flow</span>
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Bosmaxona boshqaruv tizimi
          </p>
        </div>

        {/* Card */}
        <div className="bg-white p-8 rounded-card border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full -mr-20 -mt-20" />

          <form onSubmit={handleSubmit} className="space-y-5 relative" autoComplete="off">
            {/* Workspace Slug */}
            <div>
              <label className="form-label ml-1" htmlFor="workspace-slug">
                Workspace
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[color:var(--primary)] transition-colors">
                  <Building2 size={16} />
                </div>
                <input
                  id="workspace-slug"
                  type="text"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value.toLowerCase())}
                  className="input-minimal h-control-lg pl-11"
                  placeholder="sizning-workspace"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Login */}
            <div>
              <label className="form-label ml-1" htmlFor="username">
                Login
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[color:var(--primary)] transition-colors">
                  <UserIcon size={16} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-minimal h-control-lg pl-11"
                  placeholder="loginni kiriting"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="form-label ml-1" htmlFor="password">
                Parol
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[color:var(--primary)] transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-minimal h-control-lg pl-11 pr-12"
                  placeholder="•••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[color:var(--primary)] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Session expired warning */}
            {sessionExpired && (
              <div className="bg-amber-50 border border-amber-200 text-amber-600 rounded-card text-sm font-medium p-3 text-center flex items-center justify-center gap-2">
                <AlertTriangle size={16} /> Xavfsizlik yuzasidan tizimdan chiqarildingiz. Qayta kiring.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-card text-sm font-medium p-3 text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary h-lg w-full mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Tekshirilmoqda...</span>
                </>
              ) : (
                <span>Tizimga kirish →</span>
              )}
            </button>
          </form>

          {onRegisterClick && (
            <p className="mt-6 text-center text-sm font-medium text-slate-500">
              Workspace yo'qmi?{' '}
              <button
                type="button"
                onClick={onRegisterClick}
                className="text-[color:var(--primary)] hover:underline font-semibold"
              >
                Yangi ochish
              </button>
            </p>
          )}
        </div>

        <p className="mt-8 text-center t-caption">
          PrintFlow © {new Date().getFullYear()} — Barcha huquqlar himoyalangan
        </p>
      </div>
    </div>
  );
};

export default Login;
