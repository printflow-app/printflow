import React, { useEffect, useState } from 'react';
import { tenantsApi } from '../api';

export default 
function PromoCodes() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tenantsApi.getPromoCodes()
      .then(r => setPromos(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Yuklanmoqda...</div>;

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 24 }}>Promo Kodlar va Cashbacklar</h2>
      
      <div className="table-container shadow-sm" style={{ marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Egasi (Workspace)</th>
              <th>Jalb qildi (ta)</th>
              <th>Jami topdi</th>
              <th>Balans</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {promos.map(p => (
              <React.Fragment key={p.id}>
                <tr>
                  <td style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)' }}>{p.code}</td>
                  <td style={{ fontWeight: 700 }}>{p.tenant?.name || '—'} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.tenant?.slug})</span></td>
                  <td><span className="badge" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{p.totalReferrals} ta</span></td>
                  <td style={{ fontWeight: 800, color: '#10b981' }}>{p.totalEarned?.toLocaleString()} UZS</td>
                  <td style={{ fontWeight: 800 }}>{p.cashbackBalance?.toLocaleString()} UZS</td>
                  <td>{p.isActive ? <span className="badge active">Faol</span> : <span className="badge inactive">Nofaol</span>}</td>
                </tr>
                {p.usages && p.usages.length > 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <div style={{ padding: '12px 24px' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Ishlatilish tarixi:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {p.usages.map((u: any) => (
                            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, fontSize: '0.8rem', padding: '8px 12px', backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <span><strong>Kim ishlatdi:</strong> {u.usingTenant?.name}</span>
                              <span><strong>Tarif:</strong> {u.planName}</span>
                              <span><strong>To'lov:</strong> {u.paymentAmount?.toLocaleString()} UZS</span>
                              <span style={{ color: '#ef4444' }}><strong>Chegirma:</strong> -{u.discount?.toLocaleString()} UZS</span>
                              <span style={{ color: '#10b981' }}><strong>Cashback:</strong> +{u.cashbackEarned?.toLocaleString()} UZS</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {promos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>Promo kodlar yo'q</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
