import React, { useState } from 'react';
import {
  Plus, Search, Trash2, Edit3, AlertCircle, AlertTriangle, CheckCircle2,
  ClipboardList, Handshake, DollarSign, Download
} from 'lucide-react';
import { vendorsApi } from '../api';
import { useVendors, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { exportToXlsx } from '../utils/exportToXlsx';
import { toast } from 'react-toastify';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.abs(amount)).replace(/,/g, ' ') + ' UZS';

const Hamkorlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const canManageVendors = isAdmin || !!(currentUser.permissions?.canManageVendors);

  // React Query — cached per branchId, deduped, auto-refetch on invalidate.
  const { data: vendors = [], isLoading } = useVendors(activeBranchId);
  const invalidate = useInvalidate();
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
  const [form, setForm] = useState({ id: '', name: '', phone: '' });

  // Delete confirm
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // fetchAll() o'rniga RQ invalidate ishlatamiz. Mutatsiyalardan keyin avtomatik refetch.
  const refetchVendors = () => invalidate.vendors();

  const openAdd = () => {
    setForm({ id: '', name: '', phone: '' });
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const openEdit = (v: any) => {
    setForm({ id: v.id, name: v.name, phone: v.phone || '' });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const openDetail = async (v: any) => {
    setDetailVendor(v);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    try {
      if (!activeBranchId) throw new Error('no branch');
      const res = await vendorsApi.findOne(v.id, activeBranchId);
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
    if (!activeBranchId) {
      showStatus('error', 'Avval aktiv filialni tanlang');
      return;
    }
    try {
      if (isEditing) {
        await vendorsApi.update(form.id, { name: form.name, phone: form.phone }, activeBranchId);
        showStatus('success', "Hamkor yangilandi!");
      } else {
        await vendorsApi.create({ name: form.name, phone: form.phone, branchId: activeBranchId });
        showStatus('success', "Yangi hamkor qo'shildi!");
      }
      setIsFormOpen(false);
      refetchVendors();
    } catch {
      showStatus('error', "Saqlashda xatolik!");
    }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    if (!activeBranchId) return;
    try {
      await vendorsApi.remove(confirmId, activeBranchId);
      showStatus('success', "Hamkor o'chirildi.");
      setConfirmId(null);
      refetchVendors();
    } catch {
      showStatus('error', "O'chirishda xatolik!");
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.phone || '').includes(searchTerm)
  );

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.info("Eksport qilish uchun ma'lumot yo'q");
      return;
    }
    const stamp = new Date().toLocaleDateString('en-CA');
    exportToXlsx({
      filename: `hamkorlar_${stamp}`,
      sheetName: 'Hamkorlar',
      rows: filtered,
      columns: [
        { header: 'Hamkor', accessor: (v: any) => v.name || '' },
        { header: 'Telefon', accessor: (v: any) => v.phone || '' },
        { header: 'Jami xizmat (UZS)', accessor: (v: any) => Number(v.totalAssignedCost || 0) },
        { header: "Jami to'langan (UZS)", accessor: (v: any) => Number(v.totalPaid || 0) },
        { header: 'Qarz / Qoldiq (UZS)', accessor: (v: any) => Number(v.balance || 0) },
        { header: 'Yaratilgan', accessor: (v: any) => v.createdAt ? new Date(v.createdAt).toLocaleDateString('uz-UZ') : '' },
      ],
    });
    toast.success(`${filtered.length} ta hamkor eksport qilindi`);
  };

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
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2 px-1">
            <Handshake size={20} className="text-orange-500"/> Hamkorlar (Outsourcing)
          </h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 px-1 font-sans">
            Tashqi xizmatlar va subpudratni boshqarish
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
          {(isAdmin || currentUser.permissions?.canExportVendors) && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 h-10 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-sm transition-all"
              title="Joriy ro'yxatni Excel'ga eksport qilish"
            >
              <Download size={13} strokeWidth={2.5}/> EKSPORT
            </button>
          )}
          {canManageVendors && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 h-10 px-5 bg-[#FF6B00] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-[#E65A00] transition-all hover:-translate-y-0.5"
            >
              <Plus size={14} strokeWidth={3}/> HAMKOR QO'SHISH
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mx-1 sm:mx-0">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jami hamkorlar</p>
          <p className="text-2xl font-bold text-slate-800">{vendors.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jami biriktirilgan</p>
          <p className="text-lg font-bold text-slate-800">
            {formatCurrency(vendors.reduce((s, v) => s + (v.totalAssignedCost || 0), 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jami to'langan</p>
          <p className="text-lg font-bold text-emerald-600">
            {formatCurrency(vendors.reduce((s, v) => s + (v.totalPaid || 0), 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Umumiy qarz (Bizdan)</p>
          <p className="text-lg font-bold text-rose-500">
            {formatCurrency(vendors.reduce((s, v) => s + (v.balance || 0), 0))}
          </p>
        </div>
      </div>

      {/* Vendor list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mx-1 sm:mx-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hamkor Nomi</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telefon</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jami Xizmat</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">To'langan</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Qarz (UZS)</th>
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    {searchTerm ? (
                      <p className="text-sm font-semibold text-slate-400">"{searchTerm}" — Hamkor topilmadi</p>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
                          <Handshake size={26} />
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-800 mb-1">Hali hamkor qo'shilmagan</p>
                          <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">Subpudratchi va yetkazib beruvchilarni qo'shing, ularning xarajat va to'lovlarini kuzating.</p>
                        </div>
                        {canManageVendors && (
                          <button onClick={openAdd} className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors flex items-center gap-2">
                            <Plus size={16} /> Birinchi hamkorni qo'shish
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => openDetail(v)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 font-bold text-xs">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-slate-800 uppercase group-hover:text-orange-600 transition-colors">{v.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-slate-500">{v.phone || '-'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-slate-600">{formatCurrency(v.totalAssignedCost)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-emerald-600">{formatCurrency(v.totalPaid)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`text-xs font-bold ${v.balance > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {formatCurrency(v.balance)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(v); }}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-sky-500 hover:border-sky-200 transition-all"
                        >
                          <Edit3 size={14}/>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmId(v.id); setConfirmName(v.name); }}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD / EDIT VENDOR */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={isEditing ? 'Hamkorni tahrirlash' : "Yangi hamkor qo'shish"}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Hamkor nomi *</label>
            <input type="text" required autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-minimal font-bold text-slate-800 h-12 border-2" placeholder="Masalan: Tashkent Print LLC"/>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Telefon (ixtiyoriy)</label>
            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-minimal h-11 border-2" placeholder="+998 90 123 45 67"/>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl uppercase font-bold text-[10px] tracking-widest" onClick={() => setIsFormOpen(false)}>BEKOR</button>
            <button type="submit" className="h-12 flex-[2] bg-orange-600 text-white rounded-2xl uppercase font-bold text-[10px] tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
              {isEditing ? 'YANGILASH' : "QO'SHISH"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VENDOR DETAIL */}
      <Modal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setDetailData(null); }} title={detailVendor?.name || 'Hamkor'} maxWidth="max-w-3xl">
        {isDetailLoading ? (
          <div className="py-16 flex flex-col items-center justify-center opacity-30">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 rounded-full border-t-transparent mb-3"/>
            <p className="text-[10px] font-bold uppercase">Yuklanmoqda...</p>
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jami xizmat</p>
                <p className="text-sm font-bold text-slate-800">{formatCurrency(detailData.totalAssignedCost)}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">To'langan</p>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(detailData.totalPaid)}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${detailData.balance > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Joriy qarz</p>
                <p className={`text-sm font-bold ${detailData.balance > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatCurrency(detailData.balance)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tasks List */}
              <div className="space-y-3">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList size={14}/> Topshiriqlar ({detailData.tasks?.length || 0})
                  </h4>
                </div>
                
                {/* Task Status Summary */}
                {detailData.tasks?.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-1">
                    {Object.entries(
                      detailData.tasks.reduce((acc: any, t: any) => {
                        const status = t.column?.title || 'Noma\'lum';
                        acc[status] = (acc[status] || 0) + (t.vendorCost || 0);
                        return acc;
                      }, {})
                    ).map(([status, total]: [string, any]) => (
                      <div key={status} className="bg-white border border-slate-100 px-2 py-1 rounded-lg shadow-sm">
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">{status}</p>
                        <p className="text-[10px] font-bold text-slate-700 leading-none">{formatCurrency(total)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll pr-1">
                  {detailData.tasks?.length === 0 ? (
                    <p className="text-[10px] text-slate-300 italic py-4">Hali topshiriq biriktirilmagan</p>
                  ) : detailData.tasks.map((t: any) => (
                    <div key={t.id} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-sm transition-all">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{t.title}</p>
                          <span className="shrink-0 text-[8px] font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 uppercase">
                            {t.column?.title || '...'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400">{new Date(t.createdAt).toLocaleDateString('uz-UZ')}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-rose-500">{formatCurrency(t.vendorCost)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payouts List */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                  <DollarSign size={14}/> To'lovlar (Chiqimlar)
                </h4>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll pr-1">
                  {detailData.transactions?.length === 0 ? (
                    <p className="text-[10px] text-slate-300 italic py-4">Hali to'lov qilinmagan</p>
                  ) : detailData.transactions.map((tr: any) => (
                    <div key={tr.id} className="bg-emerald-50/30 p-3 rounded-xl border border-emerald-100/50 flex justify-between items-center group hover:bg-emerald-50 transition-all">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-[11px] font-bold text-emerald-800 uppercase truncate">{tr.expenseReason || 'Hamkorga to\'lov'}</p>
                        <p className="text-[9px] text-slate-400">{new Date(tr.date).toLocaleDateString('uz-UZ')}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-emerald-600">{formatCurrency(tr.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center opacity-20"><p className="font-bold uppercase text-xs">Ma'lumot topilmadi</p></div>
        )}
      </Modal>

      {/* MODAL: DELETE CONFIRM */}
      <Modal isOpen={!!confirmId} onClose={() => setConfirmId(null)} title="Hamkorni o'chirish" type="danger">
        <div className="space-y-5">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1 shrink-0" size={22}/>
            <p className="text-xs font-bold text-rose-700">
              <strong>{confirmName}</strong> hamkorini o'chirmoqchisiz. Barcha bog'liq yozuvlar ham o'chib ketadi!
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setConfirmId(null)}>BEKOR</button>
            <button className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all" onClick={handleDelete}>
              HA, O'CHIRILSIN
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Hamkorlar;
