import React, { useState, useEffect } from 'react';
import { Lock, User as UserIcon, Building2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
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
      const res = await authApi.login({
        workspaceSlug: slug,
        login: username.trim(),
        password,
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
          className="absolute top-6 left-6 z-20 flex items-center gap-2 bg-white/80 backdrop-blur border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Bosh sahifa
        </button>
      )}

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="relative w-24 h-24 mx-auto mb-6 group">
            <div className="absolute inset-0 bg-[#FF6B00]/10 rounded-full blur-2xl group-hover:bg-[#FF6B00]/20 transition-all duration-500" />
            <img src={logo} alt="PrintFlow" className="relative w-full h-full object-contain hover:scale-110 transition-transform duration-300" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 mb-1 uppercase">
            Print<span className="text-[#FF6B00]">Flow</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
            Bosmaxona Boshqaruv Tizimi
          </p>
        </div>

        {/* Card */}
        <div className="bg-white p-8 shadow-xl border border-slate-200 relative overflow-hidden rounded-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF6B00]/5 rounded-full -mr-20 -mt-20" />

          <form onSubmit={handleSubmit} className="space-y-5 relative" autoComplete="off">
            {/* Workspace Slug */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Workspace
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#FF6B00] transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  id="workspace-slug"
                  type="text"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value.toLowerCase())}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                  placeholder="sizning-workspace"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Login */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Login
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#FF6B00] transition-colors">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                  placeholder="loginni kiriting"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Parol
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#FF6B00] transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-12 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                  placeholder="•••••••••"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#FF6B00] transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Session expired warning */}
            {sessionExpired && (
              <div className="bg-amber-50 border border-amber-200 text-amber-600 rounded-lg text-[11px] font-bold uppercase tracking-tight p-3 text-center flex items-center justify-center gap-2">
                <AlertTriangle size={14} strokeWidth={2.5}/> Xavfsizlik yuzasidan tizimdan chiqarildingiz. Qayta kiring.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-[11px] font-bold uppercase tracking-tight p-3 text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 bg-[#FF6B00] hover:bg-[#e66000] disabled:bg-slate-300 rounded-lg text-white flex justify-center items-center gap-3 text-sm font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all duration-200 mt-2 py-4"
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
            <p className="mt-6 text-center text-xs font-bold text-slate-500">
              Workspace yo'qmi?{' '}
              <button
                type="button"
                onClick={onRegisterClick}
                className="text-[#FF6B00] hover:underline font-bold uppercase tracking-wider"
              >
                Yangi ochish
              </button>
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] font-bold text-zinc-700 uppercase tracking-[0.2em]">
          PrintFlow © {new Date().getFullYear()} — Barcha huquqlar himoyalangan
        </p>
      </div>
    </div>
  );
};

export default Login;
