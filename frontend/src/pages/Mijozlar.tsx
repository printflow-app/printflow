import React, { useState, useEffect } from 'react';
import {
  Search, Phone, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  FileText, AlertCircle, Trophy, Package, ClipboardList, Plus, Edit3,
  Building2, UserPlus, Mail, Briefcase, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { customersApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + ' UZS';

const Mijozlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const p = currentUser.permissions || {};
  const isAdmin =
    currentUser.role?.name?.toLowerCase() === 'admin' ||
    currentUser.login === 'admin';
  const canAdd             = p.canAddCustomer || p.canManageCustomers || isAdmin;
  const canEdit            = p.canEditCustomer || p.canManageCustomers || isAdmin;
  const canDelete          = p.canDeleteCustomer || p.canManageCustomers || isAdmin;
  const canManageContacts  = p.canManageCustomers || isAdmin;

  const [customers, setCustomers] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'top'>('all');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit customer modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [custForm, setCustForm] = useState({ id: '', name: '', phone: '', companyInfo: '' });

  // Contacts management
  const [contactsCustomer, setContactsCustomer] = useState<any | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', role: '', email: '' });
  const [isAddingContact, setIsAddingContact] = useState(false);

  // Order history modal
  const [orderHistoryModal, setOrderHistoryModal] = useState<{ isOpen: boolean; customer: any | null; orders: any[] }>({
    isOpen: false, customer: null, orders: [],
  });
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);

  // Delete confirm
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; id: string | null; name: string }>({ isOpen: false, id: null, name: '' });

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [customersRes, topRes] = await Promise.all([
        customersApi.findAll(activeBranchId, true),
        customersApi.getTopCustomers(10),
      ]);
      setCustomers(customersRes.data || []);
      setTopCustomers(topRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeBranchId]);

  useAutoRefresh(() => fetchData(true), {
    intervalMs: 20000,
    paused: isFormOpen || isContactsOpen || orderHistoryModal.isOpen || confirmModal.isOpen,
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.companyInfo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // =============================================
  // Customer CRUD
  // =============================================
  const openAdd = () => {
    setCustForm({ id: '', name: '', phone: '', companyInfo: '' });
    setIsEditing(false);
    setIsFormOpen(true);
  };

  const openEdit = (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustForm({ id: c.id, name: c.name, phone: c.phone || '', companyInfo: c.companyInfo || '' });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name.trim()) return;
    try {
      if (isEditing) {
        await customersApi.update(custForm.id, { name: custForm.name, phone: custForm.phone, companyInfo: custForm.companyInfo });
        showStatus('success', "Mijoz yangilandi!");
      } else {
        await customersApi.create({ name: custForm.name, phone: custForm.phone, companyInfo: custForm.companyInfo });
        showStatus('success', "Yangi mijoz qo'shildi!");
      }
      setIsFormOpen(false);
      fetchData(true);
    } catch {
      showStatus('error', "Saqlashda xatolik!");
    }
  };

  const handleDelete = async () => {
    if (!confirmModal.id) return;
    try {
      await customersApi.delete(confirmModal.id);
      toast.success("Mijoz o'chirildi!");
      setConfirmModal({ isOpen: false, id: null, name: '' });
      fetchData(true);
    } catch {
      toast.error("O'chirishda xatolik yuz berdi!");
    }
  };

  // =============================================
  // Contacts
  // =============================================
  const openContacts = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setContactsCustomer(c);
    setIsContactsOpen(true);
    setIsContactsLoading(true);
    try {
      const res = await customersApi.getContacts(c.id);
      setContacts(res.data || []);
    } catch {
      setContacts([]);
    } finally {
      setIsContactsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactsCustomer || !contactForm.name.trim()) return;
    setIsAddingContact(true);
    try {
      await customersApi.createContact(contactsCustomer.id, {
        name: contactForm.name,
        phone: contactForm.phone || undefined,
        role: contactForm.role || undefined,
        email: contactForm.email || undefined,
      });
      setContactForm({ name: '', phone: '', role: '', email: '' });
      const res = await customersApi.getContacts(contactsCustomer.id);
      setContacts(res.data || []);
      showStatus('success', "Kontakt qo'shildi!");
    } catch {
      showStatus('error', "Xarajat qo'shishda xato!");
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!contactsCustomer) return;
    try {
      await customersApi.deleteContact(contactsCustomer.id, contactId);
      const res = await customersApi.getContacts(contactsCustomer.id);
      setContacts(res.data || []);
      showStatus('success', "Kontakt o'chirildi.");
    } catch {
      showStatus('error', "O'chirishda xato!");
    }
  };

  // =============================================
  // Order History
  // =============================================
  const openOrderHistory = async (customer: any) => {
    setOrderHistoryModal({ isOpen: true, customer, orders: [] });
    setOrderHistoryLoading(true);
    try {
      const res = await customersApi.getOrderHistory(customer.id);
      setOrderHistoryModal(prev => ({ ...prev, orders: res.data || [] }));
    } catch {
      toast.error('Buyurtmalar tarixini yuklashda xatolik!');
    } finally {
      setOrderHistoryLoading(false);
    }
  };

  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

  // Stats
  const totalDebtors = customers.filter(c => (c.totalDebt - c.totalPaid) > 0).length;
  const totalDebtAmount = customers.reduce((s, c) => {
    const b = c.totalDebt - c.totalPaid;
    return b > 0 ? s + b : s;
  }, 0);
  const totalCreditors = customers.filter(c => (c.totalDebt - c.totalPaid) < 0).length;

  if (isLoading) return <LoadingSpinner fullPage />;

  const MEDAL_LABELS = ['🥇', '🥈', '🥉'];
  const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#cd7c2f'];

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMsg.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
          <span className="font-bold text-sm">{statusMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-black text-slate-800 tracking-tight">Mijozlar Bazasi</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Barcha hamkorlar va ularning moliyaviy holati</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex bg-slate-100 p-0.5 rounded-lg shadow-inner">
            <button onClick={() => setActiveView('all')} className={`px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${activeView === 'all' ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500'}`}>
              Barchasi
            </button>
            <button onClick={() => setActiveView('top')} className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-md transition-all ${activeView === 'top' ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500'}`}>
              <Trophy size={11}/> Top 10
            </button>
          </div>
          {activeView === 'all' && (
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input
                type="text"
                placeholder="Qidirish (ism, tel, kompaniya)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 h-10 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 transition-all placeholder:text-slate-300 shadow-inner"
              />
            </div>
          )}
          {canAdd && (
            <button
              onClick={openAdd}
              className="w-full sm:w-auto flex items-center justify-center gap-2 h-10 px-5 bg-[#FF6B00] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-[#E65A00] transition-all"
            >
              <Plus size={13} strokeWidth={3}/> MIJOZ QO'SHISH
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Jami Mijozlar</p>
          <h4 className="text-lg font-black text-slate-800">{customers.length}</h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-[8px] font-black text-rose-400 uppercase mb-1 tracking-widest">Qarzdorlar</p>
          <h4 className="text-lg font-black text-rose-600">{totalDebtors}</h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-[8px] font-black text-rose-400 uppercase mb-1 tracking-widest">Umumiy Qarzlar</p>
          <h4 className="text-lg font-black text-rose-600 truncate">{formatCurrency(totalDebtAmount)}</h4>
        </div>
        <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm hover:shadow-md transition-all">
          <p className="text-[8px] font-black text-orange-400 uppercase mb-1 tracking-widest">Haqdorlar</p>
          <h4 className="text-lg font-black text-orange-600">{totalCreditors}</h4>
        </div>
      </div>

      {/* TOP CUSTOMERS */}
      {activeView === 'top' && (
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-1">
            <Trophy className="text-amber-500" size={18}/> Top Mijozlar (Buyurtmalar bo'yicha)
          </h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Eng ko'p buyurtma bergan va eng ko'p to'lagan mijozlar</p>
          <div className="space-y-3">
            {topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all group">
                <div className="text-2xl flex-shrink-0 w-10 text-center">{MEDAL_LABELS[i] || `${i + 1}`}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg" style={{ background: MEDAL_COLORS[i] || '#6366f1' }}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 truncate">{c.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                    <Package size={10}/> {c.orderCount} ta buyurtma
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-emerald-600">{formatCurrency(c.totalPaid)}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Jami to'lagan</p>
                </div>
                <button
                  onClick={() => openOrderHistory(c)}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all shadow-sm"
                >
                  <ClipboardList size={14}/>
                </button>
              </div>
            ))}
            {topCustomers.length === 0 && (
              <div className="py-16 text-center text-slate-300 font-bold text-xs uppercase tracking-widest">Ma'lumot yo'q</div>
            )}
          </div>
        </div>
      )}

      {/* ALL CUSTOMERS TABLE */}
      {activeView === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-100">
                  <th className="py-3 px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest w-8"></th>
                  <th className="py-3 px-5 text-[9px] uppercase font-black text-slate-400 tracking-widest">Mijoz</th>
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
                    const contactCount = (c.contacts || []).length;
                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${isExpanded ? 'bg-slate-50/70 border-b border-orange-50' : ''}`}
                          onClick={() => toggleExpand(c.id)}
                        >
                          <td className="py-3 px-5">
                            <button className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-orange-600 group-hover:text-white transition-all shadow-sm">
                              {isExpanded ? <ChevronUp size={12} strokeWidth={3}/> : <ChevronDown size={12} strokeWidth={3}/>}
                            </button>
                          </td>
                          <td className="py-3 px-5">
                            <div className="font-black text-slate-800 text-xs flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm">{c.name.charAt(0)}</div>
                              <div>
                                <p>{c.name}</p>
                                {c.companyInfo && (
                                  <p className="text-[9px] font-black text-slate-400 flex items-center gap-1 mt-0.5 normal-case font-medium">
                                    <Building2 size={8}/> {c.companyInfo}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5">
                            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5"><Phone size={11} className="text-sky-400"/> {c.phone || '—'}</p>
                          </td>
                          <td className="px-5 font-bold text-[11px] text-slate-600">{formatCurrency(c.totalDebt)}</td>
                          <td className="px-5 font-black text-[11px] text-emerald-600">{formatCurrency(c.totalPaid)}</td>
                          <td className="px-5">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black border uppercase tracking-tight ${balance > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : balance < 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                              {balance > 0 ? formatCurrency(balance) : balance < 0 ? `Haqdor: ${formatCurrency(Math.abs(balance))}` : 'Yopilgan'}
                            </span>
                          </td>
                          <td className="px-5 text-right pr-6" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openOrderHistory(c)} className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-400 hover:bg-orange-500 hover:text-white transition-all shadow-sm" title="Buyurtmalar tarixi">
                                <ClipboardList size={13}/>
                              </button>
                              {(canManageContacts || canEdit || canDelete) && (
                                <>
                                  {canManageContacts && (
                                    <button onClick={e => openContacts(c, e)} className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-white transition-all shadow-sm relative" title="Kontaktlar">
                                      <UserPlus size={13}/>
                                      {contactCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{contactCount}</span>
                                      )}
                                    </button>
                                  )}
                                  {canEdit && (
                                    <button onClick={e => openEdit(c, e)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-violet-500 hover:text-white transition-all shadow-sm" title="Tahrirlash">
                                      <Edit3 size={13}/>
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => setConfirmModal({ isOpen: true, id: c.id, name: c.name })} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                      <Trash2 size={13}/>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-slate-50/80 px-8 py-6 border-t border-slate-100 animate-fade-in">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Buyurtmalar */}
                                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                    <h5 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <FileText size={14}/> Buyurtmalar ({tasks.length})
                                    </h5>
                                    {tasks.length === 0 ? (
                                      <p className="text-xs text-slate-400 font-bold py-4">Hech qanday buyurtma topilmadi</p>
                                    ) : (
                                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                                        {tasks.map((t: any) => (
                                          <div key={t.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div>
                                              <p className="text-xs font-black text-slate-700">{t.title}</p>
                                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{new Date(t.createdAt).toLocaleDateString('uz-UZ')}</p>
                                            </div>
                                            <p className="text-xs font-black text-slate-800">{formatCurrency(t.totalAmount)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* To'lovlar tarixi */}
                                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                    <h5 className="text-xs font-black text-sky-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <TrendingUp size={14}/> To'lovlar Tarixi
                                    </h5>
                                    {transactions.length === 0 ? (
                                      <p className="text-xs text-slate-400 font-bold py-4">Hech qanday tranzaksiya topilmadi</p>
                                    ) : (
                                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                                        {transactions.map((tr: any) => (
                                          <div key={tr.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-3">
                                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tr.type === 'kirim' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                                                {tr.type === 'kirim' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                              </div>
                                              <div>
                                                <p className="text-xs font-bold text-slate-700">{tr.serviceType || tr.expenseReason || tr.type}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{new Date(tr.date).toLocaleDateString('uz-UZ')} • {tr.paymentType?.name || 'Naqd'}</p>
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
      )}

      {/* MODAL: ADD / EDIT CUSTOMER */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={isEditing ? 'Mijozni tahrirlash' : "Yangi mijoz qo'shish"}
        type={isEditing ? undefined : 'warning'}
      >
        <form onSubmit={handleSubmitCustomer} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Ism *</label>
            <input
              type="text" required autoFocus
              value={custForm.name}
              onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))}
              className="input-minimal font-black text-slate-800 h-12 border-2"
              placeholder="Mijoz ismi yoki kompaniya nomi..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Telefon</label>
              <input
                type="text"
                value={custForm.phone}
                onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))}
                className="input-minimal h-11 border-2"
                placeholder="+998 90 ..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                <Building2 size={10} className="inline mr-1"/> Kompaniya (B2B)
              </label>
              <input
                type="text"
                value={custForm.companyInfo}
                onChange={e => setCustForm(f => ({ ...f, companyInfo: e.target.value }))}
                className="input-minimal h-11 border-2"
                placeholder="Masalan: Ideal Print MCHJ"
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

      {/* MODAL: CONTACTS */}
      <Modal
        isOpen={isContactsOpen}
        onClose={() => { setIsContactsOpen(false); setContactsCustomer(null); setContacts([]); }}
        title={`Kontaktlar — ${contactsCustomer?.name || ''}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          {/* Add contact form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <UserPlus size={12}/> Yangi kontakt qo'shish
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Ism *"
                value={contactForm.name}
                onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                className="input-minimal font-black"
              />
              <input
                type="text"
                placeholder="Telefon"
                value={contactForm.phone}
                onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                className="input-minimal"
              />
              <input
                type="text"
                placeholder="Lavozim (masalan: Direktor)"
                value={contactForm.role}
                onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}
                className="input-minimal"
              />
              <input
                type="email"
                placeholder="Email (ixtiyoriy)"
                value={contactForm.email}
                onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                className="input-minimal"
              />
            </div>
            <button
              type="button"
              onClick={handleAddContact}
              disabled={isAddingContact || !contactForm.name.trim()}
              className="w-full h-10 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {isAddingContact ? 'QOSHILMOQDA...' : "QO'SHISH"}
            </button>
          </div>

          {/* Contacts list */}
          {isContactsLoading ? (
            <div className="py-10 flex justify-center opacity-30">
              <div className="animate-spin w-6 h-6 border-2 border-orange-500 rounded-full border-t-transparent"/>
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center opacity-20">
              <UserPlus size={32} className="mb-3"/>
              <p className="text-[10px] font-black uppercase">Kontaktlar yo'q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((ct: any) => (
                <div key={ct.id} className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-500 flex items-center justify-center border border-sky-100 font-black text-sm">
                      {ct.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{ct.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {ct.role && (
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Briefcase size={8}/> {ct.role}</span>
                        )}
                        {ct.phone && (
                          <span className="text-[9px] font-bold text-sky-500 flex items-center gap-1"><Phone size={8}/> {ct.phone}</span>
                        )}
                        {ct.email && (
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Mail size={8}/> {ct.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteContact(ct.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL: ORDER HISTORY */}
      <Modal
        isOpen={orderHistoryModal.isOpen}
        onClose={() => setOrderHistoryModal({ isOpen: false, customer: null, orders: [] })}
        title={`Buyurtmalar Tarixi — ${orderHistoryModal.customer?.name || ''}`}
        maxWidth="max-w-2xl"
      >
        {orderHistoryLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : orderHistoryModal.orders.length === 0 ? (
          <div className="py-16 text-center text-slate-300 font-bold text-xs uppercase tracking-widest">Hech qanday buyurtma topilmadi</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scroll">
            {orderHistoryModal.orders.map((order: any) => (
              <div key={order.id} className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{order.title}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {order.service && (
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[9px] font-black rounded-lg border border-orange-100 uppercase">{order.service.name}</span>
                      )}
                      {order.column && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg uppercase">{order.column.title}</span>
                      )}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-lg">{new Date(order.createdAt).toLocaleDateString('uz-UZ')}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-slate-800">{formatCurrency(order.totalAmount || 0)}</p>
                    {order.depositAmount > 0 && (
                      <p className="text-[10px] font-bold text-emerald-500">Zakolat: {formatCurrency(order.depositAmount)}</p>
                    )}
                    {order.remainingAmount > 0 && (
                      <p className="text-[10px] font-bold text-rose-500">Qoldiq: {formatCurrency(order.remainingAmount)}</p>
                    )}
                  </div>
                </div>
                {order.note && (
                  <p className="text-[10px] text-slate-400 font-medium mt-2 italic border-t border-slate-100 pt-2">{order.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* MODAL: DELETE CONFIRM */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title="Mijozni o'chirish"
        type="danger"
      >
        <div className="space-y-6">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1" size={24}/>
            <div>
              <p className="text-sm font-black text-rose-900 uppercase">Diqqat!</p>
              <p className="text-xs font-bold text-rose-700 mt-1">
                Siz <strong>{confirmModal.name}</strong> mijozini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
              Bekor qilish
            </button>
            <button type="button" className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all" onClick={handleDelete}>
              Ha, o'chirilsin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Mijozlar;
