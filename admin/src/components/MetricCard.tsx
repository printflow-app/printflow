import React from 'react';

// =============================================
// Utilitarian metric card — grayscale, no animations.
// Optional trend delta (positive = green, negative = red).
// =============================================

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: { value: number; suffix?: string }; // e.g. { value: 12, suffix: '%' }
  icon?: React.ReactNode;
  /** Use sparingly — only for the one or two metrics that warrant attention */
  accent?: boolean;
}

export function MetricCard({ label, value, sub, delta, icon, accent }: MetricCardProps) {
  const deltaColor = delta == null ? '#94a3b8' : delta.value > 0 ? '#059669' : delta.value < 0 ? '#dc2626' : '#94a3b8';
  const deltaSign  = delta == null ? '' : delta.value > 0 ? '+' : '';

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderLeft: accent ? '3px solid #FF6B00' : '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: 0.6,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</span>
        {icon && <span style={{ color: '#94a3b8', display: 'inline-flex' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: -0.5, lineHeight: 1.1 }}>
          {value}
        </span>
        {delta != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor }}>
            {deltaSign}{delta.value}{delta.suffix ?? ''}
          </span>
        )}
      </div>
      {sub && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{sub}</span>}
    </div>
  );
}
