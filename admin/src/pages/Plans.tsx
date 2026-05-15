import { useState } from 'react';
import { Plus, X, Check, Trash2, AlertCircle } from 'lucide-react';
import { plansApi } from '../api';
import { usePlans, useInvalidate } from '../hooks/queries';
import { ALLOWED_MODULES, defaultPlanForm as defaultForm } from '../shared/constants';

export default 
function Plans() {
  const { data: plans = [] } = usePlans();
  const invalidate = useInvalidate();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(defaultForm());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = () => invalidate.plans();

  const openCreate = () => {
    setForm(defaultForm());
    setEditing(null); setErrorMsg(''); setShowModal(true);
  };
  const openEdit = (p: any) => {
    setForm({
      name: p.name, displayName: p.displayName,
      price3m: p.price3m, price6m: p.price6m, price12m: p.price12m,
      maxEmployees: p.maxEmployees ?? 8,
      maxBranches: p.maxBranches ?? 1,
      maxDepartments: p.maxDepartments ?? 1,
      allowedModules: p.allowedModules ?? [],
      description: p.description || '', isPopular: p.isPopular, sortOrder: p.sortOrder,
    });
    setEditing(p); setErrorMsg(''); setShowModal(true);
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    try {
      if (editing) {
        await plansApi.update(editing.id, payload);
      } else {
        await plansApi.create(payload);
      }
      setShowModal(false); load();
    } catch (err: any) { 
      console.error('Save error:', err);
      setErrorMsg(err.response?.data?.message || 'Xatolik yuz berdi'); 
    }
  };
  const toggleModule = (key: string) => {
    setForm(prev => ({
      ...prev,
      allowedModules: prev.allowedModules.includes(key)
        ? prev.allowedModules.filter(m => m !== key)
        : [...prev.allowedModules, key],
    }));
  };
  const handleDelete = async () => {
    if (!editing) return;
    try {
      await plansApi.delete(editing.id);
      setShowDeleteConfirm(false); setShowModal(false); load();
    } catch (e: any) { setErrorMsg(e.response?.data?.message || 'O\'chirishda xatolik'); }
  };

  return (
    <div>
      <div className="flex-between">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Tariflar</h2>
        <button className="btn" onClick={openCreate}><Plus size={16} /> Yangi Tarif</button>
      </div>
      <div className="stats-grid">
        {plans.map(p => (
          <div key={p.id} className="stat-card" style={{ cursor: 'pointer', border: p.isPopular ? '2px solid var(--primary)' : undefined }} onClick={() => openEdit(p)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div className="stat-title">{p.displayName}</div>
              {p.isPopular && <span className="badge active">🔥 OMMABOP</span>}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 4 }}>{p.price3m?.toLocaleString()} UZS <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ 3 oy</span></div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Xodimlar: {p.maxEmployees === 0 ? 'Cheksiz' : p.maxEmployees} ta</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Mijozlar: {p._count?.tenants || 0}</div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 740, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>{editing ? 'TARIFNI TAHRIRLASH' : 'YANGI TARIF'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>
            
            {errorMsg && (
              <div style={{ margin: '16px 24px 0', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertCircle size={18} /> {errorMsg}
              </div>
            )}
            
            <form id="plan-form" onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label>NOMI (UNIKAL)</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="STARTER" /></div>
                <div className="form-group"><label>KO'RSATILADIGAN NOMI</label><input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Starter Plan" /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
                <div className="form-group"><label>3 OYLIK (UZS)</label><input type="number" required value={form.price3m} onChange={e => setForm({ ...form, price3m: +e.target.value })} /></div>
                <div className="form-group"><label>6 OYLIK (UZS)</label><input type="number" required value={form.price6m} onChange={e => setForm({ ...form, price6m: +e.target.value })} /></div>
                <div className="form-group"><label>12 OYLIK (UZS)</label><input type="number" required value={form.price12m} onChange={e => setForm({ ...form, price12m: +e.target.value })} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
                <div className="form-group"><label>XODIMLAR (0=∞)</label><input type="number" required min={0} value={form.maxEmployees} onChange={e => setForm({ ...form, maxEmployees: +e.target.value })} /></div>
                <div className="form-group"><label>FILIALLAR (0=∞)</label><input type="number" required min={0} value={form.maxBranches} onChange={e => setForm({ ...form, maxBranches: +e.target.value })} /></div>
                <div className="form-group"><label>BO'LIMLAR (0=∞)</label><input type="number" required min={0} value={form.maxDepartments} onChange={e => setForm({ ...form, maxDepartments: +e.target.value })} /></div>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}><label>TAVSIF</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0', marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={form.isPopular} onChange={e => setForm({ ...form, isPopular: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#FF6B00' }} />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>🔥 ENG OMMABOP REJA (HIGHLIGHT)</span>
                </label>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: 16, fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>SAHIFALAR VA MODULLARGA RUXSAT</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
                  {ALLOWED_MODULES.map(mod => {
                    const active = form.allowedModules.includes(mod.key);
                    return (
                      <div
                        key={mod.key}
                        onClick={() => toggleModule(mod.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                          borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s ease',
                          background: active ? 'rgba(255,107,0,0.05)' : '#fafafa',
                          border: active ? '2px solid #FF6B00' : '2px solid #e2e8f0',
                          boxShadow: active ? '0 4px 10px rgba(255,107,0,0.1)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: '1.5rem' }}>{mod.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: active ? '#FF6B00' : '#0f172a', lineHeight: 1.1 }}>{mod.label}</div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>{mod.desc}</div>
                        </div>
                        {active && <Check size={16} color="#FF6B00" strokeWidth={3} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            <div className="modal-footer" style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: 12 }}>
              <button type="submit" form="plan-form" className="btn" style={{ flex: 1, height: 48, background: '#FF6B00', color: 'white', fontWeight: 800 }}>SAQLASH VA YANGILASH</button>
              {editing && (
                <button type="button" onClick={() => setShowDeleteConfirm(true)} className="btn" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', height: 48, padding: '0 20px' }}>
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>Tarifni o'chirish</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 }}>
                <strong>{editing?.displayName}</strong> tarifini o'chirmoqchisiz. Unga ulangan workspacelar ta'sirlanishi mumkin!
              </p>
              {errorMsg && <div style={{ background: '#fee2e2', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: '0.85rem', marginBottom: 12 }}>{errorMsg}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1, background: '#64748b' }} onClick={() => { setShowDeleteConfirm(false); setErrorMsg(''); }}>Bekor qilish</button>
                <button className="btn" style={{ flex: 1, background: '#ef4444' }} onClick={handleDelete}>Ha, o'chirilsin</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
