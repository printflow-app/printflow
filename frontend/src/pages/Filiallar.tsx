import React, { useEffect, useState } from 'react';
import {
  Building2, Plus, Trash2, Edit3, Phone, MapPin, Save, X,
  Handshake, Search, TrendingDown, Briefcase, ClipboardList, AlertCircle, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import CurrencyInput from '../components/CurrencyInput';
import { branchesApi, employeesApi, vendorsApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';

interface Branch {
  id: string; name: string; address?: string; phone?: string;
  managerEmployeeId?: string; isActive: boolean; createdAt: string; updatedAt: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.abs(amount)).replace(/,/g, ' ') + ' UZS';

// ─── FILIALLAR TAB ───────────────────────────────────────────────────────────
const FiliallarTab: React.FC<{ currentUser: any }> = ({ currentUser }) => {
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
    } catch { console.error('Filiallarni yuklashda xato'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', address: '', phone: '', managerEmployeeId: '' }); setModalOpen(true); };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, address: b.address || '', phone: b.phone || '', managerEmployeeId: b.managerEmployeeId || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Filial nomi kiritilishi shart'); return; }
    try {
      const payload = { name: form.name.trim(), address: form.address.trim() || undefined, phone: form.phone.trim() || undefined, managerEmployeeId: form.managerEmployeeId || undefined };
      if (editing) { await branchesApi.update(editing.id, payload); toast.success('Filial yangilandi'); }
      else { await branchesApi.create(payload); toast.success("Filial qo'shildi"); }
      setModalOpen(false); fetchData();
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Xatolik yuz berdi'); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try { await branchesApi.delete(confirmDel.id); toast.success("Filial o'chirildi"); setConfirmDel(null); fetchData(); }
    catch (err: any) { toast.error(err?.response?.data?.message || "O'chirishda xato"); }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><X size={14} /> Bekor</button>
            <button type="submit" className="flex-2 px-6 h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"><Save size={14} /> {editing ? 'Yangilash' : 'Yaratish'}</button>
          </div>
        </form>
      </Modal>

      {confirmDel && (
        <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Filialni o'chirish">
          <div className="space-y-4">
            <p className="text-sm font-bold text-slate-600"><strong className="text-slate-900">{confirmDel.name}</strong> filiali butunlay o'chirilsinmi?</p>
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

// ─── HAMKORLAR TAB ───────────────────────────────────────────────────────────
const HamkorlarTab: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';

  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [detailVendor, setDetailVendor] = useState<any | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', phone: '', specialty: '' });

  const [payVendor, setPayVendor] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const res = await vendorsApi.findAll();
      setVendors(res.data || []);
    } catch { showStatus('error', 'Hamkorlarni yuklashda xatolik!'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchVendors(); }, []);

  const openAdd = () => { setForm({ id: '', name: '', phone: '', specialty: '' }); setIsEditing(false); setIsFormOpen(true); };
  const openEdit = (v: any) => { setForm({ id: v.id, name: v.name, phone: v.phone || '', specialty: v.specialty || '' }); setIsEditing(true); setIsFormOpen(true); };

  const openDetail = async (v: any) => {
    setDetailVendor(v); setIsDetailOpen(true); setIsDetailLoading(true);
    try { const res = await vendorsApi.findOne(v.id); setDetailData(res.data); }
    catch { setDetailData(null); }
    finally { setIsDetailLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (isEditing) { await vendorsApi.update(form.id, { name: form.name, phone: form.phone, specialty: form.specialty }); showStatus('success', 'Hamkor yangilandi!'); }
      else { await vendorsApi.create({ name: form.name, phone: form.phone, specialty: form.specialty }); showStatus('success', "Yangi hamkor qo'shildi!"); }
      setIsFormOpen(false); fetchVendors();
    } catch { showStatus('error', 'Saqlashda xatolik!'); }
  };

  const handlePayVendor = async () => {
    if (!payVendor || !payAmount || Number(payAmount) <= 0) return;
    setIsPaying(true);
    try {
      await vendorsApi.pay(payVendor.id, Number(payAmount));
      showStatus('success', `${Number(payAmount).toLocaleString()} UZS to'landi!`);
      setPayVendor(null); setPayAmount(''); fetchVendors();
      if (detailVendor?.id === payVendor.id) { const res = await vendorsApi.findOne(payVendor.id); setDetailData(res.data); }
    } catch { showStatus('error', "To'lashda xatolik!"); }
    finally { setIsPaying(false); }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    try { await vendorsApi.remove(confirmId); showStatus('success', "Hamkor o'chirildi."); setConfirmId(null); fetchVendors(); }
    catch { showStatus('error', "O'chirishda xatolik!"); }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone || '').includes(searchTerm) ||
    (v.specialty || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="font-bold text-sm">{statusMessage.text}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input type="text" placeholder="Qidirish..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 h-10 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-orange-400 transition-all" />
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center justify-center gap-2 h-10 px-5 bg-[#FF6B00] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-[#E65A00] transition-all">
            <Plus size={14} strokeWidth={3} /> HAMKOR QO'SHISH
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Jami hamkorlar</p>
          <p className="text-2xl font-black text-slate-800">{vendors.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Umumiy qarz (bizdan)</p>
          <p className="text-lg font-black text-rose-500">{formatCurrency(vendors.reduce((s, v) => s + Math.min(0, v.balance || 0), 0))}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faol hamkorlar</p>
          <p className="text-2xl font-black text-emerald-600">{vendors.filter(v => (v._count?.orderCosts || 0) > 0).length}</p>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400/40">
          <Handshake size={48} className="mb-4" />
          <p className="font-black uppercase tracking-widest text-xs italic">{searchTerm ? 'Hamkor topilmadi' : "Hamkorlar ro'yxati bo'sh"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => {
            const owes = (v.balance || 0) < 0;
            return (
              <div key={v.id} onClick={() => openDetail(v)} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 font-black text-sm">{v.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase group-hover:text-orange-700 transition-colors">{v.name}</p>
                      {v.specialty && <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 mt-0.5"><Briefcase size={8} /> {v.specialty}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(v.balance || 0) < 0 && (
                        <button onClick={e => { e.stopPropagation(); setPayVendor(v); setPayAmount(String(Math.abs(v.balance))); }} className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-500 hover:text-white flex items-center justify-center transition-all"><TrendingDown size={13} /></button>
                      )}
                      <button onClick={e => { e.stopPropagation(); openEdit(v); }} className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-400 hover:text-sky-500 flex items-center justify-center transition-all"><Edit3 size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); setConfirmId(v.id); setConfirmName(v.name); }} className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-all"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-50">
                  {v.phone && <span className="text-[9px] font-black text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 flex items-center gap-1"><Phone size={8} /> {v.phone}</span>}
                  <span className="text-[9px] font-black text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center gap-1"><ClipboardList size={8} /> {v._count?.orderCosts || 0} buyurtma</span>
                  {owes && <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 flex items-center gap-1"><TrendingDown size={8} /> {formatCurrency(v.balance)}</span>}
                  {!owes && (v.balance || 0) > 0 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">+{formatCurrency(v.balance)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add/Edit */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={isEditing ? 'Hamkorni tahrirlash' : "Yangi hamkor qo'shish"} type={isEditing ? undefined : 'warning'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Hamkor nomi *</label>
            <input type="text" required autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-minimal font-black text-slate-800 h-12 border-2" placeholder="Masalan: Tashkent Print LLC" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Telefon</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-minimal h-11 border-2" placeholder="+998 90 123 45 67" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Mutaxassislik</label>
              <input type="text" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} className="input-minimal h-11 border-2" placeholder="Masalan: Silkografiya" />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl uppercase font-black text-[10px] tracking-widest" onClick={() => setIsFormOpen(false)}>BEKOR</button>
            <button type="submit" className="h-12 flex-[2] bg-orange-600 text-white rounded-2xl uppercase font-black text-[10px] tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all">{isEditing ? 'YANGILASH' : "QO'SHISH"}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Detail */}
      <Modal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setDetailData(null); }} title={detailVendor?.name || 'Hamkor'} maxWidth="max-w-2xl">
        {isDetailLoading ? (
          <div className="py-16 flex flex-col items-center justify-center opacity-30"><div className="animate-spin w-8 h-8 border-2 border-orange-500 rounded-full border-t-transparent mb-3" /><p className="text-[10px] font-black uppercase">Yuklanmoqda...</p></div>
        ) : detailData ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {detailData.phone && <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefon</p><p className="text-sm font-black text-sky-600">{detailData.phone}</p></div>}
              {detailData.specialty && <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mutaxassislik</p><p className="text-sm font-black text-slate-800">{detailData.specialty}</p></div>}
              <div className={`p-3.5 rounded-2xl border ${(detailData.balance || 0) < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Balans</p>
                <p className={`text-sm font-black ${(detailData.balance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{(detailData.balance || 0) < 0 ? '–' : '+'}{formatCurrency(detailData.balance || 0)}</p>
                {(detailData.balance || 0) < 0 && isAdmin && (
                  <button onClick={() => { setPayVendor(detailData); setPayAmount(String(Math.abs(detailData.balance))); }} className="mt-2 w-full h-7 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg tracking-widest active:scale-95 transition-all">TO'LASH</button>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-2"><ClipboardList size={13} /> BUYURTMA TARIXI ({detailData.orderCosts?.length || 0})</h4>
              {(!detailData.orderCosts || detailData.orderCosts.length === 0) ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-20"><ClipboardList size={32} className="mb-3" /><p className="text-[10px] font-black uppercase">Buyurtmalar yo'q</p></div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll">
                  {detailData.orderCosts.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase">{c.task?.orderName ? `${c.task.orderName} — ` : ''}{c.task?.title || 'Buyurtma'}</p>
                        {c.description && <p className="text-[10px] font-bold text-slate-400 italic mt-0.5">{c.description}</p>}
                        <p className="text-[9px] font-black text-slate-300 mt-1">{new Date(c.createdAt).toLocaleDateString('uz-UZ')}</p>
                      </div>
                      <span className="text-sm font-black text-rose-600">{Number(c.amount).toLocaleString()} UZS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center opacity-20"><p className="font-black uppercase text-xs">Ma'lumot topilmadi</p></div>
        )}
      </Modal>

      {/* Modal: Pay */}
      <Modal isOpen={!!payVendor} onClose={() => { setPayVendor(null); setPayAmount(''); }} title={`To'lash — ${payVendor?.name || ''}`} type="warning">
        <div className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
            <TrendingDown className="text-emerald-500 mt-0.5 shrink-0" size={18} />
            <div><p className="text-xs font-black text-emerald-800 uppercase">Joriy qarz</p><p className="text-lg font-black text-rose-600">{payVendor ? formatCurrency(Math.abs(payVendor.balance || 0)) : ''}</p></div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">To'lov miqdori *</label>
            <CurrencyInput
              value={payAmount}
              onChange={(uzs) => setPayAmount(uzs ? String(uzs) : '')}
              colorClass="text-emerald-600"
              className="input-minimal h-14 text-xl font-black border-2 border-emerald-100"
            />
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl uppercase font-black text-[10px] tracking-widest" onClick={() => { setPayVendor(null); setPayAmount(''); }}>BEKOR</button>
            <button type="button" disabled={isPaying || !payAmount || Number(payAmount) <= 0} onClick={handlePayVendor} className="h-12 flex-[2] bg-emerald-600 text-white rounded-2xl uppercase font-black text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50">{isPaying ? "TO'LANMOQDA..." : "TO'LOVNI TASDIQLASH"}</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Delete confirm */}
      <Modal isOpen={!!confirmId} onClose={() => setConfirmId(null)} title="Hamkorni o'chirish" type="danger">
        <div className="space-y-5">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1 shrink-0" size={22} />
            <p className="text-xs font-bold text-rose-700"><strong>{confirmName}</strong> hamkorini o'chirmoqchisiz. Barcha bog'liq xarajat yozuvlari ham o'chib ketadi!</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setConfirmId(null)}>BEKOR</button>
            <button className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all" onClick={handleDelete}>HA, O'CHIRILSIN</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ─── MAIN COMBINED PAGE ──────────────────────────────────────────────────────
const Filiallar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const p = currentUser?.permissions || {};
  const canViewVendors = isAdmin || p.canViewVendors;
  const canManageBranches = isAdmin || p.canManageBranches;

  const [activeTab, setActiveTab] = useState<'filiallar' | 'hamkorlar'>(canManageBranches ? 'filiallar' : 'hamkorlar');

  return (
    <div className="space-y-5 pb-20">
      {/* Page header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Building2 className="text-orange-600" size={22} /> Hamkorlar va Filiallar
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subpudratchilar va multi-filial boshqaruvi</p>
        </div>
        <div className="flex bg-slate-100 p-0.5 rounded-xl shadow-inner w-fit">
          {canManageBranches && (
            <button onClick={() => setActiveTab('filiallar')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'filiallar' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <Building2 size={14} /> Filiallar
            </button>
          )}
          {canViewVendors && (
            <button onClick={() => setActiveTab('hamkorlar')} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'hamkorlar' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}>
              <Handshake size={14} /> Hamkorlar
            </button>
          )}
        </div>
      </div>

      {activeTab === 'filiallar' && canManageBranches && <FiliallarTab currentUser={currentUser} />}
      {activeTab === 'hamkorlar' && canViewVendors && <HamkorlarTab currentUser={currentUser} />}
    </div>
  );
};

export default Filiallar;
