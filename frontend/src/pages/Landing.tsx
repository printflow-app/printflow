import React, { useState, useEffect } from 'react';
import { ArrowRight, Layers, Users, Zap, ShieldCheck, Check, Send, PlayCircle } from 'lucide-react';
import logo from '../assets/logo.png';

const rawApiUrl = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
const API_URL = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api') : '/api';

function Landing({ onLoginClick }: { onLoginClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [duration, setDuration] = useState(3);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', companyName: '', role: '', phone: '', telegramUser: '' });
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [clientLogos, setClientLogos] = useState<string[]>([]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
      try {
        const res = await fetch(`${API_URL}/plans`, { credentials: 'omit', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Backend may return either an array OR an error object with { statusCode, message }.
        // Guard to prevent ".map is not a function" crash on non-array payloads.
        const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
        if (!cancelled) setPlans(list);
      } catch (err) {
        console.error('[Landing] Failed to load plans:', err);
        if (!cancelled) setPlans([]);
      }
    };
    loadPlans();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/settings/public/CLIENT_LOGOS`, { credentials: 'omit', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (Array.isArray(data)) setClientLogos(data); })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormStatus('loading');
    try {
      const response = await fetch(`${API_URL}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      setFormStatus(response.ok ? 'success' : 'error');
    } catch { setFormStatus('error'); }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const getPrice = (plan: any) => {
    const v = duration === 3 ? plan?.price3m : duration === 6 ? plan?.price6m : plan?.price12m;
    return typeof v === 'number' ? v : 0;
  };
  const parseFeatures = (input: any): Record<string, any> => {
    if (input && typeof input === 'object') return input as Record<string, any>;
    if (typeof input !== 'string') return {};
    try { const parsed = JSON.parse(input); return (parsed && typeof parsed === 'object') ? parsed : {}; }
    catch { return {}; }
  };

  return (
    <>
      <style>{`@keyframes logoScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.logo-slide-track{animation:logoScroll 22s linear infinite}.logo-slide-track:hover{animation-play-state:paused}`}</style>

      {/* Header */}
      <header className="header" style={{ background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent', borderBottomColor: scrolled ? 'var(--border)' : 'transparent' }}>
        <div className="container header-container">
          <a href="/" className="logo">
            <img src={logo} alt="PrintFlow" style={{ height: 36, width: 'auto' }} className="md:h-12" />
            <span style={{ fontSize: '1.4rem', color: '#0f172a' }}>Print<span style={{ color: '#FF6B00' }}>Flow</span></span>
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
        <div className="pf-animated-grid" style={{ position: 'absolute' }} />
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

      {/* Feature Showcase */}
      <section style={{ padding: '100px 0', background: 'linear-gradient(180deg,#fff 0%,#fafafa 100%)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)', borderRadius: 100, padding: '6px 16px', marginBottom: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF6B00' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#FF6B00', textTransform: 'uppercase', letterSpacing: 2 }}>Platform Imkoniyatlari</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 900, color: '#0f172a', marginBottom: 16, lineHeight: 1.2 }}>Biznesingizni To'liq Nazorat Qiling</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: 560, margin: '0 auto' }}>Moliyaviy ma'lumotlar, buyurtmalar holati, mijozlar bazasi va xodimlar davomati – barchasi bitta tizimda.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))', gap: 28 }}>

            {/* Finance */}
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#fff5ed 0%,#fff 100%)', padding: 24, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '9px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {['#fca5a5','#fcd34d','#86efac'].map((c,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
                    <div style={{ flex: 1, height: 18, background: '#e2e8f0', borderRadius: 5, marginLeft: 8 }} />
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {[{l:'Kirim',v:'12.4M',c:'#10b981'},{l:'Chiqim',v:'4.2M',c:'#ef4444'},{l:'Balans',v:'8.2M',c:'#FF6B00'}].map((s,i) => (
                        <div key={i} style={{ flex: 1, background: s.c+'18', borderRadius: 10, padding: '8px 10px' }}>
                          <div style={{ color: s.c, fontWeight: 900, fontSize: 12 }}>{s.v}M</div>
                          <div style={{ color: '#94a3b8', fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <svg width="100%" height="68" viewBox="0 0 320 68" style={{ display: 'block' }}>
                      <defs>
                        <linearGradient id="fg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B00" stopOpacity="0.28"/><stop offset="100%" stopColor="#FF6B00" stopOpacity="0"/></linearGradient>
                      </defs>
                      <path d="M0,52 C40,46 60,18 100,33 S160,8 200,23 S260,42 320,14" stroke="#FF6B00" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                      <path d="M0,52 C40,46 60,18 100,33 S160,8 200,23 S260,42 320,14 L320,68 L0,68Z" fill="url(#fg1)"/>
                      <path d="M0,60 C40,56 70,46 100,52 S170,44 200,48 S270,53 320,42" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeDasharray="5,3"/>
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      {['Apr 1','Apr 10','Apr 20','May 1'].map(d => <span key={d} style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700 }}>{d}</span>)}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 26px 26px' }}>
                <div style={{ display: 'inline-block', background: '#fff5ed', color: '#FF6B00', fontSize: '0.63rem', fontWeight: 900, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Moliya Moduli</div>
                <h3 style={{ color: '#0f172a', fontSize: '1.15rem', fontWeight: 900, marginBottom: 8, lineHeight: 1.3 }}>Moliyaviy ma'lumotlar – real vaqtda</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 14 }}>Kirim-chiqimlarni kuzating, xodimlar oyligini va mijozlar qarzini nazorat qiling.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {["Kunlik/haftalik/oylik dinamika grafiği","To'lov turlari bo'yicha taqsimlash","Xarajat kategoriyalari tahlili"].map((b,i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, color: '#475569', fontSize: '0.81rem', fontWeight: 600 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,107,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5,4 L3.5,6 L6.5,2" stroke="#FF6B00" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>{b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Kanban */}
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#eff6ff 0%,#fff 100%)', padding: 24, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '9px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {['#fca5a5','#fcd34d','#86efac'].map((c,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
                    <div style={{ flex: 1, height: 18, background: '#e2e8f0', borderRadius: 5, marginLeft: 8 }} />
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        {title:'Yangi',color:'#64748b',cards:['A4 Bosma x500','Vizitka']},
                        {title:'Jarayonda',color:'#FF6B00',cards:['Banner 3×6m','Katalog','Sticker']},
                        {title:'Tayyor',color:'#10b981',cards:['Papka x100','Jurnal']},
                      ].map((col,ci) => (
                        <div key={ci} style={{ flex: 1, background: col.color+'0f', borderRadius: 10, padding: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                            <span style={{ fontSize: 7, fontWeight: 900, color: col.color, textTransform: 'uppercase' }}>{col.title}</span>
                            <span style={{ background: col.color, color: '#fff', borderRadius: '50%', width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 900 }}>{col.cards.length}</span>
                          </div>
                          {col.cards.map((card,i) => (
                            <div key={i} style={{ background: '#fff', borderRadius: 7, padding: '6px 7px', marginBottom: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderLeft: `2px solid ${col.color}` }}>
                              <div style={{ fontSize: 7, fontWeight: 800, color: '#334155' }}>{card}</div>
                              <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 4, width: `${50+i*18}%` }}/>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 26px 26px' }}>
                <div style={{ display: 'inline-block', background: '#eff6ff', color: '#3b82f6', fontSize: '0.63rem', fontWeight: 900, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Kanban Moduli</div>
                <h3 style={{ color: '#0f172a', fontSize: '1.15rem', fontWeight: 900, marginBottom: 8, lineHeight: 1.3 }}>Buyurtmalar holati – har doim ko'z oldida</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 14 }}>Vizual kanban doska — qaysi buyurtma qaysi bosqichda ekanligi bir qarashdayoq ko'rinadi.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {["Sudrab-tashlash bilan buyurtmalarni ko'chirish","Muddatlar va javobgar xodim belgilash","Ko'p filial bo'yicha filtr"].map((b,i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, color: '#475569', fontSize: '0.81rem', fontWeight: 600 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5,4 L3.5,6 L6.5,2" stroke="#3b82f6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>{b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Customers */}
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#f0fdf4 0%,#fff 100%)', padding: 24, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '9px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {['#fca5a5','#fcd34d','#86efac'].map((c,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
                    <div style={{ flex: 1, height: 18, background: '#e2e8f0', borderRadius: 5, marginLeft: 8 }} />
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #94a3b8' }}/>
                      <div style={{ height: 7, background: '#e2e8f0', borderRadius: 4, width: 80 }}/>
                    </div>
                    {[
                      {name:'Ideal Print',phone:'+998 90 123...',amount:'1.2M',debt:false,c:'#3b82f6'},
                      {name:'ArtStyle Studio',phone:'+998 91 456...',amount:'2.1M',debt:true,c:'#f59e0b'},
                      {name:'Nova Design',phone:'+998 97 789...',amount:'650K',debt:false,c:'#10b981'},
                      {name:'Toshkent Reklama',phone:'+998 93 234...',amount:'850K',debt:false,c:'#8b5cf6'},
                    ].map((c,i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.c+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: c.c, flexShrink: 0 }}>{c.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 800, color: '#1e293b' }}>{c.name}</div>
                          <div style={{ fontSize: 7, color: '#94a3b8' }}>{c.phone}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 900, color: '#1e293b' }}>{c.amount}</div>
                          <div style={{ fontSize: 7, fontWeight: 700, color: c.debt ? '#ef4444' : '#10b981' }}>{c.debt ? '⚠ Qarzdor' : '✓ Toza'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 26px 26px' }}>
                <div style={{ display: 'inline-block', background: '#f0fdf4', color: '#16a34a', fontSize: '0.63rem', fontWeight: 900, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Mijozlar Moduli</div>
                <h3 style={{ color: '#0f172a', fontSize: '1.15rem', fontWeight: 900, marginBottom: 8, lineHeight: 1.3 }}>Mijozlar bazasi – qarz va to'lovlar nazorati</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 14 }}>Har bir mijozning to'liq tarixi, qarzi va buyurtmalari bitta ekranda.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {["Qarzdorlarga avtomatik Telegram xabar","Har bir mijoz bo'yicha alohida hisobot","Buyurtmalar tarixini ko'rish"].map((b,i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, color: '#475569', fontSize: '0.81rem', fontWeight: 600 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5,4 L3.5,6 L6.5,2" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>{b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Employees */}
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #f1f5f9', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg,#f5f3ff 0%,#fff 100%)', padding: 24, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ background: '#f1f5f9', padding: '9px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {['#fca5a5','#fcd34d','#86efac'].map((c,i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
                    <div style={{ flex: 1, height: 18, background: '#e2e8f0', borderRadius: 5, marginLeft: 8 }} />
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      {[{l:'Jami',v:'8',c:'#8b5cf6'},{l:'Keldi',v:'7',c:'#10b981'},{l:'Kelmadi',v:'1',c:'#ef4444'}].map((s,i) => (
                        <div key={i} style={{ flex: 1, background: s.c+'15', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ color: s.c, fontWeight: 900, fontSize: 14 }}>{s.v}</div>
                          <div style={{ color: '#94a3b8', fontSize: 7, fontWeight: 700, textTransform: 'uppercase' }}>{s.l}</div>
                        </div>
                      ))}
                    </div>
                    {[
                      {name:'Sardor K.',days:[1,1,1,1,1,0,1,1,1,1]},
                      {name:'Malika T.',days:[1,1,0,1,1,1,1,1,1,1]},
                      {name:'Jahongir A.',days:[1,1,1,1,0,1,0,1,1,1]},
                    ].map((emp,i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: `hsl(${i*60+230},70%,92%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: `hsl(${i*60+230},60%,40%)`, flexShrink: 0 }}>{emp.name[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 8, fontWeight: 800, color: '#1e293b', marginBottom: 3 }}>{emp.name}</div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {emp.days.map((d,di) => <div key={di} style={{ width: 8, height: 8, borderRadius: 2, background: d ? '#10b981' : '#fca5a5' }}/>)}
                          </div>
                        </div>
                        <span style={{ fontSize: 8, fontWeight: 900, color: '#10b981' }}>{emp.days.filter(Boolean).length}/10</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ padding: '22px 26px 26px' }}>
                <div style={{ display: 'inline-block', background: '#f5f3ff', color: '#7c3aed', fontSize: '0.63rem', fontWeight: 900, padding: '4px 12px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Xodimlar Moduli</div>
                <h3 style={{ color: '#0f172a', fontSize: '1.15rem', fontWeight: 900, marginBottom: 8, lineHeight: 1.3 }}>Xodimlar va davomat – bir joyda nazorat</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: 14 }}>QR kod yordamida davomat, oylik hisob-kitob va KPI tahlili avtomatik ishlaydi.</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {['QR kod orqali tezkor davomat belgilash','Oylik maosh va bonus hisob-kitobi','KPI va samaradorlik tahlili'].map((b,i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, color: '#475569', fontSize: '0.81rem', fontWeight: 600 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5,4 L3.5,6 L6.5,2" stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>{b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Dynamic Pricing Section */}
      {Array.isArray(plans) && plans.length > 0 && (
        <section id="pricing" style={{ padding: '120px 0', background: '#fafafa', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle grid for pricing section too */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,107,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,0,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none', zIndex: 0 }} />
          <div className="container" style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, color: '#0f172a', marginBottom: 16 }}>Tariflar va Narxlar</h2>
              <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: 500, margin: '0 auto 32px' }}>Sizning biznesingiz hajmiga mos ta'rifni tanlang</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', background: '#f1f5f9', padding: 6, borderRadius: 12, maxWidth: '100%', overflowX: 'auto' }}>
                {[3, 6, 12].map(m => (
                  <button key={m} onClick={() => setDuration(m)} className="flex-1 sm:flex-none" style={{
                    padding: '10px 16px', fontSize: '0.8rem', fontWeight: 800, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                    background: duration === m ? '#FF6B00' : '#fff', color: duration === m ? '#fff' : '#475569', boxShadow: duration !== m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}>{m} Oy {m === 6 ? '(-10%)' : m === 12 ? '(-25%)' : ''}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 24, maxWidth: 960, margin: '0 auto' }}>
              {plans.map(plan => {
                const features = parseFeatures(plan.features);
                const price = getPrice(plan);
                return (
                  <div key={plan.id} style={{
                    background: '#fff',
                    border: plan.isPopular ? '2px solid #FF6B00' : '1px solid #f1f5f9',
                    boxShadow: plan.isPopular ? '0 20px 25px -5px rgba(255,107,0,0.15), 0 10px 10px -5px rgba(255,107,0,0.06)' : '0 2px 12px rgba(0,0,0,0.06)',
                    borderRadius: 16, padding: 32, position: 'relative', transition: 'transform 0.3s',
                  }}>
                    {plan.isPopular && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#FF6B00', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '4px 16px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 1 }}>🔥 Eng ommabop</div>}
                    <h3 style={{ color: '#0f172a', fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>{plan.displayName}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 20 }}>{plan.description}</p>
                    <div style={{ color: '#0f172a', fontSize: '2rem', fontWeight: 900, marginBottom: 4 }}>{price.toLocaleString()} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>UZS</span></div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 20 }}>{duration} oylik / Xodimlar: {plan.maxEmployees === 0 ? 'Cheksiz' : plan.maxEmployees}</div>
                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24, flex: 1 }}>
                      {(() => {
                        // Same feature list as in-app Billing.tsx — keeps landing/in-app pricing in sync.
                        // IDs match the ALLOWED_MODULES keys in admin/src/App.tsx.
                        const modules: string[] = Array.isArray(plan.allowedModules) ? plan.allowedModules : [];
                        const allFeatures: Array<{ ids: string[]; label: string }> = [
                          { ids: ['kanban'], label: 'Kanban (Buyurtmalar)' },
                          { ids: ['finance'], label: 'Moliya (Sof foyda/Zarar)' },
                          { ids: ['inventory', 'warehouse'], label: 'Ombor boshqaruvi' },
                          { ids: ['attendance'], label: 'Ishga davomat (QR)' },
                          { ids: ['reports', 'kpi', 'kpiTracking'], label: 'Hisobotlar & KPI' },
                          { ids: ['customers'], label: 'Mijozlar bazasi (CRM)' },
                          { ids: ['ai_chat'], label: 'AI Copilot' },
                          { ids: ['partners'], label: 'Hamkorlar (Vendor)' },
                          { ids: ['branches', 'multi_branch', 'multiBranch'], label: 'Multi Filiallar' },
                          { ids: ['statistics'], label: 'Statistika & Grafiklar' },
                        ];

                        const isOn = (entry: { ids: string[] }) =>
                          entry.ids.some(id => modules.includes(id) || !!features[id]);

                        // Sort: active features first
                        const sortedFeatures = [...allFeatures].sort((a, b) => Number(isOn(b)) - Number(isOn(a)));

                        return sortedFeatures.map(feat => {
                          const val = isOn(feat);
                          return (
                            <li key={feat.ids[0]} style={{
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
                      background: plan.isPopular ? '#FF6B00' : '#f97316', color: '#fff', border: 'none',
                      boxShadow: plan.isPopular ? '0 10px 15px -3px rgba(255,107,0,0.35)' : '0 4px 12px rgba(249,115,22,0.25)'
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

      {/* Client Logos Slider */}
      {clientLogos.length > 0 && (
        <section style={{ padding: '64px 0', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div className="container" style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 10 }}>Bizga ishonch bildirganlar</p>
            <h3 style={{ color: '#0f172a', fontSize: 'clamp(1.2rem,2.5vw,1.6rem)', fontWeight: 900 }}>O'zbekistonning yetakchi bosmaxonalari bilan ishlaymiz</h3>
          </div>
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="logo-slide-track" style={{ display: 'flex', width: 'max-content' }}>
              {[...clientLogos, ...clientLogos].map((src, i) => (
                <div key={i} style={{ flexShrink: 0, width: 160, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 20px', padding: '12px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'grayscale(30%)' }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="footer pb-24 md:pb-10">
        <div className="container">
          <div className="footer-content">
            <a href="/" className="footer-logo">
              <img src={logo} alt="PF" style={{ height: 32, width: 'auto' }} />
              <span style={{ color: '#0f172a' }}>Print<span style={{ color: '#FF6B00' }}>Flow</span></span>
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
