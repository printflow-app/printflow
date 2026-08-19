import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatCardTone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning' | 'info';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatCardTone;
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
  className = '',
  onClick,
}) => {
  const iconTheme = toneIconStyles[tone] || toneIconStyles.neutral;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-card p-4 flex flex-col justify-between transition-colors duration-120 ${
        onClick ? 'cursor-pointer hover:border-slate-300' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-slate-600 select-none truncate">
          {label}
        </span>
        {Icon && (
          <div
            className={`w-7 h-7 rounded-control flex items-center justify-center flex-shrink-0 ${iconTheme.bg} ${iconTheme.text}`}
          >
            <Icon size={16} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="t-display text-slate-900 my-0.5 truncate">
        {value}
      </div>

      {subtitle && (
        <div className="text-xs text-slate-500 mt-1 font-normal truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default StatCard;
