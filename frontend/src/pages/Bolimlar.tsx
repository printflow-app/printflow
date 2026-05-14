import React, { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, Edit3, Save, Building2 } from 'lucide-react';
import { departmentsApi, billingApi, branchesApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';

interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  createdAt: string;
}

const Bolimlar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', description: '', branchId: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [maxDepartments, setMaxDepartments] = useState(0);
  const [filterBranchId, setFilterBranchId] = useState('');

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, statusRes, branchRes] = await Promise.all([
        departmentsApi.findAll(filterBranchId || undefined),
        billingApi.getStatus().catch(() => null),
        branchesApi.findAll().catch(() => ({ data: [] })),
      ]);
      setDepartments(res.data || []);
      setMaxDepartments((statusRes?.data as any)?.plan?.maxDepartments ?? 0);
      setBranches(Array.isArray(branchRes.data) ? branchRes.data : []);
    } catch {
      toast.error("Bo'limlarni yuklashda xatolik");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterBranchId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', branchId: '' });
    setIsSheetOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({ name: dept.name, description: dept.description || '', branchId: dept.branchId || '' });
    setIsSheetOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Nom kiritish shart");
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        branchId: form.branchId || undefined,
      };
      if (editing) {
        await departmentsApi.update(editing.id, payload);
        toast.success("Bo'lim yangilandi");
      } else {
        await departmentsApi.create(payload);
        toast.success("Yangi bo'lim yaratildi");
      }
      setIsSheetOpen(false);
      fetchData(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" bo'limini o'chirishga ishonchingiz komilmi?`)) return;
    try {
      await departmentsApi.delete(id);
      toast.success("Bo'lim o'chirildi");
      fetchData(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "O'chirishda xatolik");
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const atLimit = maxDepartments > 0 && departments.length >= maxDepartments;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="text-[#FF6B00]" size={24} /> Bo'limlar
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Tashkilot tarkibidagi ichki bo'linmalar</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Branch filter */}
          {branches.length > 0 && (
            <select
              value={filterBranchId}
              onChange={e => setFilterBranchId(e.target.value)}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[10px] font-black text-slate-700 uppercase tracking-widest focus:outline-none focus:border-orange-400"
            >
              <option value="">Barcha bo'limlar</option>
              <option value="__main__">Bosh ofis</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {maxDepartments > 0 && (
            <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${atLimit ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'}`}>
              {departments.length} / {maxDepartments}
            </span>
          )}
          <button
            disabled={atLimit}
            onClick={() => !atLimit && openCreate()}
            className={`h-12 px-6 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${atLimit ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#FF6B00] hover:bg-[#e66000] text-white shadow-orange-500/20'}`}
            title={atLimit ? `Limit to'ldi: ${maxDepartments} ta bo'lim` : ''}
          >
            <Plus size={18} strokeWidth={3} />
            {atLimit ? `Limit to'ldi (${departments.length}/${maxDepartments})` : "Yangi bo'lim"}
          </button>
        </div>
      </div>

      {/* Grid */}
      {departments.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 shadow-sm text-center">
          <Layers className="mx-auto text-slate-200 mb-4" size={64} />
          <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Hozircha bo'limlar yo'q</h3>
          <p className="text-xs text-slate-400 mt-2">Yangi bo'lim qo'shish uchun yuqoridagi tugmani bosing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div key={dept.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-xl hover:border-[#FF6B00]/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-[4rem] -mr-12 -mt-12 transition-all group-hover:bg-[#FF6B00]/5" />
              <div className="relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-[#FF6B00] border border-slate-100 flex items-center justify-center group-hover:bg-[#FF6B00] group-hover:text-white transition-all duration-300">
                    <Layers size={22} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(dept)} className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-[#FF6B00] flex items-center justify-center transition-all">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(dept.id, dept.name)} className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-black text-[#0f172a] uppercase tracking-tight mb-1 truncate">{dept.name}</h3>
                {dept.branch ? (
                  <div className="flex items-center gap-1 mb-2">
                    <Building2 size={11} className="text-orange-400" />
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{dept.branch.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mb-2">
                    <Building2 size={11} className="text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bosh ofis</span>
                  </div>
                )}
                <p className="text-xs font-bold text-slate-500 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                  {dept.description || "Tavsif kiritilmagan"}
                </p>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-end">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black text-emerald-600 uppercase">Aktiv</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isSheetOpen}
        onClose={() => !isSaving && setIsSheetOpen(false)}
        title={editing ? "Bo'limni tahrirlash" : "Yangi bo'lim"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Bo'lim nomi *</label>
            <input
              required autoFocus
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-minimal w-full"
              placeholder="Masalan: Poligrafiya bo'limi"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Filial</label>
            <select
              value={form.branchId}
              onChange={e => setForm({ ...form, branchId: e.target.value })}
              className="select-minimal w-full"
            >
              <option value="">Bosh ofis (filial tanlanmagan)</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Tavsif</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-minimal w-full resize-none"
              placeholder="Bo'lim vazifasi haqida qisqacha..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              className="btn-outline flex-1 h-12 rounded-xl text-xs font-black uppercase"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save size={15} strokeWidth={3} />
              {isSaving ? 'Saqlanmoqda...' : editing ? 'Saqlash' : "Yaratish"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Bolimlar;
