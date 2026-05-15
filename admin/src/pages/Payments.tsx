import { useState, useEffect } from 'react';
import { Check, X, XCircle } from 'lucide-react';
import { tenantsApi, settingsApi } from '../api';
import { useUI } from '../ui';
import { usePendingPayments, useAllPayments, useInvalidate } from '../hooks/queries';

export default 
function Payments() {
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const pendingQuery = usePendingPayments();
  const allQuery = useAllPayments();
  const payments = (tab === 'pending' ? pendingQuery.data : allQuery.data) || [];
  const invalidate = useInvalidate();
  const [cards, setCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [savingCards, setSavingCards] = useState(false);

  const loadPayments = () => invalidate.payments();

  const loadCards = () => {
    settingsApi.get('PAYMENT_CARDS')
      .then(r => { setCards(r.data.value || []); })
      .catch(() => { setCards([]); })
      .finally(() => setCardsLoading(false));
  };

  useEffect(() => { loadCards(); }, []);

  const approve = async (id: string) => {
    const ok = await confirm({ title: "To'lovni tasdiqlash", message: 'Ushbu to\'lovni tasdiqlaysizmi?', confirmText: 'Tasdiqlash' });
    if (!ok) return;
    try {
      await tenantsApi.approvePayment(id);
      toast("To'lov tasdiqlandi", 'success');
      loadPayments();
    } catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };
  const reject = async (id: string) => {
    const ok = await confirm({ title: "To'lovni rad etish", message: 'Ushbu to\'lovni rad etasizmi?', confirmText: 'Rad etish', danger: true });
    if (!ok) return;
    try {
      await tenantsApi.rejectPayment(id);
      toast("To'lov rad etildi", 'success');
      loadPayments();
    } catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const handleSaveCards = async () => {
    setSavingCards(true);
    try {
      await settingsApi.update('PAYMENT_CARDS', cards);
      toast('Kartalar saqlandi!', 'success');
    } catch { toast('Xatolik!', 'error'); }
    finally { setSavingCards(false); }
  };

  const addCard = () => setCards([...cards, { name: '', number: '', owner: '' }]);
  const removeCard = (idx: number) => setCards(cards.filter((_, i) => i !== idx));
  const updateCard = (idx: number, field: string, val: string) => {
    const newCards = [...cards];
    newCards[idx][field] = val;
    setCards(newCards);
  };

  const statusBadge = (s: string) => {
    if (s === 'APPROVED') return <span className="badge active">TASDIQLANGAN</span>;
    if (s === 'REJECTED') return <span className="badge inactive">RAD ETILGAN</span>;
    return <span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>KUTILMOQDA</span>;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 40 }}>
      {/* 1. Payments Table */}
      <div className="animate-fade-in">
        <div className="flex-between" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>To'lovlar</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={tab === 'pending' ? 'btn' : 'btn btn-outline-tab'} style={tab !== 'pending' ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' } : {}} onClick={() => setTab('pending')}>Kutilayotgan</button>
            <button className={tab === 'all' ? 'btn' : 'btn btn-outline-tab'} style={tab !== 'all' ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' } : {}} onClick={() => setTab('all')}>Barcha</button>
          </div>
        </div>
        <div className="table-container shadow-sm">
          <table>
            <thead><tr><th>Sana</th><th>Workspace</th><th>Tarif</th><th>Muddat</th><th>Summa</th><th>Yuboruvchi</th><th>Holat</th><th>Amallar</th></tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 700 }}>{p.tenant?.name || '—'}</td>
                  <td>{p.planName}</td>
                  <td>{p.duration} oy</td>
                  <td style={{ fontWeight: 700 }}>{p.amount?.toLocaleString()} UZS</td>
                  <td>{p.sender}</td>
                  <td>{statusBadge(p.status)}</td>
                  <td>
                    {p.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => approve(p.id)}><Check size={14} /> Tasdiqlash</button>
                        <button className="btn-danger" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer', borderRadius: 6, fontWeight: 800, fontFamily: 'inherit' }} onClick={() => reject(p.id)}><XCircle size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>Ma'lumot topilmadi</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Card Management */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-fade-in" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase' }}>To'lov Kartalari</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Mijozlar to'lov sahifasida ko'radigan karta raqamlari</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={addCard} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>+ Karta Qo'shish</button>
            <button onClick={handleSaveCards} disabled={savingCards} className="btn" style={{ padding: '8px 20px', fontSize: '0.8rem' }}>
              {savingCards ? 'Saqlanmoqda...' : 'SAQLASH'}
            </button>
          </div>
        </div>

        {cardsLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Yuklanmoqda...</div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {cards.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>Kartalar mavjud emas. Mijozlar to'lov qila olishi uchun karta qo'shing.</p>}
            {cards.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end', background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Karta Turi (Masalan: Humo)</label>
                  <input type="text" value={c.name} onChange={e => updateCard(i, 'name', e.target.value)} placeholder="UzCard / Humo" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Karta Raqami</label>
                  <input type="text" value={c.number} onChange={e => updateCard(i, 'number', e.target.value)} placeholder="0000 0000 0000 0000" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '1px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Ega Ism-Familiyasi</label>
                  <input type="text" value={c.owner} onChange={e => updateCard(i, 'owner', e.target.value)} placeholder="PrintFlow LLC" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }} />
                </div>
                <button onClick={() => removeCard(i)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', width: 40, height: 40, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} className="hover:bg-rose-100">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
