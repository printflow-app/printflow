import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Layers, Users, Zap, ShieldCheck, Check, Send,
  Building2, BarChart3, TrendingUp, Menu, X,
  ChevronRight, Sparkles, Package, CreditCard, Bot,
} from 'lucide-react';
import logo from '../assets/logo.png';

// ── API ────────────────────────────────────────────────────────────────────
const rawApiUrl = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
const API_URL = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api') : '/api';

// ── Animation Variants ────────────────────────────────────────────────────
const fadeUp: any = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
const stagger: any = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};
const fadeLeft: any = {
  hidden: { opacity: 0, x: -40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
const fadeRight: any = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

// ── Helpers ───────────────────────────────────────────────────────────────

// ── Floating Orb Background ───────────────────────────────────────────────
function OrbBg({ variant = 'hero' }: { variant?: 'hero' | 'dark' | 'light' }) {
  const isDark = variant === 'dark';
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute rounded-full"
        style={{
          width: 700, height: 700,
          top: '-15%', right: '-10%',
          background: isDark
            ? 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'orbFloat 18s ease-in-out infinite alternate',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 500, height: 500,
          bottom: '-10%', left: '-8%',
          background: isDark
            ? 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'orbFloat 24s ease-in-out infinite alternate-reverse',
        }}
      />
    </div>
  );
}

// ── Feature Card ──────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent = '#f97316' }: { icon: React.ReactNode; title: string; desc: string; accent?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
      className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-shadow duration-300 cursor-default"
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-all duration-300"
        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}20` }}
      >
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2 leading-tight">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

// ── Mockup: Kanban ────────────────────────────────────────────────────────
function KanbanMockup() {
  const columns = [
    { title: 'Yangi', color: '#64748b', tasks: ['A4 Bosma ×500', 'Vizitka dizayn', 'Broshura'] },
    { title: 'Jarayonda', color: '#f97316', tasks: ['Banner 3×6m', 'Katalog print', 'Sticker'] },
    { title: 'Tayyor', color: '#10b981', tasks: ['Papka ×100', 'Jurnal', 'Flyer'] },
  ];
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buyurtmalar Kanbani</span>
      </div>
      <div className="p-4 flex gap-3">
        {columns.map((col) => (
          <div key={col.title} className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: col.color }}>{col.title}</span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: col.color }}>{col.tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.tasks.map((task, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg px-2.5 py-2 shadow-sm border-l-2"
                  style={{ borderColor: col.color }}
                >
                  <div className="text-[8px] font-bold text-slate-700 leading-snug">{task}</div>
                  <div className="h-1 rounded-full bg-slate-100 mt-1.5">
                    <div className="h-full rounded-full" style={{ width: `${40 + i * 20}%`, background: col.color + '80' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mockup: Finance Chart ─────────────────────────────────────────────────
function FinanceMockup() {
  const bars = [55, 72, 48, 90, 65, 82, 70, 95, 58, 78, 88, 100];
  const months = ['Y', 'F', 'M', 'A', 'M', 'I', 'I', 'A', 'S', 'O', 'N', 'D'];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Yillik Daromad</p>
          <p className="text-lg font-black text-slate-900 tracking-tight">142.5M UZS</p>
        </div>
        <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg flex items-center gap-1">
          <TrendingUp size={10} /> +24%
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-end gap-1.5 h-24">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${h}%`,
                  background: i === 11 ? '#f97316' : `rgba(249,115,22,${0.2 + h / 200})`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {months.map((m, i) => (
            <div key={i} className="flex-1 text-center text-[7px] font-bold text-slate-300">{m}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mockup: Attendance ────────────────────────────────────────────────────
function AttendanceMockup() {
  const employees = [
    { name: 'Sardor K.', days: [1,1,1,1,1,0,1,1,1,1] },
    { name: 'Malika T.', days: [1,1,0,1,1,1,1,1,1,1] },
    { name: 'Jahongir A.', days: [1,0,1,1,1,1,0,1,1,1] },
  ];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bugungi Davomat</span>
      </div>
      <div className="p-3 space-y-2">
        {employees.map((emp, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0"
              style={{ background: `hsl(${i * 80 + 200}, 60%, 92%)`, color: `hsl(${i * 80 + 200}, 60%, 40%)` }}
            >
              {emp.name[0]}
            </div>
            <div className="flex-1">
              <div className="text-[8px] font-bold text-slate-700 mb-1">{emp.name}</div>
              <div className="flex gap-0.5">
                {emp.days.map((d, di) => (
                  <div
                    key={di}
                    className="h-2 rounded-sm flex-1"
                    style={{ background: d ? '#10b981' : '#fca5a5' }}
                  />
                ))}
              </div>
            </div>
            <span className="text-[8px] font-black text-emerald-600 flex-shrink-0">
              {emp.days.filter(Boolean).length}/10
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
function Landing({ onLoginClick, onRegisterClick }: { onLoginClick: () => void; onRegisterClick?: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [duration, setDuration] = useState(3);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', companyName: '', role: '', phone: '', telegramUser: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [clientLogos, setClientLogos] = useState<string[]>([]);



  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/plans`, { credentials: 'omit', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (!cancelled) setPlans(Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : [])); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/settings/public/CLIENT_LOGOS`, { credentials: 'omit', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setClientLogos(d); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormStatus('loading');
    try {
      const res = await fetch(`${API_URL}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      setFormStatus(res.ok ? 'success' : 'error');
    } catch { setFormStatus('error'); }
  };

  const scrollTo = (id: string) => {
    setMobileMenu(false);
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleStartTrial = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (onRegisterClick) onRegisterClick();
    else scrollTo('contact');
  };

  const getPrice = (plan: any) => {
    const v = duration === 3 ? plan?.price3m : duration === 6 ? plan?.price6m : plan?.price12m;
    return typeof v === 'number' ? v : 0;
  };

  const parseFeatures = (input: any): Record<string, any> => {
    if (input && typeof input === 'object') return input as Record<string, any>;
    if (typeof input !== 'string') return {};
    try { return JSON.parse(input) || {}; } catch { return {}; }
  };

  const navLinks = [
    { label: 'Imkoniyatlar', id: 'features' },
    { label: 'Modullar', id: 'modules' },
    { label: 'Narxlar', id: 'pricing' },
    { label: 'Aloqa', id: 'contact' },
  ];

  return (
    <>
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(3%, 4%) scale(1.03); }
          66% { transform: translate(-2%, -3%) scale(0.97); }
        }
        @keyframes logoScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .logo-track { animation: logoScroll 28s linear infinite; }
        .logo-track:hover { animation-play-state: paused; }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .gradient-text {
          background: linear-gradient(90deg, #f97316, #fb923c, #fdba74, #f97316);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 5s ease infinite;
        }
        @keyframes heroGrid {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .hero-grid-bg {
          background-image: linear-gradient(rgba(249,115,22,0.06) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(249,115,22,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
          animation: heroGrid 1.5s ease-out forwards;
        }
        .pricing-card-pop {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
        }
        .pricing-card-pop:hover {
          transform: translateY(-6px) scale(1.01);
        }
        @media (max-width: 768px) {
          .hero-title { font-size: clamp(2rem, 9vw, 3rem) !important; }
        }
      `}</style>

      {/* ── NAVBAR ───────────────────────────────────────────────────────── */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-slate-200/60 border-b border-slate-200/80' : 'bg-transparent'
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img src={logo} alt="PrintFlow" className="h-8 w-auto" />
            <span className="text-lg font-black tracking-tight text-slate-900">
              Print<span className="text-orange-500">Flow</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors duration-200 relative group"
              >
                {link.label}
                <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-orange-500 rounded-full transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onLoginClick}
              className="h-9 px-5 text-sm font-bold text-slate-700 border border-slate-200 bg-white/80 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all"
            >
              Kirish
            </button>
            <motion.button
              onClick={handleStartTrial}
              className="h-9 px-5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl shadow-md shadow-orange-500/20 transition-all"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Bepul Boshlash
            </motion.button>
          </div>

          <button className="md:hidden p-2 text-slate-700" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-200 overflow-hidden"
            >
              <div className="px-5 py-4 space-y-1">
                {navLinks.map(link => (
                  <button
                    key={link.id}
                    onClick={() => scrollTo(link.id)}
                    className="w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <button onClick={onLoginClick} className="flex-1 h-10 text-sm font-bold border border-slate-200 rounded-xl text-slate-700">
                    Kirish
                  </button>
                  <button onClick={handleStartTrial} className="flex-1 h-10 text-sm font-bold bg-orange-500 text-white rounded-xl shadow-md shadow-orange-500/20">
                    Boshlash
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-20">
        {/* Grid background */}
        <div className="hero-grid-bg absolute inset-0 pointer-events-none" aria-hidden />
        <OrbBg />

        <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold px-4 py-2 rounded-full mb-8 uppercase tracking-wider"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            7 Kun Bepul Trial
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="hero-title font-black text-slate-900 leading-[1.05] tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', letterSpacing: '-0.04em' }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            Bosmaxonangizni<br />
            <span className="gradient-text">To'liq Nazorat Qiling</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed mb-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            O'zbekiston bosmaxonalari uchun maxsus yaratilgan B2B SaaS platforma.
            Buyurtmalar, moliya, ombor va xodimlar — bitta tizimda.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <motion.button
              onClick={handleStartTrial}
              className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-2xl shadow-xl shadow-orange-500/30 flex items-center gap-2 transition-all"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              Bepul Boshlash <ArrowRight size={18} />
            </motion.button>
            <motion.button
              onClick={() => scrollTo('pricing')}
              className="h-14 px-8 bg-white hover:bg-slate-50 text-slate-700 font-bold text-base rounded-2xl border border-slate-200 hover:border-slate-300 flex items-center gap-2 transition-all shadow-sm"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              Narxlarni Ko'rish <ChevronRight size={18} />
            </motion.button>
          </motion.div>

          {/* Hero Mockups */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="md:col-span-1 md:mt-8"><AttendanceMockup /></div>
            <div className="md:col-span-2"><KanbanMockup /></div>
          </motion.div>
        </div>
      </section>


      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
        <OrbBg variant="light" />
        <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8">
          <motion.div
            className="text-center mb-16"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold px-4 py-2 rounded-full mb-5 uppercase tracking-wider">
              <Sparkles size={12} /> Nima uchun PrintFlow?
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Biznesni Raqamlashtiring
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-500 max-w-2xl mx-auto">
              Qog'ozbozlik va Excel jadvallardan voz keching. Hamma jarayonlarni avtomatlashtiring.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
          >
            {[
              { icon: <Layers size={24} />, title: 'Kanban Buyurtmalar', desc: 'Buyurtmalarni vizual ustunlarda boshqaring. Muddatlar va javobgarlikni real vaqtda ko\'ring.', accent: '#f97316' },
              { icon: <BarChart3 size={24} />, title: 'Moliya & Hisobotlar', desc: 'Kirim-chiqim, xodimlar oyligi va mijozlar qarzi — har bir tranzaksiya avtomatik kuzatiladi.', accent: '#3b82f6' },
              { icon: <Users size={24} />, title: 'Xodimlar & Davomat', desc: 'QR kod orqali tezkor davomat. Oylik maosh va KPI tahlili avtomatik ishlaydi.', accent: '#8b5cf6' },
              { icon: <Package size={24} />, title: 'Ombor Boshqaruvi', desc: 'Materiallar kirim-chiqimi, qoldiqlar nazorati va avtomatik xabar berish tizimi.', accent: '#10b981' },
              { icon: <Building2 size={24} />, title: 'Multi Filiallar', desc: 'Har bir filial to\'liq izolyatsiyada. Bosh ofisdan barcha filiallarni bir joydan nazorat qiling.', accent: '#f59e0b' },
              { icon: <Bot size={24} />, title: 'Telegram Bot', desc: 'Xodimlarga vazifalar bot orqali avto-xabar qilinadi. QR kod orqali tezkor davomat belgilash.', accent: '#06b6d4' },
            ].map((f, i) => (
              <FeatureCard key={i} {...f} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── MODULES SHOWCASE ─────────────────────────────────────────────── */}
      <section id="modules" className="py-24 md:py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 md:px-8 space-y-28">

          {/* Row 1 — Finance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              variants={fadeLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
            >
              <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-bold px-3 py-1.5 rounded-full mb-5 uppercase tracking-wider">
                <CreditCard size={10} /> Moliya Moduli
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
                Moliyaviy ma'lumotlar —<br />real vaqtda
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-6">
                Kirim-chiqimlarni kuzating, xodimlar oyligini va mijozlar qarzini nazorat qiling.
                Grafik va hisobotlar bir qarashdayoq ko'rinadi.
              </p>
              <ul className="space-y-3">
                {['Kunlik / haftalik / oylik dinamika grafiği', "To'lov turlari bo'yicha taqsimlash", 'Xarajat kategoriyalari tahlili', 'Mijozlar qarzi avtomatik hisoblanadi'].map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-orange-500" strokeWidth={3} />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              variants={fadeRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
            >
              <FinanceMockup />
            </motion.div>
          </div>

          {/* Row 2 — Kanban */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              variants={fadeLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              className="order-2 lg:order-1"
            >
              <KanbanMockup />
            </motion.div>
            <motion.div
              variants={fadeRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              className="order-1 lg:order-2"
            >
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-bold px-3 py-1.5 rounded-full mb-5 uppercase tracking-wider">
                <Layers size={10} /> Kanban Moduli
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
                Buyurtmalar holati —<br />har doim ko'z oldida
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-6">
                Vizual kanban doska — qaysi buyurtma qaysi bosqichda ekanligi bir qarashdayoq ko'rinadi.
                Drag & drop bilan bosqichlar orasida ko'chiring.
              </p>
              <ul className="space-y-3">
                {["Sudrab-tashlash bilan buyurtmalarni ko'chirish", "Muddatlar va javobgar xodim belgilash", "Ko'p filial bo'yicha filtr", "Telegram orqali avtomatik xabar"].map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-blue-500" strokeWidth={3} />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Row 3 — Attendance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              variants={fadeLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
            >
              <div className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-600 text-[10px] font-bold px-3 py-1.5 rounded-full mb-5 uppercase tracking-wider">
                <Users size={10} /> Xodimlar Moduli
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
                Xodimlar va davomat —<br />bitta joyda
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-6">
                QR kod yordamida tezkor davomat belgilash. Oylik maosh hisob-kitobi va KPI tahlili avtomatik ishlaydi.
              </p>
              <ul className="space-y-3">
                {['QR kod orqali tezkor davomat', 'Oylik maosh va bonus hisob-kitobi', 'KPI va samaradorlik tahlili', "Xodimlar uchun Telegram bot xabarlari"].map((b, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center flex-shrink-0">
                      <Check size={11} className="text-purple-500" strokeWidth={3} />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              variants={fadeRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
            >
              <AttendanceMockup />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      {Array.isArray(plans) && plans.length > 0 && (
        <section id="pricing" className="py-24 md:py-32 bg-slate-950 relative overflow-hidden">
          <OrbBg variant="dark" />
          <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8">
            <motion.div
              className="text-center mb-14"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold px-4 py-2 rounded-full mb-5 uppercase tracking-wider">
                <Zap size={12} /> Tariflar
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
                Tariflar va Narxlar
              </motion.h2>
              <motion.p variants={fadeUp} className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
                Biznesingiz hajmiga mos tarifni tanlang
              </motion.p>

              {/* Duration Toggle */}
              <motion.div variants={fadeUp} className="inline-flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
                {[
                  { m: 3, label: '3 Oy' },
                  { m: 6, label: '6 Oy (-10%)' },
                  { m: 12, label: '12 Oy (-25%)' },
                ].map(({ m, label }) => (
                  <button
                    key={m}
                    onClick={() => setDuration(m)}
                    className={`px-4 md:px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      duration === m
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto"
              variants={stagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {plans.map((plan) => {
                const features = parseFeatures(plan.features);
                const price = getPrice(plan);
                const allFeatures = [
                  { ids: ['kanban'], label: 'Kanban (Buyurtmalar)' },
                  { ids: ['finance'], label: 'Moliya (Sof foyda/Zarar)' },
                  { ids: ['inventory', 'warehouse'], label: 'Ombor boshqaruvi' },
                  { ids: ['attendance'], label: 'Ishga davomat (QR)' },
                  { ids: ['reports', 'kpi', 'kpiTracking'], label: 'Hisobotlar & KPI' },
                  { ids: ['customers'], label: 'Mijozlar bazasi (CRM)' },
                  { ids: ['ai_chat'], label: 'AI Copilot' },
                  { ids: ['partners'], label: 'Hamkorlar (Vendor)' },
                  { ids: ['branches', 'multi_branch', 'multiBranch'], label: 'Multi Filiallar' },
                ];
                const modules: string[] = Array.isArray(plan.allowedModules) ? plan.allowedModules : [];
                const isOn = (entry: { ids: string[] }) =>
                  entry.ids.some(id => modules.includes(id) || !!features[id]);
                const sorted = [...allFeatures].sort((a, b) => Number(isOn(b)) - Number(isOn(a)));

                return (
                  <motion.div
                    key={plan.id}
                    variants={fadeUp}
                    className={`pricing-card-pop relative rounded-2xl p-6 flex flex-col ${
                      plan.isPopular
                        ? 'bg-orange-500 text-white shadow-2xl shadow-orange-500/30'
                        : 'bg-slate-900 border border-slate-800 text-white'
                    }`}
                  >
                    {plan.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-orange-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                        ⭐ Eng Ommabop
                      </div>
                    )}

                    <div className="mb-5">
                      <h3 className={`text-lg font-black mb-1 ${plan.isPopular ? 'text-white' : 'text-white'}`}>
                        {plan.displayName}
                      </h3>
                      <p className={`text-sm ${plan.isPopular ? 'text-orange-100' : 'text-slate-400'}`}>
                        {plan.description || 'Boshlash uchun ideal'}
                      </p>
                    </div>

                    <div className="mb-5">
                      <span className={`text-4xl font-black ${plan.isPopular ? 'text-white' : 'text-white'}`}>
                        {price.toLocaleString()}
                      </span>
                      <span className={`text-sm ml-1 ${plan.isPopular ? 'text-orange-200' : 'text-slate-400'}`}>
                        UZS / {duration} oy
                      </span>
                      <div className={`text-xs mt-1 ${plan.isPopular ? 'text-orange-100' : 'text-slate-500'}`}>
                        Xodimlar: {plan.maxEmployees === 0 ? 'Cheksiz' : `Max ${plan.maxEmployees} ta`}
                      </div>
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-6">
                      {sorted.slice(0, 7).map(feat => {
                        const val = isOn(feat);
                        return (
                          <li key={feat.ids[0]} className={`flex items-center gap-2.5 text-sm ${val ? '' : 'opacity-40'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              val
                                ? plan.isPopular ? 'bg-white/20' : 'bg-orange-500/10'
                                : plan.isPopular ? 'bg-white/5' : 'bg-slate-800'
                            }`}>
                              {val
                                ? <Check size={11} className={plan.isPopular ? 'text-white' : 'text-orange-500'} strokeWidth={3} />
                                : <div className="w-2 h-px bg-current opacity-30" />}
                            </div>
                            <span className={val
                              ? plan.isPopular ? 'text-white font-semibold' : 'text-slate-200 font-semibold'
                              : 'text-slate-500 line-through text-xs'}
                            >
                              {feat.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    <motion.button
                      onClick={() => scrollTo('contact')}
                      className={`w-full h-11 rounded-xl font-bold text-sm transition-all ${
                        plan.isPopular
                          ? 'bg-white text-orange-500 hover:bg-orange-50'
                          : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      Boshlash →
                    </motion.button>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>
      )}

      {/* ── TRUST STRIP (logos) ───────────────────────────────────────────── */}
      {clientLogos.length > 0 && (
        <section className="py-16 bg-white border-y border-slate-100 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 md:px-8 text-center mb-10">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Bizga ishongan bosmaxonalar</p>
          </div>
          <div className="relative overflow-hidden">
            <div className="logo-track flex w-max">
              {[...clientLogos, ...clientLogos].map((src, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-32 h-16 mx-5 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 px-4"
                >
                  <img src={src} alt="" className="max-w-full max-h-full object-contain opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section id="contact" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
        <OrbBg variant="light" />
        <div className="relative z-10 max-w-6xl mx-auto px-5 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">

            {/* Left */}
            <motion.div
              variants={fadeLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-wider">
                <Send size={12} /> Demo So'rov
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-5 leading-tight">
                Batafsil ma'lumot<br />
                <span className="text-orange-500">olish uchun</span>
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                PrintFlow qanday ishlashini amalda ko'rish uchun hoziroq so'rov qoldiring. 24 soat ichida bog'lanamiz.
              </p>

              <div className="space-y-4">
                {[
                  { icon: <Check size={16} />, text: '7 Kunlik bepul sinov muddati' },
                  { icon: <Check size={16} />, text: 'Biznesingizga moslashtirish bepul' },
                  { icon: <Check size={16} />, text: "Xodimlarni o'qitish va qo'llab-quvvatlash" },
                  { icon: <ShieldCheck size={16} />, text: "Ma'lumotlar xavfsizligi kafolati" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-orange-500 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    {item.text}
                  </div>
                ))}
              </div>

            </motion.div>

            {/* Right — Form */}
            <motion.div
              variants={fadeRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 rounded-t-3xl" />

                <AnimatePresence mode="wait">
                  {formStatus === 'success' ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8"
                    >
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={28} className="text-emerald-600" strokeWidth={3} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2">So'rov Qabul Qilindi!</h3>
                      <p className="text-slate-500 text-sm mb-6">Tez orada siz bilan bog'lanamiz.</p>
                      <button onClick={() => setFormStatus('idle')} className="h-11 px-6 bg-orange-500 text-white font-bold rounded-xl text-sm hover:bg-orange-600 transition-all">
                        Yangi So'rov
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form key="form" onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 mb-1">Demo So'rov Qoldiring</h3>
                        <p className="text-sm text-slate-400">Barcha maydonlarni to'ldiring</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Ism', key: 'firstName', placeholder: 'Sardor' },
                          { label: 'Familiya', key: 'lastName', placeholder: 'Karimov' },
                        ].map(field => (
                          <div key={field.key}>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{field.label}</label>
                            <input
                              required
                              value={(formData as any)[field.key]}
                              onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                              placeholder={field.placeholder}
                              className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Kompaniya Nomi</label>
                        <input
                          required
                          value={formData.companyName}
                          onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="Ideal Print MChJ"
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Rolingiz</label>
                        <select
                          required
                          value={formData.role}
                          onChange={e => setFormData({ ...formData, role: e.target.value })}
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all appearance-none"
                        >
                          <option value="">Tanlang...</option>
                          <option value="Rahbar">Rahbar</option>
                          <option value="Menejer">Menejer</option>
                          <option value="Texnolog">Texnolog</option>
                          <option value="Boshqa">Boshqa</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Telefon</label>
                          <input
                            required
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+998 90 123 45 67"
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Telegram</label>
                          <input
                            value={formData.telegramUser}
                            onChange={e => setFormData({ ...formData, telegramUser: e.target.value })}
                            placeholder="@username"
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 transition-all"
                          />
                        </div>
                      </div>

                      {formStatus === 'error' && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm font-semibold rounded-xl px-4 py-3">
                          Xatolik yuz berdi. Qayta urinib ko'ring.
                        </div>
                      )}

                      <motion.button
                        type="submit"
                        disabled={formStatus === 'loading'}
                        className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        {formStatus === 'loading' ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Yuborilmoqda...</>
                        ) : (
                          <>So'rovni Yuborish <Send size={16} /></>
                        )}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-12 md:py-16 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-5 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <a href="/" className="flex items-center gap-2.5 mb-3">
                <img src={logo} alt="PrintFlow" className="h-7 w-auto" />
                <span className="text-base font-black text-white">
                  Print<span className="text-orange-500">Flow</span>
                </span>
              </a>
              <p className="text-sm text-slate-500 max-w-xs">
                O'zbekiston bosmaxonalari uchun maxsus yaratilgan B2B SaaS platform.
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              {navLinks.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <button onClick={onLoginClick} className="text-sm font-semibold text-orange-500 hover:text-orange-400 transition-colors">
                Tizimga Kirish
              </button>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-600">
              © {new Date().getFullYear()} PrintFlow. Barcha huquqlar himoyalangan.
            </p>
            <p className="text-xs text-slate-700 font-medium">
              O'zbekistonda ishlab chiqilgan 🇺🇿
            </p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center pb-safe">
        {[
          { id: 'features', icon: <Layers size={18} />, label: 'Xususiyat' },
          { id: 'pricing', icon: <Zap size={18} />, label: 'Narxlar' },
          { id: 'contact', icon: <Send size={18} />, label: 'Aloqa' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            className="flex-1 flex flex-col items-center py-3 gap-1 text-slate-400 hover:text-orange-500 transition-colors"
          >
            {item.icon}
            <span className="text-[9px] font-bold uppercase tracking-wide">{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default Landing;
