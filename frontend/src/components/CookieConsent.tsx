import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck } from 'lucide-react';

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
      className="fixed z-toast w-full max-w-[560px] px-4 left-1/2 -translate-x-1/2 bottom-[80px] md:bottom-6"
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
        background: '#ffffff',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 16px 44px rgba(41, 37, 36, 0.14)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: 'var(--primary-glow)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Cookie size={20} color="var(--primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 2px' }}>
              <p style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: '0.9rem', margin: 0, letterSpacing: '-0.01em' }}>
                Biz xavfsizlikni qadrlaymiz
              </p>
              <ShieldCheck size={14} color="var(--primary)" />
            </div>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
              Tizim ishlashi uchun cookie fayllaridan foydalanamiz.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={decline}
            style={{
              flex: 1, height: 44, borderRadius: 8, cursor: 'pointer',
              background: '#ffffff', color: 'var(--muted)',
              border: '1px solid var(--border)',
              fontSize: '0.875rem', fontWeight: 500,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f5f2ee')}
            onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
          >
            Rad etish
          </button>
          <button
            onClick={accept}
            style={{
              flex: 2, height: 44, borderRadius: 8, cursor: 'pointer',
              background: 'var(--primary)', color: '#fff',
              border: 'none', fontSize: '0.875rem', fontWeight: 500,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
          >
            Qabul qilish
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
