import React, { useState, useMemo } from 'react';
import { Lock, User as UserIcon, Building2, Eye, EyeOff, Phone, Hash, ChevronLeft } from 'lucide-react';
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
          className="btn-outline absolute top-6 left-6 z-fab"
        >
          <ChevronLeft size={16} />
          Bosh sahifa
        </button>
      )}

      <div className="w-full max-w-lg relative z-sticky">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 bg-primary-500/10 rounded-full blur-2xl" />
            <img src={logo} alt="PrintFlow" className="relative w-full h-full object-contain" />
          </div>
          <h1 className="t-display mb-1">
            Print<span className="text-[color:var(--primary)]">Flow</span>
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Yangi Workspace ochish
          </p>
        </div>

        <div className="bg-white p-8 rounded-card border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full -mr-20 -mt-20" />

          <form onSubmit={handleSubmit} className="space-y-4 relative" autoComplete="off">
            <div>
              <label className="form-label">
                Tashkilot nomi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Building2 size={16} />
                </div>
                <input
                  required
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Ideal Print MCHJ"
                  className="input-minimal h-control-lg pl-11"
                />
              </div>
            </div>

            <div>
              <label className="form-label">
                Workspace slug (URL identifikator)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Hash size={16} />
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
                  className="input-minimal h-control-lg pl-11"
                />
              </div>
              <p className="text-hint mt-1">
                Faqat kichik harf, raqam va tire. Login sahifada shu nomni kiritasiz.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">
                  Ism Familiya
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <UserIcon size={16} />
                  </div>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Sardor Karimov"
                    className="input-minimal h-control-lg pl-11"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">
                  Telefon (ixtiyoriy)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 ..."
                    className="input-minimal h-control-lg pl-11"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="form-label">
                Admin Login
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <UserIcon size={16} />
                </div>
                <input
                  required
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value.toLowerCase())}
                  placeholder="admin"
                  className="input-minimal h-control-lg pl-11"
                />
              </div>
            </div>

            <div>
              <label className="form-label">
                Parol
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 8 ta belgi"
                  className="input-minimal h-control-lg pl-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium rounded-card px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary h-lg w-full"
            >
              {loading ? 'Yaratilmoqda...' : 'Workspace yaratish'}
            </button>

            {onSwitchToLogin && (
              <p className="text-center text-sm font-medium text-slate-500 pt-2">
                Allaqachon hisob bormi?{' '}
                <button type="button" onClick={onSwitchToLogin} className="text-[color:var(--primary)] hover:underline font-semibold">
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
