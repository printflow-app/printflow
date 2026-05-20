import { useState } from 'react';
import { Building2, Plus, X, AlertTriangle, Clock, Calendar, Trash2 } from 'lucide-react';
import { tenantsApi } from '../api';
import { useUI } from '../ui';
import { useTenants, usePlans, useInvalidate } from '../hooks/queries';
import { STATUS_COLORS, STATUS_LABELS, getAttPct, getActiveModules } from '../shared/constants';
import TenantDetailsModal from './TenantDetailsModal';

export default 
function Tenants() {
  const { toast, confirm } = useUI();
  const { data: tenants = [] } = useTenants();
  const { data: plans = [] } = usePlans();
  const invalidate = useInvalidate();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = () => invalidate.tenants();
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pwd = generateRandomPassword();
      await tenantsApi.create({ name, slug, planId: selectedPlanId || undefined, adminEmail: 'admin', adminPassword: pwd });
      setGeneratedCreds({ slug, login: 'admin', pass: pwd }); setName(''); load();
    } catch (err: any) { toast(err.response?.data?.message || 'Xatolik', 'error'); }
    finally { setLoading(false); }
  };

  const openDetails = async (id: string) => {
    try { const res = await tenantsApi.findOne(id); setSelectedTenant(res.data); }
    catch (err) { console.error(err); }
  };

  const toggleStatus = async (id: string, cur: boolean) => {
    const ok = await confirm({ title: 'Holatini o\'zgartirish', message: cur ? 'Workspace bloklansinmi?' : 'Workspace faollashtirilsinmi?', danger: cur });
    if (!ok) return;
    try { await tenantsApi.update(id, { isActive: !cur }); toast('Holat yangilandi', 'success'); load(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [
    { key: 'ALL', label: 'Barchasi', color: '#64748b' },
    { key: 'ACTIVE', label: 'Faol', color: '#10b981' },
    { key: 'TRIAL', label: 'Trial', color: '#3b82f6' },
    { key: 'EXPIRED', label: 'Tugagan', color: '#ef4444' },
    { key: 'PENDING_PAYMENT', label: "To'lov", color: '#f59e0b' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.5px', color: '#0f172a', marginBottom: 4 }}>Workspacelar</h2>
          <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>{tenants.length} ta workspace · {tenants.filter(t => t.status === 'ACTIVE').length} faol</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            placeholder="Nomi yoki slug bo'yicha..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38, padding: '0 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600, outline: 'none', background: '#f8fafc', width: 220, fontFamily: 'inherit' }}
          />
          <button className="btn" onClick={() => setShowModal(true)} style={{ height: 38, display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
            <Plus size={14} /> Yangi
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {statuses.map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${statusFilter === s.key ? s.color : '#e2e8f0'}`, background: statusFilter === s.key ? `${s.color}10` : '#fff', color: statusFilter === s.key ? s.color : '#64748b', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
            {s.label}
            <span style={{ marginLeft: 6, background: statusFilter === s.key ? s.color : '#e2e8f0', color: statusFilter === s.key ? '#fff' : '#94a3b8', borderRadius: 4, padding: '1px 5px', fontSize: '9px', fontWeight: 900 }}>
              {s.key === 'ALL' ? tenants.length : tenants.filter(t => t.status === s.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Workspace cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {filtered.map(t => {
          const color = STATUS_COLORS[t.status] || '#94a3b8';
          const label = STATUS_LABELS[t.status] || t.status;
          const attPct = getAttPct(t);
          const modules = getActiveModules(t);
          const expDate = t.status === 'TRIAL' ? t.trialEndsAt : t.subscriptionEndsAt;
          const isExpiringSoon = expDate && (new Date(expDate).getTime() - Date.now()) < 7 * 24 * 3600 * 1000 && new Date(expDate) > new Date();

          return (
            <div key={t.id}
              style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
            >
              {/* Color strip */}
              <div style={{ height: 3, background: color }} />

              {/* Card header */}
              <div style={{ padding: '15px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <p style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</p>
                  <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginTop: 2 }}>@{t.slug} · {t.plan?.displayName || <span style={{ fontStyle: 'italic' }}>Tarifisiz</span>}</p>
                </div>
                <span style={{ background: `${color}12`, color, fontSize: '8px', fontWeight: 900, padding: '4px 9px', borderRadius: 7, textTransform: 'uppercase', letterSpacing: '0.5px', border: `1px solid ${color}25`, flexShrink: 0 }}>
                  {label}
                </span>
              </div>

              {/* Metrics strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid #f8fafc', borderBottom: '1px solid #f8fafc' }}>
                {[
                  { label: 'Xodim', value: t._count?.employees ?? 0, c: '#3b82f6' },
                  { label: 'Buyurtma', value: t.activeTasksCount ?? t._count?.tasks ?? 0, c: '#FF6B00' },
                  { label: 'Davomat', value: `${attPct}%`, c: attPct >= 80 ? '#10b981' : attPct >= 40 ? '#f59e0b' : '#ef4444' },
                  { label: 'Modullar', value: `${modules}/4`, c: '#8b5cf6' },
                ].map((m, i) => (
                  <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderRight: i < 3 ? '1px solid #f8fafc' : 'none' }}>
                    <p style={{ fontSize: '1.05rem', fontWeight: 900, color: m.c, letterSpacing: '-0.5px', lineHeight: 1 }}>{m.value}</p>
                    <p style={{ fontSize: '7px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 3 }}>{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar for attendance */}
              {(t._count?.employees || 0) > 0 && (
                <div style={{ padding: '8px 18px 0' }}>
                  <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${attPct}%`, background: attPct >= 80 ? '#10b981' : attPct >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )}

              {/* Card footer */}
              <div style={{ padding: '10px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {expDate ? (
                    <span style={{ fontSize: '10px', color: isExpiringSoon ? '#f59e0b' : '#94a3b8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isExpiringSoon && <AlertTriangle size={11} strokeWidth={2.5} />}
                      {t.status === 'TRIAL' ? <Clock size={11} strokeWidth={2.5} /> : <Calendar size={11} strokeWidth={2.5} />}
                      {t.status === 'TRIAL' ? 'Trial: ' : ''}{new Date(expDate).toLocaleDateString('uz-UZ')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} strokeWidth={2.5} /> {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => openDetails(t.id)}
                    style={{ padding: '5px 11px', fontSize: '10px', fontWeight: 800, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#64748b', fontFamily: 'inherit' }}>
                    Tafsilot
                  </button>
                  <button onClick={() => toggleStatus(t.id, t.isActive)}
                    style={{ padding: '5px 11px', fontSize: '10px', fontWeight: 800, background: t.isActive ? '#fef2f2' : '#f0fdf4', border: `1px solid ${t.isActive ? '#fca5a5' : '#86efac'}`, borderRadius: 8, cursor: 'pointer', color: t.isActive ? '#ef4444' : '#10b981', fontFamily: 'inherit' }}>
                    {t.isActive ? 'Bloklash' : 'Faollashtirish'}
                  </button>
                  <button onClick={async () => {
                    const ok = await confirm({ title: 'Workspace o\'chirish', message: `${t.name} workspace butunlay o'chirilsinmi?`, confirmText: 'Ha, o\'chirilsin', danger: true });
                    if (!ok) return;
                    try { await tenantsApi.delete(t.id); toast('Workspace o\'chirildi', 'success'); load(); }
                    catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
                  }} style={{ padding: '5px 9px', fontSize: '10px', fontWeight: 900, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}>
                    <Trash2 size={12} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#cbd5e1' }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
          <p style={{ fontWeight: 800, fontSize: '0.85rem' }}>{search ? 'Qidiruv bo\'yicha natija topilmadi' : 'Workspacelar mavjud emas'}</p>
        </div>
      )}
      {showModal && !generatedCreds && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>Yangi Workspace</h2><button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button></div>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>Workspace Nomi</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Masalan: Ideal Print" /></div>
              <div className="form-group"><label>Tarif (ixtiyoriy)</label>
                <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)} style={{ width: '100%', height: 48, border: '1px solid var(--border)', borderRadius: 6, padding: '0 16px', fontFamily: 'inherit', fontSize: '0.95rem' }}>
                  <option value="">Tanlanmagan (7 kunlik trial)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} disabled={loading}>{loading ? 'Yaratilmoqda...' : 'Yaratish'}</button>
            </form>
          </div>
        </div>
      )}

      {generatedCreds && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>Workspace Yaratildi!</h2><button className="modal-close" onClick={() => setGeneratedCreds(null)}><X size={24} /></button></div>
            <div className="generated-creds" style={{ marginTop: 16 }}>
              <h4>Kirish Ma'lumotlari</h4>
              <p><strong>Workspace URL:</strong> /t/{generatedCreds.slug}</p>
              <p><strong>Login:</strong> {generatedCreds.login}</p>
              <p><strong>Parol:</strong> {generatedCreds.pass}</p>
            </div>
            <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} onClick={() => setGeneratedCreds(null)}>Yopish</button>
          </div>
        </div>
      )}

      {selectedTenant && (
        <TenantDetailsModal
          tenant={selectedTenant}
          plans={plans}
          onClose={() => setSelectedTenant(null)}
          onSaved={() => { load(); openDetails(selectedTenant.id); }}
          toast={toast}
        />
      )}
    </div>
  );
}
