import { useState } from 'react';
import { X, Send, Trash2 } from 'lucide-react';
import { tenantsApi, leadsApi } from '../api';
import { useUI } from '../ui';
import { useLeads, usePlans, useInvalidate } from '../hooks/queries';

const STATUS_LABELS: Record<string, string> = {
  new: 'Yangi',
  contacted: "Bog'lanildi",
  demo_done: 'Demo Qilindi',
  closed: 'Yopilgan',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-amber-500',
  demo_done: 'bg-purple-500',
  closed: 'bg-slate-400',
};

export default function Leads() {
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

  const updateStatus = async (id: string, status: string) => {
    try {
      await leadsApi.updateStatus(id, status);
      load();
      toast('Status yangilandi', 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xatolik', 'error');
    }
  };

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
      load();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Xatolik', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Demo So'rovlar</h2>
        <p className="text-xs text-slate-500">Mijozlar tomonidan qoldirilgan demo so'rovlari va ariza holatlari</p>
      </div>

      {/* Leads Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850 bg-slate-950/20 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Sana</th>
                <th className="py-3 px-4">Mijoz</th>
                <th className="py-3 px-4">Kompaniya</th>
                <th className="py-3 px-4">Aloqa</th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
              {leads.map(l => (
                <tr key={l.id} className="hover:bg-slate-850/20 transition-colors">
                  <td className="py-3.5 px-4 text-slate-500 font-medium font-mono">
                    {new Date(l.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-3.5 px-4">
                    <div>
                      <p className="font-semibold text-white">{l.firstName} {l.lastName}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{l.role || 'Xodim'}</p>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-white">{l.companyName}</td>
                  <td className="py-3.5 px-4 space-y-0.5">
                    <p className="font-medium text-slate-350">{l.phone}</p>
                    {l.telegramUser && (
                      <a 
                        href={`https://t.me/${l.telegramUser.replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-500 font-medium inline-flex items-center gap-1"
                      >
                        <Send size={10} />
                        <span>{l.telegramUser}</span>
                      </a>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[l.status] || 'bg-slate-400'}`} />
                      {STATUS_LABELS[l.status] || l.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <select 
                        value={l.status} 
                        onChange={e => updateStatus(l.id, e.target.value)} 
                        className="h-7 border border-slate-800 rounded-md px-1.5 text-[11px] font-bold outline-none bg-slate-950 text-slate-300 hover:border-slate-700 transition-all cursor-pointer focus:border-orange-500"
                      >
                        <option value="new">Yangi</option>
                        <option value="contacted">Bog'lanildi</option>
                        <option value="demo_done">Demo Qilindi</option>
                        <option value="closed">Yopilgan</option>
                      </select>

                      {l.status !== 'closed' && (
                        <button 
                          onClick={() => openCreateModal(l)}
                          className="h-7 px-2.5 text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-all shadow-sm"
                        >
                          Workspace Ochish
                        </button>
                      )}

                      <button 
                        onClick={async () => {
                          const ok = await confirm({ title: 'So\'rovni o\'chirish', message: 'Ushbu demo so\'rovni ro\'yxatdan o\'chirmoqchisiz?', confirmText: 'O\'chirish', danger: true });
                          if (!ok) return;
                          try { await leadsApi.delete(l.id); toast('So\'rov o\'chirildi', 'success'); load(); }
                          catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
                        }} 
                        className="h-7 w-7 flex items-center justify-center bg-slate-950 hover:bg-rose-950/20 text-rose-500 border border-slate-800 hover:border-rose-900/30 rounded-md transition-all"
                        title="O'chirish"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">
                    Demo so'rovlar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workspace Create Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm bg-slate-900 border border-slate-800 text-white">
            <div className="modal-header p-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                {generatedCreds ? 'Workspace Yaratildi!' : 'Workspace Yaratish'}
              </h2>
              <button className="modal-close p-1" onClick={() => setShowModal(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            
            <div className="p-5">
              {!generatedCreds ? (
                <form onSubmit={handleCreateWorkspace} className="space-y-4 text-xs">
                  <div className="form-group">
                    <label className="text-slate-400">Mijoz Kompaniyasi</label>
                    <input readOnly value={selectedLead?.companyName || ''} className="bg-slate-950 cursor-not-allowed font-semibold w-full h-8 text-xs border border-slate-850 rounded-lg text-slate-350" />
                  </div>
                  <div className="form-group">
                    <label className="text-slate-400">Workspace Slug (Tizim URL manzili)</label>
                    <input 
                      required 
                      value={slug} 
                      onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} 
                      placeholder="idealprint" 
                      autoFocus
                      className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500"
                    />
                    <span className="text-[10px] font-bold text-slate-500 mt-1 block">
                      printflow.uz/t/{slug || '...'}
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="text-slate-400">Tarif Rejasi (ixtiyoriy)</label>
                    <select 
                      value={planId} 
                      onChange={e => setPlanId(e.target.value)} 
                      className="w-full h-8 border border-slate-800 bg-slate-950 text-slate-300 rounded-lg px-2 text-xs outline-none focus:border-orange-500"
                    >
                      <option value="">Tanlanmagan (7 kunlik trial)</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all mt-2" 
                    disabled={loading}
                  >
                    {loading ? 'Yaratilmoqda...' : 'Workspace Yaratish'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-xs">
                  <p className="text-slate-400 font-medium">
                    Mijoz uchun tizimga kirish ma'lumotlari yaratildi:
                  </p>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                    <p><span className="text-slate-400">Workspace URL:</span> <span className="text-white select-all font-semibold">/t/{generatedCreds.slug}</span></p>
                    <p><span className="text-slate-400">Login:</span> <span className="text-white select-all font-semibold">{generatedCreds.login}</span></p>
                    <p><span className="text-slate-400">Parol:</span> <span className="text-white select-all font-semibold">{generatedCreds.password}</span></p>
                  </div>
                  <button 
                    className="w-full h-9 bg-slate-950 hover:bg-slate-855 border border-slate-800 text-white text-xs font-bold rounded-lg transition-all mt-2" 
                    onClick={() => setShowModal(false)}
                  >
                    Yopish
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
