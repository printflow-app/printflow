import React, { useState, useEffect } from 'react';
import { Search, Phone, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { customersApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + " UZS";
};

const Mijozlar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const p = currentUser.permissions || {};
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; id: string | null; name: string }>({ isOpen: false, id: null, name: '' });

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await customersApi.findAll();
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  const handleDelete = async () => {
    if (!confirmModal.id) return;
    try {
      await customersApi.delete(confirmModal.id);
      showStatus('success', 'Mijoz muvaffaqiyatli o\'chirildi! ✅');
      setConfirmModal({ isOpen: false, id: null, name: '' });
      fetchData();
    } catch {
      showStatus('error', 'O\'chirishda xatolik yuz berdi!');
    }
  };

  const openDeleteModal = (id: string, name: string) => {
    setConfirmModal({ isOpen: true, id, name });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Stats
  const totalDebtors = customers.filter(c => (c.totalDebt - c.totalPaid) > 0).length;
  const totalDebtAmount = customers.reduce((s, c) => {
    const b = c.totalDebt - c.totalPaid;
    return b > 0 ? s + b : s;
  }, 0);
  const totalCreditors = customers.filter(c => (c.totalDebt - c.totalPaid) < 0).length;

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6">
      {/* Status notification */}
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm tracking-tight">{statusMessage.text}</span>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              Mijozlar Bazasi
           </h2>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Barcha hamkorlar va ularning moliyaviy holati</p>
        </div>
        <div className="relative w-full md:w-80">
           <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
           <input 
              type="text" 
              placeholder="Qidirish..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 h-10 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 transition-all placeholder:text-slate-300 shadow-inner"
           />
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Jami Mijozlar</p>
            <h4 className="text-lg font-black text-slate-800">{customers.length}</h4>
         </div>
         <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-[8px] font-black text-rose-400 uppercase mb-1 tracking-widest">Qarzdorlar</p>
            <h4 className="text-lg font-black text-rose-600">{totalDebtors}</h4>
         </div>
         <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-[8px] font-black text-rose-400 uppercase mb-1 tracking-widest">Umumiy Qarzlar</p>
            <h4 className="text-lg font-black text-rose-600 truncate">{formatCurrency(totalDebtAmount)}</h4>
         </div>
         <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm transition-all hover:shadow-md">
            <p className="text-[8px] font-black text-orange-400 uppercase mb-1 tracking-widest">Haqdorlar</p>
            <h4 className="text-lg font-black text-orange-600">{totalCreditors}</h4>
         </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-100">
                     <th className="py-3 px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest w-8"></th>
                     <th className="py-3 px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest">Mijoz Ismi</th>
                     <th className="px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest">Telefon</th>
                     <th className="px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest">Umumiy</th>
                     <th className="px-5 text-[9px] uppercase font-black text-emerald-500 tracking-widest">To'langan</th>
                     <th className="px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest">Holat</th>
                     <th className="px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest text-right pr-6">Harakat</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={7} className="py-20 text-center font-bold text-slate-300">Hech qanday mijoz topilmadi</td></tr>
                  ) : (
                    filteredCustomers.map(c => {
                      const balance = c.totalDebt - c.totalPaid;
                      const isExpanded = expandedId === c.id;
                      const transactions = c.transactions || [];
                      const tasks = c.tasks || [];
                      return (
                        <React.Fragment key={c.id}>
                        <tr className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${isExpanded ? 'bg-slate-50/70 border-b border-orange-50' : ''}`} onClick={() => toggleExpand(c.id)}>
                           <td className="py-3 px-5">
                              <button className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-orange-600 group-hover:text-white transition-all shadow-sm">
                                {isExpanded ? <ChevronUp size={12} strokeWidth={3} /> : <ChevronDown size={12} strokeWidth={3} />}
                              </button>
                           </td>
                           <td className="py-3 px-5">
                              <div className="font-black text-slate-800 text-xs flex items-center gap-2.5">
                                 <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm">{c.name.charAt(0)}</div>
                                 {c.name}
                              </div>
                           </td>
                           <td className="px-5">
                              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><Phone size={11} className="text-sky-400"/> {c.phone || "—"}</p>
                           </td>
                           <td className="px-5 font-bold text-[11px] text-slate-600">{formatCurrency(c.totalDebt)}</td>
                           <td className="px-5 font-black text-[11px] text-emerald-600">{formatCurrency(c.totalPaid)}</td>
                           <td className="px-5">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black border uppercase tracking-tight ${
                                balance > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                balance < 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                                'bg-emerald-50 text-emerald-600 border-emerald-100'
                              }`}>
                                 {balance > 0 ? `${formatCurrency(balance)}` : 
                                  balance < 0 ? `Haqdor: ${formatCurrency(Math.abs(balance))}` : 
                                  'Yopilgan'}
                              </span>
                           </td>
                           <td className="px-5 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                 {p.canManageCustomers && <button onClick={() => openDeleteModal(c.id, c.name)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={13}/></button>}
                              </div>
                           </td>
                        </tr>
                        
                        {/* Expanded Row: Transaction & Task Details */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-slate-50/80 px-8 py-6 border-t border-slate-100 animate-fade-in">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  
                                  {/* Buyurtmalar (Xizmatlar) */}
                                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                    <h5 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <FileText size={14} /> Buyurtmalar (Xizmatlar)
                                    </h5>
                                    {tasks.length === 0 ? (
                                      <p className="text-xs text-slate-400 font-bold py-4">Hech qanday buyurtma topilmadi</p>
                                    ) : (
                                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                                        {tasks.map((t: any) => (
                                          <div key={t.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                              <p className="text-xs font-black text-slate-700">{t.title}</p>
                                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs font-black text-slate-800">{formatCurrency(t.totalAmount)}</p>
                                              {t.depositAmount > 0 && (
                                                <p className="text-[10px] font-bold text-emerald-500">Zakolat: {formatCurrency(t.depositAmount)}</p>
                                              )}
                                              {t.remainingAmount > 0 && (
                                                <p className="text-[10px] font-bold text-rose-500">Qoldiq: {formatCurrency(t.remainingAmount)}</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Tranzaksiyalar tarixi */}
                                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                    <h5 className="text-xs font-black text-sky-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <TrendingUp size={14} /> To'lovlar Tarixi
                                    </h5>
                                    {transactions.length === 0 ? (
                                      <p className="text-xs text-slate-400 font-bold py-4">Hech qanday tranzaksiya topilmadi</p>
                                    ) : (
                                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                                        {transactions.map((tr: any) => (
                                          <div key={tr.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tr.type === 'kirim' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                                {tr.type === 'kirim' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                              </div>
                                              <div>
                                                <p className="text-xs font-bold text-slate-700">{tr.serviceType || tr.expenseReason || tr.type}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">
                                                  {new Date(tr.date).toLocaleDateString('uz-UZ')} • {tr.paymentType?.name || 'Naqd'}
                                                </p>
                                              </div>
                                            </div>
                                            <span className={`text-xs font-black ${tr.type === 'kirim' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {tr.type === 'kirim' ? '+' : '-'}{formatCurrency(tr.amount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* MODAL: CONFIRM DELETE */}
      <Modal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        title="Mijozni o'chirish"
        type="danger"
      >
        <div className="space-y-6">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1" size={24} />
            <div>
              <p className="text-sm font-black text-rose-900 uppercase">Diqqat!</p>
              <p className="text-xs font-bold text-rose-700 mt-1">
                Siz <strong>{confirmModal.name}</strong> mijozini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500 px-1">
            Ushbu mijozga biriktirilgan barcha tranzaktsiyalar va buyurtmalar tarixi ham o'chib ketishi mumkin. Davom etishni xohlaysizmi?
          </p>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" 
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Bekor qilish
            </button>
            <button 
              type="button" 
              className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all"
              onClick={handleDelete}
            >
              Ha, o'chirilsin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Mijozlar;
