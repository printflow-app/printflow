import { useState } from 'react';
import { Plus, X, Trash2, AlertCircle, Eye } from 'lucide-react';
import { plansApi } from '../api';
import { usePlans, useInvalidate } from '../hooks/queries';
import { ALLOWED_MODULES, defaultPlanForm as defaultForm, computePlanPrices, PLAN_DURATION_DISCOUNTS, ESKI_6OY_CHEGIRMA } from '../shared/constants';

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
    // Oylik baza narx 12 oylik narxdan (-10% chegirma bilan) teskari
    // hisoblanadi. Eski tariflarda 12 oylik narx bo'lmasligi mumkin —
    // u holda 6 oylikdan olamiz, aks holda tahrirlash oynasi narxni 0
    // ko'rsatib, saqlashda tarifni bepul qilib qo'yardi.
    const monthlyPrice = p.price12m
      ? Math.round(p.price12m / 12 / (1 - PLAN_DURATION_DISCOUNTS[12]))
      : p.price6m
        ? Math.round(p.price6m / 6 / (1 - ESKI_6OY_CHEGIRMA))
        : 0;
    setForm({
      name: p.name, displayName: p.displayName,
      monthlyPrice,
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
    const { monthlyPrice, ...rest } = form;
    const payload = { ...rest, ...computePlanPrices(monthlyPrice) };
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
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Tarif Rejalari</h2>
          <p className="text-xs text-slate-500">Mijoz workspacelari uchun obuna rejalari va tizim ruxsatlari</p>
        </div>
        <button
          className="h-9 px-3 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-orange-500/20"
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
            className={`bg-white rounded-xl p-5 border transition-all duration-200 hover:border-slate-300 flex flex-col justify-between cursor-pointer ${
              p.isPopular
                ? 'border-orange-500/80 ring-1 ring-orange-500/20'
                : 'border-[color:var(--border)]'
            }`}
          >
            <div>
              {/* Title & Badge */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{p.displayName}</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">{p.name}</p>
                </div>
                {p.isPopular && (
                  <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded uppercase tracking-wider">
                    Eng Ommabop
                  </span>
                )}
              </div>

              {/* Price section */}
              <div className="py-3 border-t border-b border-[color:var(--border)] mb-4">
                <div className="flex items-baseline gap-3">
                  <div>
                    <span className="text-lg font-extrabold text-slate-900">{(p.price12m || 0).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase"> / 12 oy</span>
                  </div>
                </div>
                {p.description && (
                  <p className="text-[11px] text-slate-500 mt-1 italic font-medium">"{p.description}"</p>
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
                    <span className="text-slate-800 font-semibold">{lim.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer usage summary */}
            <div className="mt-5 pt-3 border-t border-[color:var(--border)] flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                <Eye size={12} /> Tahrirlash
              </span>
              <span className="bg-slate-50 border border-[color:var(--border)] px-2 py-0.5 rounded text-slate-600">
                {p._count?.tenants || 0} ta workspace ulangan
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-white border border-[color:var(--border)] text-slate-900">
            <div className="flex items-center justify-between p-4 border-b border-[color:var(--border)]">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                {editing ? 'Tarif Rejasini Tahrirlash' : 'Yangi Tarif Rejasi'}
              </h2>
              <button className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle size={14} /> {errorMsg}
              </div>
            )}

            <form id="plan-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">NOMI (UNIKAL KALIT)</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })}
                    placeholder="Masalan: STARTER, BUSINESS"
                    disabled={!!editing}
                    className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">KO'RSATILADIGAN NOMI</label>
                  <input
                    required
                    value={form.displayName}
                    onChange={e => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Starter Tarif"
                    className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">OYLIK NARX — BAZA (UZS)</label>
                <input type="number" required min={0} value={form.monthlyPrice} onChange={e => setForm({ ...form, monthlyPrice: +e.target.value })} className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500" />
                <div className="mt-2">
                  <div className="bg-slate-50 border border-[color:var(--border)] rounded-lg px-2.5 py-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">12 oy (-10%) — mijozga shu narx ko'rinadi</p>
                    <p className="text-xs font-bold text-slate-800">{computePlanPrices(form.monthlyPrice).price12m.toLocaleString()} UZS</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">MAKS. XODIMLAR (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.maxEmployees} onChange={e => setForm({ ...form, maxEmployees: +e.target.value })} className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">MAKS. FILIALLAR (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.maxBranches} onChange={e => setForm({ ...form, maxBranches: +e.target.value })} className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">MAKS. BO'LIMLAR (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.maxDepartments} onChange={e => setForm({ ...form, maxDepartments: +e.target.value })} className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">AI XABARLAR / 30 KUN (0 = CHEKSIZ)</label>
                  <input type="number" required min={0} value={form.aiMessagesPerMonth} onChange={e => setForm({ ...form, aiMessagesPerMonth: +e.target.value })} className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500" />
                  <p className="text-[10px] text-slate-500 mt-1">Foydalanuvchi obuna boshlangan kunidan 30 kunlik davr ichida yuborishi mumkin bo'lgan AI xabarlar soni.</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">TARIF TAVSIFI</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Qisqacha izoh..." className="w-full h-9 text-xs border border-[color:var(--border)] bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500" />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={form.isPopular}
                  onChange={e => setForm({ ...form, isPopular: e.target.checked })}
                  className="w-4 h-4 text-orange-500 border-slate-300 bg-white focus:ring-orange-500 rounded cursor-pointer"
                />
                <label htmlFor="isPopular" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
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
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-[color:var(--border)] bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className={`text-xs font-bold ${active ? 'text-orange-600' : 'text-slate-900'}`}>{mod.label}</p>
                          <p className="text-[9px] text-slate-500 truncate mt-0.5">{mod.desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={active}
                          readOnly
                          className="w-4 h-4 text-orange-500 border-slate-300 bg-white rounded cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[color:var(--border)] bg-slate-50 flex items-center gap-2">
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
                  className="h-9 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors flex items-center justify-center"
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
          <div className="modal-content max-w-xs text-center p-5 space-y-3 bg-white border border-[color:var(--border)] text-slate-900">
            <div className="w-10 h-10 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-center text-amber-600 mx-auto">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Tarifni o'chirish</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Haqiqatan ham <strong className="text-slate-900">"{editing?.displayName}"</strong> tarifini o'chirmoqchimisiz?
              </p>
            </div>
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs font-bold">{errorMsg}</div>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 h-8 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-[color:var(--border)] text-slate-700 rounded-md transition-all"
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
