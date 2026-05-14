import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { financeApi, paymentTypesApi, customersApi, employeesApi, expenseTypesApi, vendorsApi, departmentsApi } from '../api';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import CurrencyInput from '../components/CurrencyInput';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + " UZS";
};

const Kassa: React.FC<{ currentUser: any; activeBranchId?: string; activeDepartmentId?: string }> = ({ currentUser, activeBranchId, activeDepartmentId }) => {
  const p = currentUser.permissions || {};

  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      
      const queryParams: any = {
        params: {
          branchId: activeBranchId,
          ...(activeDepartmentId ? { departmentId: activeDepartmentId } : {}),
          page,
          limit: 20,
          start: selectedDate,
          end: selectedDate
        }
      };

      const [transRes, summaryRes, ptRes, custRes, empRes, etRes, vendorRes] = await Promise.all([
        financeApi.getTransactions(queryParams),
        financeApi.getDailySummary({ params: { branchId: activeBranchId, ...(activeDepartmentId ? { departmentId: activeDepartmentId } : {}), start: selectedDate, end: selectedDate } }),
        paymentTypesApi.findAll(),
        customersApi.findAll(),
        employeesApi.findAll(),
        expenseTypesApi.findAll(),
        vendorsApi.findAll().catch(() => ({ data: [] })),
      ]);

      setTransactions(transRes.data.data || []);
      setMeta(transRes.data.meta);
      setSummary(summaryRes.data);
      setPaymentTypes(ptRes.data || []);
      setCustomers(custRes.data || []);
      setEmployees(empRes.data || []);
      setExpenseTypes(etRes.data || []);
      setVendors(vendorRes.data || []);
    } catch (err) {
      console.error("Kassa yuklashda xato:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId, activeDepartmentId, page, selectedDate]);

  // Modals
  const [isKirimModalOpen, setIsKirimModalOpen] = useState(false);
  const [isChiqimModalOpen, setIsChiqimModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useAutoRefresh(() => fetchData(true), {
    intervalMs: 15000,
    paused: isKirimModalOpen || isChiqimModalOpen,
  });

  // Forms
  const [kirimForm, setKirimForm] = useState({ amount: '', paymentTypeId: '', customerId: '', customerName: '', serviceType: '', forExistingDebt: false, vendorId: '', departmentId: '' });
  const [chiqimForm, setChiqimForm] = useState({ amount: '', paymentTypeId: '', expenseReason: '', expenseTypeId: '', employeeId: '', isEmployeeExpense: false, isVendorExpense: false, vendorId: '', departmentId: '' });
  const [deptOptions, setDeptOptions] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBranchId) { setDeptOptions([]); return; }
    const branchParam = activeBranchId === '__main__' ? undefined : activeBranchId;
    departmentsApi.findAll(branchParam).then(r => setDeptOptions(Array.isArray(r.data) ? r.data : [])).catch(() => setDeptOptions([]));
  }, [activeBranchId]);
  const [customerTasks, setCustomerTasks] = useState<any[]>([]);

  const handleCustomerChange = async (cid: string) => {
    setKirimForm((f: any) => ({ ...f, customerId: cid, customerName: '', serviceType: '' }));
    if (!cid) {
      setCustomerTasks([]);
      return;
    }
    try {
      const res = await customersApi.getCustomerTasks(cid);
      setCustomerTasks(res.data || []);
    } catch {
      setCustomerTasks([]);
    }
  };

  const selectedCustomerInfo = customers.find(c => c.id === kirimForm.customerId);
  const hasDebt = selectedCustomerInfo ? (selectedCustomerInfo.totalDebt - selectedCustomerInfo.totalPaid > 0) : false;
  const currentDebtAmount = hasDebt ? (selectedCustomerInfo.totalDebt - selectedCustomerInfo.totalPaid) : 0;

  useEffect(() => {
    if (!hasDebt) {
      setKirimForm(prev => ({ ...prev, forExistingDebt: false }));
    }
  }, [hasDebt]);

  const handleAddKirim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await financeApi.createTransaction({
        ...kirimForm,
        type: 'kirim',
        vendorId: kirimForm.vendorId || null,
        customerId: kirimForm.vendorId ? null : kirimForm.customerId,
        departmentId: kirimForm.departmentId || activeDepartmentId || null,
      });
      setIsKirimModalOpen(false);
      setKirimForm({ amount: '', paymentTypeId: '', customerId: '', customerName: '', serviceType: '', forExistingDebt: false, vendorId: '', departmentId: '' });
      showStatus('success', "Kirim muvaffaqiyatli amalga oshirildi!");
      fetchData(true);
    } catch (err) {
      showStatus('error', "Kirim qo'shishda xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChiqim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await financeApi.createTransaction({
        ...chiqimForm,
        type: 'chiqim',
        employeeId: chiqimForm.isEmployeeExpense ? chiqimForm.employeeId : null,
        vendorId: chiqimForm.isVendorExpense ? chiqimForm.vendorId : null,
        expenseTypeId: chiqimForm.isVendorExpense || chiqimForm.isEmployeeExpense ? null : chiqimForm.expenseTypeId,
        departmentId: chiqimForm.departmentId || activeDepartmentId || null,
      });
      setIsChiqimModalOpen(false);
      setChiqimForm({ amount: '', paymentTypeId: '', expenseReason: '', expenseTypeId: '', employeeId: '', isEmployeeExpense: false, isVendorExpense: false, vendorId: '', departmentId: '' });
      showStatus('success', "Chiqim muvaffaqiyatli amalga oshirildi!");
      fetchData(true);
    } catch (err) {
      showStatus('error', "Chiqim qo'shishda xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative">
      {isLoading && <LoadingSpinner fullPage />}
      {isLoading ? null : (<>
      
      {/* Global Status Notification */}
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="font-bold text-sm">{statusMessage.text}</span>
        </div>
      )}

      {/* Daily Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kirim ({selectedDate})</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={16}/></div>
          </div>
          <p className="text-xl font-black text-emerald-600 tracking-tight">{formatCurrency(summary?.totalKirim || 0)}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            {summary?.kirimBreakdown?.map((b: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400">{b.name}</span>
                <span className="text-emerald-500">+{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {!summary?.kirimBreakdown?.length && <p className="text-[10px] font-black text-slate-300 uppercase italic">Kirimlar yo'q</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiqim ({selectedDate})</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={16}/></div>
          </div>
          <p className="text-xl font-black text-rose-600 tracking-tight">{formatCurrency(summary?.totalChiqim || 0)}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            {summary?.chiqimBreakdown?.map((b: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-400">{b.name}</span>
                <span className="text-rose-500">-{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {!summary?.chiqimBreakdown?.length && <p className="text-[10px] font-black text-slate-300 uppercase italic">Chiqimlar yo'q</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xarajat Yo'nalishlari</span>
            <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><Wallet size={16}/></div>
          </div>
          <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scroll pr-1">
            {summary?.expenseBreakdown?.map((b: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-500">{b.name}</span>
                <span className="text-slate-700">{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {!summary?.expenseBreakdown?.length && <p className="text-[10px] font-black text-slate-300 uppercase italic">Xarajatlar yo'q</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Balans</span>
            <p className={`text-2xl font-black tracking-tighter ${(summary?.balance || 0) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
              {formatCurrency(summary?.balance || 0)}
            </p>
            <div className="mt-2 px-3 py-1 bg-slate-100 rounded-full">
               <span className="text-[9px] font-black text-slate-500 uppercase">{new Date(selectedDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-slate-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                Kassa Amaliyotlari <Wallet size={18} className="text-orange-500" />
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Kunlik tranzaksiyalar tarixi</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
               <input 
                 type="date" 
                 value={selectedDate} 
                 onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
                 className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-none focus:ring-0 cursor-pointer bg-transparent py-1"
               />
               <button 
                 onClick={() => { setSelectedDate(new Date().toLocaleDateString('en-CA')); setPage(1); }}
                 className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[8px] font-black uppercase tracking-widest rounded-lg transition-colors text-slate-500"
               >
                 BUGUN
               </button>
            </div>
          </div>
          <div className="flex gap-2">
             {p.canAddIncome && (
               <button onClick={() => setIsKirimModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-9 px-6 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all hover:-translate-y-0.5">
                 <TrendingUp size={14} strokeWidth={2.5}/> KIRIM
               </button>
             )}
             {p.canAddExpense && (
               <button onClick={() => setIsChiqimModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-9 px-6 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all hover:-translate-y-0.5">
                 <TrendingDown size={14} strokeWidth={2.5}/> CHIQIM
               </button>
             )}
          </div>
        </div>

        <div className="overflow-x-auto custom-scroll overflow-y-auto max-h-[55vh]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
              <tr className="border-b border-slate-100">
                <th className="py-3 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">Turi</th>
                <th className="py-3 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Mijoz / Sabab</th>
                <th className="py-3 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Summa</th>
                <th className="py-3 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center hidden md:table-cell">To'lov</th>
                <th className="py-3 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-6">Sana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3 px-5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.type === 'kirim' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'kirim' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                      </div>
                  </td>
                  <td className="py-3 px-5">
                      <p className="font-black text-slate-800 text-xs tracking-tight">
                        {t.type === 'kirim'
                          ? (t.vendor?.name ? `Hamkor: ${t.vendor.name}` : (t.customer?.name || t.customerName || t.serviceType || '—'))
                          : (t.vendor?.name ? `Hamkor: ${t.vendor.name}` : (t.employeeId && !p.canViewSalary) ? 'Xodim maoshi' : (t.expenseReason || (t.expenseType?.name + (t.employee?.fullName ? ' - ' + t.employee.fullName : ''))))}
                      </p>
                      {t.vendor && <span className="text-[8px] font-black text-sky-500 uppercase tracking-widest mt-0.5">{t.vendor.specialty || 'Hamkor'}</span>}
                      {!t.vendor && t.expenseType && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t.expenseType.name}</span>}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                      <span className={`font-black text-xs tabular-nums ${t.type === 'kirim' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(t.type === 'chiqim' && t.employeeId && !p.canViewSalary) ? '***' : (t.type === 'kirim' ? '+' : '-') + formatCurrency(t.amount)}
                      </span>
                  </td>
                  <td className="py-3 px-5 text-center hidden md:table-cell">
                      <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200/60 uppercase tracking-tighter">
                        {t.paymentType?.name || '—'}
                      </span>
                  </td>
                  <td className="py-3 px-5 text-right pr-6 whitespace-nowrap">
                      <p className="text-[10px] font-bold text-slate-400 tabular-nums">{new Date(t.date).toLocaleDateString('uz-UZ')}</p>
                      <p className="text-[9px] font-medium text-slate-300 mt-0.5 tabular-nums">{new Date(t.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                   <td colSpan={5} className="py-20 text-center">
                     <div className="flex flex-col items-center justify-center opacity-30">
                       <Wallet size={40} className="mb-4" />
                       <p className="font-black uppercase text-xs">Bugun amaliyotlar yo'q</p>
                     </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {meta && meta.lastPage > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-4 bg-slate-50/30">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              Oldingi
            </button>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Sahifa {page} / {meta.lastPage}
            </span>
            <button 
              disabled={page === meta.lastPage}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              Keyingi
            </button>
          </div>
        )}
      </div>

      {/* Modal: Kirim Qo'shish */}
      <Modal 
        isOpen={isKirimModalOpen} 
        onClose={() => setIsKirimModalOpen(false)} 
        title="Kirim Amaliyoti"
        type="success"
      >
        <form onSubmit={handleAddKirim} className="space-y-4">
          {vendors.length > 0 && (
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button type="button" onClick={() => setKirimForm(f => ({...f, vendorId: ''}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${!kirimForm.vendorId ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>MIJOZDAN</button>
              <button type="button" onClick={() => setKirimForm(f => ({...f, vendorId: '_', customerId: '', customerName: ''}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${kirimForm.vendorId ? 'bg-white shadow text-sky-600' : 'text-slate-400'}`}>HAMKORDAN</button>
            </div>
          )}

          {kirimForm.vendorId ? (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Hamkorni tanlang</label>
              <select required value={kirimForm.vendorId === '_' ? '' : kirimForm.vendorId} onChange={e => setKirimForm(f => ({...f, vendorId: e.target.value}))} className="select-minimal">
                <option value="">Tanlang...</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.specialty ? ` — ${v.specialty}` : ''}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Mijozni tanlang</label>
              <SearchableSelect
                options={customers.map(c => ({ id: c.id, label: c.name, subLabel: c.phone || 'Tel yo\'q', value: c }))}
                value={kirimForm.customerId}
                onChange={(id) => handleCustomerChange(id)}
                placeholder="Mijoz qidirish..."
              />
              {!kirimForm.customerId && (
                <div className="mt-2 animate-fade-in">
                  <input type="text" value={kirimForm.customerName} onChange={e => setKirimForm(f => ({ ...f, customerName: e.target.value }))} className="input-minimal text-slate-700 font-bold" placeholder="Noma'lum mijoz ismi (ixtiyoriy)..."/>
                </div>
              )}
            </div>
          )}

          {!kirimForm.vendorId && customerTasks.length > 0 && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1 text-orange-500">Bog'liq xizmat (Mijoz nomiga)</label>
              <select value={kirimForm.serviceType} onChange={e => setKirimForm(f => ({ ...f, serviceType: e.target.value }))} className="select-minimal font-black text-orange-700 h-11 border-orange-100 bg-orange-50/30">
                <option value="">— Xizmatni tanlang (ixtiyoriy) —</option>
                {customerTasks.map((t, idx) => <option key={idx} value={t.orderName || t.title}>{t.orderName || t.title}</option>)}
              </select>
            </div>
          )}

          {!kirimForm.vendorId && hasDebt && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-orange-900 flex items-center gap-2">
                <AlertCircle size={14} className="text-orange-500" />
                Mijoz qarzi: <span className="font-black">{formatCurrency(currentDebtAmount)}</span>
              </p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={kirimForm.forExistingDebt} onChange={(e) => setKirimForm({...kirimForm, forExistingDebt: e.target.checked})} className="w-5 h-5 rounded-lg border-2 border-orange-300 text-orange-500 focus:ring-orange-200 transition-all cursor-pointer" />
                <span className="text-xs font-bold text-orange-800">Qarzdorlikni qoplash uchun</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Xizmat Nomi / Izoh</label>
            <input type="text" required={!kirimForm.forExistingDebt} value={kirimForm.serviceType} onChange={(e) => setKirimForm({...kirimForm, serviceType: e.target.value})} className="input-minimal" placeholder={kirimForm.forExistingDebt ? "Qarz to'lovi" : "Masalan: Banner bosish..."} />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Summa</label>
            <CurrencyInput
              value={kirimForm.amount}
              onChange={(uzs) => setKirimForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
              colorClass="text-emerald-600 focus:border-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">To'lov Turi</label>
            <select required value={kirimForm.paymentTypeId} onChange={(e) => setKirimForm({...kirimForm, paymentTypeId: e.target.value})} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>

          {deptOptions.length > 0 && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bo'lim (ixtiyoriy)</label>
              <select value={kirimForm.departmentId} onChange={e => setKirimForm(f => ({ ...f, departmentId: e.target.value }))} className="select-minimal">
                <option value="">— Barcha bo'limlar —</option>
                {deptOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsKirimModalOpen(false)} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-success h-11 shadow-emerald-500/20">
              {isSubmitting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : "TASDIQLASH"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Chiqim Qo'shish */}
      <Modal 
        isOpen={isChiqimModalOpen} 
        onClose={() => setIsChiqimModalOpen(false)} 
        title="Chiqim / Xarajat"
        type="danger"
      >
        <form onSubmit={handleAddChiqim} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-2">
            <button type="button" onClick={() => setChiqimForm(f => ({...f, isEmployeeExpense: false, isVendorExpense: false}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${!chiqimForm.isEmployeeExpense && !chiqimForm.isVendorExpense ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>UMUMIY</button>
            <button type="button" onClick={() => setChiqimForm(f => ({...f, isEmployeeExpense: true, isVendorExpense: false}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${chiqimForm.isEmployeeExpense ? 'bg-white shadow text-orange-600' : 'text-slate-400'}`}>HODIM</button>
            {vendors.length > 0 && <button type="button" onClick={() => setChiqimForm(f => ({...f, isVendorExpense: true, isEmployeeExpense: false}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${chiqimForm.isVendorExpense ? 'bg-white shadow text-sky-600' : 'text-slate-400'}`}>HAMKOR</button>}
          </div>

          {!chiqimForm.isEmployeeExpense && !chiqimForm.isVendorExpense && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Xarajat Turi</label>
              <select required value={chiqimForm.expenseTypeId} onChange={(e) => setChiqimForm({...chiqimForm, expenseTypeId: e.target.value})} className="select-minimal">
                <option value="">Tanlang...</option>
                {expenseTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
              </select>
            </div>
          )}
          {chiqimForm.isEmployeeExpense && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Hodimni tanlang</label>
              <SearchableSelect
                options={employees.map(e => ({ id: e.id, label: e.fullName, subLabel: e.role?.name || 'Xodim', value: e }))}
                value={chiqimForm.employeeId}
                onChange={(id) => setChiqimForm(f => ({ ...f, employeeId: id }))}
                placeholder="Hodim qidirish..."
              />
            </div>
          )}
          {chiqimForm.isVendorExpense && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Hamkorni tanlang</label>
              <select required value={chiqimForm.vendorId} onChange={e => setChiqimForm(f => ({...f, vendorId: e.target.value}))} className="select-minimal">
                <option value="">Tanlang...</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.specialty ? ` — ${v.specialty}` : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Xarajat Sababi (Ixtiyoriy)</label>
            <input type="text" value={chiqimForm.expenseReason} onChange={(e) => setChiqimForm({...chiqimForm, expenseReason: e.target.value})} className="input-minimal" placeholder="Masalan: Kommunal to'lov, Material..." />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Summa</label>
            <CurrencyInput
              value={chiqimForm.amount}
              onChange={(uzs) => setChiqimForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
              colorClass="text-rose-600 focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">To'lov Turi</label>
            <select required value={chiqimForm.paymentTypeId} onChange={(e) => setChiqimForm({...chiqimForm, paymentTypeId: e.target.value})} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>

          {deptOptions.length > 0 && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Bo'lim (ixtiyoriy)</label>
              <select value={chiqimForm.departmentId} onChange={e => setChiqimForm(f => ({ ...f, departmentId: e.target.value }))} className="select-minimal">
                <option value="">— Barcha bo'limlar —</option>
                {deptOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsChiqimModalOpen(false)} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-danger h-11 shadow-rose-500/20">
              {isSubmitting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : "TASDIQLASH"}
            </button>
          </div>
        </form>
      </Modal>

    </>)}
    </div>
  );
};

export default Kassa;
