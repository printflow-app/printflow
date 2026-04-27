import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { financeApi, paymentTypesApi, customersApi, employeesApi, expenseTypesApi } from '../api';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import NumberInput from '../components/NumberInput';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + " UZS";
};

const Kassa: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const p = currentUser.permissions;

  const [transactions, setTransactions] = useState<any[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [transRes, ptRes, custRes, empRes, etRes] = await Promise.all([
        financeApi.getTransactions(),
        paymentTypesApi.findAll(),
        customersApi.findAll(),
        employeesApi.findAll(),
        expenseTypesApi.findAll()
      ]);
      setTransactions(transRes.data || []);
      setPaymentTypes(ptRes.data || []);
      setCustomers(custRes.data || []);
      setEmployees(empRes.data || []);
      setExpenseTypes(etRes.data || []);
    } catch (err) {
      console.error("Kassa yuklashda xato:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Modals
  const [isKirimModalOpen, setIsKirimModalOpen] = useState(false);
  const [isChiqimModalOpen, setIsChiqimModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Forms
  const [kirimForm, setKirimForm] = useState({ amount: '', paymentTypeId: '', customerId: '', customerName: '', serviceType: '', forExistingDebt: false });
  const [chiqimForm, setChiqimForm] = useState({ amount: '', paymentTypeId: '', expenseReason: '', expenseTypeId: '', employeeId: '', isEmployeeExpense: false });
  const [customerTasks, setCustomerTasks] = useState<string[]>([]);

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
      await financeApi.createTransaction({ ...kirimForm, type: 'kirim' });
      setIsKirimModalOpen(false);
      setKirimForm({ amount: '', paymentTypeId: '', customerId: '', customerName: '', serviceType: '', forExistingDebt: false });
      showStatus('success', "Kirim muvaffaqiyatli amalga oshirildi!");
      fetchData();
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
      });
      setIsChiqimModalOpen(false);
      setChiqimForm({ amount: '', paymentTypeId: '', expenseReason: '', expenseTypeId: '', employeeId: '', isEmployeeExpense: false });
      showStatus('success', "Chiqim muvaffaqiyatli amalga oshirildi!");
      fetchData();
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

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 animate-pulse space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">Kassa ma'lumotlari yuklanmoqda...</p>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative">
      
      {/* Global Status Notification */}
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="font-bold text-sm">{statusMessage.text}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/30">
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
              Kassa Amaliyotlari <Wallet size={18} className="text-indigo-500" />
            </h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Barcha tranzaksiyalar tarixi</p>
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

        <div className="overflow-x-auto custom-scroll overflow-y-auto max-h-[65vh]">
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
                          ? (t.customer?.name || t.customerName || t.serviceType || '—')
                          : ((t.employeeId && !p.canViewSalary) ? 'Xodim maoshi' : (t.expenseReason || (t.expenseType?.name + (t.employee?.fullName ? ' - ' + t.employee.fullName : ''))))}
                      </p>
                      {t.expenseType && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t.expenseType.name}</span>}
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
                       <p className="font-black uppercase text-xs">Hozircha amaliyotlar yo'q</p>
                     </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Kirim Qo'shish */}
      <Modal 
        isOpen={isKirimModalOpen} 
        onClose={() => setIsKirimModalOpen(false)} 
        title="Kirim Amaliyoti"
        type="success"
      >
        <form onSubmit={handleAddKirim} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Mijozni tanlang</label>
            <SearchableSelect 
              options={customers.map(c => ({ id: c.id, label: c.name, subLabel: c.phone || 'Tel yo\'q', value: c }))}
              value={kirimForm.customerId}
              onChange={(id) => handleCustomerChange(id)}
              placeholder="Mijoz qidirish..."
            />
            {/* Unknown customer name input — shows only when no customer selected */}
            {!kirimForm.customerId && (
              <div className="mt-2 animate-fade-in">
                <input
                  type="text"
                  value={kirimForm.customerName}
                  onChange={e => setKirimForm(f => ({ ...f, customerName: e.target.value }))}
                  className="input-minimal text-slate-700 font-bold"
                  placeholder="Noma'lum mijoz ismi (ixtiyoriy)..."
                />
              </div>
            )}
          </div>

          {customerTasks.length > 0 && (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1 text-indigo-500">Bog'liq xizmat (Mijoz nomiga)</label>
              <select 
                value={kirimForm.serviceType} 
                onChange={e => setKirimForm(f => ({ ...f, serviceType: e.target.value }))}
                className="select-minimal font-black text-violet-700 h-11 border-indigo-100 bg-indigo-50/30"
              >
                <option value="">— Xizmatni tanlang (ixtiyoriy) —</option>
                {customerTasks.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          
          {hasDebt && (
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
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Summa (UZS)</label>
            <NumberInput
              value={kirimForm.amount}
              onChange={(num) => setKirimForm(f => ({ ...f, amount: num ? String(num) : '' }))}
              placeholder="0"
              className="input-minimal h-12 text-lg font-black text-emerald-600 focus:border-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">To'lov Turi</label>
            <select required value={kirimForm.paymentTypeId} onChange={(e) => setKirimForm({...kirimForm, paymentTypeId: e.target.value})} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsKirimModalOpen(false)} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-success h-11 shadow-emerald-500/20">
              {isSubmitting ? "YUKLANMOQDA..." : "TASDIQLASH"}
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
            <button type="button" onClick={() => setChiqimForm(f => ({...f, isEmployeeExpense: false}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${!chiqimForm.isEmployeeExpense ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>UMUMIY</button>
            <button type="button" onClick={() => setChiqimForm(f => ({...f, isEmployeeExpense: true}))} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-colors ${chiqimForm.isEmployeeExpense ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>HODIM UCHUN</button>
          </div>

          {!chiqimForm.isEmployeeExpense ? (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Xarajat Turi</label>
              <select required value={chiqimForm.expenseTypeId} onChange={(e) => setChiqimForm({...chiqimForm, expenseTypeId: e.target.value})} className="select-minimal">
                <option value="">Tanlang...</option>
                {expenseTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="animate-fade-in">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Hodimni tanlang (Maoshidan ushlab qolinadi)</label>
              <SearchableSelect 
                options={employees.map(e => ({ id: e.id, label: e.fullName, subLabel: e.role?.name || 'Xodim', value: e }))}
                value={chiqimForm.employeeId}
                onChange={(id) => setChiqimForm(f => ({ ...f, employeeId: id }))}
                placeholder="Hodim qidirish..."
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Xarajat Sababi (Ixtiyoriy)</label>
            <input type="text" value={chiqimForm.expenseReason} onChange={(e) => setChiqimForm({...chiqimForm, expenseReason: e.target.value})} className="input-minimal" placeholder="Masalan: Kommunal to'lov, Material..." />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">Summa (UZS)</label>
            <NumberInput
              value={chiqimForm.amount}
              onChange={(num) => setChiqimForm(f => ({ ...f, amount: num ? String(num) : '' }))}
              placeholder="0"
              className="input-minimal h-12 text-lg font-black text-rose-600 focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 px-1">To'lov Turi</label>
            <select required value={chiqimForm.paymentTypeId} onChange={(e) => setChiqimForm({...chiqimForm, paymentTypeId: e.target.value})} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsChiqimModalOpen(false)} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-danger h-11 shadow-rose-500/20">
              {isSubmitting ? "YUKLANMOQDA..." : "TASDIQLASH"}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default Kassa;
