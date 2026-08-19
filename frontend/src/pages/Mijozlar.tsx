import React, { useState } from 'react';
import {
  Search, Phone, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  FileText, AlertCircle, ClipboardList, Plus, Edit3,
  Building2, UserPlus, Mail, Briefcase, CheckCircle2, Download,
  MapPin, Users, Table, Map as MapIcon
} from 'lucide-react';
import { customersApi } from '../api';
import { useCustomers, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import MijozXarita from '../components/MijozXarita';
import JoyTanlagich from '../components/JoyTanlagich';
import LoadingSpinner from '../components/LoadingSpinner';
import { SkeletonTable } from '../components/Skeleton';
import { toast } from 'react-toastify';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { exportMultiSheetXlsx } from '../utils/exportToXlsx';
import { Badge, EmptyState, PhoneInput, StatCard, Tabs, Toast } from '../components/ui';

const formatCurrency = (amount: number | null | undefined) => {
  const val = typeof amount === 'number' ? amount : 0;
  return new Intl.NumberFormat('uz-UZ').format(val).replace(/,/g, ' ') + ' UZS';
};

const formatDate = (dateStr: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ');
};

const MIN_DEBT = 1;
const debtOf = (c: any) => Number(c?.totalDebt || 0) - Number(c?.totalPaid || 0);
const hasDebt = (c: any) => debtOf(c) >= MIN_DEBT;

type ViewType = 'all' | 'map';

const Mijozlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const p = currentUser?.permissions || {};
  const isAdmin =
    currentUser?.role?.name?.toLowerCase() === 'admin' ||
    currentUser?.login === 'admin';
  const canAdd             = p.canAddCustomer || p.canManageCustomers || isAdmin;
  const canEdit            = p.canEditCustomer || p.canManageCustomers || isAdmin;
  const canDelete          = p.canDeleteCustomer || p.canManageCustomers || isAdmin;
  const canManageContacts  = p.canManageCustomers || isAdmin;

  // RQ — cache'lanadi
  const { data: customers = [], isLoading } = useCustomers(activeBranchId, false);
  const invalidate = useInvalidate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'debt' | 'paid' | 'name'>('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, { tasks: any[]; transactions: any[] } | 'loading'>>({});
  const [activeView, setActiveView] = useState<ViewType>('all');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit customer modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [custForm, setCustForm] = useState<{
    id: string; name: string; phone: string; companyInfo: string;
    address: string; joy: { lat: number; lng: number } | null;
  }>({ id: '', name: '', phone: '', companyInfo: '', address: '', joy: null });
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // Contacts management
  const [contacts, setContacts] = useState<any[]>([]);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', role: '', email: '' });
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

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

  const fetchData = async (_silent = false) => { invalidate.customers(); };

  useAutoRefresh(() => fetchData(true), {
    intervalMs: 20000,
    paused: isFormOpen || orderHistoryModal.isOpen || confirmModal.isOpen,
  });

  const filteredCustomers = customers
    .filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone || '').includes(searchTerm) ||
      (c.companyInfo || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'debt') return debtOf(b) - debtOf(a);
      if (sortBy === 'paid') return Number(b.totalPaid) - Number(a.totalPaid);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    const rows = filteredCustomers;
    if (rows.length === 0) {
      toast.info("Eksport qilish uchun ma'lumot yo'q");
      return;
    }
    setIsExporting(true);
    try {
      let xizmatlar: any[] = [];
      try {
        const res = await customersApi.getServiceRows(activeBranchId);
        xizmatlar = res.data || [];
      } catch {
        toast.warn("Xizmatlar ro'yxati olinmadi — faqat mijozlar chiqarildi");
      }

      const korinadiganIds = new Set(rows.map((c: any) => c.id));
      const xizmatQatorlari = xizmatlar.filter((t: any) => korinadiganIds.has(t.customer?.id));

      const yakun = new Map<string, { soni: number; summa: number; nomlar: string[] }>();
      for (const t of xizmatQatorlari) {
        const id = t.customer?.id;
        if (!id) continue;
        const y = yakun.get(id) || { soni: 0, summa: 0, nomlar: [] };
        y.soni += 1;
        y.summa += Number(t.totalAmount || 0);
        const nom = t.service?.name || t.title || '—';
        if (!y.nomlar.includes(nom)) y.nomlar.push(nom);
        yakun.set(id, y);
      }

      const stamp = new Date().toLocaleDateString('en-CA');
      exportMultiSheetXlsx({
        filename: `mijozlar_${stamp}`,
        sheets: [
          {
            sheetName: 'Mijozlar',
            rows,
            columns: [
              { header: 'Kompaniya', accessor: (c: any) => c.name || '' },
              { header: 'Telefon', accessor: (c: any) => c.phone || '' },
              {
                header: 'Vakillar',
                accessor: (c: any) => (c.contacts || [])
                  .map((k: any) => (k.role ? `${k.name} (${k.role})` : k.name))
                  .join('\n'),
              },
              {
                header: 'Vakillar telefoni',
                accessor: (c: any) => (c.contacts || [])
                  .map((k: any) => k.phone || '—')
                  .join('\n'),
              },
              { header: 'Xizmatlar soni', accessor: (c: any) => yakun.get(c.id)?.soni ?? 0 },
              { header: 'Umumiy summa', accessor: (c: any) => c.totalDebt || 0 },
              { header: "To'langan", accessor: (c: any) => c.totalPaid || 0 },
              { header: 'Qoldiq qarz', accessor: (c: any) => debtOf(c) },
              {
                header: 'Holati',
                accessor: (c: any) => (hasDebt(c) ? 'Qarzdor' : 'Yopilgan'),
              },
              { header: 'Manzil', accessor: (c: any) => c.address || '' },
              { header: "Qo'shimcha info", accessor: (c: any) => c.companyInfo || '' },
            ],
          },
          {
            sheetName: 'Xizmatlar',
            rows: xizmatQatorlari,
            columns: [
              { header: 'Mijoz', accessor: (t: any) => t.customer?.name || '' },
              { header: 'Mijoz telefoni', accessor: (t: any) => t.customer?.phone || '' },
              {
                header: 'Vakil',
                accessor: (t: any) =>
                  t.customerContact
                    ? (t.customerContact.role
                        ? `${t.customerContact.name} (${t.customerContact.role})`
                        : t.customerContact.name)
                    : '',
              },
              { header: 'Buyurtma nomi', accessor: (t: any) => t.orderName || t.title || '' },
              { header: 'Xizmat turi', accessor: (t: any) => t.service?.name || '' },
              { header: 'Bosqich', accessor: (t: any) => t.column?.title || '' },
              { header: 'Sana', accessor: (t: any) => formatDate(t.createdAt) },
              { header: 'Summa', accessor: (t: any) => t.totalAmount || 0 },
              { header: 'Zakolat', accessor: (t: any) => t.depositAmount || 0 },
              { header: 'Qoldiq', accessor: (t: any) => t.remainingAmount || 0 },
            ],
          },
        ],
      });
      toast.success("Excel fayl yuklab olindi");
    } catch {
      toast.error("Eksport qilishda xatolik");
    } finally {
      setIsExporting(false);
    }
  };

  const openAdd = () => {
    setIsEditing(false);
    setCustForm({ id: '', name: '', phone: '', companyInfo: '', address: '', joy: null });
    setFormStep(1);
    setContacts([]);
    setContactForm({ name: '', phone: '', role: '', email: '' });
    setEditingContactId(null);
    setIsFormOpen(true);
  };

  const openEdit = async (c: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    const joy = (typeof c.latitude === 'number' && typeof c.longitude === 'number')
      ? { lat: c.latitude, lng: c.longitude }
      : null;
    setCustForm({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      companyInfo: c.companyInfo || '',
      address: c.address || '',
      joy,
    });
    setFormStep(1);
    setContactForm({ name: '', phone: '', role: '', email: '' });
    setEditingContactId(null);
    setIsFormOpen(true);

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

  const openVakillar = async () => {
    if (!custForm.id) return;
    setFormStep(2);
    setContactForm({ name: '', phone: '', role: '', email: '' });
    setEditingContactId(null);
    if (contacts.length === 0) {
      setIsContactsLoading(true);
      try {
        const res = await customersApi.getContacts(custForm.id);
        setContacts(res.data || []);
      } catch {
        setContacts([]);
      } finally {
        setIsContactsLoading(false);
      }
    }
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name.trim()) return;
    try {
      const data = {
        name: custForm.name,
        phone: custForm.phone || undefined,
        companyInfo: custForm.companyInfo || undefined,
        address: custForm.address || undefined,
        latitude: custForm.joy?.lat ?? null,
        longitude: custForm.joy?.lng ?? null,
      };
      let id = custForm.id;
      if (isEditing) {
        await customersApi.update(id, data);
        showStatus('success', "Mijoz yangilandi!");
      } else {
        const res = await customersApi.create(data);
        id = res.data?.id;
        setCustForm(f => ({ ...f, id }));
        setIsEditing(true);
        showStatus('success', "Mijoz qo'shildi!");
      }
      fetchData(true);

      setFormStep(2);
      setContactForm({ name: '', phone: '', role: '', email: '' });
      setEditingContactId(null);
      setIsContactsLoading(true);
      try {
        const res = await customersApi.getContacts(id);
        setContacts(res.data || []);
      } catch {
        setContacts([]);
      } finally {
        setIsContactsLoading(false);
      }
    } catch {
      showStatus('error', "Saqlashda xatolik!");
    }
  };

  const closeCustomerModal = () => {
    setIsFormOpen(false);
    setFormStep(1);
    setContacts([]);
    setContactForm({ name: '', phone: '', role: '', email: '' });
    setEditingContactId(null);
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
  // Vakillarga alohida kirish tugmasi yo'q — qalamcha mijoz oynasini
  // ochadi, vakillar esa uning 2-bosqichida (`openVakillar`).

  // MIJOZ ID'SI YAGONA MANBADAN — `custForm.id`.
  //
  // Ilgari bu yer `contactsCustomer` ga tayanardi. Oyna ikki bosqichga
  // birlashtirilgandan keyin ikkita holat paydo bo'ldi va ular ajralib
  // qolishi mumkin edi: 2-tabga o'tish `custForm.id` ni ishlatadi,
  // qo'shish esa `contactsCustomer` ni — u null bo'lsa tugma jimgina
  // hech narsa qilmasdi.
  /** Vakil qatoridagi qalamcha — ma'lumotini yuqoridagi formaga oladi. */
  const startEditContact = (ct: any) => {
    setEditingContactId(ct.id);
    setContactForm({
      name: ct.name || '', phone: ct.phone || '',
      role: ct.role || '', email: ct.email || '',
    });
  };

  const cancelEditContact = () => {
    setEditingContactId(null);
    setContactForm({ name: '', phone: '', role: '', email: '' });
  };

  const handleSaveContact = async () => {
    if (!custForm.id || !contactForm.name.trim()) return;
    setIsAddingContact(true);
    const tahrir = !!editingContactId;
    try {
      const data = {
        name: contactForm.name,
        phone: contactForm.phone || undefined,
        role: contactForm.role || undefined,
        email: contactForm.email || undefined,
      };
      if (tahrir) {
        await customersApi.updateContact(custForm.id, editingContactId!, data);
      } else {
        await customersApi.createContact(custForm.id, data);
      }
      setContactForm({ name: '', phone: '', role: '', email: '' });
      setEditingContactId(null);
      const res = await customersApi.getContacts(custForm.id);
      setContacts(res.data || []);
      fetchData(true);
      showStatus('success', tahrir ? "Vakil yangilandi!" : "Vakil qo'shildi!");
    } catch (e: any) {
      showStatus('error', e?.response?.data?.message || (tahrir ? "Saqlashda xato!" : "Vakil qo'shishda xato!"));
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!custForm.id) return;
    try {
      await customersApi.deleteContact(custForm.id, contactId);
      const res = await customersApi.getContacts(custForm.id);
      setContacts(res.data || []);
      showStatus('success', "Kontakt o'chirildi.");
    } catch {
      showStatus('error', "O'chirishda xato!");
    }
  };

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

  const toggleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && !detailsCache[next]) {
      setDetailsCache(prev => ({ ...prev, [next]: 'loading' }));
      customersApi.getDetails(next)
        .then(res => setDetailsCache(prev => ({ ...prev, [next]: res.data })))
        .catch(() => {
          setDetailsCache(prev => {
            const copy = { ...prev };
            delete copy[next];
            return copy;
          });
          toast.error("Mijoz tafsilotlarini yuklashda xatolik!");
        });
    }
  };

  // Stats
  const totalDebtors = customers.filter(hasDebt).length;
  const totalDebtAmount = customers.reduce((s, c) => {
    const b = debtOf(c);
    return b >= MIN_DEBT ? s + b : s;
  }, 0);
  const totalSettled = customers.filter(c => !hasDebt(c)).length;

  if (isLoading) return <SkeletonTable rows={8} cols={6} />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12">
      {statusMsg && (
        <Toast type={statusMsg.type}>{statusMsg.text}</Toast>
      )}

      {/* Tabs Switcher */}
      <Tabs<ViewType>
        tabs={[
          { id: 'all', label: 'Jadval', icon: Table, count: customers.length },
          { id: 'map', label: 'Xarita', icon: MapIcon },
        ]}
        activeTab={activeView}
        onChange={setActiveView}
      />

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-card border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <p className="t-body-md flex items-center gap-2">
            <Users size={18} className="text-[color:var(--primary)]" /> Barcha hamkorlar va ularning moliyaviy holati
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto flex-wrap">
          {activeView === 'all' && (
            <>
              <div className="relative flex-1 sm:w-64 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                <input
                  type="text"
                  placeholder="Qidirish (ism, tel)..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="input-minimal pl-9"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="select-minimal w-auto cursor-pointer"
                title="Saralash"
              >
                <option value="recent">Oxirgi faollik</option>
                <option value="debt">Eng ko'p qarz</option>
                <option value="paid">Eng ko'p to'lagan</option>
                <option value="name">Nomi (A-Z)</option>
              </select>
            </>
          )}
          {(isAdmin || p.canExportCustomers) && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn-outline h-control"
              title="Mijozlar va ularga ko'rsatilgan xizmatlarni Excel'ga eksport qilish"
            >
              <Download size={16}/> {isExporting ? 'Tayyorlanmoqda...' : 'Eksport'}
            </button>
          )}
          {canAdd && (
            <button
              data-tour-id="mijoz-add"
              onClick={openAdd}
              className="btn-primary h-control w-full sm:w-auto"
            >
              <Plus size={16}/> Mijoz qo'shish
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard label="Jami mijozlar" value={customers.length} icon={Users} tone="neutral" />
        <StatCard label="Qarzdorlar" value={totalDebtors} icon={AlertCircle} tone={totalDebtors > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Umumiy qarzlar" value={formatCurrency(totalDebtAmount)} icon={TrendingDown} tone={totalDebtAmount > 0 ? 'danger' : 'neutral'} />
        <StatCard label="Hisobi yopilgan" value={totalSettled} icon={CheckCircle2} tone="success" />
      </div>

      {/* XARITA */}
      {activeView === 'map' && (() => {
        const nuqtalar = (customers as any[])
          .filter((c) => typeof c.latitude === 'number' && typeof c.longitude === 'number')
          .map((c) => ({
            id: c.id,
            nom: c.name,
            telefon: c.phone,
            manzil: c.address,
            lat: c.latitude,
            lng: c.longitude,
            qarz: debtOf(c),
          }));
        const belgilanmagan = customers.length - nuqtalar.length;

        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="t-caption font-semibold text-slate-600">
                Xaritada {nuqtalar.length} ta mijoz
              </p>
              {belgilanmagan > 0 && (
                <p className="text-xs font-medium text-amber-700">
                  {belgilanmagan} ta mijozning joyi belgilanmagan — kartasini tahrirlab xaritadan belgilang
                </p>
              )}
            </div>
            {nuqtalar.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Hali birorta mijozning joyi belgilanmagan"
                description="Mijozni tahrirlash oynasida manzilni yozing va xaritadan uning joyini bosing."
              />
            ) : (
              <MijozXarita
                nuqtalar={nuqtalar}
                onTanlash={(id) => {
                  setActiveView('all');
                  if (expandedId !== id) toggleExpand(id);
                }}
              />
            )}
          </div>
        );
      })()}

      {/* ALL CUSTOMERS TABLE */}
      {activeView === 'all' && (
        <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-minimal">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Mijoz</th>
                  <th className="hidden md:table-cell">Telefon</th>
                  <th className="hidden md:table-cell">Umumiy</th>
                  <th className="hidden md:table-cell">To'langan</th>
                  <th>Holat</th>
                  <th className="text-right pr-6">Amal</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center">
                    {searchTerm ? (
                      <p className="text-sm font-medium text-slate-500">"{searchTerm}" — mijoz topilmadi</p>
                    ) : (
                      <EmptyState
                        icon={UserPlus}
                        title="Hali mijoz qo'shilmagan"
                        description="Mijozlaringizni qo'shing — qarzlar, to'lovlar va buyurtmalar avtomatik kuzatiladi."
                        action={canAdd ? { label: "Birinchi mijozni qo'shish", onClick: openAdd } : undefined}
                      />
                    )}
                  </td></tr>
                ) : (
                  filteredCustomers.map(c => {
                    const balance = debtOf(c);
                    const isExpanded = expandedId === c.id;
                    const details = detailsCache[c.id];
                    const isLoadingDetails = details === 'loading';
                    const transactions = (details && details !== 'loading') ? details.transactions : [];
                    const tasks = (details && details !== 'loading') ? details.tasks : [];
                    const contactCount = (c.contacts || []).length;
                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${isExpanded ? 'bg-slate-50/80 border-b border-primary-100' : ''}`}
                          onClick={() => toggleExpand(c.id)}
                        >
                          <td>
                            <button className="icon-btn-sm text-slate-400 group-hover:text-[color:var(--primary)]">
                              {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                            </button>
                          </td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                                {contactCount > 0 && (
                                  <p className="t-caption truncate">
                                    {(c.contacts || []).slice(0, 2).map((k: any) => k.name).join(', ')}
                                    {contactCount > 2 ? ` +${contactCount - 2}` : ''}
                                  </p>
                                )}
                                {c.companyInfo && (
                                  <p className="t-caption flex items-center gap-1">
                                    <Building2 size={12}/> {c.companyInfo}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="hidden md:table-cell">
                            <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5 tabular-nums">
                              <Phone size={12} className="text-slate-400"/> {c.phone || '—'}
                            </p>
                          </td>
                          <td className="hidden md:table-cell font-medium text-xs text-slate-700 tabular-nums whitespace-nowrap">{formatCurrency(c.totalDebt)}</td>
                          <td className="hidden md:table-cell font-semibold text-xs text-emerald-700 tabular-nums whitespace-nowrap">{formatCurrency(c.totalPaid)}</td>
                          <td>
                            <Badge variant={balance >= MIN_DEBT ? 'danger' : 'success'}>
                              {balance >= MIN_DEBT ? formatCurrency(balance) : 'YOPILGAN'}
                            </Badge>
                          </td>
                          <td className="text-right pr-6" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openOrderHistory(c)} className="icon-btn-sm" title="Buyurtmalar tarixi">
                                <ClipboardList size={16}/>
                              </button>
                              {(canEdit || canDelete) && (
                                <>
                                  {/* Alohida "Vakillar" ikonkasi olib tashlandi:
                                      u qalamcha bilan bir xil oynani ochardi,
                                      faqat 2-bosqichdan. Ikkita ikonka bir ishni
                                      qilishi chalkashtirardi — endi qalamcha
                                      bosiladi, ichida "2. Vakillar" bosqichi bor. */}
                                  {canEdit && (
                                    <button onClick={e => openEdit(c, e)} className="icon-btn-sm" title="Tahrirlash va vakillar">
                                      <Edit3 size={16}/>
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => setConfirmModal({ isOpen: true, id: c.id, name: c.name })} className="icon-btn-sm hover:text-rose-600">
                                      <Trash2 size={16}/>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="space-y-4">
                                {isLoadingDetails ? (
                                  <div className="flex justify-center py-6"><LoadingSpinner /></div>
                                ) : (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Buyurtmalar */}
                                    <div className="bg-white rounded-card border border-slate-200 p-4">
                                      <h5 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                        <FileText size={16}/> Oxirgi buyurtmalar
                                      </h5>
                                      {tasks.length === 0 ? (
                                        <p className="t-caption py-4 text-center">Hech qanday buyurtma topilmadi</p>
                                      ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                                          {tasks.map((t: any) => (
                                            <div key={t.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-control border border-slate-100">
                                              <div>
                                                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                                  {t.title}
                                                  {t.isArchived && (
                                                    <span className="badge-neutral">Arxiv</span>
                                                  )}
                                                </p>
                                                {t.service && (
                                                  <p className="text-xs text-primary-700 font-medium mt-0.5">
                                                    {t.service.name}
                                                  </p>
                                                )}
                                                <p className="t-caption mt-0.5">{formatDate(t.createdAt)}</p>
                                              </div>
                                              <p className="text-xs font-semibold text-slate-800 tabular-nums">{formatCurrency(t.totalAmount)}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* To'lovlar */}
                                    <div className="bg-white rounded-card border border-slate-200 p-4">
                                      <h5 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                                        <TrendingUp size={16}/> To'lovlar tarixi
                                      </h5>
                                      {transactions.length === 0 ? (
                                        <p className="t-caption py-4 text-center">Hech qanday tranzaksiya topilmadi</p>
                                      ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
                                          {transactions.map((tr: any) => (
                                            <div key={tr.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-control border border-slate-100">
                                              <div className="flex items-center gap-2.5">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${tr.type === 'kirim' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                  {tr.type === 'kirim' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                                </div>
                                                <div>
                                                  <p className="text-xs font-semibold text-slate-800">{tr.serviceType || tr.expenseReason || tr.type}</p>
                                                  <p className="t-caption">{formatDate(tr.date)} • {tr.paymentType?.name || 'Naqd'}</p>
                                                </div>
                                              </div>
                                              <span className={`text-xs font-semibold tabular-nums ${tr.type === 'kirim' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {tr.type === 'kirim' ? '+' : '-'}{formatCurrency(tr.amount)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
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

      {/* MODAL: MIJOZ FORM */}
      <Modal
        isOpen={isFormOpen}
        onClose={closeCustomerModal}
        title={formStep === 1
          ? (isEditing ? 'Mijozni tahrirlash' : "Yangi mijoz qo'shish")
          : `Vakillar — ${custForm.name}`}
        maxWidth="max-w-xl"
      >
        {/* Bosqich ko'rsatkichi */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-card mb-4">
          <button
            type="button"
            onClick={() => setFormStep(1)}
            className={`flex-1 py-1.5 rounded-control text-xs font-medium transition-colors ${formStep === 1 ? 'bg-white shadow-sm font-semibold text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            1. Ma'lumot
          </button>
          <button
            type="button"
            onClick={openVakillar}
            disabled={!custForm.id}
            title={custForm.id ? undefined : "Avval mijozni saqlang"}
            className={`flex-1 py-1.5 rounded-control text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${formStep === 2 ? 'bg-white shadow-sm font-semibold text-[color:var(--primary)]' : 'text-slate-500 hover:text-slate-700'}`}
          >
            2. Vakillar{contacts.length > 0 ? ` (${contacts.length})` : ''}
          </button>
        </div>

        {formStep === 1 ? (
          <form onSubmit={handleSubmitCustomer} className="space-y-3.5">
            <div>
              <label className="form-label">
                <Building2 size={12} className="inline mr-1 text-slate-400"/> Tashkilot nomi *
              </label>
              <input
                type="text" required autoFocus
                value={custForm.name}
                onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))}
                className="input-minimal font-medium text-slate-800"
                placeholder="Masalan: Boburshox klinikasi"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Telefon</label>
                <PhoneInput
                  value={custForm.phone}
                  onChange={phone => setCustForm(f => ({ ...f, phone }))}
                />
              </div>
              <div>
                <label className="form-label">Qo'shimcha info</label>
                <input
                  type="text"
                  value={custForm.companyInfo}
                  onChange={e => setCustForm(f => ({ ...f, companyInfo: e.target.value }))}
                  className="input-minimal"
                  placeholder="INN, izoh..."
                />
              </div>
            </div>

            <div>
              <label className="form-label">
                <MapPin size={12} className="inline mr-1 text-slate-400"/> Manzil
              </label>
              <input
                type="text"
                value={custForm.address}
                onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))}
                className="input-minimal"
                placeholder="Masalan: Namangan, Uychi ko'chasi 12"
              />
            </div>

            <JoyTanlagich
              qiymat={custForm.joy}
              manzil={custForm.address}
              onChange={(joy) => setCustForm(f => ({ ...f, joy }))}
              balandlik={180}
            />

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button type="button" className="btn-outline flex-1" onClick={closeCustomerModal}>
                Bekor qilish
              </button>
              <button type="submit" className="btn-primary flex-[2]">
                Saqlash va vakillar →
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3.5">
            {canManageContacts && editingContactId && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-control">
                <p className="text-xs font-semibold text-primary-800">Vakil tahrirlanmoqda</p>
                <button
                  type="button"
                  onClick={cancelEditContact}
                  className="text-xs font-medium text-primary-700 hover:text-primary-900"
                >
                  Bekor qilish
                </button>
              </div>
            )}
            {canManageContacts && (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Ism *"
                    value={contactForm.name}
                    onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                    className="input-minimal font-medium"
                  />
                  <PhoneInput
                    value={contactForm.phone}
                    onChange={phone => setContactForm(f => ({ ...f, phone }))}
                  />
                  <input
                    type="text"
                    placeholder="Lavozim (Direktor)"
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
                  onClick={handleSaveContact}
                  disabled={isAddingContact || !contactForm.name.trim()}
                  className={editingContactId ? 'btn-primary w-full' : 'btn-outline w-full'}
                >
                  {editingContactId
                    ? <><CheckCircle2 size={16}/> {isAddingContact ? 'Saqlanmoqda...' : "O'zgarishni saqlash"}</>
                    : <><UserPlus size={16}/> {isAddingContact ? "Qo'shilmoqda..." : "Vakil qo'shish"}</>}
                </button>
              </>
            )}

            <div className="border-t border-slate-100 pt-3">
              {isContactsLoading ? (
                <div className="py-8 flex justify-center"><LoadingSpinner /></div>
              ) : contacts.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-500">
                  <UserPlus size={24} className="mb-1.5 opacity-40"/>
                  <p className="text-xs font-semibold">Vakillar yo'q</p>
                  <p className="t-caption mt-0.5">Bu tashkilot bilan kim gaplashadi?</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scroll pr-1">
                  {contacts.map((ct: any) => (
                    <div key={ct.id} className="flex items-center justify-between bg-white p-2.5 rounded-control border border-slate-200 group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {ct.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{ct.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {ct.role && (
                              <span className="t-caption flex items-center gap-1"><Briefcase size={12}/> {ct.role}</span>
                            )}
                            {ct.phone && (
                              <span className="t-caption font-medium text-slate-600 flex items-center gap-1"><Phone size={12}/> {ct.phone}</span>
                            )}
                            {ct.email && (
                              <span className="t-caption flex items-center gap-1 truncate"><Mail size={12}/> {ct.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${canManageContacts ? '' : 'hidden'}`}>
                        <button
                          onClick={() => startEditContact(ct)}
                          className="icon-btn-sm"
                          title="Vakilni tahrirlash"
                        >
                          <Edit3 size={16}/>
                        </button>
                        <button
                          onClick={() => handleDeleteContact(ct.id)}
                          className="icon-btn-sm hover:text-rose-600"
                          title="Vakilni o'chirish"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button type="button" className="btn-outline flex-1" onClick={() => setFormStep(1)}>
                ← Orqaga
              </button>
              <button type="button" className="btn-primary flex-[2]" onClick={closeCustomerModal}>
                Tayyor
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ORDER HISTORY */}
      <Modal
        isOpen={orderHistoryModal.isOpen}
        onClose={() => setOrderHistoryModal({ isOpen: false, customer: null, orders: [] })}
        title={`Buyurtmalar tarixi — ${orderHistoryModal.customer?.name || ''}`}
        maxWidth="max-w-2xl"
      >
        {orderHistoryLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : orderHistoryModal.orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-medium text-xs">Hech qanday buyurtma topilmadi</div>
        ) : (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scroll">
            {orderHistoryModal.orders.map((order: any) => (
              <div key={order.id} className="bg-slate-50 rounded-control border border-slate-200 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{order.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {order.service && (
                        <span className="badge-primary">{order.service.name}</span>
                      )}
                      {order.column && (
                        <span className="badge-neutral">{order.column.title}</span>
                      )}
                      <span className="badge-neutral">{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(order.totalAmount || 0)}</p>
                    {order.depositAmount > 0 && (
                      <p className="text-xs font-semibold text-emerald-700 tabular-nums">Zakolat: {formatCurrency(order.depositAmount)}</p>
                    )}
                    {order.remainingAmount > 0 && (
                      <p className="text-xs font-semibold text-rose-700 tabular-nums">Qoldiq: {formatCurrency(order.remainingAmount)}</p>
                    )}
                  </div>
                </div>
                {order.note && (
                  <p className="t-caption mt-2 border-t border-slate-200 pt-1.5">{order.note}</p>
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
        <div className="space-y-4">
          <div className="bg-rose-50 p-4 rounded-card border border-rose-200 flex items-start gap-3">
            <AlertCircle className="text-rose-600 mt-0.5 shrink-0" size={20}/>
            <div>
              <p className="text-sm font-semibold text-rose-900">Diqqat!</p>
              <p className="text-xs text-rose-700 mt-1">
                Siz <strong>{confirmModal.name}</strong> mijozini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
              Bekor qilish
            </button>
            <button type="button" className="btn-danger-solid flex-1" onClick={handleDelete}>
              Ha, o'chirilsin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Mijozlar;
