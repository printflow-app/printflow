import React from 'react';

// =============================================
// Skeleton — content placeholder while data loads.
// Replaces full-page spinner with shape-aware shimmer.
// Pure CSS animation, no library.
// =============================================

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Skeleton({ width = '100%', height = 16, className = '', rounded = 'md' }: SkeletonProps) {
  const r = rounded === 'full' ? 'rounded-full' : `rounded-${rounded}`;
  return (
    <div
      className={`bg-slate-200 ${r} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

// ---------- Pre-built skeleton presets for common page layouts ----------

/** Table skeleton — header + rows. Drop into a page while a list is loading. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-50/70 p-3 border-b border-slate-200 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} rounded="sm" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} height={14} rounded="sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card grid skeleton — N cards in a responsive grid */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <Skeleton width={44} height={44} rounded="xl" />
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={12} />
          <div className="pt-2 border-t border-slate-100">
            <Skeleton width="80%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stats row skeleton — KPI strip placeholder */
export function SkeletonStats({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
          <Skeleton width={36} height={36} rounded="xl" />
          <Skeleton width="50%" height={10} />
          <Skeleton width="70%" height={22} />
        </div>
      ))}
    </div>
  );
}

/** Kanban skeleton — N columns with a few cards each */
export function SkeletonKanban({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex-shrink-0 w-72 bg-slate-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton width={80} height={12} />
            <Skeleton width={24} height={20} rounded="full" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 space-y-2">
              <Skeleton width="80%" height={12} />
              <Skeleton width="60%" height={10} />
              <Skeleton width="40%" height={10} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Empty State component ----------

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

/** Empty state with optional CTA. Use when a list is empty. */
export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-slate-800 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-3 justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="h-10 px-5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm border border-slate-200 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
