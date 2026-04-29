import React, { useState, useEffect } from 'react';
import { Cookie, X, ShieldCheck } from 'lucide-react';

// =============================================
// COOKIE CONSENT BANNER
// Bir marta ko'rsatiladi. localStorage'da saqlanadi.
// =============================================

const COOKIE_KEY = 'pf_cookie_consent';

const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Biroz kechikish bilan ko'rsatish (sahifa yuklangandan keyin)
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    dismiss();
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    dismiss();
  };

  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => setVisible(false), 400);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed z-[9999] w-full max-w-[560px] px-4 left-1/2 -translate-x-1/2 bottom-[80px] md:bottom-6"
      style={{
        animation: leaving ? 'slideDown 0.4s ease forwards' : 'slideUp 0.4s ease',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(30px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to   { opacity: 0; transform: translateX(-50%) translateY(30px); }
        }
      `}</style>

      <div style={{
        background: '#0f172a',
        borderRadius: 20,
        padding: '20px 24px',
        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,107,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(255,107,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid rgba(255,107,0,0.3)',
          }}>
            <ShieldCheck size={20} color="#FF6B00" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '0.9rem', margin: '0 0 2px', letterSpacing: '-0.3px' }}>
              Biz xavfsizlikni qadrlaymiz 🛡️
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
              Tizim ishlashi uchun cookie fayllaridan foydalanamiz.
            </p>
          </div>
          <button
            onClick={decline}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, flexShrink: 0 }}
            title="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={decline}
            style={{
              flex: 1, height: 42, borderRadius: 12, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.82rem', fontWeight: 700, letterSpacing: 0.5,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            Rad etish
          </button>
          <button
            onClick={accept}
            style={{
              flex: 2, height: 42, borderRadius: 12, cursor: 'pointer',
              background: '#FF6B00', color: '#fff',
              border: 'none', fontSize: '0.82rem', fontWeight: 800,
              letterSpacing: 0.5, textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(255,107,0,0.35)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e85e00')}
            onMouseLeave={e => (e.currentTarget.style.background = '#FF6B00')}
          >
            Qabul qilish ✓
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
