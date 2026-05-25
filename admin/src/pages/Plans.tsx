import { useState } from 'react';
import { Plus, X, Trash2, AlertCircle, Eye } from 'lucide-react';
import { plansApi } from '../api';
import { usePlans, useInvalidate } from '../hooks/queries';
import { ALLOWED_MODULES, defaultPlanForm as defaultForm } from '../shared/constants';

export default function Plans() {
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
      aiMessagesPerMonth: p.aiMessagesPerMonth ?? 100,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Tarif Rejalari</h2>
          <p className="text-xs text-slate-500">Mijoz workspacelari uchun obuna rejalari va tizim ruxsatlari</p>
        </div>
        <button 
          className="h-9 px-3 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
          onClick={openCreate}
        >
          <Plus size={14} /> Yangi Tarif
        </button>
      </div>

      {/* Plans List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {plans.map(p => (
          <div 
            key={p.id} 
            onClick={() => openEdit(p)}
            className={`bg-slate-900 rounded-xl p-5 border transition-all duration-200 hover:border-slate-700 flex flex-col justify-between cursor-pointer ${
              p.isPopular 
                ? 'border-orange-500/80 shadow-sm ring-1 ring-orange-500/20' 
                : 'border-slate-800'
            }`}
          >
            <div>
              {/* Title & Badge */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">{p.displayName}</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">{p.name}</p>
                </div>
                {p.isPopular && (
                  <span className="text-[9px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                    Eng Ommabop
                  </span>
                )}
              </div>

              {/* Price section */}
              <div className="py-3 border-t border-b border-slate-850 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-white">{(p.price3m || 0).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase">UZS / 3 oy</span>
                </div>
                {p.description && (
                  <p className="text-[11px] text-slate-400 mt-1 italic font-medium">"{p.description}"</p>
                )}
              </div>

              {/* Limits and features */}
              <div className="space-y-2">
                {[
                  { label: "Maks. Xodimlar", value: p.maxEmployees === 0 ? 'Cheksiz' : `${p.maxEmployees} ta` },
                  { label: "Maks. Filiallar", value: p.maxBranches === 0 ? 'Cheksiz' : `${p.maxBranches} ta` },
                  { label: "Maks. Bo'limlar", value: p.maxDepartments === 0 ? 'Cheksiz' : `${p.maxDepartments} ta` },
                  { label: "AI / 30 kun", value: (p.aiMessagesPerMonth ?? 0) === 0 ? 'Cheksiz' : `${p.aiMessagesPerMonth} xabar` },
                ].map((lim, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">{lim.label}</span>
                    <span className="text-slate-350 font-semibold">{lim.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer usage summary */}
            <div className="mt-5 pt-3 border-t border-slate-850 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1 hover:text-slate-305 transition-colors">
                <Eye size={12} /> Tahrirlash
              </span>
              <span className="bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-400">
                {p._count?.tenants || 0} ta workspace ulangan
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-slate-900 border border-slate-800 text-white">
            <div className="modal-header p-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                {editing ? 'Tarif Rejasini Tahrirlash' : 'Yangi Tarif Rejasi'}
              </h2>
              <button className="modal-close p-1" onClick={() => setShowModal(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            
            {errorMsg && (
              <div className="mx-4 mt-3 bg-rose-950/20 border border-rose-900/30 text-rose-450 rounded-lg p-3 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}
            
            <form id="plan-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="text-slate-400">NOMI (UNIKAL KALIT)</label>
                  <input 
                    required 
                    value={form.name} 
                    onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} 
                    placeholder="Masalan: STARTER, BUSINESS" 
                    disabled={!!editing}
                    className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500"
                  />
                </div>
                <div className="form-group">
                  <label className="text-slate-400">KO'RSATILADIGAN NOMI</label>
                  <input 
                    required 
                    value={form.displayName} 
                    onChange={e => setForm({ ...form, displayName: e.target.value })} 
                    placeholder="Starter Tarif" 
                    className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="text-slate-400">3 OYLIK NARX (UZS)</label>
                  <input type="number" required value={form.price3m} onChange={e => setForm({ ...form, price3m: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
                <div className="form-group">
                  <label className="text-slate-400">6 OYLIK NARX (UZS)</label>
                  <input type="number" required value={form.price6m} onChange={e => setForm({ ...form, price6m: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
                <div className="form-group">
                  <label className="text-slate-400">12 OYLIK NARX (UZS)</label>
                  <input type="number" required value={form.price12m} onChange={e => setForm({ ...form, price12m: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="text-slate-400">MAKS. XODIMLAR (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.maxEmployees} onChange={e => setForm({ ...form, maxEmployees: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
                <div className="form-group">
                  <label className="text-slate-400">MAKS. FILIALLAR (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.maxBranches} onChange={e => setForm({ ...form, maxBranches: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
                <div className="form-group">
                  <label className="text-slate-400">MAKS. BO'LIMLAR (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.maxDepartments} onChange={e => setForm({ ...form, maxDepartments: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="form-group">
                  <label className="text-slate-400">AI XABARLAR / 30 KUN (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.aiMessagesPerMonth} onChange={e => setForm({ ...form, aiMessagesPerMonth: +e.target.value })} className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
                  <p className="text-[10px] text-slate-500 mt-1">Foydalanuvchi obuna boshlangan kunidan 30 kunlik davr ichida yuborishi mumkin bo'lgan AI xabarlar soni.</p>
                </div>
              </div>

              <div className="form-group">
                <label className="text-slate-400">TARIF TAVSIFI</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Qisqacha izoh..." className="w-full h-8 text-xs border border-slate-800 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500" />
              </div>
              
              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox" 
                  id="isPopular"
                  checked={form.isPopular} 
                  onChange={e => setForm({ ...form, isPopular: e.target.checked })} 
                  className="w-4 h-4 text-orange-500 border-slate-800 bg-slate-950 focus:ring-orange-500 rounded cursor-pointer"
                />
                <label htmlFor="isPopular" className="text-xs font-semibold text-slate-350 cursor-pointer select-none">
                  Eng Ommabop Reja (Highlight)
                </label>
              </div>

              {/* Modules selector */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Modullar & Ruxsatlar</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALLOWED_MODULES.map(mod => {
                    const active = form.allowedModules.includes(mod.key);
                    return (
                      <div
                        key={mod.key}
                        onClick={() => toggleModule(mod.key)}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          active 
                            ? 'border-orange-500 bg-orange-500/10' 
                            : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className={`text-xs font-bold ${active ? 'text-orange-500' : 'text-white'}`}>{mod.label}</p>
                          <p className="text-[9px] text-slate-500 truncate mt-0.5">{mod.desc}</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={active}
                          readOnly
                          className="w-4 h-4 text-orange-500 border-slate-800 bg-slate-900 rounded cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex items-center gap-2">
              <button 
                type="submit" 
                form="plan-form" 
                className="flex-1 h-9 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all"
              >
                SAQLASH VA YANGILASH
              </button>
              {editing && (
                <button 
                  type="button" 
                  onClick={() => setShowDeleteConfirm(true)} 
                  className="h-9 px-3 rounded-lg border border-rose-900/35 bg-rose-950/20 hover:bg-rose-900/20 text-rose-400 transition-colors flex items-center justify-center"
                  title="Tarifni O'chirish"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xs text-center p-5 space-y-3 bg-slate-900 border border-slate-800 text-white">
            <div className="w-10 h-10 bg-amber-950/20 border border-amber-900/30 rounded-lg flex items-center justify-center text-amber-500 mx-auto">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Tarifni o'chirish</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Haqiqatan ham <strong className="text-white">"{editing?.displayName}"</strong> tarifini o'chirmoqchimisiz?
              </p>
            </div>
            {errorMsg && (
              <div className="bg-rose-950/20 border border-rose-900/30 text-rose-450 rounded-lg p-2.5 text-xs font-bold">{errorMsg}</div>
            )}
            <div className="flex gap-2">
              <button 
                className="flex-1 h-8 text-xs font-semibold bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded-md transition-all" 
                onClick={() => { setShowDeleteConfirm(false); setErrorMsg(''); }}
              >
                Bekor qilish
              </button>
              <button 
                className="flex-1 h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-all" 
                onClick={handleDelete}
              >
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
