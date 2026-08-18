import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// =============================================
// TOAST — sahifa ichidagi qisqa xabar
//
// Ilgari 7 sahifada nusxa ko'chirilgan `fixed top-6 right-6 ...` div bor
// edi, har birida boshqa radius/soya/z-index. Endi ko'rinish bitta joyda;
// holat (matn + turi) chaqiruvchi sahifada qoladi:
//
//   {statusMsg && <Toast type={statusMsg.type}>{statusMsg.text}</Toast>}
// =============================================

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  type: ToastType;
  children: React.ReactNode;
  className?: string;
}

const TOAST_STYLE: Record<ToastType, { bg: string; Icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-emerald-600', Icon: CheckCircle2 },
  error: { bg: 'bg-rose-600', Icon: AlertCircle },
  warning: { bg: 'bg-amber-600', Icon: AlertTriangle },
  info: { bg: 'bg-blue-600', Icon: Info },
};

export const Toast: React.FC<ToastProps> = ({ type, children, className = '' }) => {
  const { bg, Icon } = TOAST_STYLE[type] || TOAST_STYLE.info;
  return (
    <div
      role="status"
      className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-toast max-w-[calc(100vw-2rem)] p-4 rounded-card shadow-lg flex items-center gap-3 text-white animate-slide-up ${bg} ${className}`}
    >
      <Icon size={18} className="shrink-0" />
      <span className="font-semibold text-sm">{children}</span>
    </div>
  );
};

export default Toast;
