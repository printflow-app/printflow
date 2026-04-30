import React, { useEffect, useState } from 'react';
import { Building2, Plus, Trash2, Edit3, Phone, MapPin, Save, X } from 'lucide-react';
import { branchesApi, employeesApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';

interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  managerEmployeeId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const Filiallar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canManage = isAdmin || currentUser?.permissions?.canManageBranches;

  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', managerEmployeeId: '' });
  const [confirmDel, setConfirmDel] = useState<Branch | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, eRes] = await Promise.all([branchesApi.findAll(), employeesApi.findAll()]);
      setBranches(Array.isArray(bRes.data) ? bRes.data : []);
      setEmployees(Array.isArray(eRes.data) ? eRes.data : []);
    } catch (err) {
      console.error('Filiallarni yuklashda xato:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '', managerEmployeeId: '' });
    setModalOpen(true);
  };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      address: b.address || '',
      phone: b.phone || '',
      managerEmployeeId: b.managerEmployeeId || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Filial nomi kiritilishi shart'); return; }
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        managerEmployeeId: form.managerEmployeeId || undefined,
      };
      if (editing) {
        await branchesApi.update(editing.id, payload);
        toast.success('Filial yangilandi');
      } else {
        await branchesApi.create(payload);
        toast.success('Filial qo\'shildi');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Xatolik yuz berdi');
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await branchesApi.delete(confirmDel.id);
      toast.success('Filial o\'chirildi');
      setConfirmDel(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'O\'chirishda xato');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="text-orange-600" size={22} /> Filiallar
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Multi-filial boshqaruvi</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="bg-orange-600 hover:bg-orange-700 text-white h-10 px-6 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2">
            <Plus size={16} strokeWidth={3} /> Yangi filial
          </button>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Building2 className="mx-auto text-slate-300 mb-3" size={48} />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Hozircha filiallar yo'q</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => {
            const manager = employees.find((e) => e.id === b.managerEmployeeId);
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all hover:shadow-md hover:border-orange-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center"><Building2 size={20} /></div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(b)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"><Edit3 size={14} /></button>
                      <button onClick={() => setConfirmDel(b)} className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                <h3 className="text-base font-black text-slate-800 tracking-tight mb-1">{b.name}</h3>
                {b.address && <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1"><MapPin size={12} /> {b.address}</p>}
                {b.phone && <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-1"><Phone size={12} /> {b.phone}</p>}
                {manager && <p className="text-[11px] font-bold text-slate-600 mt-2 pt-2 border-t border-slate-100">Mas'ul: <span className="text-slate-800 font-black">{manager.fullName}</span></p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Filialni tahrirlash' : 'Yangi filial'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Filial nomi *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" placeholder="Toshkent filiali" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Manzil</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" placeholder="Chilonzor, 5-mavze" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Telefon</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none" placeholder="+998 90 123 45 67" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Mas'ul xodim</label>
            <select value={form.managerEmployeeId} onChange={(e) => setForm({ ...form, managerEmployeeId: e.target.value })} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none">
              <option value="">Tanlanmagan</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
              <X size={14} /> Bekor
            </button>
            <button type="submit" className="flex-2 px-6 h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
              <Save size={14} /> {editing ? 'Yangilash' : 'Yaratish'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm delete */}
      {confirmDel && (
        <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Filialni o'chirish">
          <div className="space-y-4">
            <p className="text-sm font-bold text-slate-600">
              <strong className="text-slate-900">{confirmDel.name}</strong> filiali butunlay o'chirilsinmi?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="flex-1 h-11 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest">Bekor</button>
              <button onClick={handleDelete} className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest">Ha, o'chirilsin</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Filiallar;
