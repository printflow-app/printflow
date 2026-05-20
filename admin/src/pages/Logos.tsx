import { useState, useEffect } from 'react';
import { Upload, Trash2, Image, CheckCircle2, AlertCircle } from 'lucide-react';
import { platformApi } from '../api';
import { useClientLogos, useInvalidate } from '../hooks/queries';

export default function Logos() {
  const { data: logosData } = useClientLogos();
  const invalidate = useInvalidate();
  const [logos, setLogos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      showMsg('success', 'Logolar muvaffaqiyatli saqlandi');
    } catch {
      showMsg('error', 'Saqlashda xatolik yuz berdi');
    } finally { setSaving(false); }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { 
      showMsg('error', "Fayl hajmi 500KB dan kichik bo'lishi kerak"); 
      return; 
    }
    const reader = new FileReader();
    reader.onload = (ev) => save([...logos, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {msg && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg shadow-md text-xs font-bold text-white flex items-center gap-2 animate-fade-in ${
          msg.type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-rose-600 border border-rose-500'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Mijozlar Logolari</h2>
        <p className="text-xs text-slate-500">Landing page slayderida namoyish etiladigan mijoz hamkor logotiplari boshqaruvi</p>
      </div>

      {/* Upload Zone */}
      <label className="block border border-dashed border-slate-800 hover:border-orange-500/80 rounded-xl p-8 text-center cursor-pointer transition-all bg-slate-900 hover:bg-slate-850/50">
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={saving} />
        <Upload size={24} className="mx-auto mb-2 text-slate-500" />
        <p className="text-xs font-bold text-slate-300">Logo yuklash uchun bosing</p>
        <p className="text-[10px] text-slate-500 font-medium mt-0.5">PNG, JPG, SVG, WebP • Maks 500KB</p>
      </label>

      {/* Logo Grid */}
      {logos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {logos.map((src, i) => (
            <div 
              key={i} 
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 h-24 flex items-center justify-center relative group transition-all"
            >
              <img src={src} alt={`Client Logo ${i + 1}`} className="max-w-full max-h-full object-contain filter grayscale opacity-50 hover:opacity-90 hover:grayscale-0 transition-all" />
              
              <button 
                onClick={() => save(logos.filter((_, j) => j !== i))}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded bg-slate-800 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-slate-750"
                title="Logoni o'chirish"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Image size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-xs font-bold text-slate-500">Logotiplar yuklanmagan</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Yuqoridagi maydon orqali yangi rasm yuklang.</p>
        </div>
      )}

      {saving && (
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-orange-500 animate-pulse">
          <span>Saqlanmoqda...</span>
        </div>
      )}
    </div>
  );
}
