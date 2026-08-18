import React, { useState } from 'react';
import { Trash2, UserPlus, Eye, EyeOff, RefreshCw, ShieldCheck, Building2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { employeesApi } from '../api';
import { useEmployees, useRoles, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { SkeletonTable } from '../components/Skeleton';
const FiliallarPage = React.lazy(() => import('./Filiallar'));
const Admins: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.role?.name?.toLowerCase() === 'superadmin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};

  // RQ — cache'lanadi
  const { data: rawEmployees = [], isLoading: empLoading } = useEmployees();
  const { data: rawRoles = [], isLoading: roleLoading } = useRoles(activeBranchId);
  const invalidate = useInvalidate();
  const isLoading = empLoading || roleLoading;

  // Derived: filter admin/owner roles + matching employees
  const roles = (rawRoles as any[]).filter((r: any) => {
    const roleName = r.name.toLowerCase();
    return roleName === 'admin' || roleName === 'superadmin' || roleName === 'rahbar' || roleName === 'owner';
  });
  const adminRoleIds = roles.map((r: any) => r.id);
  const employees = (rawEmployees as any[]).filter((emp: any) => {
    const empRoleName = emp.role?.name?.toLowerCase() || '';
    return adminRoleIds.includes(emp.roleId) ||
           emp.login === 'admin' ||
           empRoleName === 'admin' ||
           empRoleName === 'superadmin';
  });

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'admins' | 'branches'>('admins');

  // Employee Form
  const [newEmployee, setNewEmployee] = useState<any>({
    fullName: '', phone: '', roleId: '', baseSalary: ''
  });
  const [generatedCredentials, setGeneratedCredentials] = useState<{login: string, password: string} | null>(null);
  const [showGenPass, setShowGenPass] = useState(false);
  const [showSelectedPass, setShowSelectedPass] = useState(false);

  // fetchData() shim — RQ invalidate orqali avtomatik refetch
  const fetchData = async (_silent = false) => {
    invalidate.employees();
    invalidate.roles();
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await employeesApi.create({ ...newEmployee, baseSalary: Number(newEmployee.baseSalary) || 0 });
      // Modal OCHIQ qoladi — generatedCredentials o'rnatilgach, modal kontenti
      // login/parol ko'rsatish ekraniga almashadi. Modalni yopib yubormaymiz!
      setGeneratedCredentials({ login: res.data.login, password: res.data.password });
      setNewEmployee({ fullName: '', phone: '', roleId: '', baseSalary: '' });
      fetchData(true);
      toast.success("Admin muvaffaqiyatli qo'shildi!");
    } catch (err) {
      toast.error("Admin qo'shishda xatolik yuz berdi.");
    }
  };

  const handleCloseModal = () => {
    setIsEmployeeModalOpen(false);
    setGeneratedCredentials(null);
    setShowGenPass(false);
  };

  const handleDeleteEmployee = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Adminni o'chirish",
      message: "Ushbu foydalanuvchini tizimdan butunlay o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await employeesApi.delete(id);
          fetchData(true);
          toast.success("Foydalanuvchi tizimdan o'chirildi.");
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
      message: "Ushbu foydalanuvchi uchun yangi parol generatsiya qilinsinmi?",
      onConfirm: async () => {
        try {
          const res = await employeesApi.update(id, { password: Math.floor(100000 + Math.random() * 900000).toString() });
          fetchData(true);
          setSelectedEmp(res.data);
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

  if (isLoading) return <SkeletonTable rows={4} cols={4} />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative">
      {/* Tab switcher */}
      <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-card border border-slate-200/50 max-w-full overflow-x-auto no-scrollbar">
        {[
          { id: 'admins', label: "Ma'murlar", icon: ShieldCheck },
          { id: 'branches', label: 'Filiallar', icon: Building2 },
        ].map(tab => (
          <button
            key={tab.id}
            data-tour-id={`admin-tab-${tab.id}`}
            onClick={() => setActiveAdminTab(tab.id as any)}
            className={`inline-flex items-center gap-2 px-4 py-2 h-[34px] rounded-control text-sm font-medium transition-all duration-120 whitespace-nowrap ${
              activeAdminTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <tab.icon size={16} className={activeAdminTab === tab.id ? 'text-orange-600' : 'text-slate-500'} /> {tab.label}
          </button>
        ))}
      </div>

      {activeAdminTab === 'branches' && (
        <React.Suspense fallback={<LoadingSpinner />}>
          <FiliallarPage currentUser={currentUser} />
        </React.Suspense>
      )}

      {activeAdminTab === 'admins' && <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="bg-white p-4 sm:p-5 rounded-card border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h3 className="card-title flex items-center gap-2">
              <ShieldCheck className="text-[color:var(--primary)]" size={20} /> Tizim Ma'murlari
            </h3>
            <p className="t-caption mt-0.5">Asoschilar va raxbarlar uchun maxsus saxifa</p>
          </div>
          {(isAdmin || p.canManageAdmins) && (
             <button className="btn-primary w-full sm:w-auto" onClick={() => { setGeneratedCredentials(null); setShowGenPass(false); setIsEmployeeModalOpen(true); }}>
               <UserPlus size={16} /> Yangi Ma'mur Qo'shish
             </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-minimal">
               <thead>
                <tr>
                  <th>F.I.SH & Aloqa</th>
                  <th className="hidden md:table-cell">Lavozimi</th>
                  <th>Login</th>
                  <th className="text-right">Harakat</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="group">
                    <td>
                      <p className="font-semibold text-slate-800 lowercase first-letter:uppercase">{emp.fullName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{emp.phone}</p>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="badge-primary">
                        {emp.role?.name || '—'}
                      </span>
                    </td>
                    <td className="font-mono text-slate-600">
                      <div className="flex items-center gap-1.5">
                        {emp.login}
                        {isAdmin && (
                          <button onClick={() => openCredentialsModal(emp)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Ma'lumotlarni ko'rish">
                            <Eye size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <button onClick={() => handleRegeneratePassword(emp.id)} className="w-8 h-8 rounded-control text-slate-500 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center transition-colors" title="Parolni yangilash">
                            <RefreshCw size={12} />
                          </button>
                        )}
                        {(isAdmin || p.canManageAdmins) && (
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            disabled={emp.login === 'admin'}
                            className={`w-8 h-8 rounded-control flex items-center justify-center transition-colors ${
                              emp.login === 'admin'
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
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
      </div>}

      {/* Admin Modal: Create */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={handleCloseModal}
        title={generatedCredentials ? "Muvaffaqiyatli saqlandi!" : "Yangi Ma'mur Qo'shish"}
        maxWidth="max-w-md"
      >
          {generatedCredentials ? (
            <div className="space-y-6 text-center animate-fade-in">
               <div className="w-16 h-16 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-card mx-auto mb-4">
                  <UserPlus size={20} />
               </div>
               <p className="t-body text-slate-600 mb-6">Ma'mur tizimga kirishi uchun quyidagi ma'lumotlarni siri saqlagan holda unga taqdim eting:</p>
               <div className="bg-slate-50 p-5 rounded-card border border-slate-200 text-left space-y-4">
                  <div>
                     <p className="label-caps mb-1">Login</p>
                     <p className="font-mono text-base font-semibold text-slate-800 bg-white p-2 rounded-control border border-slate-200 select-all">{generatedCredentials.login}</p>
                  </div>
                  <div>
                     <p className="label-caps mb-1">Parol</p>
                     <div className="relative">
                        <input
                           type={showGenPass ? "text" : "password"}
                           readOnly
                           value={generatedCredentials.password}
                           className="w-full font-mono text-base font-semibold text-[color:var(--primary)] bg-white p-2 pr-12 rounded-control border border-slate-200 select-all outline-none"
                        />
                        <button
                           type="button"
                           onClick={() => setShowGenPass(!showGenPass)}
                           className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn-sm"
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
                  <input type="text" value={newEmployee.phone} onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})} className="input-minimal w-full" placeholder="+998 90 123 45 67" />
               </div>
               <div>
                  <label className="form-label">Lavozimi</label>
                  <select required value={newEmployee.roleId} onChange={(e) => setNewEmployee({...newEmployee, roleId: e.target.value})} className="select-minimal w-full">
                     <option value="">Tanlang...</option>
                     {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
               </div>
               <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                 <button type="button" className="btn-outline flex-1" onClick={handleCloseModal}>Bekor qilish</button>
                 <button type="submit" className="btn-primary flex-1">Saqlash</button>
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
                <p className="t-caption mb-0.5">Foydalanuvchi</p>
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
                    className="w-full font-mono font-semibold text-[color:var(--primary)] bg-transparent text-sm select-all outline-none"
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
            <p className="t-body">{confirmModal.message}</p>
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

export default Admins;
