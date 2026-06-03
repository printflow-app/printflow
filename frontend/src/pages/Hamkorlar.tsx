import React, { useState } from 'react';
import {
  Plus, Search, Trash2, Edit3, AlertCircle, AlertTriangle, CheckCircle2,
  ClipboardList, Handshake, DollarSign, Download, ArrowDownLeft, ArrowUpRight, X
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { vendorsApi, financeApi } from '../api';
import { useVendors, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { exportToXlsx } from '../utils/exportToXlsx';
import { toast } from 'react-toastify';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.abs(amount)).replace(/,/g, ' ') + ' UZS';

// Rol-teglar — faqat yorliq/filtr uchun, pul yo'nalishini cheklamaydi.
const ROLE_OPTIONS: { key: string; label: string }[] = [
  { key: 'xomashyo', label: 'Xomashyo' },
  { key: 'xizmat', label: 'Xizmat' },
  { key: 'xaridor', label: 'Xaridor' },
];
const roleLabel = (key: string) => ROLE_OPTIONS.find(r => r.key === key)?.label || key;

// Balansni ikki yo'nalishli talqin qilish.
//   > 0 → biz hamkorga qarzdormiz; < 0 → hamkor bizga qarzdor.
const balanceMeta = (balance: number) => {
  if (balance > 0) return { text: 'Biz qarzdormiz', cls: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' };
  if (balance < 0) return { text: 'Hamkor qarzdor', cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' };
  return { text: 'Tenglashgan', cls: 'text-slate-500', bg: 'bg-slate-50 border-slate-100' };
};

const Hamkorlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const canManageVendors = isAdmin || !!(currentUser.permissions?.canManageVendors);

  // React Query — cached per branchId, deduped, auto-refetch on invalidate.
  const { data: vendors = [], isLoading } = useVendors(activeBranchId);
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
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
  const [form, setForm] = useState<{ id: string; name: string; phone: string; roles: string[] }>({ id: '', name: '', phone: '', roles: [] });

  // Ledger (Xarid / Sotuv) entry form — detail modal ichida
  const [ledgerForm, setLedgerForm] = useState<{ open: boolean; direction: 'we_owe' | 'they_owe'; amount: string; description: string; paidNow: boolean }>(
    { open: false, direction: 'we_owe', amount: '', description: '', paidNow: false }
  );
  const [isLedgerSubmitting, setIsLedgerSubmitting] = useState(false);

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
    setForm({ id: '', name: '', phone: '', roles: [] });
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const openEdit = (v: any) => {
    setForm({ id: v.id, name: v.name, phone: v.phone || '', roles: Array.isArray(v.roles) ? v.roles : [] });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const toggleRole = (key: string) =>
    setForm(f => ({ ...f, roles: f.roles.includes(key) ? f.roles.filter(r => r !== key) : [...f.roles, key] }));

  const reloadDetail = async (vendorId: string) => {
    if (!activeBranchId) return;
    const res = await vendorsApi.findOne(vendorId, activeBranchId);
    setDetailData(res.data);
  };

  const openDetail = async (v: any) => {
    setDetailVendor(v);
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setLedgerForm({ open: false, direction: 'we_owe', amount: '', description: '', paidNow: false });
    try {
      if (!activeBranchId) throw new Error('no branch');
      await reloadDetail(v.id);
    } catch {
      setDetailData(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Ledger yozuvi yaratish (Xarid = we_owe, Sotuv = they_owe).
  // Sotuv + "darhol to'landi" bo'lsa — qo'shimcha Kassa KIRIM ham yaratiladi (balans 0).
  const submitLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailVendor || !activeBranchId) return;
    const amount = Number(ledgerForm.amount);
    if (!amount || amount <= 0) { showStatus('error', 'Summani kiriting'); return; }
    setIsLedgerSubmitting(true);
    try {
      await vendorsApi.createLedgerEntry(
        { vendorId: detailVendor.id, direction: ledgerForm.direction, amount, description: ledgerForm.description || null },
        activeBranchId,
      );
      // Sotuv darhol naqd to'langan bo'lsa — Kassaga kirim yozamiz.
      if (ledgerForm.direction === 'they_owe' && ledgerForm.paidNow) {
        await financeApi.createTransaction({
          type: 'kirim',
          amount,
          vendorId: detailVendor.id,
          branchId: activeBranchId,
          serviceType: 'Hamkorga sotuv',
          paymentTypeId: null,
        });
        queryClient.invalidateQueries({ queryKey: ['kassa-transactions'] });
        queryClient.invalidateQueries({ queryKey: ['kassa-summary'] });
      }
      setLedgerForm({ open: false, direction: 'we_owe', amount: '', description: '', paidNow: false });
      await reloadDetail(detailVendor.id);
      refetchVendors();
      showStatus('success', ledgerForm.direction === 'we_owe' ? 'Xarid qo\'shildi' : 'Sotuv qo\'shildi');
    } catch {
      showStatus('error', 'Saqlashda xatolik');
    } finally {
      setIsLedgerSubmitting(false);
    }
  };

  const deleteLedger = async (entryId: string) => {
    if (!detailVendor || !activeBranchId) return;
    try {
      await vendorsApi.removeLedgerEntry(entryId, activeBranchId);
      await reloadDetail(detailVendor.id);
      refetchVendors();
    } catch {
      showStatus('error', 'O\'chirishda xatolik');
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
        await vendorsApi.update(form.id, { name: form.name, phone: form.phone, roles: form.roles }, activeBranchId);
        showStatus('success', "Hamkor yangilandi!");
      } else {
        await vendorsApi.create({ name: form.name, phone: form.phone, roles: form.roles, branchId: activeBranchId });
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
        { header: 'Rollar', accessor: (v: any) => (Array.isArray(v.roles) ? v.roles.map(roleLabel).join(', ') : '') },
        { header: 'Subpudrat (UZS)', accessor: (v: any) => Number(v.totalAssignedCost || 0) },
        { header: 'Xarid (UZS)', accessor: (v: any) => Number(v.totalPurchases || 0) },
        { header: 'Sotuv (UZS)', accessor: (v: any) => Number(v.totalSales || 0) },
        { header: "Biz to'ladik (UZS)", accessor: (v: any) => Number(v.totalPaid || 0) },
        { header: "Hamkor to'ladi (UZS)", accessor: (v: any) => Number(v.totalReceived || 0) },
        { header: 'Holat', accessor: (v: any) => (v.balance > 0 ? 'Biz qarzdormiz' : v.balance < 0 ? 'Hamkor qarzdor' : 'Tenglashgan') },
        { header: 'Balans (UZS)', accessor: (v: any) => Math.abs(Number(v.balance || 0)) },
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
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Biz qarzdormiz</p>
          <p className="text-lg font-bold text-rose-500">
            {formatCurrency(vendors.reduce((s, v) => s + (v.balance > 0 ? v.balance : 0), 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hamkor bizga qarzdor</p>
          <p className="text-lg font-bold text-emerald-600">
            {formatCurrency(vendors.reduce((s, v) => s + (v.balance < 0 ? -v.balance : 0), 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jami to'langan</p>
          <p className="text-lg font-bold text-slate-700">
            {formatCurrency(vendors.reduce((s, v) => s + (v.totalPaid || 0), 0))}
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
                <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Balans (UZS)</th>
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
                        <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 font-bold text-xs shrink-0">
                          {v.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 uppercase group-hover:text-orange-600 transition-colors">{v.name}</span>
                          {Array.isArray(v.roles) && v.roles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {v.roles.map((r: string) => (
                                <span key={r} className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                  {roleLabel(r)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
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
                      <span className={`text-xs font-bold ${balanceMeta(v.balance).cls}`}>
                        {v.balance === 0 ? '0 UZS' : formatCurrency(v.balance)}
                      </span>
                      <p className={`text-[8px] font-bold uppercase tracking-wider mt-0.5 ${balanceMeta(v.balance).cls}`}>
                        {balanceMeta(v.balance).text}
                      </p>
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
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Rol-teglar (ixtiyoriy)</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(r => {
                const active = form.roles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleRole(r.key)}
                    className={`h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-wider border-2 transition-all ${active ? 'bg-orange-50 border-orange-300 text-orange-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-slate-400 mt-1.5 px-1">Bir nechta tanlash mumkin. Faqat yorliq — pul yo'nalishini cheklamaydi.</p>
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
            {/* Bidirectional balance hero */}
            <div className={`p-5 rounded-2xl border ${balanceMeta(detailData.balance).bg}`}>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{balanceMeta(detailData.balance).text}</p>
                  <p className={`text-2xl font-bold ${balanceMeta(detailData.balance).cls}`}>
                    {detailData.balance === 0 ? '0 UZS' : formatCurrency(detailData.balance)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/60">
                {[
                  { label: 'Subpudrat', val: detailData.totalAssignedCost },
                  { label: 'Xarid (qarzga)', val: detailData.totalPurchases },
                  { label: 'Sotuv (qarzga)', val: detailData.totalSales },
                  { label: 'Biz to\'ladik', val: detailData.totalPaid },
                  { label: 'Hamkor to\'ladi', val: detailData.totalReceived },
                ].map(c => (
                  <div key={c.label} className="bg-white/70 px-2.5 py-1.5 rounded-lg">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">{c.label}</p>
                    <p className="text-[10px] font-bold text-slate-700 leading-none">{formatCurrency(c.val || 0)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Xarid / Sotuv actions */}
            {canManageVendors && (
              <div className="space-y-3">
                {!ledgerForm.open ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLedgerForm({ open: true, direction: 'we_owe', amount: '', description: '', paidNow: false })}
                      className="flex-1 h-11 rounded-xl border-2 border-rose-200 text-rose-600 bg-rose-50/40 hover:bg-rose-50 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowDownLeft size={14}/> Xarid (biz oldik)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLedgerForm({ open: true, direction: 'they_owe', amount: '', description: '', paidNow: false })}
                      className="flex-1 h-11 rounded-xl border-2 border-emerald-200 text-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowUpRight size={14}/> Sotuv (u oldi)
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitLedger} className={`p-4 rounded-2xl border-2 space-y-3 ${ledgerForm.direction === 'we_owe' ? 'border-rose-100 bg-rose-50/30' : 'border-emerald-100 bg-emerald-50/30'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        {ledgerForm.direction === 'we_owe' ? 'Xarid — biz hamkordan oldik' : 'Sotuv — hamkor bizdan oldi'}
                      </p>
                      <button type="button" onClick={() => setLedgerForm(f => ({ ...f, open: false }))} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Summa (UZS) *</label>
                      <input
                        type="number" min="0" required autoFocus
                        value={ledgerForm.amount}
                        onChange={e => setLedgerForm(f => ({ ...f, amount: e.target.value }))}
                        className="input-minimal h-11 border-2" placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Izoh (ixtiyoriy)</label>
                      <input
                        type="text"
                        value={ledgerForm.description}
                        onChange={e => setLedgerForm(f => ({ ...f, description: e.target.value }))}
                        className="input-minimal h-11 border-2" placeholder="Masalan: 100 dona ofset qog'oz"
                      />
                    </div>
                    {ledgerForm.direction === 'they_owe' && (
                      <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                        <input type="checkbox" checked={ledgerForm.paidNow} onChange={e => setLedgerForm(f => ({ ...f, paidNow: e.target.checked }))} className="w-4 h-4 accent-emerald-600"/>
                        <span className="text-[11px] font-bold text-slate-600">Darhol to'landi (naqd) — Kassaga kirim yoziladi</span>
                      </label>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setLedgerForm(f => ({ ...f, open: false }))} className="btn-outline h-11 flex-1 rounded-xl uppercase font-bold text-[10px] tracking-widest">BEKOR</button>
                      <button type="submit" disabled={isLedgerSubmitting} className={`h-11 flex-[2] text-white rounded-xl uppercase font-bold text-[10px] tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 ${ledgerForm.direction === 'we_owe' ? 'bg-rose-600 shadow-rose-500/20' : 'bg-emerald-600 shadow-emerald-500/20'}`}>
                        {isLedgerSubmitting ? '...' : 'SAQLASH'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Topshiriqlar + Ledger (biz qarzdor / hamkor qarzdor manbalari) */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                  <ClipboardList size={14}/> Topshiriq & Xarid/Sotuv
                </h4>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll pr-1">
                  {(detailData.tasks?.length === 0 && detailData.ledgerEntries?.length === 0) && (
                    <p className="text-[10px] text-slate-300 italic py-4">Hali yozuv yo'q</p>
                  )}
                  {detailData.tasks?.map((t: any) => (
                    <div key={t.id} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{t.title}</p>
                          <span className="shrink-0 text-[8px] font-bold bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-rose-500 uppercase">Subpudrat</span>
                        </div>
                        <p className="text-[9px] text-slate-400">{new Date(t.createdAt).toLocaleDateString('uz-UZ')}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-rose-500">+{formatCurrency(t.vendorCost)}</span>
                    </div>
                  ))}
                  {detailData.ledgerEntries?.map((l: any) => {
                    const isBuy = l.direction === 'we_owe';
                    return (
                      <div key={l.id} className={`p-3 rounded-xl border flex justify-between items-center group ${isBuy ? 'bg-rose-50/30 border-rose-100' : 'bg-emerald-50/30 border-emerald-100'}`}>
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{l.description || (isBuy ? 'Xarid' : 'Sotuv')}</p>
                            <span className={`shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${isBuy ? 'bg-rose-50 border border-rose-100 text-rose-500' : 'bg-emerald-50 border border-emerald-100 text-emerald-600'}`}>{isBuy ? 'Xarid' : 'Sotuv'}</span>
                          </div>
                          <p className="text-[9px] text-slate-400">{new Date(l.date).toLocaleDateString('uz-UZ')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${isBuy ? 'text-rose-500' : 'text-emerald-600'}`}>{isBuy ? '+' : '−'}{formatCurrency(l.amount)}</span>
                          {canManageVendors && (
                            <button onClick={() => deleteLedger(l.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={13}/></button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kassa harakatlari (kirim + chiqim) */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
                  <DollarSign size={14}/> Kassa harakatlari
                </h4>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll pr-1">
                  {detailData.transactions?.length === 0 ? (
                    <p className="text-[10px] text-slate-300 italic py-4">Hali kassa harakati yo'q</p>
                  ) : detailData.transactions.map((tr: any) => {
                    const isIn = tr.type === 'kirim';
                    return (
                      <div key={tr.id} className={`p-3 rounded-xl border flex justify-between items-center ${isIn ? 'bg-emerald-50/30 border-emerald-100/50' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-[11px] font-bold uppercase truncate text-slate-700">
                            {isIn ? (tr.serviceType || 'Hamkordan kirim') : (tr.expenseReason || 'Hamkorga to\'lov')}
                          </p>
                          <p className="text-[9px] text-slate-400">{new Date(tr.date).toLocaleDateString('uz-UZ')} · {isIn ? 'Kirim' : 'Chiqim'}</p>
                        </div>
                        <span className={`shrink-0 text-xs font-bold ${isIn ? 'text-emerald-600' : 'text-slate-500'}`}>{isIn ? '+' : '−'}{formatCurrency(tr.amount)}</span>
                      </div>
                    );
                  })}
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
