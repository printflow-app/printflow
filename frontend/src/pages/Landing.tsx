import React, { useState, useEffect } from 'react';
import { ArrowRight, Layers, Users, Zap, ShieldCheck, Check, Send, PlayCircle } from 'lucide-react';
import logo from '../assets/logo.png';

const rawApiUrl = (import.meta as any).env.VITE_API_URL || 'https://printflow-production-bb78.up.railway.app';
const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api';

function Landing({ onLoginClick }: { onLoginClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [duration, setDuration] = useState(3);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', companyName: '', role: '', phone: '', telegramUser: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/plans`).then(r => r.json()).then(setPlans).catch(() => { });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormStatus('loading');
    try {
      const response = await fetch(`${API_URL}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      setFormStatus(response.ok ? 'success' : 'error');
    } catch { setFormStatus('error'); }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const getPrice = (plan: any) => duration === 3 ? plan.price3m : duration === 6 ? plan.price6m : plan.price12m;
  const parseFeatures = (str: string) => { try { return JSON.parse(str); } catch { return {}; } };

  return (
    <>
      {/* Header */}
      <header className="header" style={{ background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent', borderBottomColor: scrolled ? 'var(--border)' : 'transparent' }}>
        <div className="container header-container">
          <a href="/" className="logo">
            <img src={logo} alt="PrintFlow" style={{ height: 36, width: 'auto' }} className="md:h-12" />
            <span style={{ fontSize: '1.4rem' }}>Print<span>Flow</span></span>
          </a>
          <nav className="nav hidden md:flex">
            <a href="#features" onClick={e => { e.preventDefault(); scrollTo('features'); }}>Imkoniyatlar</a>
            <a href="#pricing" onClick={e => { e.preventDefault(); scrollTo('pricing'); }}>Narxlar</a>
            <a href="#contact" onClick={e => { e.preventDefault(); scrollTo('contact'); }}>Aloqa</a>
          </nav>
          <div className="flex gap-2 sm:gap-4">
            <a href="#" onClick={e => { e.preventDefault(); onLoginClick(); }} className="btn btn-outline btn-sm">Kirish</a>
            <a href="#contact" onClick={e => { e.preventDefault(); scrollTo('contact'); }} className="btn btn-sm">Demo</a>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <div className="bottom-nav md:hidden">
        <a href="#features" onClick={e => { e.preventDefault(); scrollTo('features'); }} className="bottom-nav-item">
          <Layers />
          <span>Xususiyat</span>
        </a>
        <a href="#pricing" onClick={e => { e.preventDefault(); scrollTo('pricing'); }} className="bottom-nav-item">
          <Zap />
          <span>Narxlar</span>
        </a>
        <a href="#contact" onClick={e => { e.preventDefault(); scrollTo('contact'); }} className="bottom-nav-item">
          <Send />
          <span>Aloqa</span>
        </a>
      </div>

      {/* Hero with Grid Background */}
      <section className="hero" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,107,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(255,107,0,0.12) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
          <div className="hero-content">
            <div className="hero-badge"><div className="pulse"></div>7 Kunlik Bepul Sinov Muddati</div>
            <h1>Bosmaxonangizni<br /><span>To'liq Nazorat Qiling</span></h1>
            <p>O'zbekiston bosmaxonalari uchun maxsus yaratilgan B2B SaaS platformasi. Buyurtmalar, moliya, ombor va xodimlar boshqaruvini bitta qulay tizimda birlashtiring.</p>
            <div className="cta-group">
              <a href="#contact" onClick={e => { e.preventDefault(); scrollTo('contact'); }} className="btn" style={{ padding: '20px 40px', fontSize: '1.1rem' }}>Bepul Boshlash <ArrowRight size={20} /></a>
              <a href="#pricing" onClick={e => { e.preventDefault(); scrollTo('pricing'); }} className="btn btn-outline" style={{ padding: '20px 40px', fontSize: '1.1rem' }}><PlayCircle size={20} /> Narxlarni Ko'rish</a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Biznesingizni To'liq Raqamlashtiring</h2>
            <p className="section-subtitle">Qog'ozbozlik va Excel jadvallardan voz keching. Biznesingizni avtomatlashtiring.</p>
          </div>
          <div className="features-grid">
            {[
              { icon: <Layers size={36} />, title: 'Buyurtmalar (Kanban)', desc: 'Buyurtmalarni vizual ustunlarda boshqaring. Muddatlar va javobgarlikni belgilang.' },
              { icon: <Zap size={36} />, title: 'Avto Narxlash', desc: "Qog'oz turi, ranglar va qo'shimcha ishlov berish ustamalarini avtomatik hisoblovchi engine." },
              { icon: <ShieldCheck size={36} />, title: 'Kassa va Moliya', desc: "Naqd, Click, Uzcard tushumlari. Xodimlar oyligi va mijozlar qarzdorligi nazoratda." },
              { icon: <Users size={36} />, title: 'Telegram Bot', desc: "Xodimlarga vazifalar bot orqali avto-xabar qilinadi. QR kod yordamida tezkor davomat." },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon-wrapper">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic Pricing Section */}
      {plans.length > 0 && (
        <section id="pricing" style={{ padding: '120px 0', background: '#fafafa', position: 'relative' }}>
          {/* Subtle grid for pricing section too */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,107,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none', zIndex: 0 }} />
          <div className="container" style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#0f172a', marginBottom: 16 }}>Tariflar va Narxlar</h2>
              <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: 500, margin: '0 auto 32px' }}>Sizning biznesingiz hajmiga mos ta'rifni tanlang</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {[3, 6, 12].map(m => (
                  <button key={m} onClick={() => setDuration(m)} style={{
                    padding: '10px 24px', fontSize: '0.85rem', fontWeight: 800, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    background: duration === m ? '#0f172a' : '#fff', color: duration === m ? '#fff' : '#475569', boxShadow: duration !== m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}>{m} Oy {m === 6 ? '(-10%)' : m === 12 ? '(-25%)' : ''}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 960, margin: '0 auto' }}>
              {plans.map(plan => {
                const features = parseFeatures(plan.features);
                const price = getPrice(plan);
                return (
                  <div key={plan.id} style={{
                    background: '#fff',
                    border: plan.isPopular ? '2px solid #FF6B00' : '1px solid #e2e8f0',
                    boxShadow: plan.isPopular ? '0 20px 25px -5px rgba(255,107,0,0.1), 0 10px 10px -5px rgba(255,107,0,0.04)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                    borderRadius: 16, padding: 32, position: 'relative', transition: 'transform 0.3s',
                  }}>
                    {plan.isPopular && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#FF6B00', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '4px 16px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 1 }}>🔥 Eng ommabop</div>}
                    <h3 style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>{plan.displayName}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 20 }}>{plan.description}</p>
                    <div style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 900, marginBottom: 4 }}>{price.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>UZS</span></div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 20 }}>{duration} oylik / Xodimlar: {plan.maxEmployees === 0 ? 'Cheksiz' : plan.maxEmployees}</div>
                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24, flex: 1 }}>
                      {(() => {
                        const allFeatures = [
                          { id: 'kanban', label: 'Kanban (Buyurtmalar)' },
                          { id: 'warehouse', label: 'Ombor boshqaruvi' },
                          { id: 'telegram_bot', label: 'Telegram Bot (Xabarlar)' },
                          { id: 'attendance', label: 'Ishga davomat (QR)' },
                          { id: 'finance', label: 'Moliya (Sof foyda/Zarar)' },
                          { id: 'tasks', label: 'Task Management' },
                          { id: 'kpi', label: 'Xodimlar KPI tahlili' },
                          { id: 'debtors', label: 'Qarzdorlarga avto-xabar' },
                          { id: 'multi_branch', label: 'Multi Filiallar (Tez kunda)' }
                        ];

                        // Sort: active features first
                        const sortedFeatures = [...allFeatures].sort((a, b) => {
                          const valA = features[a.id] ? 1 : 0;
                          const valB = features[b.id] ? 1 : 0;
                          return valB - valA;
                        });

                        return sortedFeatures.map(feat => {
                          const val = features[feat.id];
                          return (
                            <li key={feat.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: '0.85rem',
                              color: val ? '#1e293b' : '#94a3b8',
                              fontWeight: val ? 600 : 400
                            }}>
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: val ? 'rgba(255,107,0,0.1)' : 'rgba(226,232,240,0.5)'
                              }}>
                                {val ? <Check size={12} color="#FF6B00" strokeWidth={3} /> : <div style={{ width: 4, height: 1, background: '#cbd5e1' }} />}
                              </div>
                              <span style={{ textDecoration: val ? 'none' : 'line-through', opacity: val ? 1 : 0.6 }}>{feat.label}</span>
                            </li>
                          );
                        });
                      })()}
                    </ul>
                    <a href="#contact" onClick={e => { e.preventDefault(); scrollTo('contact'); }} style={{
                      display: 'block', textAlign: 'center', padding: '16px 0', borderRadius: 12, fontWeight: 900, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 1, textDecoration: 'none', transition: 'all 0.3s',
                      background: plan.isPopular ? '#FF6B00' : '#0f172a', color: '#fff', border: 'none',
                      boxShadow: plan.isPopular ? '0 10px 15px -3px rgba(255,107,0,0.3)' : 'none'
                    }}>Boshlash →</a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Contact Form */}
      <section className="contact-section" id="contact">
        <div className="container">
          <div className="contact-container">
            <div className="contact-info">
              <h2>Tizimni<br /><span style={{ color: 'var(--primary)' }}>Sinab Ko'ring</span></h2>
              <p>PrintFlow qanday ishlashini amalda ko'rish uchun hoziroq so'rov qoldiring.</p>
              <ul className="benefits-list">
                <li><Check size={20} /> <span>7 Kunlik bepul sinov muddati</span></li>
                <li><Check size={20} /> <span>Biznesingizga moslashtirish bepul</span></li>
                <li><Check size={20} /> <span>Xodimlarni o'qitish va qo'llab-quvvatlash</span></li>
                <li><Check size={20} /> <span>Ma'lumotlar xavfsizligi kafolati</span></li>
              </ul>
            </div>
            <div className="contact-form-wrapper">
              {formStatus === 'success' ? (
                <div className="success-message"><div className="success-icon"><Check size={40} strokeWidth={3} /></div><h3>So'rov qabul qilindi!</h3><p>Tez orada siz bilan bog'lanamiz.</p><button className="btn mt-6" onClick={() => setFormStatus('idle')}>Yangi so'rov</button></div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group"><label>Ism</label><input type="text" required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} placeholder="Sardor" /></div>
                    <div className="form-group"><label>Familiya</label><input type="text" required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} placeholder="Karimov" /></div>
                  </div>
                  <div className="form-group"><label>Kompaniya Nomi</label><input type="text" required value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} placeholder="Ideal Print MChJ" /></div>
                  <div className="form-group"><label>Rolingiz</label>
                    <select required value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                      <option value="">Tanlang...</option><option value="Rahbar">Rahbar</option><option value="Menejer">Menejer</option><option value="Texnolog">Texnolog</option><option value="Boshqa">Boshqa</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label>Telefon</label><input type="tel" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+998 90 123 45 67" /></div>
                    <div className="form-group"><label>Telegram (ixtiyoriy)</label><input type="text" value={formData.telegramUser} onChange={e => setFormData({ ...formData, telegramUser: e.target.value })} placeholder="@username" /></div>
                  </div>
                  {formStatus === 'error' && <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, marginBottom: 16 }}>Xatolik. Qayta urinib ko'ring.</div>}
                  <button type="submit" className="btn form-submit" disabled={formStatus === 'loading'}>{formStatus === 'loading' ? 'YUBORILMOQDA...' : "SO'ROVNI YUBORISH"} <Send size={18} /></button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <a href="/" className="footer-logo">
              <img src={logo} alt="PF" style={{ height: 32, width: 'auto' }} />
              <span>Print<span>Flow</span></span>
            </a>
            <div className="footer-links">
              <a href="#features">Imkoniyatlar</a><a href="#pricing">Narxlar</a><a href="#contact">Aloqa</a>
              <a href="#" onClick={e => { e.preventDefault(); onLoginClick(); }}>Tizimga Kirish</a>
            </div>
            <p className="footer-copy">© {new Date().getFullYear()} PrintFlow. Barcha huquqlar himoyalangan.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Landing;
