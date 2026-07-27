import React from 'react';

// =============================================
// Ko'rsatkich kartasi — 2026-07 redizayn.
// Inline style o'rniga Tailwind (loyihaning styling tizimi bilan bir xil).
// Raqam — proporsional figuralar (hero qiymatda tabular-nums ishlatilmaydi),
// yordamchi matn — neytral. Accent faqat 1-2 ta muhim ko'rsatkichda.
// =============================================

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  /** Masalan { value: 12, suffix: '%' } — musbat yashil, manfiy qizil */
  delta?: { value: number; suffix?: string };
  icon?: React.ReactNode;
  /** Kam ishlating — faqat e'tibor talab qiladigan ko'rsatkichda */
  accent?: boolean;
}

export function MetricCard({ label, value, sub, delta, icon, accent }: MetricCardProps) {
  const deltaTone =
    delta == null || delta.value === 0
      ? 'text-slate-400'
      : delta.value > 0
      ? 'text-emerald-600'
      : 'text-rose-600';

  return (
    <div
      className={`bg-white rounded-xl border p-4 min-w-0 flex flex-col gap-1 ${
        accent ? 'border-orange-200' : 'border-[color:var(--border)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 truncate">
          {label}
        </span>
        {icon && (
          <span
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              accent ? 'bg-orange-50 text-orange-600' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[22px] leading-none font-extrabold text-slate-900 tracking-tight">
          {value}
        </span>
        {delta != null && (
          <span className={`text-[12px] font-bold font-mono ${deltaTone}`}>
            {delta.value > 0 ? '+' : ''}
            {delta.value}
            {delta.suffix ?? ''}
          </span>
        )}
      </div>

      {sub && <span className="text-[11px] font-medium text-slate-400">{sub}</span>}
    </div>
  );
}
