import React, { useState, useEffect } from 'react';
import { Trash2, UserPlus, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { employeesApi, rolesApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
const Admins: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.role?.name?.toLowerCase() === 'superadmin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};

  const [roles, setRoles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);

  // Employee Form
  const [newEmployee, setNewEmployee] = useState<any>({
    fullName: '', phone: '', roleId: '', baseSalary: ''
  });
  const [generatedCredentials, setGeneratedCredentials] = useState<{login: string, password: string} | null>(null);
  const [showGenPass, setShowGenPass] = useState(false);
  const [showSelectedPass, setShowSelectedPass] = useState(false);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [empRes, roleRes] = await Promise.all([
        employeesApi.findAll(),
        rolesApi.findAll()
      ]);
      
      // Filter for Admins/Owners
      const adminRoles = roleRes.data?.filter((r: any) => {
        const roleName = r.name.toLowerCase();
        return roleName === 'admin' || roleName === 'superadmin' || roleName === 'rahbar' || roleName === 'owner';
      }) || [];
      const adminRoleIds = adminRoles.map((r: any) => r.id);

      const adminsList = empRes.data?.filter((emp: any) => {
        const empRoleName = emp.role?.name?.toLowerCase() || '';
        return adminRoleIds.includes(emp.roleId) || 
               emp.login === 'admin' || 
               empRoleName === 'admin' || 
               empRoleName === 'superadmin';
      }) || [];

      setEmployees(adminsList);
      setRoles(adminRoles);
    } catch (err) {
      console.error("Xatolik:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await employeesApi.create({ ...newEmployee, baseSalary: Number(newEmployee.baseSalary) || 0 });
      setGeneratedCredentials({ login: res.data.login, password: res.data.password });
      setNewEmployee({ fullName: '', phone: '', roleId: '', baseSalary: '' });
      fetchData(true);
      toast.success("Admin muvaffaqiyatli qo'shildi!");
      setIsEmployeeModalOpen(false);
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

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 animate-fade-in relative">
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-orange-600" size={24} /> Tizim Ma'murlari
            </h3>
            <p className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-widest">Asoschilar va raxbarlar uchun maxsus saxifa</p>
          </div>
          {(isAdmin || p.canManageAdmins) && (
             <button className="flex items-center gap-2 h-10 px-8 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all hover:-translate-y-0.5" onClick={() => setIsEmployeeModalOpen(true)}>
               <UserPlus size={16} strokeWidth={2.5} /> Yangi Ma'mur Qo'shish
             </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-100">
                  <th className="text-[9px] uppercase tracking-widest font-black text-slate-400 py-3 px-5">F.I.SH & Aloqa</th>
                  <th className="text-[9px] uppercase tracking-widest font-black text-slate-400 px-5">Lavozimi</th>
                  <th className="text-[9px] uppercase tracking-widest font-black text-slate-400 px-5">Login</th>
                  <th className="text-[9px] uppercase tracking-widest font-black text-slate-400 text-right pr-6 px-5">Harakat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="py-3 px-5">
                      <p className="font-black text-slate-800 text-xs lowercase first-letter:uppercase tracking-tight">{emp.fullName}</p>
                      <p className="text-[10px] font-bold text-sky-500 mt-0.5">{emp.phone}</p>
                    </td>
                    <td className="px-5">
                      <span className="bg-orange-50 text-orange-700 text-[9px] font-black px-2 py-1 rounded-lg border border-orange-100 uppercase tracking-tight">
                        {emp.role?.name || '—'}
                      </span>
                    </td>
                    <td className="px-5 font-mono font-bold text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        {emp.login}
                        {isAdmin && (
                          <button onClick={() => openCredentialsModal(emp)} className="text-slate-300 hover:text-sky-500 transition-colors p-1" title="Ma'lumotlarni ko'rish">
                            <Eye size={12} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-right pr-6">
                      <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <button onClick={() => handleRegeneratePassword(emp.id)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 flex items-center justify-center border border-transparent hover:border-amber-100 shadow-sm" title="Parolni yangilash">
                            <RefreshCw size={12} strokeWidth={3} />
                          </button>
                        )}
                        {(isAdmin || p.canManageAdmins) && (
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

      {/* Admin Modal: Create */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={handleCloseModal}
        title={generatedCredentials ? "Muvaffaqiyatli saqlandi!" : "Yangi Ma'mur Qo'shish"}
        maxWidth="max-w-md"
      >
          {generatedCredentials ? (
            <div className="space-y-6 text-center animate-fade-in">
               <div className="w-16 h-16 bg-emerald-100 text-emerald-500 flex items-center justify-center rounded-2xl mx-auto mb-4">
                  <UserPlus size={32} />
               </div>
               <p className="text-sm font-bold text-slate-600 mb-6">Ma'mur tizimga kirishi uchun quyidagi ma'lumotlarni siri saqlagan holda unga taqdim eting:</p>
               <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-left space-y-4">
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Login</p>
                     <p className="font-mono text-lg font-black text-slate-800 bg-white p-2 rounded-lg border border-slate-200 select-all tracking-wider">{generatedCredentials.login}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Parol</p>
                     <div className="relative">
                        <input 
                           type={showGenPass ? "text" : "password"} 
                           readOnly 
                           value={generatedCredentials.password} 
                           className="w-full font-mono text-lg font-black text-orange-600 bg-white p-2 pr-12 rounded-lg border border-slate-200 select-all tracking-wider outline-none" 
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
                  <button type="button" className="btn-primary w-full h-12 font-black tracking-widest uppercase bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 rounded-xl" onClick={handleCloseModal}>Tushunarli, Yopish</button>
               </div>
            </div>
          ) : (
            <form onSubmit={handleAddEmployee} className="space-y-5">
               <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">F.I.SH</label>
                  <input type="text" required value={newEmployee.fullName} onChange={(e) => setNewEmployee({...newEmployee, fullName: e.target.value})} className="input-minimal w-full" placeholder="Ism Familiya" />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Telefon</label>
                  <input type="text" value={newEmployee.phone} onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})} className="input-minimal w-full" placeholder="+998 90 123 45 67" />
               </div>
               <div>
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Lavozimi</label>
                  <select required value={newEmployee.roleId} onChange={(e) => setNewEmployee({...newEmployee, roleId: e.target.value})} className="select-minimal font-black w-full">
                     <option value="">Tanlang...</option>
                     {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
               </div>
               <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                 <button type="button" className="btn-outline h-12 px-6 flex-1 rounded-xl text-xs font-black uppercase" onClick={handleCloseModal}>Bekor qilish</button>
                 <button type="submit" className="btn-primary h-12 px-10 font-black flex-1 rounded-xl text-xs uppercase shadow-lg shadow-orange-500/20 bg-orange-500 text-white hover:bg-orange-600">SAQLASH</button>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Foydalanuvchi</p>
                <p className="font-bold text-slate-800">{selectedEmp.fullName}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Login</p>
                <p className="font-mono font-black text-slate-800 select-all tracking-wider">{selectedEmp.login}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Parol</p>
                <div className="relative">
                  <input 
                    type={showSelectedPass ? "text" : "password"} 
                    readOnly 
                    value={selectedEmp.password} 
                    className="w-full font-mono font-black text-orange-600 bg-transparent select-all tracking-wider outline-none" 
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
                className="btn-outline w-full mt-6 h-12 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl"
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

export default Admins;
