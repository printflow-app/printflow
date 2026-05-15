import { useState } from 'react';
import { Check, X, XCircle } from 'lucide-react';
import { tenantsApi } from '../api';
import { STATUS_COLORS, STATUS_LABELS } from '../shared/constants';

export default 
function TenantDetailsModal({ tenant, plans, onClose, onSaved, toast }: {
  tenant: any; plans: any[]; onClose: () => void; onSaved: () => void; toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const statusColor = STATUS_COLORS[tenant.status] || '#94a3b8';
  const statusLabel = STATUS_LABELS[tenant.status] || tenant.status;
  const curExpDate = tenant.status === 'TRIAL'
    ? (tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toISOString().slice(0, 10) : '')
    : (tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toISOString().slice(0, 10) : '');

  const [newEndDate, setNewEndDate] = useState(curExpDate);
  const [newStatus, setNewStatus] = useState<string>(() => {
    // Agar status EXPIRED lekin sana kelajakda bo'lsa — ACTIVE deb boshlash
    if (tenant.status === 'EXPIRED' && curExpDate && new Date(curExpDate) > new Date()) {
      return 'ACTIVE';
    }
    return tenant.status;
  });
  const [newPlanId, setNewPlanId] = useState(tenant.planId || '');
  const [saving, setSaving] = useState(false);

  const addMonths = (months: number) => {
    const base = newEndDate ? new Date(newEndDate) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + months);
    setNewEndDate(base.toISOString().slice(0, 10));
    if (newStatus !== 'ACTIVE') setNewStatus('ACTIVE');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Kelajak sana bilan EXPIRED saqlashni oldini olish
      const effectiveStatus =
        newStatus === 'EXPIRED' && newEndDate && new Date(newEndDate) > new Date()
          ? 'ACTIVE'
          : newStatus;
      const updateData: any = { status: effectiveStatus, planId: newPlanId || null };
      if (effectiveStatus === 'TRIAL') {
        updateData.trialEndsAt = newEndDate ? new Date(newEndDate).toISOString() : null;
      } else {
        updateData.subscriptionEndsAt = newEndDate ? new Date(newEndDate).toISOString() : null;
      }
      await tenantsApi.update(tenant.id, updateData);
      toast('Workspace yangilandi!', 'success');
      onSaved();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>{tenant.name}</h2>
            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, marginTop: 3 }}>@{tenant.slug}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ background: `${statusColor}12`, color: statusColor, fontSize: '9px', fontWeight: 900, padding: '5px 12px', borderRadius: 8, textTransform: 'uppercase', border: `1px solid ${statusColor}25` }}>
              {statusLabel}
            </span>
            <button className="modal-close" onClick={onClose}><X size={22} /></button>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: "To'langan (UZS)", value: (tenant.totalPaid || 0).toLocaleString() },
            { label: 'Xodimlar', value: tenant._count?.employees ?? '—' },
            { label: 'Mijozlar', value: tenant._count?.customers ?? '—' },
            { label: 'Yaratilgan', value: new Date(tenant.createdAt).toLocaleDateString('uz-UZ') },
          ].map((item, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: '7px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: 4 }}>{item.label}</p>
              <p style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* ===== SUBSCRIPTION MANAGEMENT ===== */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', marginBottom: 20, background: '#fafafa' }}>
          <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 14 }}>Obuna Boshqaruvi</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* Status */}
            <div>
              <label style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: 6 }}>Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                style={{ width: '100%', height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="ACTIVE">✅ Faol (ACTIVE)</option>
                <option value="TRIAL">🔵 Trial</option>
                <option value="EXPIRED">❌ Muddati tugagan</option>
                <option value="PENDING_PAYMENT">⏳ To'lov kutilmoqda</option>
              </select>
            </div>

            {/* Plan */}
            <div>
              <label style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: 6 }}>Tarif</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)}
                style={{ width: '100%', height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 700, background: '#fff', outline: 'none', cursor: 'pointer' }}>
                <option value="">— Tarifisiz —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b', display: 'block', marginBottom: 6 }}>
              {newStatus === 'TRIAL' ? 'Trial tugash sanasi' : 'Obuna tugash sanasi'}
            </label>
            <input type="date" value={newEndDate} onChange={e => {
              setNewEndDate(e.target.value);
              if (e.target.value && new Date(e.target.value) > new Date() && newStatus !== 'ACTIVE') {
                setNewStatus('ACTIVE');
              }
            }}
              style={{ width: '100%', height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, background: '#fff', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Quick extend buttons */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '9px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Tezkor uzaytirish</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: '+1 oy', months: 1 }, { label: '+3 oy', months: 3 }, { label: '+6 oy', months: 6 }, { label: '+12 oy', months: 12 }].map(btn => (
                <button key={btn.months} onClick={() => addMonths(btn.months)}
                  style={{ padding: '6px 14px', fontSize: '11px', fontWeight: 800, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#FF6B00', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,0,0.06)'; e.currentTarget.style.borderColor = '#FF6B00'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{ width: '100%', height: 42, background: saving ? '#94a3b8' : '#FF6B00', color: '#fff', border: 'none', borderRadius: 10, fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: saving ? 'none' : '0 4px 12px rgba(255,107,0,0.25)', transition: 'all 0.2s' }}>
            {saving ? 'SAQLANMOQDA...' : '✓ SAQLASH'}
          </button>
        </div>

        {/* Payment history */}
        <div>
          <p style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#94a3b8', marginBottom: 12 }}>To'lovlar tarixi</p>
          {tenant.payments?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tenant.payments.map((p: any) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', background: '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: '12px' }}>
                  <div>
                    <p style={{ fontWeight: 800, color: '#0f172a' }}>{p.planName} · {p.duration} oy</p>
                    <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</p>
                  </div>
                  <span style={{ fontWeight: 900, color: '#0f172a' }}>{(p.amount || 0).toLocaleString()} UZS</span>
                  <span style={{ fontWeight: 700, color: p.sender ? '#64748b' : '#94a3b8', fontSize: '11px' }}>{p.sender || '—'}</span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {p.status === 'APPROVED' ? <Check size={14} color="#10b981" /> : p.status === 'REJECTED' ? <XCircle size={14} color="#ef4444" /> : <span style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b' }}>KUTILMOQDA</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '16px 0' }}>To'lovlar tarixi mavjud emas</p>
          )}
        </div>
      </div>
    </div>
  );
}

