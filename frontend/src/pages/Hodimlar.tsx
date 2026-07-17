import React, { useState } from 'react';
import { Trash2, UserPlus, Eye, EyeOff, RefreshCw, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { employeesApi, billingApi } from '../api';
import { useQuery } from '@tanstack/react-query';
import { useEmployees, useRoles, useBranches, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import { SkeletonTable } from '../components/Skeleton';
import CurrencyInput from '../components/CurrencyInput';
import { exportToXlsx } from '../utils/exportToXlsx';
import { PayrollSection } from '../components/PayrollSection';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(amount).replace(/,/g, ' ') + " UZS";
};

const Hodimlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.role?.name?.toLowerCase() === 'superadmin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};

  const canAdd           = isAdmin || p.canAddEmployee || p.canManageEmployees;
  const canDelete        = isAdmin || p.canDeleteEmployee || p.canManageEmployees;
  const canResetPassword = isAdmin || p.canResetEmployeePassword || p.canManageEmployees;

  // Maosh (payroll) bo'limi ruxsatlari + tab holati
  const canViewPayroll   = isAdmin || !!p.canViewPayroll;
  const canManagePayroll = isAdmin || !!p.canManagePayroll;
  const [activeTab, setActiveTab] = useState<'xodimlar' | 'maosh'>('xodimlar');

  // RQ — cache'lanadi, derived data effect orqali tayyorlanadi
  const { data: rawEmployees = [], isLoading: empLoading } = useEmployees();
  const { data: rawRoles = [], isLoading: roleLoading } = useRoles(activeBranchId);
  const { data: branches = [] } = useBranches();
  const { data: billingStatus } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: async () => (await billingApi.getStatus()).data,
    staleTime: 60_000,
  });
  const invalidate = useInvalidate();
  const isLoading = empLoading || roleLoading;

  // Derived: filter out admin roles + employees
  const roles = (rawRoles as any[]).filter((r: any) => {
    const roleName = r.name.toLowerCase();
    return roleName !== 'admin' && roleName !== 'superadmin' && roleName !== 'rahbar' && roleName !== 'owner';
  });
  const employeeRoleIds = roles.map((r: any) => r.id);
  const employees = (rawEmployees as any[]).filter((emp: any) => {
    const empRoleName = emp.role?.name?.toLowerCase() || '';
    return employeeRoleIds.includes(emp.roleId) &&
           emp.login !== 'admin' &&
           empRoleName !== 'admin' &&
           empRoleName !== 'superadmin';
  });
  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  // Employee Form
  const [newEmployee, setNewEmployee] = useState<any>({
    fullName: '', phone: '', roleId: '', baseSalary: '', branchId: ''
  });
  const [generatedCredentials, setGeneratedCredentials] = useState<{login: string, password: string} | null>(null);
  const [showGenPass, setShowGenPass] = useState(true);
  const [showSelectedPass, setShowSelectedPass] = useState(false);
  const maxEmployees = (billingStatus as any)?.plan?.maxEmployees ?? 0;

  // fetchData() shim — invalidates relevant RQ caches
  const fetchData = async (_silent = false) => {
    invalidate.employees();
    invalidate.roles();
  };

  // RQ auto-fetches on hooks; manual useEffect not needed

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await employeesApi.create({ ...newEmployee, baseSalary: Number(newEmployee.baseSalary) || 0, branchId: newEmployee.branchId || undefined });
      setGeneratedCredentials({ login: res.data.login, password: res.data.password });
      setNewEmployee({ fullName: '', phone: '', roleId: '', baseSalary: '', branchId: '' });
      fetchData(true);
      toast.success("Xodim muvaffaqiyatli qo'shildi!");
      setIsEmployeeModalOpen(false);
    } catch (err) {
      toast.error("Xodim qo'shishda xatolik yuz berdi.");
    }
  };

  const handleCloseModal = () => {
    setIsEmployeeModalOpen(false);
    setGeneratedCredentials(null);
    setShowGenPass(true);
  };

  const handleDeleteEmployee = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Xodimni o'chirish",
      message: "Ushbu xodimni tizimdan butunlay o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await employeesApi.delete(id);
          fetchData(true);
          toast.success("Xodim tizimdan o'chirildi.");
        } catch (err) {
          toast.error("O'chirishda xatolik yuz berdi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const handleRegeneratePassword = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Parolni yangilash",
      message: "Ushbu xodim uchun yangi parol generatsiya qilinsinmi?",
      onConfirm: async () => {
        try {
          const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
          const res = await employeesApi.update(id, { password: newPassword });
          fetchData(true);
          setSelectedEmp({ ...res.data, password: newPassword });
          setIsCredentialsModalOpen(true);
          toast.success("Parol muvaffaqiyatli yangilandi.");
        } catch (err) {
          toast.error("Yangilashda xatolik yuz berdi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const openCredentialsModal = (emp: any) => {
    setSelectedEmp(emp);
    setIsCredentialsModalOpen(true);
  };

  const handleExport = () => {
    if (employees.length === 0) {
      toast.info("Eksport qilish uchun xodim yo'q");
      return;
    }
    const branchById = new Map((branches as any[]).map((b: any) => [b.id, b.name]));
    const showSalary = isAdmin || p.canViewSalary;
    const cols: any[] = [
      { header: 'F.I.SH', accessor: (e: any) => e.fullName || '' },
      { header: 'Telefon', accessor: (e: any) => e.phone || '' },
      { header: 'Login', accessor: (e: any) => e.login || '' },
      { header: 'Lavozim', accessor: (e: any) => e.role?.name || '' },
      { header: 'Filial', accessor: (e: any) => branchById.get(e.branchId) || '' },
    ];
    if (showSalary) {
      cols.push({ header: 'Asosiy maosh (UZS)', accessor: (e: any) => Number(e.baseSalary || 0) });
    }
    cols.push({ header: 'Yaratilgan', accessor: (e: any) => e.createdAt ? new Date(e.createdAt).toLocaleDateString('uz-UZ') : '' });

    const stamp = new Date().toLocaleDateString('en-CA');
    exportToXlsx({
      filename: `hodimlar_${stamp}`,
      sheetName: 'Hodimlar',
      rows: employees,
      columns: cols,
    });
    toast.success(`${employees.length} ta xodim eksport qilindi`);
  };

  if (isLoading) return <SkeletonTable rows={5} cols={5} />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative">
      {canViewPayroll && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('xodimlar')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'xodimlar' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Xodimlar</button>
          <button onClick={() => setActiveTab('maosh')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeTab === 'maosh' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>Maosh</button>
        </div>
      )}

      {activeTab === 'maosh' && canViewPayroll && (
        <PayrollSection activeBranchId={activeBranchId} canManage={canManagePayroll} />
      )}

      <div className={`space-y-4 sm:space-y-6 animate-fade-in ${activeTab !== 'xodimlar' ? 'hidden' : ''}`}>
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight">Jamoa A'zolari</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
              Tizimga kirish huquqiga ega barcha xodimlar
              {maxEmployees > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold ${employees.length >= maxEmployees ? 'bg-rose-100 text-rose-600' : 'bg-orange-50 text-orange-600'}`}>
                  {employees.length} / {maxEmployees}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {(isAdmin || p.canExportEmployees) && (
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 h-10 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-sm transition-all"
                title="Xodimlar ro'yxatini Excel'ga eksport qilish"
              >
                <Download size={13} strokeWidth={2.5}/> EKSPORT
              </button>
            )}
            {canAdd && (() => {
              const atLimit = maxEmployees > 0 && employees.length >= maxEmployees;
              return (
                <button
                  data-tour-id="hodim-add"
                  disabled={atLimit}
                  onClick={() => !atLimit && setIsEmployeeModalOpen(true)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-5 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg transition-all ${atLimit ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-orange-600 text-white shadow-orange-500/20 hover:bg-orange-700'}`}
                  title={atLimit ? `Limit to'ldi: ${maxEmployees} ta xodim (tarifni yangilang)` : ''}
                >
                  <UserPlus size={16} strokeWidth={2.5} />
                  {atLimit ? `Limit to'ldi (${maxEmployees}/${maxEmployees})` : "Yangi Xodim"}
                </button>
              );
            })()}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-100">
                  <th className="text-[9px] uppercase tracking-widest font-bold text-slate-400 py-3 px-5">F.I.SH & Aloqa</th>
                  <th className="text-[9px] uppercase tracking-widest font-bold text-slate-400 px-5">Lavozimi</th>
                  <th className="text-[9px] uppercase tracking-widest font-bold text-slate-400 px-5">Login</th>
                  {branches.length > 0 && <th className="text-[9px] uppercase tracking-widest font-bold text-slate-400 px-5">Filial</th>}
                  {(isAdmin || p.canViewSalary) && <th className="text-[9px] uppercase tracking-widest font-bold text-slate-400 px-5 text-emerald-600">Asosiy Maosh</th>}
                  <th className="text-[9px] uppercase tracking-widest font-bold text-slate-400 text-right pr-6 px-5">Harakat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
                        <UserPlus size={26} />
                      </div>
                      <div>
                        <p className="text-base font-bold text-slate-800 mb-1">Hali xodim qo'shilmagan</p>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">Jamoangiz a'zolarini qo'shing. Har bir xodim uchun login/parol avtomatik yaratiladi.</p>
                      </div>
                      {canAdd && (
                        <button onClick={() => setIsEmployeeModalOpen(true)} className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm flex items-center gap-2 mt-2">
                          <UserPlus size={16} /> Birinchi xodimni qo'shish
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="py-3 px-5">
                      <p className="font-bold text-slate-800 text-xs lowercase first-letter:uppercase tracking-tight">{emp.fullName}</p>
                      <p className="text-[10px] font-bold text-sky-500 mt-0.5">{emp.phone}</p>
                    </td>
                    <td className="px-5">
                      <span className="bg-orange-50 text-orange-700 text-[9px] font-bold px-2 py-1 rounded-lg border border-orange-100 uppercase tracking-tight">
                        {emp.role?.name || '—'}
                      </span>
                    </td>
                    <td className="px-5 font-mono font-bold text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        {emp.login}
                        {canResetPassword && (
                          <button onClick={() => openCredentialsModal(emp)} className="text-slate-300 hover:text-sky-500 transition-colors p-1" title="Ma'lumotlarni ko'rish">
                            <Eye size={12} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                    {branches.length > 0 && (
                      <td className="px-5">
                        {emp.branchId ? (
                          <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg uppercase tracking-tight">
                            {branches.find(b => b.id === emp.branchId)?.name || '—'}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-300 font-bold">—</span>
                        )}
                      </td>
                    )}
                    {(isAdmin || p.canViewSalary) && <td className="px-5 font-bold text-xs text-slate-700 tabular-nums">{formatCurrency(emp.baseSalary)}</td>}
                    <td className="text-right pr-6">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canResetPassword && (
                          <button onClick={() => handleRegeneratePassword(emp.id)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center border border-transparent hover:border-amber-100 shadow-sm" title="Parolni yangilash">
                            <RefreshCw size={12} strokeWidth={3} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            disabled={emp.login === 'admin'}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border border-transparent transition-all shadow-sm ${
                              emp.login === 'admin'
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100'
                            }`}
                            title={emp.login === 'admin' ? "Asosiy adminni o'chirib bo'lmaydi" : "O'chirish"}
                          >
                            <Trash2 size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Employee Modal: Create */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={handleCloseModal}
        title={generatedCredentials ? "Muvaffaqiyatli saqlandi!" : "Yangi Xodim Qo'shish"}
        maxWidth="max-w-md"
      >
          {generatedCredentials ? (
            <div className="space-y-6 text-center animate-fade-in">
               <div className="w-16 h-16 bg-emerald-100 text-emerald-500 flex items-center justify-center rounded-2xl mx-auto mb-4">
                  <UserPlus size={32} />
               </div>
               <p className="text-sm font-bold text-slate-600 mb-6">Xodim tizimga kirishi uchun quyidagi ma'lumotlarni siri saqlagan holda unga taqdim eting:</p>
               <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left space-y-4">
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Login</p>
                     <p className="font-mono text-lg font-bold text-slate-800 bg-white p-2 rounded-lg border border-slate-200 select-all tracking-wider">{generatedCredentials.login}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parol</p>
                     <div className="relative">
                        <input 
                           type={showGenPass ? "text" : "password"} 
                           readOnly 
                           value={generatedCredentials.password} 
                           className="w-full font-mono text-lg font-bold text-orange-600 bg-white p-2 pr-12 rounded-lg border border-slate-200 select-all tracking-wider outline-none" 
                        />
                        <button 
                           type="button" 
                           onClick={() => setShowGenPass(!showGenPass)}
                           className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors"
                        >
                           {showGenPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                     </div>
                  </div>
               </div>
               <div className="pt-4">
                  <button type="button" className="btn-primary w-full h-12 font-bold tracking-widest uppercase bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 rounded-xl" onClick={handleCloseModal}>Tushunarli, Yopish</button>
               </div>
            </div>
          ) : (
            <form onSubmit={handleAddEmployee} className="space-y-5">
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">F.I.SH</label>
                  <input type="text" required value={newEmployee.fullName} onChange={(e) => setNewEmployee({...newEmployee, fullName: e.target.value})} className="input-minimal w-full" placeholder="Ism Familiya" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Telefon</label>
                  <input type="text" value={newEmployee.phone} onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})} className="input-minimal w-full" placeholder="+998 90 123 45 67" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Lavozimi</label>
                  <select required value={newEmployee.roleId} onChange={(e) => setNewEmployee({...newEmployee, roleId: e.target.value})} className="select-minimal font-bold w-full">
                     <option value="">Tanlang...</option>
                     {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
               </div>
               {branches.length > 0 && (
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Filial</label>
                    <select value={newEmployee.branchId} onChange={(e) => setNewEmployee({...newEmployee, branchId: e.target.value})} className="select-minimal font-bold w-full">
                       <option value="">Filial tanlanmagan</option>
                       {branches.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                 </div>
               )}
               {(isAdmin || p.canViewSalary) && (
                 <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Maoshi</label>
                    <CurrencyInput
                      value={newEmployee.baseSalary}
                      onChange={(uzs) => setNewEmployee({...newEmployee, baseSalary: uzs || ''})}
                      colorClass="text-emerald-600"
                      className="input-minimal font-bold w-full"
                    />
                 </div>
               )}
               <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                 <button type="button" className="btn-outline h-12 px-6 flex-1 rounded-xl text-xs font-bold uppercase" onClick={handleCloseModal}>Bekor qilish</button>
                 <button type="submit" className="btn-primary h-12 px-10 font-bold flex-1 rounded-xl text-xs uppercase shadow-lg shadow-orange-500/20 bg-orange-500 text-white hover:bg-orange-600">SAQLASH</button>
               </div>
            </form>
          )}
      </Modal>

      {/* Credentials Modal: View */}
      <Modal
        isOpen={isCredentialsModalOpen && !!selectedEmp}
        onClose={() => setIsCredentialsModalOpen(false)}
        title="Kirish Ma'lumotlari"
        maxWidth="max-w-sm"
      >
          {selectedEmp && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Xodim</p>
                <p className="font-bold text-slate-800">{selectedEmp.fullName}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Login</p>
                <p className="font-mono font-bold text-slate-800 select-all tracking-wider">{selectedEmp.login}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Parol</p>
                <div className="relative">
                  <input 
                    type={showSelectedPass ? "text" : "password"} 
                    readOnly 
                    value={selectedEmp.password} 
                    className="w-full font-mono font-bold text-orange-600 bg-transparent select-all tracking-wider outline-none" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowSelectedPass(!showSelectedPass)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600 transition-colors"
                  >
                    {showSelectedPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button 
                onClick={() => handleRegeneratePassword(selectedEmp.id)}
                className="btn-outline w-full mt-6 h-12 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest rounded-xl"
              >
                <RefreshCw size={14} /> YANGI PAROL GENERATSIYA QILISH
              </button>
            </div>
          )}
      </Modal>

      {/* Confirmation Modal */}
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
                className="flex-1 btn-primary bg-orange-600 text-white h-12 rounded-xl font-bold uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20"
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

export default Hodimlar;
