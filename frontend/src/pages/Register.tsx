import React, { useState, useMemo } from 'react';
import { Lock, User as UserIcon, Building2, Eye, EyeOff, Phone, Hash } from 'lucide-react';
import { authApi } from '../api';
import { buildUser, User } from '../App';
import logo from '../assets/logo.png';

interface RegisterProps {
  onRegistered: (user: User) => void;
  onBack?: () => void;
  onSwitchToLogin?: () => void;
}

// Mirrors the server-side DTO: lowercase alphanumeric + dashes, 3-32 chars.
const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// Live slug suggestion from tenant name — strip diacritics, collapse non-alphanumerics to dashes.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

const Register: React.FC<RegisterProps> = ({ onRegistered, onBack, onSwitchToLogin }) => {
  const [tenantName, setTenantName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill slug while user hasn't manually edited it yet.
  const suggestedSlug = useMemo(() => slugify(tenantName), [tenantName]);
  const effectiveSlug = slugEdited ? workspaceSlug : suggestedSlug;

  const validate = (): string | null => {
    if (tenantName.trim().length < 2) return 'Tashkilot nomi kamida 2 ta belgi';
    if (!SLUG_REGEX.test(effectiveSlug) || effectiveSlug.length < 3) {
      return 'Workspace slug noto\'g\'ri (faqat a-z, 0-9, tire; 3-32 belgi)';
    }
    if (fullName.trim().length < 2) return 'Ism familiya kamida 2 ta belgi';
    if (login.trim().length < 3) return 'Login kamida 3 ta belgi';
    if (!/^[a-zA-Z0-9._-]+$/.test(login.trim())) {
      return 'Login faqat harf, raqam, nuqta, tire va pastki chiziq';
    }
    if (password.length < 8) return 'Parol kamida 8 ta belgi bo\'lishi kerak';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    setLoading(true);
    try {
      // Telegram WebApp ichida register qilingan bo'lsa — egani Telegram'ga bog'laymiz.
      const tgId = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const res = await authApi.register({
        tenantName: tenantName.trim(),
        workspaceSlug: effectiveSlug,
        fullName: fullName.trim(),
        login: login.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        ...(tgId ? { telegramId: String(tgId) } : {}),
      });

      const { token, user, workspaceSlug: slug } = res.data;
      // Same Bearer fallback the Login page uses — needed for Telegram WebApp / iOS Safari.
      if (token) localStorage.setItem('pf_token', token);
      onRegistered(buildUser({ ...user, workspaceSlug: slug }));
    } catch (err: any) {
      const m = err.response?.data?.message;
      if (typeof m === 'string') setError(m);
      else if (Array.isArray(m)) setError(m.join(', '));
      else setError('Ro\'yxatdan o\'tish muvaffaqiyatsiz tugadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="pf-animated-grid" />

      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 bg-white/80 backdrop-blur border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Bosh sahifa
        </button>
      )}

      <div className="w-full max-w-lg relative z-10">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-[#FF6B00]/10 rounded-full blur-2xl" />
            <img src={logo} alt="PrintFlow" className="relative w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 mb-1 uppercase">
            Print<span className="text-[#FF6B00]">Flow</span>
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
            Yangi Workspace ochish
          </p>
        </div>

        <div className="bg-white p-8 shadow-xl border border-slate-200 relative overflow-hidden rounded-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF6B00]/5 rounded-full -mr-20 -mt-20" />

          <form onSubmit={handleSubmit} className="space-y-4 relative" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Tashkilot nomi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  required
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Ideal Print MCHJ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Workspace slug (URL identifikator)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  required
                  type="text"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    setWorkspaceSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="ideal-print"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none"
                />
              </div>
              <p className="text-xs font-bold text-slate-400 mt-1">
                Faqat kichik harf, raqam va tire. Login sahifada shu nomni kiritasiz.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Ism Familiya
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Sardor Karimov"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Telefon (ixtiyoriy)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 ..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Admin Login
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  required
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value.toLowerCase())}
                  placeholder="admin"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Parol
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 8 ta belgi"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-11 pr-11 py-3 text-sm font-bold focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF6B00] hover:bg-[#e66000] disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
            >
              {loading ? 'Yaratilmoqda...' : 'Workspace yaratish'}
            </button>

            {onSwitchToLogin && (
              <p className="text-center text-xs font-bold text-slate-500 pt-2">
                Allaqachon hisob bormi?{' '}
                <button type="button" onClick={onSwitchToLogin} className="text-[#FF6B00] hover:underline">
                  Tizimga kirish
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
