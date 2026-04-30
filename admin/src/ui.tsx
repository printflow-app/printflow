import React, { createContext, useCallback, useContext, useState } from 'react';

// =============================================
// Lightweight UI helpers for the admin panel:
//   - useToast(): replaces alert()
//   - useConfirm(): replaces window.confirm()
// =============================================

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };
type ConfirmRequest = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
};

type UICtx = {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
};

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const confirm = useCallback((opts: Omit<ConfirmRequest, 'resolve'>) => {
    return new Promise<boolean>((resolve) => {
      setConfirmReq({ ...opts, resolve });
    });
  }, []);

  const closeConfirm = (ok: boolean) => {
    confirmReq?.resolve(ok);
    setConfirmReq(null);
  };

  const colors: Record<ToastKind, { bg: string; border: string; text: string }> = {
    success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e3a8a' },
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast container */}
      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const c = colors[t.kind];
          return (
            <div key={t.id} style={{
              background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.border}`,
              padding: '12px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
              minWidth: 240, maxWidth: 360, pointerEvents: 'auto'
            }}>
              {t.message}
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmReq && (
        <div className="modal-overlay" style={{ zIndex: 99998 }}>
          <div className="modal-content" style={{ maxWidth: 420, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{confirmReq.danger ? '⚠️' : '❓'}</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 8 }}>{confirmReq.title}</h3>
            {confirmReq.message && (
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>{confirmReq.message}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1, background: '#64748b' }} onClick={() => closeConfirm(false)}>
                {confirmReq.cancelText || 'Bekor qilish'}
              </button>
              <button
                className="btn"
                style={{ flex: 1, background: confirmReq.danger ? '#ef4444' : 'var(--primary)' }}
                onClick={() => closeConfirm(true)}
              >
                {confirmReq.confirmText || 'Tasdiqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useUI(): UICtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
