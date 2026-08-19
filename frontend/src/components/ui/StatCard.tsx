import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatCardTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatCardTone;
  /**
   * `ink` — to'q ko'k to'ldirilgan karta (uchinchi brend rangi).
   * Bir ekranda FAQAT BITTA: o'sha ekranning yakuniy natijasi (balans,
   * sof foyda, umumiy ko'rsatkich). Qolgan kartalar oq qoladi — shunda
   * ko'z darhol asosiy raqamni topadi.
   */
  variant?: 'default' | 'ink';
  className?: string;
  onClick?: () => void;
}

const toneIconStyles: Record<StatCardTone, { bg: string; text: string }> = {
  neutral: { bg: 'bg-slate-100', text: 'text-slate-600' },
  brand:   { bg: 'bg-primary-50', text: 'text-primary-600' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  danger:  { bg: 'bg-rose-50', text: 'text-rose-600' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700' },
  info:    { bg: 'bg-blue-50', text: 'text-blue-600' },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = 'neutral',
  variant = 'default',
  className = '',
  onClick,
}) => {
  const isInk = variant === 'ink';
  const iconTheme = toneIconStyles[tone] || toneIconStyles.neutral;

  return (
    <div
      onClick={onClick}
      className={`rounded-card p-4 flex flex-col justify-between transition-colors duration-120 ${
        isInk
          ? 'bg-ink border border-ink text-white'
          : 'bg-white border border-slate-200'
      } ${onClick ? `cursor-pointer ${isInk ? 'hover:bg-ink-soft' : 'hover:border-slate-300'}` : ''} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-xs font-medium select-none truncate ${
            isInk ? 'text-white/70' : 'text-slate-600'
          }`}
        >
          {label}
        </span>
        {Icon && (
          <div
            className={`w-7 h-7 rounded-control flex items-center justify-center flex-shrink-0 ${
              isInk ? 'bg-white/10 text-white' : `${iconTheme.bg} ${iconTheme.text}`
            }`}
          >
            <Icon size={16} />
          </div>
        )}
      </div>

      <div className={`t-display my-0.5 truncate ${isInk ? 'text-white' : 'text-slate-900'}`}>
        {value}
      </div>

      {subtitle && (
        <div
          className={`text-xs mt-1 font-normal truncate ${
            isInk ? 'text-white/60' : 'text-slate-500'
          }`}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default StatCard;
