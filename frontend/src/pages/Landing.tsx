import React, { useState, useEffect } from 'react';
import { Printer, ArrowRight, Layers, Users, Zap, ShieldCheck, Check, Phone, Mail, Send, PlayCircle, BarChart3, Clock, Lock } from 'lucide-react';

function Landing({ onLoginClick }: { onLoginClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    role: '',
    phone: '',
    telegramUser: ''
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('loading');
    try {
      const response = await fetch('http://localhost:4000/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setFormStatus('success');
      } else {
        setFormStatus('error');
      }
    } catch (err) {
      setFormStatus('error');
    }
  };

  const handleDemoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div className="bg-glow">
        <div className="glow-orb-1"></div>
        <div className="glow-orb-2"></div>
      </div>

      {/* Header */}
      <header className="header" style={{ background: scrolled ? 'rgba(255, 255, 255, 0.9)' : 'transparent', borderBottomColor: scrolled ? 'var(--border)' : 'transparent' }}>
        <div className="container header-container">
          <a href="/" className="logo">
            <Printer size={28} color="var(--primary)" />
            Print<span>Flow</span>
          </a>
          <nav className="nav hidden md:flex">
            <a href="#features">Imkoniyatlar</a>
            <a href="#benefits">Afzalliklar</a>
            <a href="#contact">Aloqa</a>
          </nav>
          <div className="flex gap-4">
            <a href="#" onClick={(e) => { e.preventDefault(); onLoginClick(); }} className="btn btn-outline btn-sm hidden sm:inline-flex">
              Tizimga Kirish
            </a>
            <a href="#contact" onClick={handleDemoClick} className="btn btn-sm">
              Demo So'rash
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <div className="pulse"></div>
              Yangi v2.0 Versiya Ishga Tushdi
            </div>
            <h1>Bosmaxonangizni<br/><span>To'liq Nazorat Qiling</span></h1>
            <p>
              O'zbekiston bosmaxonalari uchun maxsus yaratilgan B2B SaaS platformasi. 
              Buyurtmalar, moliya, ombor va xodimlar boshqaruvini bitta qulay va zamonaviy tizimda birlashtiring.
            </p>
            <div className="cta-group">
              <a href="#contact" onClick={handleDemoClick} className="btn" style={{ padding: '20px 40px', fontSize: '1.1rem' }}>
                Bepul Demo Sinash <ArrowRight size={20} />
              </a>
              <a href="#features" className="btn btn-outline" style={{ padding: '20px 40px', fontSize: '1.1rem' }}>
                <PlayCircle size={20} /> Tizim Haqida
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Barcha Jarayonlar Bitta Joyda</h2>
            <p className="section-subtitle">
              Qog'ozbozlik va Excel jadvallardan voz keching. Biznesingizni avtomatlashtiring va xatoliklarni 0% ga tushiring.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Layers size={36} />
              </div>
              <h3 className="feature-title">Buyurtmalar (Kanban)</h3>
              <p className="feature-desc">
                Buyurtmalarni vizual ustunlarda boshqaring. Muddatlar, dizaynerlar va presschilar javobgarligini belgilang.
              </p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Zap size={36} />
              </div>
              <h3 className="feature-title">Avto Narxlash</h3>
              <p className="feature-desc">
                Qog'oz turi, ranglar va qo'shimcha ishlov berish ustamalarini avtomatik hisoblovchi "Pricing Engine".
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <ShieldCheck size={36} />
              </div>
              <h3 className="feature-title">Kassa va Moliya</h3>
              <p className="feature-desc">
                Naqd, Click, Uzcard tushumlari. Xodimlar oyligi va mijozlar qarzdorligi xavfsiz va aniq nazoratda.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <Users size={36} />
              </div>
              <h3 className="feature-title">Telegram Bot</h3>
              <p className="feature-desc">
                Xodimlarga vazifalar bot orqali avto-xabar qilinadi. QR kod yordamida tezkor davomat (Check-in).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Form Section */}
      <section className="contact-section" id="contact">
        <div className="container">
          <div className="contact-container">
            <div className="contact-info">
              <h2>Tizimni<br/><span style={{ color: 'var(--primary)' }}>Sinab Ko'ring</span></h2>
              <p>
                PrintFlow qanday ishlashini amalda ko'rish uchun hoziroq so'rov qoldiring. Mutaxassislarimiz siz bilan bog'lanib, bepul taqdimot (demo) o'tkazib berishadi.
              </p>
              <ul className="benefits-list">
                <li><Check size={20} /> <span>14 Kunlik mutlaqo bepul sinov muddati</span></li>
                <li><Check size={20} /> <span>Biznesingizga moslashtirish bepul</span></li>
                <li><Check size={20} /> <span>Xodimlarni o'qitish va 24/7 qo'llab-quvvatlash</span></li>
                <li><Check size={20} /> <span>Ma'lumotlar xavfsizligi va maxfiylik kafolati</span></li>
              </ul>
            </div>
            
            <div className="contact-form-wrapper">
              {formStatus === 'success' ? (
                <div className="success-message animate-slide-up">
                  <div className="success-icon">
                    <Check size={40} strokeWidth={3} />
                  </div>
                  <h3>So'rov qabul qilindi!</h3>
                  <p>Tez orada siz bilan bog'lanamiz va PrintFlow haqida batafsil ma'lumot beramiz.</p>
                  <button className="btn mt-6" onClick={() => setFormStatus('idle')}>Yangi so'rov qoldirish</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Ism</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.firstName} 
                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                        placeholder="Sardor" 
                      />
                    </div>
                    <div className="form-group">
                      <label>Familiya</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.lastName} 
                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                        placeholder="Karimov" 
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Kompaniya / Bosmaxona Nomi</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.companyName} 
                      onChange={e => setFormData({...formData, companyName: e.target.value})}
                      placeholder="Ideal Print MChJ" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Kompaniyadagi Rolingiz</label>
                    <select 
                      required 
                      value={formData.role} 
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="">Tanlang...</option>
                      <option value="Rahbar">Rahbar / Ta'sischi</option>
                      <option value="Menejer">Savdo Menejeri</option>
                      <option value="Texnolog">Texnolog / Ishlab chiqarish rahbari</option>
                      <option value="Dizayner">Dizayner</option>
                      <option value="Boshqa">Boshqa</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Telefon Raqam</label>
                      <input 
                        type="tel" 
                        required 
                        value={formData.phone} 
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="+998 90 123 45 67" 
                      />
                    </div>
                    <div className="form-group">
                      <label>Telegram Username (ixtiyoriy)</label>
                      <input 
                        type="text" 
                        value={formData.telegramUser} 
                        onChange={e => setFormData({...formData, telegramUser: e.target.value})}
                        placeholder="@username" 
                      />
                    </div>
                  </div>

                  {formStatus === 'error' && (
                    <div className="text-red-500 text-sm font-bold mb-4 bg-red-500/10 p-3 rounded text-center">
                      Xatolik yuz berdi. Iltimos qayta urinib ko'ring.
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn form-submit"
                    disabled={formStatus === 'loading'}
                  >
                    {formStatus === 'loading' ? 'YUBORILMOQDA...' : 'SO\'ROVNI YUBORISH'} <Send size={18} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="container">
        <div className="cta-banner">
          <h2>Biznesingizni keyingi bosqichga olib chiqing</h2>
          <p>PrintFlow orqali buyurtmalarni 40% ga tezroq bajaring, moliyaviy oqimni 100% nazorat qiling va mijozlar ishonchini qozoning.</p>
          <a href="#contact" onClick={handleDemoClick} className="btn" style={{ padding: '20px 40px', fontSize: '1.1rem' }}>
            Hozirroq Boshlash <ArrowRight size={20} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <a href="/" className="footer-logo">
              <Printer size={28} color="var(--primary)" />
              Print<span>Flow</span>
            </a>
            <div className="footer-links">
              <a href="#features">Imkoniyatlar</a>
              <a href="#benefits">Afzalliklar</a>
              <a href="#contact">Aloqa</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onLoginClick(); }}>Tizimga Kirish</a>
            </div>
            <p className="footer-copy">
              © {new Date().getFullYear()} PrintFlow. Barcha huquqlar himoyalangan.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Landing;
