import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

// =============================================
// Lightweight DropdownMenu. No Radix, no Headless UI.
// Click-outside + Escape close. Anchored to the trigger.
// Used as the per-row "Quick Actions" menu in TenantsDataTable.
// =============================================

export type MenuItem =
  | { kind: 'item'; label: string; icon?: React.ReactNode; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { kind: 'separator' }
  | { kind: 'label'; text: string };

interface DropdownMenuProps {
  items: MenuItem[];
  align?: 'left' | 'right';
  /** Custom trigger; defaults to a 3-dot icon button */
  trigger?: React.ReactNode;
}

export function DropdownMenu({ items, align = 'right', trigger }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: open ? '#f1f5f9' : 'transparent', border: 'none', borderRadius: 6,
          color: '#475569', cursor: 'pointer', transition: 'background 120ms',
        }}
      >
        {trigger ?? <MoreVertical size={16} />}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            [align]: 0,
            minWidth: 200,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 10px 30px -10px rgba(15,23,42,0.18), 0 4px 12px -4px rgba(15,23,42,0.08)',
            padding: 4,
            zIndex: 50,
          }}
        >
          {items.map((it, i) => {
            if (it.kind === 'separator') {
              return <div key={i} style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />;
            }
            if (it.kind === 'label') {
              return <div key={i} style={{ padding: '6px 10px 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#94a3b8' }}>{it.text}</div>;
            }
            return (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onSelect(); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', fontSize: 13, fontWeight: 500,
                  background: 'transparent', border: 'none', borderRadius: 6,
                  textAlign: 'left', cursor: it.disabled ? 'not-allowed' : 'pointer',
                  color: it.disabled ? '#cbd5e1' : it.danger ? '#dc2626' : '#0f172a',
                  opacity: it.disabled ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = it.danger ? '#fef2f2' : '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {it.icon}
                <span>{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
