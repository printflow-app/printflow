import React, { useState } from 'react';
import { Lock } from 'lucide-react';

// =============================================
// PermissionButton — yashirin tugma o'rniga disabled tooltip.
// Foydalanuvchi "nima uchun bu yo'q" deb so'ramaydi.
// =============================================

interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** True if user has permission. False → button is disabled with a tooltip. */
  allowed: boolean;
  /** Message shown in the tooltip when disabled. */
  reason?: string;
  children: React.ReactNode;
}

export function PermissionButton({
  allowed,
  reason = "Bu amalga ruxsatingiz yo'q. Adminga murojaat qiling.",
  className = '',
  children,
  onClick,
  ...rest
}: PermissionButtonProps) {
  const [showTip, setShowTip] = useState(false);

  if (allowed) {
    return (
      <button className={className} onClick={onClick} {...rest}>
        {children}
      </button>
    );
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <button
        {...rest}
        disabled
        className={`${className} opacity-50 cursor-not-allowed grayscale-[0.4]`}
        onClick={(e) => e.preventDefault()}
      >
        {children}
      </button>

      {showTip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[260px] pointer-events-none">
          <div className="bg-slate-900 text-white text-xs font-semibold rounded-lg px-3 py-2 shadow-xl flex items-start gap-2">
            <Lock size={12} className="mt-0.5 text-rose-400 flex-shrink-0" />
            <span>{reason}</span>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
