import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Trash2, Edit3, AlertCircle, AlertTriangle, CheckCircle2,
  Phone, Briefcase, TrendingDown, ClipboardList, Handshake
} from 'lucide-react';
import { vendorsApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.abs(amount)).replace(/,/g, ' ') + ' UZS';

const Hamkorlar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const canManageVendors = isAdmin || !!(currentUser.permissions?.canManageVendors);

  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Detail modal
  const [detailVendor, setDetailVendor] = useState<any | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Add / edit form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', phone: '', specialty: '' });

  // Payment modal
  const [payVendor, setPayVendor] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Delete confirm
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
    } catch {
      showStatus('error', "Hamkorlarni yuklashda xatolik!");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const openAdd = () => {
    setForm({ id: '', name: '', phone: '', specialty: '' });
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const openEdit = (v: any) => {
    setForm({ id: v.id, name: v.name, phone: v.phone || '', specialty: v.specialty || '' });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const openDetail = async (v: any) => {
    setDetailVendor(v);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    try {
      const res = await vendorsApi.findOne(v.id);
      setDetailData(res.data);
    } catch {
      setDetailData(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (isEditing) {
        await vendorsApi.update(form.id, { name: form.name, phone: form.phone, specialty: form.specialty });
        showStatus('success', "Hamkor yangilandi!");
      } else {
        await vendorsApi.create({ name: form.name, phone: form.phone, specialty: form.specialty });
        showStatus('success', "Yangi hamkor qo'shildi!");
      }
      setIsFormOpen(false);
      fetchVendors();
    } catch {
      showStatus('error', "Saqlashda xatolik!");
    }
  };

  const handlePayVendor = async () => {
    if (!payVendor || !payAmount || Number(payAmount) <= 0) return;
    setIsPaying(true);
    try {
      await vendorsApi.pay(payVendor.id, Number(payAmount));
      showStatus('success', `${Number(payAmount).toLocaleString()} UZS to'landi!`);
      setPayVendor(null);
      setPayAmount('');
      fetchVendors();
      // Refresh detail if open for this vendor
      if (detailVendor?.id === payVendor.id) {
        const res = await vendorsApi.findOne(payVendor.id);
        setDetailData(res.data);
      }
    } catch {
      showStatus('error', "To'lashda xatolik!");
    } finally {
      setIsPaying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    try {
      await vendorsApi.remove(confirmId);
      showStatus('success', "Hamkor o'chirildi.");
      setConfirmId(null);
      fetchVendors();
    } catch {
      showStatus('error', "O'chirishda xatolik!");
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone || '').includes(searchTerm) ||
    (v.specialty || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6 animate-fade-in">
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
          <span className="font-bold text-sm">{statusMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 mx-1 sm:mx-0">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 px-1">
            <Handshake size={20} className="text-orange-500"/> Hamkorlar
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 px-1 font-sans">
            Subpudratchi va yetkazib beruvchilar
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
            <input
              type="text"
              placeholder="Qidirish..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 h-10 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-400 transition-all"
            />
          </div>
          {canManageVendors && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 h-10 px-5 bg-[#FF6B00] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-[#E65A00] transition-all hover:-translate-y-0.5"
            >
              <Plus size={14} strokeWidth={3}/> HAMKOR QO'SHISH
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mx-1 sm:mx-0">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Jami hamkorlar</p>
          <p className="text-2xl font-black text-slate-800">{vendors.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Umumiy qarz (bizdan)</p>
          <p className="text-lg font-black text-rose-500">
            {formatCurrency(vendors.reduce((s, v) => s + Math.min(0, v.balance || 0), 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faol hamkorlar</p>
          <p className="text-2xl font-black text-emerald-600">
            {vendors.filter(v => (v._count?.orderCosts || 0) > 0).length}
          </p>
        </div>
      </div>

      {/* Vendor list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400/40">
          <Handshake size={48} className="mb-4"/>
          <p className="font-black uppercase tracking-widest text-xs italic">
            {searchTerm ? 'Hamkor topilmadi' : 'Hamkorlar ro\'yxati bo\'sh'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mx-1 sm:mx-0">
          {filtered.map(v => {
            const owes = (v.balance || 0) < 0;
            return (
              <div
                key={v.id}
                onClick={() => openDetail(v)}
                className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 font-black text-sm">
                      {v.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase group-hover:text-orange-700 transition-colors">{v.name}</p>
                      {v.specialty && (
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 mt-0.5">
                          <Briefcase size={8}/> {v.specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManageVendors && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(v.balance || 0) < 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setPayVendor(v); setPayAmount(String(Math.abs(v.balance))); }}
                          className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-500 text-emerald-500 hover:text-white flex items-center justify-center transition-all"
                          title="Qarzni to'lash"
                        >
                          <TrendingDown size={13}/>
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(v); }}
                        className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-sky-50 text-slate-400 hover:text-sky-500 flex items-center justify-center transition-all"
                      >
                        <Edit3 size={13}/>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmId(v.id); setConfirmName(v.name); }}
                        className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-all"
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-50">
                  {v.phone && (
                    <span className="text-[9px] font-black text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 flex items-center gap-1">
                      <Phone size={8}/> {v.phone}
                    </span>
                  )}
                  <span className="text-[9px] font-black text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center gap-1">
                    <ClipboardList size={8}/> {v._count?.orderCosts || 0} buyurtma
                  </span>
                  {owes && (
                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 flex items-center gap-1">
                      <TrendingDown size={8}/> {formatCurrency(v.balance)}
                    </span>
                  )}
                  {!owes && (v.balance || 0) > 0 && (
                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                      +{formatCurrency(v.balance)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD / EDIT VENDOR */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={isEditing ? 'Hamkorni tahrirlash' : "Yangi hamkor qo'shish"}
        type={isEditing ? undefined : 'warning'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Hamkor nomi *</label>
            <input
              type="text"
              required
              autoFocus
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-minimal font-black text-slate-800 h-12 border-2"
              placeholder="Masalan: Tashkent Print LLC"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Telefon (ixtiyoriy)</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="input-minimal h-11 border-2"
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Mutaxassislik (ixtiyoriy)</label>
              <input
                type="text"
                value={form.specialty}
                onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                className="input-minimal h-11 border-2"
                placeholder="Masalan: Silkografiya"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl uppercase font-black text-[10px] tracking-widest" onClick={() => setIsFormOpen(false)}>BEKOR</button>
            <button type="submit" className="h-12 flex-[2] bg-orange-600 text-white rounded-2xl uppercase font-black text-[10px] tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
              {isEditing ? 'YANGILASH' : "QO'SHISH"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VENDOR DETAIL */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setDetailData(null); }}
        title={detailVendor?.name || 'Hamkor'}
        maxWidth="max-w-2xl"
      >
        {isDetailLoading ? (
          <div className="py-16 flex flex-col items-center justify-center opacity-30">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 rounded-full border-t-transparent mb-3"/>
            <p className="text-[10px] font-black uppercase">Yuklanmoqda...</p>
          </div>
        ) : detailData ? (
          <div className="space-y-5">
            {/* Info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {detailData.phone && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Telefon</p>
                  <p className="text-sm font-black text-sky-600">{detailData.phone}</p>
                </div>
              )}
              {detailData.specialty && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mutaxassislik</p>
                  <p className="text-sm font-black text-slate-800">{detailData.specialty}</p>
                </div>
              )}
              <div className={`p-3.5 rounded-2xl border ${(detailData.balance || 0) < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Balans</p>
                <p className={`text-sm font-black ${(detailData.balance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {(detailData.balance || 0) < 0 ? '–' : '+'}{formatCurrency(detailData.balance || 0)}
                </p>
                {(detailData.balance || 0) < 0 && canManageVendors && (
                  <button
                    onClick={() => { setPayVendor(detailData); setPayAmount(String(Math.abs(detailData.balance))); }}
                    className="mt-2 w-full h-7 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg tracking-widest active:scale-95 transition-all"
                  >
                    TO'LASH
                  </button>
                )}
              </div>
            </div>

            {/* Order costs history */}
            <div>
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <ClipboardList size={13}/> BUYURTMA TARIXI ({detailData.orderCosts?.length || 0})
              </h4>
              {(!detailData.orderCosts || detailData.orderCosts.length === 0) ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-20">
                  <ClipboardList size={32} className="mb-3"/>
                  <p className="text-[10px] font-black uppercase">Buyurtmalar yo'q</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll">
                  {detailData.orderCosts.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-100 hover:bg-white transition-all">
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase">
                          {c.task?.orderName ? `${c.task.orderName} — ` : ''}{c.task?.title || 'Buyurtma'}
                        </p>
                        {c.description && <p className="text-[10px] font-bold text-slate-400 italic mt-0.5">{c.description}</p>}
                        <p className="text-[9px] font-black text-slate-300 mt-1">
                          {new Date(c.createdAt).toLocaleDateString('uz-UZ')}
                        </p>
                      </div>
                      <span className="text-sm font-black text-rose-600">{Number(c.amount).toLocaleString()} UZS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center opacity-20">
            <p className="font-black uppercase text-xs">Ma'lumot topilmadi</p>
          </div>
        )}
      </Modal>

      {/* MODAL: PAY VENDOR */}
      <Modal
        isOpen={!!payVendor}
        onClose={() => { setPayVendor(null); setPayAmount(''); }}
        title={`To'lash — ${payVendor?.name || ''}`}
        type="warning"
      >
        <div className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
            <TrendingDown className="text-emerald-500 mt-0.5 shrink-0" size={18}/>
            <div>
              <p className="text-xs font-black text-emerald-800 uppercase">Joriy qarz</p>
              <p className="text-lg font-black text-rose-600">{payVendor ? formatCurrency(Math.abs(payVendor.balance || 0)) : ''}</p>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">To'lov miqdori (UZS) *</label>
            <input
              type="number"
              min="1"
              autoFocus
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              className="input-minimal font-black text-emerald-600 text-xl h-14 border-2 border-emerald-100"
              placeholder="500 000"
            />
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl uppercase font-black text-[10px] tracking-widest" onClick={() => { setPayVendor(null); setPayAmount(''); }}>BEKOR</button>
            <button
              type="button"
              disabled={isPaying || !payAmount || Number(payAmount) <= 0}
              onClick={handlePayVendor}
              className="h-12 flex-[2] bg-emerald-600 text-white rounded-2xl uppercase font-black text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {isPaying ? "TO'LANMOQDA..." : "TO'LOVNI TASDIQLASH"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: DELETE CONFIRM */}
      <Modal
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Hamkorni o'chirish"
        type="danger"
      >
        <div className="space-y-5">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1 shrink-0" size={22}/>
            <p className="text-xs font-bold text-rose-700">
              <strong>{confirmName}</strong> hamkorini o'chirmoqchisiz. Barcha bog'liq xarajat yozuvlari ham o'chib ketadi!
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setConfirmId(null)}>BEKOR</button>
            <button className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all" onClick={handleDelete}>
              HA, O'CHIRILSIN
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Hamkorlar;
