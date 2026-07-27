import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../api';
import logo from '../assets/logo.png';

// =============================================
// SUPER-ADMIN KIRISH — 2026-07 redizayn.
// Ikki ustunli konsol kirishi: chapda brend/kontekst, o'ngda forma.
// Ranglar o'zgarmagan; struktura, tipografika va holatlar qayta qurildi.
// =============================================

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Login va parolni kiriting');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login({ login: login.trim(), password });
      if (res.data?.token) localStorage.setItem('pf_sa_token', res.data.token);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login yoki parol xato. Qaytadan urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-[color:var(--bg)]">
      {/* Chap: brend va kontekst — faqat kengroq ekranda */}
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-slate-900 relative overflow-hidden">
        {/* Sokin fon: nozik to'r + bitta issiq radial yorug'lik (bir manba) */}
        <div
          className="absolute inset-0 opacity-[0.55]"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full pointer-events-none"
          aria-hidden
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 68%)' }}
        />

        <div className="relative flex items-center gap-2.5">
          <img src={logo} alt="PrintFlow logotipi" className="h-7 w-auto" />
          <span className="text-[16px] font-extrabold tracking-tight text-white">
            Print<span className="text-orange-500">Flow</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-md">
            <ShieldCheck size={11} /> Platforma boshqaruvi
          </span>
          <h1 className="text-[34px] leading-[1.12] font-extrabold text-white tracking-tight mt-5 text-balance">
            Bosmaxonalar tarmog'ini bitta joydan boshqaring
          </h1>
          <p className="text-[14px] leading-relaxed text-slate-400 mt-4">
            Workspacelar, tariflar, to'lovlar va AI sarfi — barchasi shu panelda.
            Kirish faqat platforma ma'muriyati uchun ochiq.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          {[
            { k: 'Workspacelar', v: 'Hisob nazorati' },
            { k: "To'lovlar", v: 'Tasdiqlash oqimi' },
            { k: 'AI sarfi', v: 'Token va xarajat' },
          ].map(i => (
            <div key={i.k}>
              <p className="text-[11px] font-bold text-white">{i.k}</p>
              <p className="text-[10px] font-medium text-slate-500 mt-0.5">{i.v}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* O'ng: forma */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px]">
          {/* Mobil brend — chap ustun yashiringanda */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <img src={logo} alt="PrintFlow logotipi" className="h-7 w-auto" />
            <span className="text-[16px] font-extrabold tracking-tight text-slate-900">
              Print<span className="text-orange-500">Flow</span>
            </span>
          </div>

          <h2 className="text-[22px] font-extrabold text-slate-900 tracking-tight">Tizimga kirish</h2>
          <p className="text-[13px] font-medium text-slate-500 mt-1">
            Super admin hisobingiz bilan davom eting.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-semibold px-3.5 py-3 rounded-lg"
              >
                <AlertCircle size={15} className="shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="sa-login" className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1.5">
                Login
              </label>
              <input
                id="sa-login"
                type="text"
                autoComplete="username"
                autoFocus
                value={login}
                onChange={e => { setLogin(e.target.value); if (error) setError(''); }}
                placeholder="superadmin"
                className="w-full h-11 bg-white border border-[color:var(--border)] rounded-lg px-3.5 text-[14px] font-semibold text-slate-900 placeholder:text-slate-300 placeholder:font-normal outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 transition-all"
              />
            </div>

            <div>
              <label htmlFor="sa-pass" className="block text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-1.5">
                Parol
              </label>
              <div className="relative">
                <input
                  id="sa-pass"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                  placeholder="••••••••"
                  className="w-full h-11 bg-white border border-[color:var(--border)] rounded-lg pl-3.5 pr-11 text-[14px] font-semibold text-slate-900 placeholder:text-slate-300 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-1 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-[13px] rounded-lg transition-all duration-150 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Tekshirilmoqda
                </>
              ) : (
                'Kirish'
              )}
            </button>
          </form>

          <p className="text-[10px] font-semibold tracking-wide text-slate-400 mt-8 text-center font-mono">
            © 2026 PrintFlow SaaS · v2.5.0
          </p>
        </div>
      </main>
    </div>
  );
}
