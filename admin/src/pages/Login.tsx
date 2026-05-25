import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { authApi } from '../api';
import logo from '../assets/logo.png';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login({ login, password });
      if (res.data?.token) localStorage.setItem('pf_sa_token', res.data.token);
      onLogin();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login xatosi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#f2f2f7] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,107,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.08) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-md mx-4 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center">
          <img
            src={logo}
            alt="PrintFlow"
            className="w-16 h-16 mx-auto mb-4 object-contain drop-shadow-lg"
          />
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Print<span className="text-orange-400">Flow</span>
          </h1>
          <p className="text-[12px] font-medium tracking-wide text-slate-400 mt-2">
            Super Admin Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[13px] font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-slate-600 mb-2 ml-1">
              Login
            </label>
            <input
              type="text"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Admin login..."
              className="w-full h-12 bg-slate-100/70 border border-slate-200 rounded-xl px-4 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-600 mb-2 ml-1">
              Parol
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 bg-slate-100/70 border border-slate-200 rounded-xl pl-4 pr-12 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] disabled:bg-slate-300 text-white font-semibold text-[15px] rounded-xl shadow-lg shadow-orange-500/30 transition-all"
          >
            {loading ? 'Yuklanmoqda...' : 'Tizimga kirish'}
          </button>

          <p className="text-center text-[10px] text-slate-400 font-semibold tracking-wider mt-6">
            © 2026 PRINTFLOW SaaS · v2.5.0
          </p>
        </form>
      </div>
    </div>
  );
}
