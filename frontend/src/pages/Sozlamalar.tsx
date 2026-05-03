import React, { useState, useEffect } from 'react';
import { Shield, CreditCard, Plus, Trash2, Check, X, Save, Edit3, ChevronDown, ChevronUp, AlertCircle, LayoutGrid, ReceiptText, Tag, Layers, Package, Bell, Upload } from 'lucide-react';
import { rolesApi, paymentTypesApi, expenseTypesApi, tasksApi, servicesApi, inventoryApi, settingsApi, employeesApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import NumberInput from '../components/NumberInput';

const Sozlamalar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};

  const [roles, setRoles] = useState<any[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<{ hisobotReceivers: string[]; newOrderReceivers: string[]; reminderReceivers: string[] }>({ hisobotReceivers: [], newOrderReceivers: [], reminderReceivers: [] });
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);
  const [clientLogos, setClientLogos] = useState<string[]>([]);
  const [savingLogos, setSavingLogos] = useState(false);
  const [minPrepaymentPct, setMinPrepaymentPct] = useState(70);
  const [savingPrepayment, setSavingPrepayment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [roleRes, ptRes, etRes, kcRes, svcRes, empRes] = await Promise.all([
        rolesApi.findAll(),
        paymentTypesApi.findAll(),
        expenseTypesApi.findAll(),
        tasksApi.getColumns(),
        servicesApi.findAll(),
        employeesApi.findAll(),
      ]);
      setRoles(roleRes.data || []);
      setPaymentTypes(ptRes.data || []);
      setExpenseTypes(etRes.data || []);
      setKanbanColumns(kcRes.data || []);
      setServices(svcRes.data || []);
      setEmployees(empRes.data || []);

      // Load notification preferences
      try {
        const notifRes = await settingsApi.get('TELEGRAM_BOT_PREFS');
        if (notifRes.data && typeof notifRes.data === 'object') {
          setNotifPrefs({
            hisobotReceivers: notifRes.data.hisobotReceivers || [],
            newOrderReceivers: notifRes.data.newOrderReceivers || [],
            reminderReceivers: notifRes.data.reminderReceivers || [],
          });
        }
      } catch { /* default prefs already set */ }

      try {
        const logosRes = await settingsApi.get('CLIENT_LOGOS');
        if (Array.isArray(logosRes.data)) setClientLogos(logosRes.data);
      } catch { /* default empty */ }

      try {
        const pctRes = await settingsApi.get('MIN_PREPAYMENT_PERCENTAGE');
        if (pctRes.data?.value) setMinPrepaymentPct(Number(pctRes.data.value));
      } catch { /* default 70 */ }
    } catch (err) {
      console.error("Sozlamalarni yuklashda xato:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePrepaymentPct = async () => {
    setSavingPrepayment(true);
    try {
      await settingsApi.set('MIN_PREPAYMENT_PERCENTAGE', { value: minPrepaymentPct });
      showStatus('success', 'Minimal zakolat foizi saqlandi!');
    } catch {
      showStatus('error', 'Saqlashda xatolik!');
    } finally {
      setSavingPrepayment(false);
    }
  };

  const saveNotifPrefs = async (next: typeof notifPrefs) => {
    setNotifPrefs(next);
    setSavingNotifPrefs(true);
    try {
      await settingsApi.set('TELEGRAM_BOT_PREFS', next);
      showStatus('success', 'Xabarnoma sozlamalari saqlandi');
    } catch {
      showStatus('error', 'Xabarnoma sozlamalarini saqlashda xato');
    } finally {
      setSavingNotifPrefs(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showStatus('error', "Fayl 500KB dan kichik bo'lishi kerak"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const newLogos = [...clientLogos, base64];
      setClientLogos(newLogos);
      setSavingLogos(true);
      try {
        await settingsApi.set('CLIENT_LOGOS', newLogos);
        showStatus('success', 'Logo saqlandi');
      } catch {
        showStatus('error', 'Saqlashda xato');
        setClientLogos(clientLogos);
      } finally { setSavingLogos(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoDelete = async (index: number) => {
    const prev = [...clientLogos];
    const newLogos = clientLogos.filter((_, i) => i !== index);
    setClientLogos(newLogos);
    setSavingLogos(true);
    try {
      await settingsApi.set('CLIENT_LOGOS', newLogos);
      showStatus('success', "Logo o'chirildi");
    } catch {
      showStatus('error', 'Saqlashda xato');
      setClientLogos(prev);
    } finally { setSavingLogos(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Role Form
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const initialRoleForm = {
    name: '',
    canViewFinance: false, canAddIncome: false, canAddExpense: false, canViewTotalBalance: false, canManagePaymentTypes: false,
    canViewTasks: false, canCreateTask: false, canEditTask: false, canDeleteTask: false, canMoveTask: false, canManageColumns: false,
    canViewCustomers: false, canManageCustomers: false,
    canViewEmployees: false, canManageEmployees: false, canManageRoles: false, canViewSalary: false, canManageAdmins: false,
    canManageBranches: false, canViewKpi: false, canViewExpenseCharts: false, canViewSettings: false, canAssignToOtherBranches: false,
    canManageBilling: false, canManageNotifications: false,
    canViewVendors: false, canViewInventory: false, canManageInventory: false, canViewAttendance: false, canManageAttendance: false,
    canViewServices: false, canManageServices: false,
  };
  const [newRole, setNewRole] = useState(initialRoleForm);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rolesApi.create(newRole);
      setIsRoleModalOpen(false);
      setNewRole(initialRoleForm);
      fetchData();
    } catch (err) {
      showStatus('error', "Lavozim yaratishda xato!");
    }
  };

  // Edit Role Inline
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleData, setEditRoleData] = useState<any>(null);

  const startEditRole = (role: any) => {
    setEditingRoleId(role.id);
    setEditRoleData({ ...role });
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditRoleData(null);
  };

  const saveEditRole = async () => {
    if (!editRoleData || !editingRoleId) return;
    try {
      const { id, employees, ...data } = editRoleData;
      await rolesApi.update(editingRoleId, data);
      setEditingRoleId(null);
      setEditRoleData(null);
      fetchData();
    } catch (err) {
      showStatus('error', "O'zgarishlarni saqlashda xato!");
    }
  };

  const handleDeleteRole = (id: string) => {
    const role = roles.find(r => r.id === id);
    setConfirmModal({
      isOpen: true,
      title: "Lavozimni o'chirish",
      message: `"${role?.name}" lavozimini o'chirmoqchimisiz? Unga biriktirilgan xodimlar bilan muammo chiqishi mumkin!`,
      onConfirm: async () => {
        try {
          await rolesApi.delete(id);
          fetchData();
          showStatus('success', "Lavozim o'chirildi.");
        } catch (err) {
          showStatus('error', "O'chirishda xato! Avval shu lavozim xodimlarini boshqa lavozimga o'tkazing.");
        }
        setConfirmModal(null);
      }
    });
  };

  const [newPT, setNewPT] = useState('');
  const [editingPTId, setEditingPTId] = useState<string | null>(null);
  const [editPTName, setEditPTName] = useState('');

  const handleAddPT = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPT) return;
    try {
      await paymentTypesApi.create({ name: newPT });
      setNewPT('');
      fetchData();
    } catch (err) {
      showStatus('error', "To'lov turini qo'shishda xato!");
    }
  };

  const handleUpdatePT = async (id: string) => {
    if (!editPTName) return;
    try {
      await paymentTypesApi.update(id, { name: editPTName });
      setEditingPTId(null);
      fetchData();
    } catch (err) {
      showStatus('error', "Tahrirlashda xato!");
    }
  };

  // Expense Type Logic
  const [newET, setNewET] = useState('');
  const [editingETId, setEditingETId] = useState<string | null>(null);
  const [editETName, setEditETName] = useState('');

  const handleAddET = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newET) return;
    try {
      await expenseTypesApi.create({ name: newET });
      setNewET('');
      fetchData();
    } catch (err) {
      showStatus('error', "Xarajat turini qo'shishda xato!");
    }
  };

  const handleUpdateET = async (id: string) => {
    if (!editETName) return;
    try {
      await expenseTypesApi.update(id, { name: editETName });
      setEditingETId(null);
      fetchData();
    } catch (err) {
      showStatus('error', "Tahrirlashda xato!");
    }
  };

  // Kanban Column Logic
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');

  const handleUpdateColumn = async (id: string) => {
    if (!editColTitle) return;
    try {
      await tasksApi.updateColumn(id, { title: editColTitle });
      setEditingColId(null);
      fetchData();
    } catch (err) {
      showStatus('error', "Bosqichni tahrirlashda xato!");
    }
  };

  // Permissions grouped by page — each group = one sidebar page
  const permissionGroups = [
    {
      title: 'Kassa (Tranzaksiyalar) Sahifasi',
      color: 'emerald',
      permissions: {
        canViewFinance: "Kassa va moliyani ko'rish",
        canAddIncome: "Kirim qo'shish",
        canAddExpense: "Chiqim qo'shish",
        canViewTotalBalance: "Umumiy kassa balansini ko'rish",
        canManagePaymentTypes: "To'lov turlarini boshqarish",
      }
    },
    {
      title: 'Statistika & Hisobotlar Sahifasi',
      color: 'sky',
      permissions: {
        canViewKpi: "Xodim samaradorligi (KPI) ni ko'rish",
        canViewExpenseCharts: "Chiqim tahlil grafiklarini ko'rish",
      }
    },
    {
      title: 'Xizmatlar (Kanban) Sahifasi',
      color: 'orange',
      permissions: {
        canViewTasks: "Buyurtmalar va topshiriqlarni ko'rish",
        canCreateTask: "Yangi buyurtma yaratish",
        canEditTask: "Buyurtmani tahrirlash",
        canDeleteTask: "Buyurtmani o'chirish",
        canMoveTask: "Bosqichdan bosqichga o'tkazish",
        canManageColumns: "Kanban bosqichlarini boshqarish",
        canAssignToOtherBranches: "Boshqa filial xodimlariga buyurtma berish",
      }
    },
    {
      title: 'Mijozlar Bazasi Sahifasi',
      color: 'violet',
      permissions: {
        canViewCustomers: "Mijozlar ro'yxatini ko'rish",
        canManageCustomers: "Mijozlarni qo'shish va tahrirlash",
      }
    },
    {
      title: 'Xodimlar Sahifasi',
      color: 'indigo',
      permissions: {
        canViewEmployees: "Xodimlar ro'yxatini ko'rish",
        canManageEmployees: "Xodimlarni qo'shish va tahrirlash",
        canViewSalary: "Xodim maoshlarini ko'rish",
      }
    },
    {
      title: "Ma'muriyat (Adminlar) Sahifasi",
      color: 'rose',
      permissions: {
        canManageAdmins: "Adminlar va rahbarlarni boshqarish",
        canManageRoles: "Lavozimlar va ruxsatlarni boshqarish",
      }
    },
    {
      title: 'Ombor Sahifasi',
      color: 'amber',
      permissions: {
        canViewInventory: "Ombor va materiallarni ko'rish",
        canManageInventory: "Ombor zaxirasini boshqarish",
      }
    },
    {
      title: 'Davomat Sahifasi',
      color: 'teal',
      permissions: {
        canViewAttendance: "Davomat ma'lumotlarini ko'rish",
        canManageAttendance: "Davomat kirim/chiqimini boshqarish",
      }
    },
    {
      title: 'Hamkorlar va Filiallar Sahifasi',
      color: 'cyan',
      permissions: {
        canViewVendors: "Hamkorlar va subpudratchilarni ko'rish",
        canManageBranches: "Filiallarni qo'shish va tahrirlash",
      }
    },
    {
      title: 'Xizmatlar Katalogi',
      color: 'slate',
      permissions: {
        canViewServices: "Xizmatlar katalogini ko'rish",
        canManageServices: "Katalogni qo'shish va tahrirlash",
      }
    },
    {
      title: 'Tizim Sozlamalari & Obuna Sahifasi',
      color: 'gray',
      permissions: {
        canViewSettings: "Tizim sozlamalariga kirish",
        canManageNotifications: "Telegram bot bildirishnomalarini sozlash",
        canManageBilling: "Obuna va to'lovlarni boshqarish",
      }
    },
  ];

  const allPermissionKeys = permissionGroups.flatMap(g => Object.keys(g.permissions));
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-10 pb-20 animate-fade-in">
      {/* Status notification */}
      {statusMessage && (
        <div className={`fixed top-4 right-4 z-[200] p-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="font-bold text-xs tracking-tight">{statusMessage.text}</span>
        </div>
      )}
      
      {/* Roles Section */}
      {(isAdmin || p.canManageRoles) && (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                 <Shield className="text-orange-600" size={24} /> Lavozimlar & Ruxsatlar
              </h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Sahifalar va funksiyalarga dostupni sozlash</p>
            </div>
            <button className="bg-orange-600 hover:bg-orange-700 text-white h-10 px-8 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-2" onClick={() => setIsRoleModalOpen(true)}>
              <Plus size={16} strokeWidth={3} /> Yangi Lavozim
            </button>
          </div>

          <div className="space-y-4">
            {roles.map(role => {
              const isEditing = editingRoleId === role.id;
              const isExpanded = expandedRoleId === role.id;
              const dataSource = isEditing ? editRoleData : role;

              return (
                <div key={role.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 ${isEditing ? 'border-orange-400 ring-4 ring-orange-50' : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'}`}>
                  
                  {/* Role header */}
                  <div className={`flex items-center justify-between p-5 cursor-pointer ${isExpanded ? 'bg-slate-50/50' : ''}`} onClick={() => !isEditing && setExpandedRoleId(isExpanded ? null : role.id)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center font-black text-base border border-orange-200 shadow-inner">
                        {role.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-base text-slate-800 uppercase tracking-tight">{role.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${allPermissionKeys.filter(k => role[k]).length > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                            {allPermissionKeys.filter(k => role[k]).length} Ruxsat
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase">Aktiv</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEditRole} className="h-9 px-5 bg-emerald-500 text-white text-[10px] font-black rounded-lg flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-95">
                            <Save size={14} /> SAQLASH
                          </button>
                          <button onClick={cancelEditRole} className="h-9 px-5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg hover:bg-slate-200 transition-all">
                            BEKOR
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditRole(role)} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-orange-500 hover:text-white hover:shadow-md transition-all active:scale-90">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDeleteRole(role.id)} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white hover:shadow-md transition-all active:scale-90">
                            <Trash2 size={14} />
                          </button>
                          <button onClick={() => setExpandedRoleId(isExpanded ? null : role.id)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-orange-600 text-white shadow-md shadow-orange-500/30' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                            {isExpanded ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Permissions grid (expanded or editing) */}
                  {(isExpanded || isEditing) && (
                    <div className="px-8 pb-8 border-t border-slate-100 pt-8 animate-slide-up">
                      <div className="space-y-10">
                        {permissionGroups.map(group => (
                          <div key={group.title}>
                            <h5 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-${group.color}-600 flex items-center gap-2.5`}>
                              <div className={`w-3 h-3 rounded-md bg-${group.color}-500 shadow-sm shadow-${group.color}-500/20`}></div>
                              {group.title}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {Object.entries(group.permissions).map(([key, label]) => (
                                <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                                  isEditing 
                                    ? 'bg-white cursor-pointer hover:border-orange-400 hover:shadow-md border-slate-200' 
                                    : 'bg-slate-50 border-slate-50 opacity-80'
                                }`}
                                onClick={() => {
                                  if (isEditing) {
                                    setEditRoleData({ ...editRoleData, [key]: !editRoleData[key] });
                                  }
                                }}>
                                   <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{label}</span>
                                   {isEditing ? (
                                     <div className={`w-10 h-6 rounded-full relative transition-all cursor-pointer ${editRoleData[key] ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${editRoleData[key] ? 'left-5' : 'left-1'}`}></div>
                                     </div>
                                   ) : (
                                     dataSource[key] ? (
                                       <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center"><Check size={14} strokeWidth={4}/></div>
                                     ) : (
                                       <div className="w-6 h-6 bg-slate-200/50 text-slate-300 rounded-lg flex items-center justify-center"><X size={12} strokeWidth={4}/></div>
                                     )
                                   )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {isEditing && (
                        <div className="mt-10 p-5 bg-orange-50 rounded-2xl border border-orange-100 flex items-start gap-4">
                           <AlertCircle className="text-orange-500 mt-1" size={20} />
                           <div className="space-y-1">
                              <p className="text-xs font-black text-orange-900 uppercase">Ruxsatlarni tahrirlash</p>
                              <p className="text-[11px] font-bold text-orange-700">Tugmalarni bosish orqali ruxsatlarni yoqishingiz yoki o'chirishingiz mumkin. Saqlash tugmasini bosishni unutmang.</p>
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}



      {/* Payment Types Section */}
      {(isAdmin || p.canManagePaymentTypes) && (
        <section className="space-y-4">
           <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm transition-all hover:shadow-md">
              <form onSubmit={handleAddPT} className="flex flex-col md:flex-row gap-3 mb-6 pb-6 border-b border-slate-100">
                 <div className="flex-1 relative">
                    <input 
                       type="text" 
                       required 
                       value={newPT} 
                       onChange={(e) => setNewPT(e.target.value)} 
                       className="w-full h-12 text-base font-black bg-slate-50 border-2 border-slate-50 rounded-xl px-5 outline-none focus:bg-white focus:border-sky-500 transition-all placeholder:text-slate-300 shadow-inner" 
                       placeholder="Yangi usul nomi (Click, Uzcard...)"
                    />
                 </div>
                 <button type="submit" className="h-12 px-10 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs uppercase tracking-[0.1em] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 active:scale-95">
                    <Plus size={18} strokeWidth={3}/> QO'SHISH
                 </button>
              </form>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {paymentTypes.map(pt => {
                   const isEditingPT = editingPTId === pt.id;
                   return (
                      <div key={pt.id} className={`group p-5 rounded-2xl border-2 transition-all duration-300 ${isEditingPT ? 'bg-white border-sky-500 shadow-lg' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-sky-200 hover:shadow-md'}`}>
                         {isEditingPT ? (
                           <div className="flex flex-col gap-3">
                              <input 
                                type="text" 
                                autoFocus
                                value={editPTName}
                                onChange={(e) => setEditPTName(e.target.value)}
                                className="w-full h-10 text-xs font-black bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-sky-500"
                              />
                              <div className="flex gap-2">
                                 <button onClick={() => handleUpdatePT(pt.id)} className="flex-1 h-8 bg-sky-500 text-white text-[10px] font-black rounded-md hover:bg-sky-600 transition-colors">SAQLASH</button>
                                 <button onClick={() => setEditingPTId(null)} className="flex-1 h-8 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md hover:bg-slate-200">BEKOR</button>
                              </div>
                           </div>
                         ) : (
                           <div className="flex justify-between items-center">
                              <span className="text-sm font-black text-slate-800 uppercase tracking-tighter truncate pr-4">{pt.name}</span>
                              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => { setEditingPTId(pt.id); setEditPTName(pt.name); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-sky-500 hover:bg-sky-50 border border-slate-100 flex items-center justify-center transition-all">
                                    <Edit3 size={14}/>
                                 </button>
                                 <button onClick={() => { setConfirmModal({ isOpen: true, title: "O'chirish", message: "${pt.name} o'chirilsinmi?", onConfirm: () => { paymentTypesApi.delete(pt.id).then(fetchData); setConfirmModal(null); } }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center transition-all">
                                    <Trash2 size={14}/>
                                 </button>
                              </div>
                           </div>
                         )}
                      </div>
                   );
                 })}
                 {paymentTypes.length === 0 && (
                   <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[2rem]">
                      <CreditCard size={40} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-300 font-black uppercase tracking-widest text-xs">Hozircha to'lov turlari mavjud emas</p>
                   </div>
                 )}
              </div>
           </div>
        </section>
      )}

      {/* Expense Types Section */}
      {(isAdmin || p.canAddExpense) && (
        <section className="space-y-4">
           <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
             <div>
               <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <ReceiptText className="text-rose-500" size={24} /> Xarajat Turlari
               </h3>
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Chiqimlar uchun maxsus kategoriyalar</p>
             </div>
           </div>

           <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm transition-all hover:shadow-md">
              <form onSubmit={handleAddET} className="flex flex-col md:flex-row gap-3 mb-6 pb-6 border-b border-slate-100">
                 <div className="flex-1 relative">
                    <input 
                       type="text" 
                       required 
                       value={newET} 
                       onChange={(e) => setNewET(e.target.value)} 
                       className="w-full h-12 text-base font-black bg-slate-50 border-2 border-slate-50 rounded-xl px-5 outline-none focus:bg-white focus:border-rose-500 transition-all placeholder:text-slate-300 shadow-inner" 
                       placeholder="Xarajat turi nomi (Material, Kommunal...)"
                    />
                 </div>
                 <button type="submit" className="h-12 px-10 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-[0.1em] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all hover:-translate-y-0.5 active:scale-95">
                    <Plus size={18} strokeWidth={3}/> QO'SHISH
                 </button>
              </form>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {expenseTypes.map(et => {
                   const isEditingET = editingETId === et.id;
                   return (
                      <div key={et.id} className={`group p-5 rounded-2xl border-2 transition-all duration-300 ${isEditingET ? 'bg-white border-rose-500 shadow-lg' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-rose-200 hover:shadow-md'}`}>
                         {isEditingET ? (
                           <div className="flex flex-col gap-3">
                              <input 
                                type="text" 
                                autoFocus
                                value={editETName}
                                onChange={(e) => setEditETName(e.target.value)}
                                className="w-full h-10 text-xs font-black bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-rose-500"
                              />
                              <div className="flex gap-2">
                                 <button onClick={() => handleUpdateET(et.id)} className="flex-1 h-8 bg-rose-500 text-white text-[10px] font-black rounded-md hover:bg-rose-600 transition-colors">SAQLASH</button>
                                 <button onClick={() => setEditingETId(null)} className="flex-1 h-8 bg-slate-100 text-slate-500 text-[10px] font-black rounded-md hover:bg-slate-200">BEKOR</button>
                              </div>
                           </div>
                         ) : (
                           <div className="flex justify-between items-center">
                              <span className="text-sm font-black text-slate-800 uppercase tracking-tighter truncate pr-4">{et.name}</span>
                              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => { setEditingETId(et.id); setEditETName(et.name); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center transition-all">
                                    <Edit3 size={14}/>
                                 </button>
                                 <button onClick={() => { setConfirmModal({ isOpen: true, title: "O'chirish", message: "${et.name} o'chirilsinmi?", onConfirm: () => { expenseTypesApi.delete(et.id).then(fetchData); setConfirmModal(null); } }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center transition-all">
                                    <Trash2 size={14}/>
                                 </button>
                              </div>
                           </div>
                         )}
                      </div>
                   );
                 })}
              </div>
           </div>
        </section>
      )}

      {/* Kanban Columns Section (Editing Titles) */}
      {(isAdmin || p.canManageColumns) && (
        <section className="space-y-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div>
               <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <LayoutGrid className="text-sky-400" size={28} /> Kanban Bosqichlari
               </h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Sotuv varonkasi bosqichlarini tahrirlash</p>
             </div>
           </div>

           <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {kanbanColumns.map(col => {
                   const isEditingCol = editingColId === col.id;
                   return (
                      <div key={col.id} className={`group p-5 rounded-2xl border-2 transition-all duration-300 ${isEditingCol ? 'bg-white border-orange-400 shadow-lg scale-105' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-orange-100 hover:shadow-md'}`}>
                         {isEditingCol ? (
                           <div className="space-y-3">
                              <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Bosqich nomi</label>
                              <input 
                                type="text" 
                                autoFocus
                                value={editColTitle}
                                onChange={(e) => setEditColTitle(e.target.value)}
                                className="w-full h-10 text-xs font-black bg-white border-2 border-orange-100 rounded-xl px-4 outline-none focus:border-orange-500 uppercase"
                              />
                              <div className="flex gap-2">
                                 <button onClick={() => handleUpdateColumn(col.id)} className="flex-1 h-9 bg-orange-500 text-white text-[10px] font-black rounded-lg hover:bg-orange-600 transition-all uppercase tracking-widest">SAQLASH</button>
                                 <button onClick={() => setEditingColId(null)} className="flex-1 h-9 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg hover:bg-slate-200 uppercase tracking-widest">BEKOR</button>
                              </div>
                           </div>
                         ) : (
                           <div className="flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                 <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm border border-slate-100 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                    <LayoutGrid size={16}/>
                                 </div>
                                 <div className="flex gap-1">
                                    <button onClick={() => { setEditingColId(col.id); setEditColTitle(col.title); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-orange-500 hover:border-orange-200 border border-slate-100 flex items-center justify-center transition-all">
                                       <Edit3 size={12}/>
                                    </button>
                                    <button onClick={() => { setConfirmModal({ isOpen: true, title: "Bosqichni o'chirish", message: "${col.title} bosqichi o'chirilsinmi?", onConfirm: () => { tasksApi.deleteColumn(col.id).then(fetchData); setConfirmModal(null); } }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:border-rose-200 border border-slate-100 flex items-center justify-center transition-all">
                                       <Trash2 size={12}/>
                                    </button>
                                 </div>
                              </div>
                              <div>
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tartib: #{col.orderIdx + 1}</p>
                                 <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate">{col.title}</h4>
                              </div>
                           </div>
                         )}
                      </div>
                   );
                 })}
              </div>
           </div>
        </section>
      )}

      {/* General Settings Section */}
      {isAdmin && (
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <Save className="text-orange-500" size={28}/> Umumiy Sozlamalar
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Tizim darajasidagi qoidalar va chegaralar</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">
                  Minimal zakolat foizi (%)
                </label>
                <p className="text-[10px] font-bold text-amber-600 mb-3">
                  Yangi buyurtma qo'shishda zakolat shu foizdan kam bo'lsa ogohlantirish chiqadi
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min="0" max="100" step="5"
                    value={minPrepaymentPct}
                    onChange={e => setMinPrepaymentPct(Number(e.target.value))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-2xl font-black text-orange-600 w-14 text-right">{minPrepaymentPct}%</span>
                </div>
              </div>
              <button
                onClick={savePrepaymentPct}
                disabled={savingPrepayment}
                className="h-11 px-6 bg-orange-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {savingPrepayment ? 'SAQLANMOQDA...' : 'SAQLASH'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bot Notifications Section */}
      {(isAdmin || p.canManageNotifications) && (
        <section className="space-y-6">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <div>
               <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <Bell className="text-sky-500" size={28} /> Telegram Xabarnomalar
               </h3>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Bot orqali keladigan bildirishnomalar sozlamalari</p>
             </div>
           </div>
           
           <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Hisobotlar (Kunlik/Haftalik)</label>
                   <div className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold overflow-y-auto custom-scroll flex flex-col gap-1">
                     {employees.map(emp => (
                       <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
                         <input 
                           type="checkbox" 
                           className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300 cursor-pointer"
                           checked={notifPrefs.hisobotReceivers.includes(emp.id)}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setNotifPrefs(prev => ({...prev, hisobotReceivers: [...prev.hisobotReceivers, emp.id]}));
                             } else {
                               setNotifPrefs(prev => ({...prev, hisobotReceivers: prev.hisobotReceivers.filter(id => id !== emp.id)}));
                             }
                           }}
                         />
                         <span className="text-slate-700 text-xs font-black">{emp.fullName}</span>
                       </label>
                     ))}
                   </div>
                   <p className="text-[9px] text-slate-400 italic">Hisobot yuboriladigan xodimlar (Keraklilarini belgilang)</p>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Yangi Buyurtmalar</label>
                   <div className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold overflow-y-auto custom-scroll flex flex-col gap-1">
                     {employees.map(emp => (
                       <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
                         <input 
                           type="checkbox" 
                           className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300 cursor-pointer"
                           checked={notifPrefs.newOrderReceivers.includes(emp.id)}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setNotifPrefs(prev => ({...prev, newOrderReceivers: [...prev.newOrderReceivers, emp.id]}));
                             } else {
                               setNotifPrefs(prev => ({...prev, newOrderReceivers: prev.newOrderReceivers.filter(id => id !== emp.id)}));
                             }
                           }}
                         />
                         <span className="text-slate-700 text-xs font-black">{emp.fullName}</span>
                       </label>
                     ))}
                   </div>
                   <p className="text-[9px] text-slate-400 italic">Yangi buyurtma tushganda kimlarga xabar borishi kerak (Keraklilarini belgilang)</p>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Muddat Eslatmalari</label>
                   <div className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold overflow-y-auto custom-scroll flex flex-col gap-1">
                     {employees.map(emp => (
                       <label key={emp.id} className="flex items-center gap-3 p-2 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
                         <input 
                           type="checkbox" 
                           className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-300 cursor-pointer"
                           checked={notifPrefs.reminderReceivers.includes(emp.id)}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setNotifPrefs(prev => ({...prev, reminderReceivers: [...prev.reminderReceivers, emp.id]}));
                             } else {
                               setNotifPrefs(prev => ({...prev, reminderReceivers: prev.reminderReceivers.filter(id => id !== emp.id)}));
                             }
                           }}
                         />
                         <span className="text-slate-700 text-xs font-black">{emp.fullName}</span>
                       </label>
                     ))}
                   </div>
                   <p className="text-[9px] text-slate-400 italic">Muddat oz qolganda va tugaganda eslatmalar kimlarga borishi kerak (Keraklilarini belgilang)</p>
                </div>
             </div>
             
             <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => saveNotifPrefs(notifPrefs)} 
                  disabled={savingNotifPrefs}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-black text-xs uppercase px-8 h-12 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {savingNotifPrefs ? 'SAQLANMOQDA...' : 'SAQLASH'}
                </button>
             </div>
           </div>
        </section>
      )}

      {/* Client Logos Section */}
      {isAdmin && (
        <section className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Upload className="text-orange-400" size={28} /> Mijozlar Logolari
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Landing page'da "Bizga ishonch bildirganlar" qismida ko'rsatiladi</p>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm">
            <label className="block w-full border-2 border-dashed border-orange-200 rounded-2xl p-8 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group mb-6">
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={savingLogos} />
              <Upload size={32} className="mx-auto mb-3 text-orange-300 group-hover:text-orange-500 transition-colors" />
              <p className="text-sm font-black text-slate-400 group-hover:text-slate-600">Logo yuklash uchun bosing</p>
              <p className="text-xs font-bold text-slate-300 mt-1">PNG, JPG, SVG • Maks 500KB</p>
            </label>
            {clientLogos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {clientLogos.map((logo, i) => (
                  <div key={i} className="relative group bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-center h-24">
                    <img src={logo} alt={`Logo ${i + 1}`} className="max-w-full max-h-full object-contain" />
                    <button
                      onClick={() => handleLogoDelete(i)}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-sm hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm font-bold text-slate-300 py-8">Hali logolar yo'q. Yuqoridagi maydonga bosib qo'shing.</p>
            )}
            {savingLogos && <p className="text-center text-xs font-black text-orange-500 mt-4 animate-pulse">SAQLANMOQDA...</p>}
          </div>
        </section>
      )}

      {/* Services Catalog Section */}
      {(isAdmin || p.canViewServices || p.canManageServices) && (
        <ServicesCatalogSection services={services} onRefresh={fetchData} showStatus={showStatus} currentUser={currentUser} />
      )}

      {/* Role Modal */}
      <Modal 
        isOpen={isRoleModalOpen} 
        onClose={() => setIsRoleModalOpen(false)} 
        title="Yangi Lavozim Qo'shish"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleAddRole} className="space-y-10">
           <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Lavozim Nomi (Masalan: Admin, Katta Hodim, Manager...)</label>
              <input type="text" required value={newRole.name} onChange={(e) => setNewRole({...newRole, name: e.target.value})} className="w-full h-16 text-2xl font-black bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none focus:bg-white focus:border-orange-500 transition-all shadow-inner placeholder:text-slate-200" placeholder="Manager..." />
           </div>
           
           <div className="space-y-10">
             {permissionGroups.map(group => (
               <div key={group.title} className="space-y-4">
                 <h4 className={`text-[11px] font-black uppercase tracking-[0.4em] border-b pb-4 text-${group.color}-600 border-${group.color}-200 flex items-center gap-3`}>
                    <div className={`w-3 h-3 rounded-full bg-${group.color}-500 shadow-sm shadow-${group.color}-500/30`}></div>
                    {group.title}
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border">
                    {Object.entries(group.permissions).map(([key, label]) => (
                       <label key={key} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-50 rounded-md">
                          <input 
                             type="checkbox" 
                             checked={(newRole as any)[key]} 
                             onChange={(e) => setNewRole({...newRole, [key]: e.target.checked})}
                             className="h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-[12px] font-black uppercase tracking-tight text-slate-800">
                             {label}
                          </span>
                       </label>
                    ))}
                 </div>
               </div>
             ))}
           </div>

           <div className="flex justify-end gap-4 pt-10 border-t border-slate-100 mt-10">
             <button type="button" className="h-14 px-10 text-xs font-black uppercase tracking-widest bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all font-black" onClick={() => setIsRoleModalOpen(false)}>BEKOR QILISH</button>
             <button type="submit" className="h-14 px-16 text-sm font-black tracking-[0.1em] bg-gradient-to-r from-orange-500 to-orange-700 text-white rounded-2xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 transition-all active:translate-y-0 uppercase">YARATISH VA SAQLASH</button>
           </div>
        </form>
      </Modal>

      {/* Unified Confirm Modal */}
      {confirmModal && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
        >
          <div className="space-y-6">
            <p className="text-sm font-bold text-slate-600">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 btn-outline h-12">BEKOR QILISH</button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="flex-1 btn-primary bg-orange-600 text-white h-12 rounded-xl font-black uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20"
              >
                TASDIQLASH
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

// =============================================
// XIZMATLAR KATALOGI KOMPONENTI
// =============================================
const ServicesCatalogSection: React.FC<{ services: any[]; onRefresh: () => void; showStatus: (type: 'success' | 'error', text: string) => void; currentUser: any }> = ({ services, onRefresh, showStatus, currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};
  const canManage = isAdmin || p.canManageServices;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOptionOpen, setIsOptionOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const [newSvcForm, setNewSvcForm] = useState({ name: '', description: '', basePrice: '', unit: 'dona' });
  const [editSvcId, setEditSvcId] = useState<string | null>(null);
  const [editSvcForm, setEditSvcForm] = useState<any>({});
  const [newOptionForm, setNewOptionForm] = useState({ name: '', value: '', percentageMarkup: '' });

  // BOM State
  const [materials, setMaterials] = useState<any[]>([]);
  const [isBOMOpen, setIsBOMOpen] = useState(false);
  const [newMaterialForm, setNewMaterialForm] = useState({ materialId: '', normPerUnit: '' });

  useEffect(() => {
    inventoryApi.getMaterials().then(res => setMaterials(res.data || []));
  }, []);


  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await servicesApi.create({ ...newSvcForm, basePrice: Number(newSvcForm.basePrice) });
      showStatus('success', 'Xizmat qo\'shildi!');
      setIsAddOpen(false);
      setNewSvcForm({ name: '', description: '', basePrice: '', unit: 'dona' });
      onRefresh();
    } catch { showStatus('error', 'Xizmat qo\'shishda xatolik!'); }
  };

  const handleDeleteService = async (id: string) => {
    setConfirmModal({ 
      isOpen: true, 
      title: "Xizmatni o'chirish", 
      message: "Bu xizmatni o'chirmoqchimisiz?", 
      onConfirm: async () => { 
        try { 
          await servicesApi.delete(id); 
          onRefresh(); 
          showStatus("success", "Xizmat o'chirildi."); 
        } catch { 
          showStatus("error", "Xatolik yuz berdi."); 
        } 
        setConfirmModal(null); 
      } 
    });
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    try {
      await servicesApi.addOption(selectedService.id, { 
        name: newOptionForm.name, 
        value: newOptionForm.value, 
        percentageMarkup: Number(newOptionForm.percentageMarkup) 
      });
      showStatus('success', 'Optsiya qo\'shildi!');
      setIsOptionOpen(false);
      setNewOptionForm({ name: '', value: '', percentageMarkup: '' });
      onRefresh();
    } catch { showStatus('error', 'Optsiya qo\'shishda xatolik!'); }
  };

  const handleDeleteOption = async (id: string) => {
    setConfirmModal({ 
      isOpen: true, 
      title: "Opsiyani o'chirish", 
      message: "Tanlangan optsiyani o'chirmoqchimisiz?", 
      onConfirm: async () => { 
        try { 
          await servicesApi.deleteOption(id); 
          const updated = await servicesApi.findAll(); 
          const newSvc = updated.data.find((s: any) => s.id === selectedService.id); 
          setSelectedService(newSvc); 
          onRefresh(); 
          showStatus("success", "Opsiya o'chirildi."); 
        } catch { 
          showStatus("error", "Xatolik yuz berdi."); 
        } 
        setConfirmModal(null); 
      } 
    });
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    try {
      await servicesApi.addMaterial(selectedService.id, { 
        materialId: newMaterialForm.materialId, 
        normPerUnit: Number(newMaterialForm.normPerUnit) 
      });
      showStatus('success', 'Material biriktirildi!');
      setIsBOMOpen(false);
      setNewMaterialForm({ materialId: '', normPerUnit: '' });
      onRefresh();
    } catch { showStatus('error', 'Material biriktirishda xatolik!'); }
  };

  const handleRemoveMaterial = async (materialId: string) => {
    if (!selectedService) return; 
    setConfirmModal({ 
      isOpen: true, 
      title: "BOM o'chirish", 
      message: "Ushbu material sarfini o'chirmoqchimisiz?", 
      onConfirm: async () => { 
        try { 
          await servicesApi.deleteMaterial(selectedService.id, materialId); 
          const updated = await servicesApi.findAll(); 
          const newSvc = updated.data.find((s: any) => s.id === selectedService.id); 
          setSelectedService(newSvc); 
          onRefresh(); 
          showStatus("success", "Material sarfi o'chirildi."); 
        } catch { 
          showStatus("error", "Xatolik yuz berdi."); 
        } 
        setConfirmModal(null); 
      } 
    });
  };

  const handleUpdateService = async (id: string) => {
    try {
      await servicesApi.update(id, { ...editSvcForm, basePrice: Number(editSvcForm.basePrice) });
      setEditSvcId(null);
      showStatus('success', 'Yangilandi!');
      onRefresh();
    } catch { showStatus('error', 'Yangilashda xatolik!'); }
  };

  return (
    <section className="space-y-4">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="text-orange-600" size={24} /> Xizmatlar Katalogi
          </h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pricing Engine — xizmat va opsiyalar narxlari</p>
        </div>
        {canManage && (
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white h-10 px-8 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} strokeWidth={3} /> Yangi Xizmat
          </button>
        )}
      </div>

      <div className="space-y-4">
        {services.length === 0 && (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 py-20 flex flex-col items-center gap-3 text-slate-300">
            <Tag size={40} />
            <p className="font-black uppercase tracking-widest text-xs">Hozircha xizmatlar yo'q</p>
          </div>
        )}
        {services.map(svc => {
          const isExpanded = expandedId === svc.id;
          const isEditing = editSvcId === svc.id;
          return (
            <div key={svc.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${isEditing ? 'border-orange-400 ring-4 ring-orange-50' : 'border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
              {/* Service header */}
              <div className="flex items-center justify-between p-6 cursor-pointer" onClick={() => !isEditing && setExpandedId(isExpanded ? null : svc.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 text-orange-700 rounded-2xl flex items-center justify-center font-black text-lg border border-orange-200">
                    {svc.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                        <input type="text" value={editSvcForm.name} onChange={e => setEditSvcForm({ ...editSvcForm, name: e.target.value })} className="h-9 px-3 text-sm font-black border-2 border-violet-200 rounded-xl outline-none focus:border-violet-500 bg-white" />
                        <input type="number" value={editSvcForm.basePrice} onChange={e => setEditSvcForm({ ...editSvcForm, basePrice: e.target.value })} className="h-9 px-3 w-32 text-sm font-black border-2 border-violet-200 rounded-xl outline-none focus:border-violet-500 bg-white" placeholder="Asosiy narx" />
                        <select value={editSvcForm.unit} onChange={e => setEditSvcForm({ ...editSvcForm, unit: e.target.value })} className="h-9 px-3 text-sm font-black border-2 border-violet-200 rounded-xl outline-none focus:border-violet-500 bg-white">
                          {['dona', 'metr', 'sm', 'm2', 'kg', 'litr', 'soat', 'rulon', 'varaq'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-black text-lg text-slate-800 uppercase tracking-tight">{svc.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-black text-violet-600">{Number(svc.basePrice).toLocaleString('uz-UZ')} UZS</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">/ {svc.unit}</span>
                          <span className="text-[9px] font-black text-sky-500 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full uppercase">{svc.options?.length || 0} optsiya</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button onClick={() => handleUpdateService(svc.id)} className="h-9 px-5 bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"><Save size={14}/> SAQLASH</button>
                      <button onClick={() => setEditSvcId(null)} className="h-9 px-5 bg-slate-100 text-slate-500 text-xs font-black rounded-xl hover:bg-slate-200">BEKOR</button>
                    </>
                  ) : (
                    <>
                      {canManage && (
                        <>
                          <button onClick={() => { setSelectedService(svc); setNewOptionForm(f => ({ ...f, percentageMarkup: '0' })); setIsOptionOpen(true); }} className="h-9 px-4 text-xs font-black text-violet-600 bg-violet-50 border border-violet-100 rounded-xl hover:bg-violet-100 transition-all flex items-center gap-1.5"><Plus size={13}/> Optsiya</button>
                          <button onClick={() => { setEditSvcId(svc.id); setEditSvcForm({ name: svc.name, basePrice: String(svc.basePrice), unit: svc.unit }); }} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-sky-500 hover:text-white transition-all"><Edit3 size={15}/></button>
                          <button onClick={() => handleDeleteService(svc.id)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={15}/></button>
                        </>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : svc.id)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {isExpanded ? <ChevronUp size={16} strokeWidth={3}/> : <ChevronDown size={16} strokeWidth={3}/>}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Options & BOM expanded */}
              {isExpanded && !isEditing && (
                <div className="px-6 pb-6 border-t border-slate-50 pt-5 animate-slide-up space-y-6">
                  {/* Options List */}
                  <div>
                    <h5 className="text-[10px] font-black text-violet-600 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                       <Tag size={12}/> Opsiyalar (Ustama Narxlar)
                    </h5>
                    {svc.options?.length === 0 ? (
                      <p className="text-slate-300 text-[10px] font-black uppercase italic">Opsiyalar yo'q</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {svc.options.map((opt: any) => (
                          <div key={opt.id} className="group flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 hover:border-orange-200 hover:bg-orange-50 transition-all">
                            <div>
                              <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">{opt.name}</p>
                              <p className="text-xs font-black text-slate-800">{opt.value}</p>
                            </div>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${Number(opt.percentageMarkup) >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
                              {opt.percentageMarkup > 0 ? '+' : ''}{opt.percentageMarkup}% ({Number(opt.priceAdd).toLocaleString()} UZS)
                            </span>
                            {canManage && (
                              <button onClick={() => handleDeleteOption(opt.id)} className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-rose-100 text-rose-500 flex items-center justify-center transition-all">
                                <Trash2 size={10}/>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materials List (BOM) */}
                  <div className="pt-4 border-t border-slate-50">
                    <div className="flex justify-between items-center mb-3">
                       <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] flex items-center gap-2">
                          <Package size={12}/> Xomashyo Sarfi (BOM)
                       </h5>
                       {canManage && (
                         <button onClick={() => { setSelectedService(svc); setIsBOMOpen(true); }} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1">
                            <Plus size={12}/> BIRIKTIRISH
                         </button>
                       )}
                    </div>
                    {svc.materials?.length === 0 ? (
                      <p className="text-slate-300 text-[10px] font-black uppercase italic">Materiallar biriktirilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {svc.materials.map((sm: any) => (
                          <div key={sm.id} className="group flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3 hover:border-emerald-200 hover:bg-emerald-50 transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-emerald-500 font-black text-xs">
                                   {sm.material?.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                   <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{sm.material?.name}</p>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase">Sarfi: <span className="text-emerald-600 font-black">{sm.normPerUnit} {sm.material?.unit}</span> / {svc.unit}</p>
                                </div>
                             </div>
                             {canManage && (
                               <button onClick={() => handleRemoveMaterial(sm.materialId)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center transition-all">
                                  <Trash2 size={12}/>
                               </button>
                             )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Service Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Yangi Xizmat Qo'shish">
        <form onSubmit={handleAddService} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Xizmat Nomi</label>
            <input type="text" required value={newSvcForm.name} onChange={e => setNewSvcForm(f => ({ ...f, name: e.target.value }))} className="input-minimal text-lg font-black" placeholder="Masalan: Banner Bosish, Vizitka..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Asosiy Narx (UZS)</label>
              <NumberInput
                value={newSvcForm.basePrice}
                onChange={(num) => setNewSvcForm(f => ({ ...f, basePrice: num ? String(num) : '' }))}
                placeholder="50 000"
                className="input-minimal font-black text-violet-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">O'lchov Birligi</label>
              <select value={newSvcForm.unit} onChange={e => setNewSvcForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal font-black">
                {['dona', 'metr', 'sm', 'm2', 'kg', 'litr', 'soat', 'rulon', 'varaq'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Tavsif (ixtiyoriy)</label>
            <textarea value={newSvcForm.description} onChange={e => setNewSvcForm(f => ({ ...f, description: e.target.value }))} className="input-minimal min-h-[60px]" placeholder="Qo'shimcha ma'lumot..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setIsAddOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-10 bg-violet-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-violet-700 transition-all">Yaratish</button>
          </div>
        </form>
      </Modal>

      {/* Add Option Modal */}
      <Modal isOpen={isOptionOpen} onClose={() => setIsOptionOpen(false)} title={`Optsiya: ${selectedService?.name || ''}`}>
        <form onSubmit={handleAddOption} className="space-y-5">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-[11px] font-bold text-orange-700">
            Asosiy narx: <strong>{Number(selectedService?.basePrice || 0).toLocaleString()} UZS</strong> / {selectedService?.unit}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Parametr Nomi</label>
              <input type="text" required value={newOptionForm.name} onChange={e => setNewOptionForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Qog'oz turi, Rang..." />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Qiymat</label>
              <input type="text" required value={newOptionForm.value} onChange={e => setNewOptionForm(f => ({ ...f, value: e.target.value }))} className="input-minimal" placeholder="A4, To'q ko'k, Ha..." />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Yakuniy Narx (UZS)</label>
            <div className="relative">
              <NumberInput
                value={newOptionForm.percentageMarkup === '' ? '' : String(Number(selectedService?.basePrice || 0) + Math.round(Number(selectedService?.basePrice || 0) * (Number(newOptionForm.percentageMarkup) / 100)))}
                onChange={(num) => {
                  const base = Number(selectedService?.basePrice || 0);
                  if (base > 0 && num !== undefined) {
                    const markup = ((num / base) - 1) * 100;
                    setNewOptionForm(f => ({ ...f, percentageMarkup: String(markup) }));
                  }
                }}
                placeholder="0"
                className="input-minimal font-black text-2xl h-14 text-orange-600"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-2xl text-slate-200">UZS</div>
            </div>
            
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400">Ustama Foizi:</p>
                  <p className={`text-lg font-black ${Number(newOptionForm.percentageMarkup) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {Number(newOptionForm.percentageMarkup) > 0 ? '+' : ''}{Math.round(Number(newOptionForm.percentageMarkup) * 100) / 100}%
                  </p>
               </div>
               <div className="text-right space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400">Narx Farqi:</p>
                  <p className={`text-lg font-black ${Number(newOptionForm.percentageMarkup) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {Number(newOptionForm.percentageMarkup) >= 0 ? '+' : ''}{Math.round(Number(selectedService?.basePrice || 0) * (Number(newOptionForm.percentageMarkup) / 100))} UZS
                  </p>
               </div>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400 mt-3 px-1 italic">
              * Yakuniy narxni yozing, tizim foizni avtomatik hisoblab oladi. Keyinchalik asosiy narx o'zgarganda, bu optsiya foizga qarab moslashadi.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setIsOptionOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-10 bg-orange-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-orange-700 transition-all">Qo'shish</button>
          </div>
        </form>
      </Modal>
      {/* BOM Modal */}
      <Modal isOpen={isBOMOpen} onClose={() => setIsBOMOpen(false)} title={`Xomashyo Biriktirish: ${selectedService?.name || ''}`}>
        <form onSubmit={handleAddMaterial} className="space-y-5">
           <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-[11px] font-bold text-emerald-700">
             Xizmat: <strong>{selectedService?.name}</strong> uchun 1 <strong>{selectedService?.unit}</strong> sarfini belgilang.
           </div>
           <div className="space-y-4">
             <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Materialni tanlang</label>
               <select 
                 required
                 value={newMaterialForm.materialId} 
                 onChange={e => setNewMaterialForm(f => ({ ...f, materialId: e.target.value }))}
                 className="select-minimal font-black h-12"
               >
                 <option value="">Tanlang...</option>
                 {materials.map(m => (
                   <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                 ))}
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Sarflash miqdori (Norma)</label>
               <input 
                 type="number" 
                 step="0.0001" 
                 required 
                 min="0"
                 value={newMaterialForm.normPerUnit} 
                 onChange={e => setNewMaterialForm(f => ({ ...f, normPerUnit: e.target.value }))} 
                 className="input-minimal font-black h-12 border-emerald-100 focus:border-emerald-500" 
                 placeholder="Masalan: 0.1" 
               />
               <p className="text-[10px] font-bold text-slate-400 mt-2 px-1 italic">
                 Masalan: 1ta qog'ozdan 10ta vizitka chiqsa, 0.1 deb yozing.
               </p>
             </div>
           </div>
           <div className="flex gap-3 pt-4">
             <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setIsBOMOpen(false)}>Bekor</button>
             <button type="submit" className="h-12 flex-2 px-10 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 transition-all">Biriktirish</button>
           </div>
        </form>
      </Modal>

      {/* Sub-component Confirm Modal */}
      {confirmModal && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
        >
          <div className="space-y-6">
            <p className="text-sm font-bold text-slate-600">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 btn-outline h-12">BEKOR</button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="flex-1 btn-primary bg-orange-600 text-white h-12 rounded-xl font-black uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20"
              >
                TASDIQLASH
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
};

export default Sozlamalar;

