import React, { useState } from 'react';
import { Trash2, UserPlus, Eye, EyeOff, RefreshCw, Download, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import { employeesApi, billingApi } from '../api';
import { useQuery } from '@tanstack/react-query';
import { useEmployees, useRoles, useBranches, useDepartments, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import { SkeletonTable } from '../components/Skeleton';
import { exportToXlsx } from '../utils/exportToXlsx';
import { PayrollSection } from '../components/PayrollSection';
import { SalarySchemeSection } from '../components/SalarySchemeSection';


import Tabs from '../components/ui/Tabs';
import PhoneInput from '../components/ui/PhoneInput';
import Badge from '../components/ui/Badge';

/**
 * Xodim qaysi bo'lim(lar)da ishlashini tanlash.
 */
const fmtDebt = (v: any) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Number(v) || 0).replace(/,/g, ' ');

const DepartmentPicker: React.FC<{
  departments: any[];
  value: string[];
  onChange: (ids: string[]) => void;
}> = ({ departments, value, onChange }) => {
  if (!departments.length) return null;
  const selected = value || [];
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div>
      <label className="form-label">
        Bo'limlar
      </label>
      <div className="flex flex-wrap gap-1.5">
        {departments.map((d: any) => {
          const on = selected.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              className={`px-3 py-1.5 rounded-control text-xs font-medium border transition-colors ${
                on
                  ? 'bg-[color:var(--primary)] text-white border-transparent shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>
      <p className="t-caption mt-1.5 leading-relaxed">
        {selected.length === 0
          ? "Bo'lim tanlanmasa, xodim barcha bo'limlar bo'yicha hisoblanadi."
          : "Maosh hisobida faqat shu bo'lim(lar)dagi buyurtma va tushum inobatga olinadi."}
      </p>
    </div>
  );
};

const Hodimlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.role?.name?.toLowerCase() === 'superadmin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};

  const canAdd           = isAdmin || p.canAddEmployee || p.canManageEmployees;
  const canEdit          = isAdmin || p.canEditEmployee || p.canManageEmployees;
  const canDelete        = isAdmin || p.canDeleteEmployee || p.canManageEmployees;
  const canResetPassword = isAdmin || p.canResetEmployeePassword || p.canManageEmployees;

  const canViewPayroll   = isAdmin || !!p.canViewPayroll;
  const canManagePayroll = isAdmin || !!p.canManagePayroll;
  const [activeTab, setActiveTab] = useState<'xodimlar' | 'maosh' | 'sxema'>('xodimlar');

  const { data: rawEmployees = [], isLoading: empLoading } = useEmployees();
  const { data: rawRoles = [], isLoading: roleLoading } = useRoles(activeBranchId);
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useDepartments(activeBranchId);
  const { data: billingStatus } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: async () => (await billingApi.getStatus()).data,
    staleTime: 60_000,
  });
  const invalidate = useInvalidate();
  const isLoading = empLoading || roleLoading;

  const anyDebt = (rawEmployees as any[]).some((e: any) => Number(e.workDebt || 0) > 0);

  // Derived: filter out admin roles + employees
  const roles = (rawRoles as any[]).filter((r: any) => {
    const roleName = r.name.toLowerCase();
    return roleName !== 'admin' && roleName !== 'superadmin';
  });

  const employees = (rawEmployees as any[]).filter((e: any) => {
    const roleName = e.role?.name?.toLowerCase();
    return roleName !== 'admin' && roleName !== 'superadmin' && e.login !== 'admin';
  });

  // Tarif limiti
  const maxEmployees = (billingStatus as any)?.plan?.maxEmployees ?? 0;

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [editEmployee, setEditEmployee] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{ login: string; pass: string; name: string } | null>(null);
  const [showGenPass, setShowGenPass] = useState(false);
  const [showSelectedPass, setShowSelectedPass] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    phone: '',
    roleId: '',
    branchId: '',
    departmentIds: [] as string[],
  });

  // Handlers
  const handleCloseModal = () => {
    setIsEmployeeModalOpen(false);
    setGeneratedCreds(null);
    setNewEmployee({
      fullName: '',
      phone: '',
      roleId: '',
      branchId: '',
      departmentIds: [],
    });
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await employeesApi.create({
        ...newEmployee,
        branchId: newEmployee.branchId || undefined,
        departmentIds: newEmployee.departmentIds.length ? newEmployee.departmentIds : undefined,
      });
      if (res.data?.temporaryPassword) {
        setGeneratedCreds({
          login: res.data.login,
          pass: res.data.temporaryPassword,
          name: res.data.fullName,
        });
      } else {
        handleCloseModal();
      }
      invalidate.employees();
      toast.success("Xodim muvaffaqiyatli qo'shildi");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Xodim qo'shishda xatolik");
    }
  };

  const openEditModal = (emp: any) => {
    setEditEmployee({
      id: emp.id,
      fullName: emp.fullName || '',
      phone: emp.phone || '',
      roleId: emp.roleId || emp.role?.id || '',
      branchId: emp.branchId || '',
      departmentIds: emp.departmentIds || (emp.departments || []).map((d: any) => d.id) || [],
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    setSavingEdit(true);
    try {
      await employeesApi.update(editEmployee.id, {
        fullName: editEmployee.fullName,
        phone: editEmployee.phone,
        roleId: editEmployee.roleId,
        branchId: editEmployee.branchId || null,
        departmentIds: editEmployee.departmentIds,
      });
      invalidate.employees();
      setIsEditModalOpen(false);
      setEditEmployee(null);
      toast.success("Xodim ma'lumotlari yangilandi");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Yangilashda xatolik yuz berdi");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEmployee = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Xodimni o'chirish",
      message: "Haqiqatan ham bu xodimni tizimdan o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await employeesApi.delete(id);
          invalidate.employees();
          toast.success("Xodim o'chirildi");
        } catch (err: any) {
          toast.error(err.response?.data?.error || "Xodimni o'chirishda xatolik");
        }
        setConfirmModal(null);
      }
    });
  };

  const handleRegeneratePassword = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Parolni yangilash",
      message: "Xodim uchun yangi parol generatsiya qilinsinmi? Eski parol o'z kuchini yo'qotadi.",
      onConfirm: async () => {
        try {
          const res = await (employeesApi as any).regeneratePassword(id);
          const newPass = res.data?.temporaryPassword;
          invalidate.employees();
          if (newPass) {
            setSelectedEmp((prev: any) => prev ? { ...prev, password: newPass } : prev);
            toast.success(`Yangi parol: ${newPass}`);
          } else {
            toast.success("Parol yangilandi");
          }
        } catch (err: any) {
          toast.error(err.response?.data?.error || "Parolni yangilashda xatolik");
        }
        setConfirmModal(null);
      }
    });
  };

  const openCredentialsModal = (emp: any) => {
    setSelectedEmp(emp);
    setShowSelectedPass(false);
    setIsCredentialsModalOpen(true);
  };

  const handleExport = () => {
    if (employees.length === 0) {
      toast.info("Eksport qilish uchun xodim yo'q");
      return;
    }
    const branchById = new Map((branches as any[]).map((b: any) => [b.id, b.name]));
    const cols: any[] = [
      { header: 'F.I.SH', accessor: (e: any) => e.fullName || '' },
      { header: 'Telefon', accessor: (e: any) => e.phone || '' },
      { header: 'Login', accessor: (e: any) => e.login || '' },
      { header: 'Lavozim', accessor: (e: any) => e.role?.name || '' },
      { header: 'Filial', accessor: (e: any) => branchById.get(e.branchId) || '' },
      { header: 'Yaratilgan', accessor: (e: any) => e.createdAt ? new Date(e.createdAt).toLocaleDateString('uz-UZ') : '' }
    ];

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
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative pb-12">
      {canViewPayroll && (
        <Tabs<'xodimlar' | 'maosh' | 'sxema'>
          tabs={[
            { id: 'xodimlar', label: 'Xodimlar' },
            { id: 'maosh', label: 'Maosh' },
            { id: 'sxema', label: 'Maosh sxemasi' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      )}

      {activeTab === 'maosh' && canViewPayroll && (
        <PayrollSection activeBranchId={activeBranchId} canManage={canManagePayroll} />
      )}

      {activeTab === 'sxema' && canViewPayroll && (
        <SalarySchemeSection canManage={canManagePayroll} />
      )}

      <div className={`space-y-4 sm:space-y-6 animate-fade-in ${activeTab !== 'xodimlar' ? 'hidden' : ''}`}>
        <div className="bg-white p-4 sm:p-5 rounded-card border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="card-title">Jamoa a'zolari</h3>
            <p className="t-caption mt-0.5">
              Tizimga kirish huquqiga ega barcha xodimlar
              {maxEmployees > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${employees.length >= maxEmployees ? 'bg-rose-100 text-rose-700' : 'bg-primary-50 text-primary-700'}`}>
                  {employees.length} / {maxEmployees}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {(isAdmin || p.canExportEmployees) && (
              <button
                onClick={handleExport}
                className="btn-outline h-control"
                title="Xodimlar ro'yxatini Excel'ga eksport qilish"
              >
                <Download size={16} /> Eksport
              </button>
            )}
            {canAdd && (() => {
              const atLimit = maxEmployees > 0 && employees.length >= maxEmployees;
              return (
                <button
                  data-tour-id="hodim-add"
                  disabled={atLimit}
                  onClick={() => !atLimit && setIsEmployeeModalOpen(true)}
                  className={`btn-primary h-control ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={atLimit ? `Limit to'ldi: ${maxEmployees} ta xodim` : ''}
                >
                  <UserPlus size={16} />
                  {atLimit ? `Limit to'ldi (${maxEmployees}/${maxEmployees})` : "Yangi xodim"}
                </button>
              );
            })()}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-minimal">
              <thead>
                <tr>
                  <th>F.I.SH & Aloqa</th>
                  <th>Lavozimi</th>
                  <th className="hidden md:table-cell">Login</th>
                  {branches.length > 0 && <th className="hidden md:table-cell">Filial</th>}
                  {departments.length > 0 && <th className="hidden md:table-cell">Bo'limlar</th>}
                  {anyDebt && <th className="hidden md:table-cell">Qarzdorlik</th>}
                  <th className="text-right pr-6">Amal</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600">
                        <UserPlus size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Hali xodim qo'shilmagan</p>
                        <p className="t-caption max-w-sm mx-auto mt-0.5">Jamoangiz a'zolarini qo'shing. Har bir xodim uchun login/parol avtomatik yaratiladi.</p>
                      </div>
                      {canAdd && (
                        <button onClick={() => setIsEmployeeModalOpen(true)} className="btn-primary mt-1">
                          <UserPlus size={16} /> Birinchi xodimni qo'shish
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td>
                      <p className="font-semibold text-slate-800 text-xs">{emp.fullName}</p>
                      <p className="t-caption mt-0.5 tabular-nums">{emp.phone}</p>
                    </td>
                    <td>
                      <Badge variant="brand">
                        {emp.role?.name || '—'}
                      </Badge>
                    </td>
                    <td className="hidden md:table-cell font-mono text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        {emp.login}
                        {canResetPassword && (
                          <button onClick={() => openCredentialsModal(emp)} className="icon-btn-sm" title="Ma'lumotlarni ko'rish">
                            <Eye size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    {branches.length > 0 && (
                      <td className="hidden md:table-cell">
                        {emp.branchId ? (
                          <Badge variant="neutral">
                            {branches.find(b => b.id === emp.branchId)?.name || '—'}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    )}
                    {departments.length > 0 && (
                      <td className="hidden md:table-cell">
                        {(emp.departmentNames || []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.departmentNames.map((n: string) => (
                              <Badge key={n} variant="neutral">
                                {n}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">hammasi</span>
                        )}
                      </td>
                    )}
                    {anyDebt && (
                      <td className="hidden md:table-cell">
                        {Number(emp.workDebt || 0) > 0 ? (
                          <Badge variant="danger">
                            {fmtDebt(emp.workDebt)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td className="text-right pr-6">
                      <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(emp)}
                            className="icon-btn-sm"
                            title="Tahrirlash"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {canResetPassword && (
                          <button onClick={() => handleRegeneratePassword(emp.id)} className="icon-btn-sm hover:text-amber-600" title="Parolni yangilash">
                            <RefreshCw size={12} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            disabled={emp.login === 'admin'}
                            className={`icon-btn-sm ${
                              emp.login === 'admin'
                                ? 'text-slate-200 cursor-not-allowed'
                                : 'hover:text-rose-600'
                            }`}
                            title={emp.login === 'admin' ? "Asosiy adminni o'chirib bo'lmaydi" : "O'chirish"}
                          >
                            <Trash2 size={12} />
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

      {/* Employee Modal: Create / Credentials */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={handleCloseModal}
        title={generatedCreds ? "Yangi xodim yaratildi!" : "Yangi xodim qo'shish"}
        maxWidth="max-w-md"
      >
          {generatedCreds ? (
            <div className="space-y-4 animate-fade-in">
               <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-card text-emerald-800 text-xs leading-relaxed">
                  <strong>{generatedCreds.name}</strong> muvaffaqiyatli ro'yxatdan o'tdi. Quyidagi ma'lumotlarni xodimga taqdim eting:
               </div>
               <div className="space-y-3 bg-slate-50 p-4 rounded-card border border-slate-200">
                  <div>
                     <p className="t-caption">Login</p>
                     <p className="font-mono font-bold text-slate-800 text-sm">{generatedCreds.login}</p>
                  </div>
                  <div>
                     <p className="t-caption">Vaqtinchalik parol</p>
                     <div className="relative flex items-center">
                        <input 
                           type={showGenPass ? "text" : "password"} 
                           readOnly 
                           value={generatedCreds.pass} 
                           className="font-mono font-bold text-primary-700 bg-transparent text-sm w-full outline-none" 
                        />
                        <button 
                           type="button" 
                           onClick={() => setShowGenPass(!showGenPass)}
                           className="icon-btn-sm"
                        >
                           {showGenPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                     </div>
                  </div>
               </div>
               <div className="pt-2">
                  <button type="button" className="btn-primary w-full" onClick={handleCloseModal}>Tushunarli, yopish</button>
               </div>
            </div>
          ) : (
            <form onSubmit={handleAddEmployee} className="space-y-3.5">
               <div>
                  <label className="form-label">F.I.SH</label>
                  <input type="text" required value={newEmployee.fullName} onChange={(e) => setNewEmployee({...newEmployee, fullName: e.target.value})} className="input-minimal w-full" placeholder="Ism Familiya" />
               </div>
               <div>
                  <label className="form-label">Telefon</label>
                  <PhoneInput value={newEmployee.phone} onChange={(phone) => setNewEmployee({...newEmployee, phone})} />
               </div>
               <div>
                  <label className="form-label">Lavozimi</label>
                  <select required value={newEmployee.roleId} onChange={(e) => setNewEmployee({...newEmployee, roleId: e.target.value})} className="select-minimal w-full">
                     <option value="">Tanlang...</option>
                     {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
               </div>
               {branches.length > 0 && (
                 <div>
                    <label className="form-label">Filial</label>
                    <select value={newEmployee.branchId} onChange={(e) => setNewEmployee({...newEmployee, branchId: e.target.value})} className="select-minimal w-full">
                       <option value="">Filial tanlanmagan</option>
                       {branches.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                 </div>
               )}
               <DepartmentPicker
                 departments={departments}
                 value={newEmployee.departmentIds}
                 onChange={(ids) => setNewEmployee({ ...newEmployee, departmentIds: ids })}
               />
               <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                 <button type="button" className="btn-outline flex-1" onClick={handleCloseModal}>Bekor qilish</button>
                 <button type="submit" className="btn-primary flex-1">Saqlash</button>
               </div>
            </form>
          )}
      </Modal>

      {/* Employee Modal: Edit */}
      <Modal
        isOpen={isEditModalOpen && !!editEmployee}
        onClose={() => { setIsEditModalOpen(false); setEditEmployee(null); }}
        title="Xodim ma'lumotlarini tahrirlash"
        maxWidth="max-w-md"
      >
        {editEmployee && (
          <form onSubmit={handleUpdateEmployee} className="space-y-3.5">
             <div>
                <label className="form-label">F.I.SH</label>
                <input type="text" required value={editEmployee.fullName} onChange={(e) => setEditEmployee({...editEmployee, fullName: e.target.value})} className="input-minimal w-full" placeholder="Ism Familiya" />
             </div>
             <div>
                <label className="form-label">Telefon</label>
                <PhoneInput value={editEmployee.phone} onChange={(phone) => setEditEmployee({...editEmployee, phone})} />
             </div>
             <div>
                <label className="form-label">Lavozimi</label>
                <select required value={editEmployee.roleId} onChange={(e) => setEditEmployee({...editEmployee, roleId: e.target.value})} className="select-minimal w-full">
                   <option value="">Tanlang...</option>
                   {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
             </div>
             {branches.length > 0 && (
               <div>
                  <label className="form-label">Filial</label>
                  <select value={editEmployee.branchId} onChange={(e) => setEditEmployee({...editEmployee, branchId: e.target.value})} className="select-minimal w-full">
                     <option value="">Filial tanlanmagan</option>
                     {branches.filter(b => b.isActive).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>
             )}
             <DepartmentPicker
               departments={departments}
               value={editEmployee.departmentIds}
               onChange={(ids) => setEditEmployee({ ...editEmployee, departmentIds: ids })}
             />
             <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-card p-3">
               Login va parol bu yerda o'zgartirilmaydi. Parolni yangilash uchun qatordagi
               <RefreshCw size={12} className="inline mx-1 -mt-0.5" />
               tugmasidan foydalaning.
             </p>
             <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
               <button type="button" className="btn-outline flex-1" onClick={() => { setIsEditModalOpen(false); setEditEmployee(null); }}>Bekor qilish</button>
               <button type="submit" disabled={savingEdit} className="btn-primary flex-1">
                 {savingEdit ? 'Saqlanmoqda...' : 'Saqlash'}
               </button>
             </div>
          </form>
        )}
      </Modal>

      {/* Credentials Modal: View */}
      <Modal
        isOpen={isCredentialsModalOpen && !!selectedEmp}
        onClose={() => setIsCredentialsModalOpen(false)}
        title="Kirish ma'lumotlari"
        maxWidth="max-w-sm"
      >
          {selectedEmp && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="bg-slate-50 p-3.5 rounded-card border border-slate-200">
                <p className="t-caption mb-0.5">Xodim</p>
                <p className="font-semibold text-slate-800 text-sm">{selectedEmp.fullName}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-card border border-slate-200">
                <p className="t-caption mb-0.5">Login</p>
                <p className="font-mono font-semibold text-slate-800 text-sm select-all">{selectedEmp.login}</p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-card border border-slate-200">
                <p className="t-caption mb-0.5">Parol</p>
                <div className="relative flex items-center">
                  <input 
                    type={showSelectedPass ? "text" : "password"} 
                    readOnly 
                    value={selectedEmp.password} 
                    className="w-full font-mono font-semibold text-primary-700 bg-transparent text-sm select-all outline-none" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowSelectedPass(!showSelectedPass)}
                    className="icon-btn-sm"
                  >
                    {showSelectedPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button 
                onClick={() => handleRegeneratePassword(selectedEmp.id)}
                className="btn-outline w-full mt-2"
              >
                <RefreshCw size={16} /> Yangi parol generatsiya qilish
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
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{confirmModal.message}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmModal(null)} className="flex-1 btn-outline">Bekor qilish</button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="flex-1 btn-danger-solid"
              >
                Tasdiqlash
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Hodimlar;
