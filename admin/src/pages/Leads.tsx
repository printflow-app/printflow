import { useState } from 'react';
import { X } from 'lucide-react';
import { tenantsApi, leadsApi } from '../api';
import { useUI } from '../ui';
import { useLeads, usePlans, useInvalidate } from '../hooks/queries';

export default 
function Leads() {
  const { toast, confirm } = useUI();
  const { data: leads = [] } = useLeads();
  const { data: plans = [] } = usePlans();
  const invalidate = useInvalidate();
  const [showModal, setShowModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [slug, setSlug] = useState('');
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);

  const load = () => invalidate.leads();

  const updateStatus = async (id: string, status: string) => { await leadsApi.updateStatus(id, status); load(); };

  const openCreateModal = (lead: any) => {
    setSelectedLead(lead);
    setSlug(lead.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || '');
    setPlanId('');
    setGeneratedCreds(null);
    setShowModal(true);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setLoading(true);
    try {
      const res = await tenantsApi.createFromLead({
        leadId: selectedLead.id,
        slug,
        planId: planId || undefined
      });
      setGeneratedCreds(res.data.credentials);
      load(); // refresh leads to show status closed
    } catch (err: any) {
      toast(err.response?.data?.message || 'Xatolik', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 24 }}>Demo So'rovlar</h2>
      <div className="table-container">
        <table>
          <thead><tr><th>Sana</th><th>Mijoz</th><th>Kompaniya</th><th>Aloqa</th><th>Holat</th><th>Amallar</th></tr></thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id}>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                <td><div style={{ fontWeight: 700 }}>{l.firstName} {l.lastName}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.role}</div></td>
                <td style={{ fontWeight: 700 }}>{l.companyName}</td>
                <td><div>{l.phone}</div>{l.telegramUser && <div style={{ color: '#3b82f6', fontSize: '0.85rem' }}>{l.telegramUser}</div>}</td>
                <td><span className="badge">{l.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)} style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: 6, borderRadius: 4 }}>
                      <option value="new">Yangi</option><option value="contacted">Bog'lanildi</option><option value="demo_done">Demo Qilindi</option><option value="closed">Yopilgan</option>
                    </select>
                    {l.status !== 'closed' && (
                      <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => openCreateModal(l)}>Workspace Ochish</button>
                    )}
                    <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={async () => {
                      const ok = await confirm({ title: 'So\'rovni o\'chirish', message: 'Ushbu demo so\'rov o\'chirilsinmi?', confirmText: 'O\'chirish', danger: true });
                      if (!ok) return;
                      try { await leadsApi.delete(l.id); toast('So\'rov o\'chirildi', 'success'); load(); }
                      catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
                    }}>O'chirish</button>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Ma'lumot topilmadi</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{generatedCreds ? 'Workspace Yaratildi!' : 'Workspace Yaratish'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={24} /></button>
            </div>
            {!generatedCreds ? (
              <form onSubmit={handleCreateWorkspace}>
                <div className="form-group">
                  <label>Mijoz Kompaniyasi</label>
                  <input readOnly value={selectedLead?.companyName || ''} style={{ background: 'var(--bg)' }} />
                </div>
                <div className="form-group">
                  <label>Workspace Slug (Manzil)</label>
                  <input required value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} placeholder="idealprint" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>printflow.uz/t/{slug || '...'}</span>
                </div>
                <div className="form-group">
                  <label>Tarif (ixtiyoriy)</label>
                  <select value={planId} onChange={e => setPlanId(e.target.value)} style={{ width: '100%', height: 48, border: '1px solid var(--border)', borderRadius: 6, padding: '0 16px', fontFamily: 'inherit' }}>
                    <option value="">Tanlanmagan (7 kunlik trial)</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </select>
                </div>
                <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} disabled={loading}>
                  {loading ? 'Yaratilmoqda...' : 'Workspace Yaratish'}
                </button>
              </form>
            ) : (
              <div>
                <p style={{ marginBottom: 16 }}>Mijoz uchun tizimga kirish ma'lumotlari yaratildi. Ushbu ma'lumotlarni mijozga yuboring:</p>
                <div className="generated-creds">
                  <p><strong>URL Manzil:</strong> /t/{generatedCreds.slug}</p>
                  <p><strong>Login:</strong> {generatedCreds.login}</p>
                  <p><strong>Parol:</strong> {generatedCreds.password}</p>
                </div>
                <button className="btn" style={{ width: '100%', height: 48, marginTop: 16 }} onClick={() => setShowModal(false)}>Yopish</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
