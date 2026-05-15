import { useState, useEffect } from 'react';
import { Upload, Trash2, Image } from 'lucide-react';
import { platformApi } from '../api';
import { useClientLogos, useInvalidate } from '../hooks/queries';

export default 
function Logos() {
  // RQ — client logos cache
  const { data: logosData } = useClientLogos();
  const invalidate = useInvalidate();
  const [logos, setLogos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync RQ data → local state (so optimistic updates from `save` still work)
  useEffect(() => {
    if (Array.isArray(logosData)) setLogos(logosData);
  }, [logosData]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const save = async (newLogos: string[]) => {
    setSaving(true);
    try {
      await platformApi.setClientLogos(newLogos);
      setLogos(newLogos);
      invalidate.clientLogos();
      showMsg('success', 'Saqlandi');
    } catch {
      showMsg('error', 'Xatolik');
    } finally { setSaving(false); }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showMsg('error', 'Fayl 500KB dan kichik bo\'lishi kerak'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => save([...logos, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      {msg && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, padding: '12px 20px', borderRadius: 12, fontWeight: 800, fontSize: '0.85rem', background: msg.type === 'success' ? '#10b981' : '#ef4444', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Mijozlar Logolari</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Landing page'dagi "Bizga ishonch bildirganlar" slayderida ko'rsatiladi</p>
        </div>
      </div>

      {/* Upload area */}
      <label style={{ display: 'block', border: '2px dashed #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center', cursor: 'pointer', marginBottom: 24, transition: 'all 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = '#FF6B00')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
      >
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={saving} />
        <Upload size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#94a3b8' }} />
        <p style={{ fontWeight: 800, color: '#64748b', marginBottom: 4 }}>Logo yuklash uchun bosing</p>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PNG, JPG, SVG, WebP • Maks 500KB</p>
      </label>

      {/* Logo grid */}
      {logos.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {logos.map((src, i) => (
            <div key={i} style={{ position: 'relative', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}
              onMouseEnter={e => (e.currentTarget.querySelector('.del-btn') as HTMLElement)!.style.opacity = '1'}
              onMouseLeave={e => (e.currentTarget.querySelector('.del-btn') as HTMLElement)!.style.opacity = '0'}
            >
              <img src={src} alt={`Logo ${i + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              <button className="del-btn" onClick={() => save(logos.filter((_, j) => j !== i))}
                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', boxShadow: '0 2px 6px rgba(239,68,68,0.4)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <Image size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontWeight: 700 }}>Hali logolar yo'q</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Yuqoridan logo yuklang — landing pageda avtomatik chiqadi</p>
        </div>
      )}

      {saving && <p style={{ textAlign: 'center', color: '#FF6B00', fontWeight: 800, marginTop: 16, fontSize: '0.85rem' }}>SAQLANMOQDA...</p>}
    </div>
  );
}
