import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    primary?: boolean;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-card border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 flex-shrink-0">
        <Icon size={22} strokeWidth={1.75} />
      </div>

      <h3 className="text-sm sm:text-base font-semibold text-slate-800 mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={action.primary ? 'btn-primary' : 'btn-outline'}
        >
          {action.icon && <action.icon size={16} />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

export default EmptyState;
