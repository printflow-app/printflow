import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, HelpCircle, CheckCircle2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'default' | 'danger' | 'success' | 'warning';
  footer?: React.ReactNode;
  maxWidth?: string;
  /**
   * `drawer` — o'ng tomondan surilib chiqadigan panel (uzun formalar uchun).
   * Sukut bo'yicha o'rtadagi oyna: mavjud oynalarning hech biri o'zgarmaydi.
   * Panelda balandlik har doim to'liq ekran, telefonda kengligi ham to'liq.
   */
  variant?: 'modal' | 'drawer';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  type = 'default',
  footer,
  maxWidth = 'max-w-md',
  variant = 'modal',
}) => {
  // Esc — eng yuqori (oxirgi ochilgan) modalni yopadi. stopPropagation bilan
  // pastdagi modal listener'iga ko'tarilmaydi.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const typeConfig = {
    default: { icon: null, color: 'text-slate-800', bg: 'bg-white' },
    danger: { icon: <AlertCircle className="text-rose-500" size={24} />, color: 'text-rose-800', bg: 'bg-rose-50' },
    success: { icon: <CheckCircle2 className="text-emerald-500" size={24} />, color: 'text-emerald-800', bg: 'bg-emerald-50' },
    warning: { icon: <HelpCircle className="text-amber-500" size={24} />, color: 'text-amber-800', bg: 'bg-amber-50' },
  };

  // Modal'ni document.body'ga to'g'ridan-to'g'ri portalliymiz — Dashboard daraxti
  // ichida `backdrop-filter`, `overflow`, va boshqa ajdod xususiyatlari
  // `position: fixed` containing block'ni o'zgartiradi va backdrop ekranni
  // to'liq qoplamasligi mumkin. Portal bilan modal har doim viewport bo'yicha
  // joylashadi va tepada ochiq joy qolmaydi.
  const drawer = variant === 'drawer';

  const overlay = (
    <div
      className={`fixed top-0 left-0 right-0 bottom-0 z-[1000] flex ${
        drawer ? 'justify-end' : 'items-center justify-center p-4 overflow-y-auto'
      }`}
      style={{ height: '100dvh', width: '100vw' }}
    >
      <div
        className="fixed top-0 left-0 right-0 bottom-0 bg-slate-900/70 backdrop-blur-md animate-fade-in"
        style={{ height: '100dvh', width: '100vw' }}
        onClick={onClose}
      />
      <div
        className={
          drawer
            // Panel: o'ng chetga yopishadi, balandligi to'liq ekran. Faqat chap
            // burchaklari yumaloq — o'ng chet ekran qirrasi bilan tutashadi.
            ? `relative bg-white shadow-2xl w-full ${maxWidth} h-full rounded-none sm:rounded-l-2xl overflow-hidden animate-drawer-in border-l border-slate-100 flex flex-col z-10`
            : `relative bg-white rounded-xl shadow-2xl w-full ${maxWidth} overflow-hidden animate-slide-up border border-slate-100 flex flex-col max-h-[95vh] sm:max-h-[90vh] z-10`
        }
      >
        <div className={`px-4 sm:px-5 py-3.5 border-b border-slate-100 flex justify-between items-center ${typeConfig[type].bg}`}>
          <div className="flex items-center gap-2.5">
            {typeConfig[type].icon}
            <h3 className={`text-base font-semibold tracking-tight ${typeConfig[type].color}`}>{title}</h3>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scroll">
          {children}
        </div>

        {footer && (
          <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default Modal;
