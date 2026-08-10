import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpDown, CalendarPlus, CreditCard, Ban, CheckCircle2, Search, Pencil, LogIn,
} from 'lucide-react';
import { tenantsApi, APP_URL } from '../api';
import { useTenants, usePlans, useInvalidate } from '../hooks/queries';
import { useUI } from '../ui';
import { DropdownMenu, type MenuItem } from './DropdownMenu';

// =============================================
// TenantsDataTable
//   - Client-side sort (name/status/createdAt/employees)
//   - Filter pills (All / Trial / Active / Suspended / Expired)
//   - Text search across name + slug
//   - Pagination (25 per page)
//   - Per-row DropdownMenu with quick actions:
//       Change Tariff → opens a small plan picker
//       Extend Trial +7d → patches trialEndsAt
//       Suspend/Activate → flips isActive
//       Admin sifatida kirish (impersonate) → super-admin tenantga o'sha
//         tenant admini sifatida parolsiz kiradi. Backend qisqa muddatli
//         (4 soat) tenant JWT beradi, kirish logda yoziladi; token asosiy
//         ilovaga URL hash orqali uzatiladi.
// =============================================

type Status = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'PENDING_PAYMENT';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: Status;
  isActive: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  subscriptionDurationMonths?: number | null;
  // price6m qoldirilgan: 6 oylik variant sotuvdan olib tashlangan, lekin
  // eski tariflarda ustun bazada turibdi.
  plan?: { id: string; name: string; displayName: string; price3m: number; price6m?: number; price12m: number } | null;
  createdAt: string;
  _count?: { employees: number; tasks: number; customers: number };
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price3m: number;
  /** 6 oylik sotuvdan olib tashlangan — eski yozuvlarda qolgan. */
  price6m?: number;
  price12m: number;
}

type SortKey = 'name' | 'status' | 'createdAt' | 'employees';
type SortDir = 'asc' | 'desc';

type StatusFilter = 'ALL' | Status | 'SUSPENDED';

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<Status, string> = {
  TRIAL: 'Trial',
  ACTIVE: 'Faol',
  EXPIRED: 'Tugagan',
  PENDING_PAYMENT: 'To\'lov kutilmoqda',
};

const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  TRIAL:           { bg: '#eff6ff', fg: '#1e40af' },
  ACTIVE:          { bg: '#ecfdf5', fg: '#065f46' },
  EXPIRED:         { bg: '#fef2f2', fg: '#991b1b' },
  PENDING_PAYMENT: { bg: '#fffbeb', fg: '#92400e' },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

export function TenantsDataTable() {
  const ui = useUI();
  // RQ — cache'lanadi, mutatsiyalardan keyin invalidate.tenants() chaqirsa avto-refetch
  const { data: tenantsData = [], isLoading: tLoading, error: tError } = useTenants();
  const { data: plansData = [] } = usePlans();
  const tenants = tenantsData as Tenant[];
  const plans = plansData as Plan[];
  const loading = tLoading;
  const invalidate = useInvalidate();

  // Toast on first error
  useEffect(() => {
    if (tError) ui.toast('Workspacelarni yuklashda xatolik', 'error');
  }, [tError]); // eslint-disable-line react-hooks/exhaustive-deps

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const [planPickerFor, setPlanPickerFor] = useState<Tenant | null>(null);
  const [renameFor, setRenameFor] = useState<Tenant | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameSlug, setRenameSlug] = useState('');
  const [renaming, setRenaming] = useState(false);

  // refresh() shim — invalidates RQ caches, hooks auto-refetch
  const refresh = () => { invalidate.tenants(); invalidate.plans(); };

  // -------- Derived data (filter → search → sort → paginate) --------
  const filtered = useMemo(() => {
    let rows = tenants;
    if (statusFilter !== 'ALL') {
      rows = statusFilter === 'SUSPENDED'
        ? rows.filter(t => !t.isActive)
        : rows.filter(t => t.status === statusFilter && t.isActive);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return rows;
  }, [tenants, statusFilter, query]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'employees') cmp = (a._count?.employees ?? 0) - (b._count?.employees ?? 0);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [statusFilter, query, sortKey, sortDir]);

  // -------- Counts for filter pills --------
  const counts = useMemo(() => ({
    ALL:             tenants.length,
    TRIAL:           tenants.filter(t => t.status === 'TRIAL'           && t.isActive).length,
    ACTIVE:          tenants.filter(t => t.status === 'ACTIVE'          && t.isActive).length,
    EXPIRED:         tenants.filter(t => t.status === 'EXPIRED'         && t.isActive).length,
    PENDING_PAYMENT: tenants.filter(t => t.status === 'PENDING_PAYMENT' && t.isActive).length,
    SUSPENDED:       tenants.filter(t => !t.isActive).length,
  }), [tenants]);

  // -------- Mutations --------
  const handleSuspendToggle = async (t: Tenant) => {
    const willSuspend = t.isActive;
    const ok = await ui.confirm({
      title: willSuspend ? `"${t.name}" ni bloklash` : `"${t.name}" ni qayta yoqish`,
      message: willSuspend
        ? "Foydalanuvchilar tizimga kira olmaydi. Ma'lumotlar saqlanadi."
        : 'Workspace qayta faollashtiriladi.',
      danger: willSuspend,
      confirmText: willSuspend ? 'Bloklash' : 'Qayta yoqish',
    });
    if (!ok) return;
    try {
      await tenantsApi.update(t.id, { isActive: !willSuspend });
      ui.toast(willSuspend ? 'Workspace bloklandi' : 'Workspace qayta yoqildi', 'success');
      refresh();
    } catch (e) {
      ui.toast('Xatolik yuz berdi', 'error');
    }
  };

  const handleExtendTrial = async (t: Tenant) => {
    const base = t.trialEndsAt ? new Date(t.trialEndsAt) : new Date();
    // Don't extend backwards from a past date — start from today if trial already expired
    const start = base.getTime() < Date.now() ? new Date() : base;
    const next = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    try {
      await tenantsApi.update(t.id, { trialEndsAt: next.toISOString(), status: 'TRIAL' });
      ui.toast(`Trial uzaytirildi: ${fmtDate(next.toISOString())} gacha`, 'success');
      refresh();
    } catch (e) {
      ui.toast('Trialni uzaytirib bo\'lmadi', 'error');
    }
  };

  const handleChangePlan = async (t: Tenant, planId: string) => {
    try {
      await tenantsApi.update(t.id, { planId });
      ui.toast('Tarif o\'zgartirildi', 'success');
      setPlanPickerFor(null);
      refresh();
    } catch (e) {
      ui.toast('Tarifni o\'zgartirib bo\'lmadi', 'error');
    }
  };

  // IMPERSONATE — tenantga o'sha tenant admini sifatida kirish (parolsiz).
  // Backend qisqa muddatli tenant JWT qaytaradi; uni asosiy ilovaga URL hash
  // orqali uzatamiz (Referer/loglarga tushmasligi uchun hash, query emas),
  // ilova esa uni Bearer sifatida saqlab, sessiyani ochadi.
  const handleImpersonate = async (t: Tenant) => {
    const ok = await ui.confirm({
      title: `"${t.name}" ga kirish`,
      message:
        'Siz bu workspace\'ga uning admini sifatida kirasiz. Kirish super-admin ' +
        'nomidan logda yoziladi. Yangi oynada ochiladi.',
      confirmText: 'Kirish',
    });
    if (!ok) return;
    try {
      const res = await tenantsApi.impersonate(t.id);
      const { token } = res.data || {};
      if (!token) throw new Error('Token kelmadi');
      // Ildiz yo'liga ochamiz: token tenantId'ni o'zida saqlaydi, slug URL'da
      // shart emas. Ilova ildizda autentifikatsiyadan so'ng dashboard'ga
      // o'zi yo'naltiradi (`/t/slug` yo'lida bu redirect ishlamaydi).
      const url = `${APP_URL}/#impersonate=${encodeURIComponent(token)}`;
      window.open(url, '_blank', 'noopener');
      ui.toast(`"${t.name}" yangi oynada ochilmoqda`, 'success');
    } catch (e: any) {
      ui.toast(e?.response?.data?.message || 'Kira olmadik', 'error');
    }
  };

  const buildMenu = (t: Tenant): MenuItem[] => [
    { kind: 'label', text: 'Tezkor amallar' },
    {
      kind: 'item',
      label: 'Nomini o\'zgartirish',
      icon: <Pencil size={14} />,
      onSelect: () => { setRenameFor(t); setRenameName(t.name); setRenameSlug(t.slug); },
    },
    {
      kind: 'item',
      label: 'Tarifni o\'zgartirish',
      icon: <CreditCard size={14} />,
      onSelect: () => setPlanPickerFor(t),
    },
    {
      kind: 'item',
      label: 'Trial +7 kun',
      icon: <CalendarPlus size={14} />,
      onSelect: () => handleExtendTrial(t),
    },
    { kind: 'separator' },
    {
      kind: 'item',
      label: 'Admin sifatida kirish',
      icon: <LogIn size={14} />,
      onSelect: () => handleImpersonate(t),
    },
    { kind: 'separator' },
    t.isActive
      ? { kind: 'item', label: 'Workspaceni bloklash', icon: <Ban size={14} />, danger: true, onSelect: () => handleSuspendToggle(t) }
      : { kind: 'item', label: 'Qayta yoqish', icon: <CheckCircle2 size={14} />, onSelect: () => handleSuspendToggle(t) },
  ];

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => {
        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(k); setSortDir('asc'); }
      }}
      style={{
        cursor: 'pointer', userSelect: 'none',
        padding: '10px 12px', textAlign: 'left',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
        color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {sortKey === k
          ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
          : <ArrowUpDown size={11} style={{ opacity: 0.4 }} />}
      </span>
    </th>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      {/* Toolbar: search + filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ position: 'relative', flex: '0 1 280px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Nom yoki slug bo'yicha qidirish..."
            style={{
              width: '100%', height: 32, paddingLeft: 30, paddingRight: 10,
              fontSize: 13, color: '#0f172a',
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {([
            ['ALL', 'Hammasi'],
            ['TRIAL', 'Trial'],
            ['ACTIVE', 'Faol'],
            ['PENDING_PAYMENT', "To'lov kutilmoqda"],
            ['EXPIRED', 'Tugagan'],
            ['SUSPENDED', 'Bloklangan'],
          ] as [StatusFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                height: 28, padding: '0 10px', fontSize: 12, fontWeight: 600,
                borderRadius: 6, border: '1px solid', cursor: 'pointer',
                background: statusFilter === key ? '#0f172a' : '#fff',
                color: statusFilter === key ? '#fff' : '#475569',
                borderColor: statusFilter === key ? '#0f172a' : '#e2e8f0',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 16, padding: '0 4px', borderRadius: 4, fontSize: 10,
                background: statusFilter === key ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
                color: statusFilter === key ? '#fff' : '#64748b',
              }}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <SortHeader k="name">Workspace</SortHeader>
              <SortHeader k="status">Holat</SortHeader>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>Tarif</th>
              <SortHeader k="employees">Xodimlar</SortHeader>
              <SortHeader k="createdAt">Yaratilgan</SortHeader>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>Trial/Obuna</th>
              <th style={{ width: 40, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Yuklanmoqda...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Workspace topilmadi</td></tr>
            ) : paged.map(t => {
              const sc = STATUS_COLOR[t.status];
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {!t.isActive ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>Bloklangan</span>
                    ) : (
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.fg }}>{STATUS_LABEL[t.status]}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569', fontSize: 13 }}>{t.plan?.displayName ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={{ padding: '10px 12px', color: '#475569', fontSize: 13 }}>{t._count?.employees ?? 0}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>{fmtDate(t.createdAt)}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                    {/* Muddat ixtiyoriy: sana yo'q = cheksiz obuna, "sana
                        kiritilmagan" emas. Bloklangan/tugagan workspace'da
                        buni yozish chalg'itadi — u yerda tire qoladi. */}
                    {(() => {
                      const sana = t.status === 'ACTIVE' ? t.subscriptionEndsAt : t.trialEndsAt;
                      if (sana) return fmtDate(sana);
                      if (t.status === 'ACTIVE' || t.status === 'TRIAL') {
                        return <span style={{ color: '#059669', fontWeight: 600 }}>Muddatsiz</span>;
                      }
                      return '—';
                    })()}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                    <DropdownMenu items={buildMenu(t)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
        <span>{sorted.length} ta workspace · sahifa {safePage} / {pageCount}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{ height: 26, padding: '0 10px', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 5, background: '#fff', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? 0.5 : 1 }}
          >Oldingi</button>
          <button
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={safePage >= pageCount}
            style={{ height: 26, padding: '0 10px', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 5, background: '#fff', cursor: safePage >= pageCount ? 'not-allowed' : 'pointer', opacity: safePage >= pageCount ? 0.5 : 1 }}
          >Keyingi</button>
        </div>
      </div>

      {/* NOMNI O'ZGARTIRISH.
          Slug alohida ko'rsatiladi va ogohlantirish bilan — u login uchun
          ishlatiladi, o'zgartirilsa eski nom bilan kirish to'xtaydi. */}
      {renameFor && (
        <div
          onClick={() => setRenameFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 20, width: '100%', maxWidth: 460 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
              Workspace nomini o'zgartirish
            </h3>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Ko'rinadigan nom
            </label>
            <input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, marginBottom: 16 }}
            />

            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Slug (login uchun)
            </label>
            <input
              value={renameSlug}
              onChange={e => setRenameSlug(e.target.value.toLowerCase())}
              style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'monospace' }}
            />
            {renameSlug !== renameFor.slug && (
              <p style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10, marginTop: 8, lineHeight: 1.5 }}>
                <b>Diqqat:</b> slug login uchun ishlatiladi. O'zgartirilsa, barcha xodim
                tizimga <b>{renameFor.slug}</b> o'rniga <b>{renameSlug || '...'}</b> deb kiradi.
                Eski nom bilan kirish to'xtaydi — xodimlarga aytishni unutmang.
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setRenameFor(null)}
                style={{ flex: 1, height: 38, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                BEKOR
              </button>
              <button
                disabled={renaming || !renameName.trim()}
                onClick={async () => {
                  setRenaming(true);
                  try {
                    const patch: any = { name: renameName.trim() };
                    if (renameSlug && renameSlug !== renameFor.slug) patch.slug = renameSlug;
                    await tenantsApi.update(renameFor.id, patch);
                    ui.toast('Nom yangilandi', 'success');
                    setRenameFor(null);
                    refresh();
                  } catch (e: any) {
                    ui.toast(e?.response?.data?.message || 'Xatolik yuz berdi', 'error');
                  } finally { setRenaming(false); }
                }}
                style={{ flex: 1, height: 38, borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: renaming ? 0.6 : 1 }}
              >
                {renaming ? 'SAQLANMOQDA...' : 'SAQLASH'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan picker — opens when "Change Tariff" is selected */}
      {planPickerFor && (
        <div
          onClick={() => setPlanPickerFor(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 20, width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Tarifni o'zgartirish</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{planPickerFor.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plans.length === 0 && <div style={{ fontSize: 13, color: '#94a3b8' }}>Plan topilmadi</div>}
              {plans.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleChangePlan(planPickerFor, p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 6,
                    background: planPickerFor.plan?.id === p.id ? '#fff5ed' : '#fff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{p.displayName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.name}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{p.price12m?.toLocaleString() ?? '—'} / 12oy</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setPlanPickerFor(null)} style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
