import React, { useState } from 'react';
import {
  Building2, Plus, Trash2, Edit3, Phone, MapPin, Save, X, AlertTriangle,
  ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import { branchesApi, billingApi, departmentsApi } from '../api';
import { useBranches, useEmployees, useInvalidate } from '../hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { SkeletonCardGrid } from '../components/Skeleton';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';

// =============================================
// Per-branch Department management.
// Departments are a lightweight analytical tag for Tasks/Transactions only.
// Scoped to a single Branch (branchId required). Deletion sets task/transaction
// departmentId to NULL via Prisma onDelete: SetNull — tag is lost, data is not.
// =============================================
interface Department { id: string; name: string; branchId: string }

const BranchDepartments: React.FC<{ branchId: string; canManage: boolean }> = ({ branchId, canManage }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Department[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDel, setConfirmDel] = useState<Department | null>(null);

  // Lazy-load — only fetch when user opens the panel. Saves N API calls on page mount.
  const fetchItems = async () => {
    setLoading(true);
    try {
      const r = await departmentsApi.findAll(branchId);
      setItems(Array.isArray(r.data) ? r.data : []);
      setLoaded(true);
    } catch {
      toast.error("Bo'limlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) fetchItems();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await departmentsApi.create({ name, branchId });
      setNewName('');
      await fetchItems();
      toast.success("Bo'lim qo'shildi");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Bo'lim qo'shilmadi");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (d: Department) => { setEditingId(d.id); setEditName(d.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); };

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await departmentsApi.update(id, { name }, branchId);
      cancelEdit();
      await fetchItems();
      toast.success("Bo'lim yangilandi");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Yangilab bo'lmadi");
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await departmentsApi.remove(confirmDel.id, branchId);
      setConfirmDel(null);
      await fetchItems();
      toast.success("Bo'lim o'chirildi");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "O'chirib bo'lmadi");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Layers size={12} />
          Bo'limlar {loaded && <span className="text-slate-400 normal-case tracking-normal font-bold">({items.length})</span>}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading && <p className="text-xs text-slate-400">Yuklanmoqda...</p>}

          {loaded && items.length === 0 && !loading && (
            <p className="text-xs text-slate-400 italic">Bo'lim qo'shilmagan</p>
          )}

          {items.map((d) => (
            <div key={d.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
              {editingId === d.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(d.id); if (e.key === 'Escape') cancelEdit(); }}
                    autoFocus
                    className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  />
                  <button onClick={() => handleSaveEdit(d.id)} className="w-7 h-7 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center"><Save size={12} /></button>
                  <button onClick={cancelEdit} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"><X size={12} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs font-bold text-slate-700">{d.name}</span>
                  {canManage && (
                    <>
                      <button onClick={() => startEdit(d)} className="w-7 h-7 rounded-md hover:bg-slate-200 text-slate-500 flex items-center justify-center"><Edit3 size={12} /></button>
                      <button onClick={() => setConfirmDel(d)} className="w-7 h-7 rounded-md hover:bg-rose-100 text-rose-500 flex items-center justify-center"><Trash2 size={12} /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}

          {canManage && (
            <form onSubmit={handleCreate} className="flex gap-2 pt-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Yangi bo'lim..."
                disabled={creating}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="h-8 px-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-1"
              >
                <Plus size={12} /> Qo'shish
              </button>
            </form>
          )}
        </div>
      )}

      {confirmDel && (
        <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Bo'limni o'chirish" type="danger">
          <div className="space-y-4">
            <p className="text-sm font-bold text-slate-600">
              <strong className="text-slate-900">{confirmDel.name}</strong> bo'limi o'chirilsinmi?
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bu bo'limga biriktirilgan buyurtmalar va tranzaksiyalar yo'qolmaydi — faqat bo'lim tegi olib tashlanadi. Hisobotlarda ular "Bo'limsiz" deb ko'rinadi.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="flex-1 h-11 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest">Bekor</button>
              <button onClick={handleDelete} className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold uppercase text-xs tracking-widest">Ha, o'chirilsin</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

interface Branch {
  id: string; name: string; address?: string; phone?: string;
  managerEmployeeId?: string; isActive: boolean; createdAt: string; updatedAt: string;
  _count?: { employees: number; tasks: number };
}

// ─── FILIALLAR TAB ───────────────────────────────────────────────────────────
const FiliallarTab: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin   = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canManage = isAdmin || currentUser?.permissions?.canManageBranches;

  // React Query — cached, deduped, auto-refetch on invalidation.
  // Tab almashganda qaytadan API chaqirilmaydi — instant.
  const { data: branchesData = [], isLoading: branchesLoading } = useBranches();
  const branches = branchesData as Branch[];
  const { data: employees = [] } = useEmployees();
  const { data: billingStatus } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: async () => (await billingApi.getStatus()).data,
    staleTime: 60_000,
  });
  const maxBranches = (billingStatus as any)?.plan?.maxBranches ?? 0;
  const invalidate = useInvalidate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', managerEmployeeId: '' });
  const [confirmDel, setConfirmDel] = useState<Branch | null>(null);

  const openCreate = () => { setEditing(null); setForm({ name: '', address: '', phone: '', managerEmployeeId: '' }); setModalOpen(true); };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, address: b.address || '', phone: b.phone || '', managerEmployeeId: b.managerEmployeeId || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Filial nomi kiritilishi shart'); return; }
    try {
      const payload = { name: form.name.trim(), address: form.address.trim() || undefined, phone: form.phone.trim() || undefined, managerEmployeeId: form.managerEmployeeId || undefined };
      if (editing) { await branchesApi.update(editing.id, payload); toast.success('Filial yangilandi'); }
      else { await branchesApi.create(payload); toast.success("Filial qo'shildi"); }
      setModalOpen(false);
      invalidate.branches(); // RQ re-fetches branches, UI updates automatically
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Xatolik yuz berdi'); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    try {
      await branchesApi.delete(confirmDel.id);
      toast.success("Filial o'chirildi");
      setConfirmDel(null);
      invalidate.branches();
    } catch (err: any) { toast.error(err?.response?.data?.message || "O'chirishda xato"); }
  };

  if (branchesLoading) return <SkeletonCardGrid count={3} />;

  // Total = real branches only (synthetic main office removed)
  const totalCount = branches.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {maxBranches > 0 && (
          <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${branches.length >= maxBranches ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'}`}>
            {totalCount} / {maxBranches + 1 /* +1 = main branch */} filial
          </span>
        )}
        {!maxBranches && <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500">{totalCount} ta filial</span>}
        {canManage && (() => {
          const atLimit = maxBranches > 0 && branches.length >= maxBranches;
          return (
            <button
              data-tour-id="filial-add"
              disabled={atLimit}
              onClick={() => !atLimit && openCreate()}
              className={`btn-primary h-control ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={atLimit ? `Limit to'ldi: ${maxBranches} ta qo'shimcha filial` : ''}
            >
              <Plus size={15} strokeWidth={2.5} />
              {atLimit ? `Limit to'ldi (${branches.length}/${maxBranches})` : 'Yangi filial'}
            </button>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {branches.map((b) => {
          const manager = employees.find((e) => e.id === b.managerEmployeeId);
          return (
            <div key={b.id} className="bg-white rounded-card border border-slate-200 p-4 transition-all hover:border-orange-200">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-control bg-orange-50 text-[color:var(--primary)] border border-orange-100 flex items-center justify-center"><Building2 size={18} /></div>
                {canManage && (() => {
                  const isLast = branches.length <= 1;
                  const delTitle = isLast ? "Oxirgi filial o'chirilmaydi" : "O'chirish";
                  return (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(b)} className="icon-btn-sm" title="Tahrirlash"><Edit3 size={13} /></button>
                      <button
                        onClick={() => !isLast && setConfirmDel(b)}
                        disabled={isLast}
                        title={delTitle}
                        className={`icon-btn-sm ${isLast ? 'text-slate-200 cursor-not-allowed' : 'hover:text-rose-600'}`}
                      ><Trash2 size={13} /></button>
                    </div>
                  );
                })()}
              </div>
              <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-1">{b.name}</h3>
              {b.address && <p className="t-caption text-slate-500 flex items-center gap-1.5 mb-1"><MapPin size={12} /> {b.address}</p>}
              {b.phone && <p className="t-caption text-slate-500 flex items-center gap-1.5 mb-1 tabular-nums"><Phone size={12} /> {b.phone}</p>}
              {manager && <p className="t-caption text-slate-600 mt-2 pt-2 border-t border-slate-100">Mas'ul: <span className="text-slate-800 font-semibold">{manager.fullName}</span></p>}
              <BranchDepartments branchId={b.id} canManage={canManage} />
            </div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Filialni tahrirlash' : 'Yangi filial'} maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="form-label">Filial nomi *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-minimal w-full" placeholder="Toshkent filiali" />
          </div>
          <div>
            <label className="form-label">Manzil</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-minimal w-full" placeholder="Chilonzor, 5-mavze" />
          </div>
          <div>
            <label className="form-label">Telefon</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-minimal w-full" placeholder="+998 90 123 45 67" />
          </div>
          <div>
            <label className="form-label">Mas'ul xodim</label>
            <select value={form.managerEmployeeId} onChange={(e) => setForm({ ...form, managerEmployeeId: e.target.value })} className="select-minimal w-full">
              <option value="">Tanlanmagan</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>
          <div className="flex gap-2.5 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-outline flex-1">Bekor qilish</button>
            <button type="submit" className="btn-primary flex-1">{editing ? 'Yangilash' : 'Yaratish'}</button>
          </div>
        </form>
      </Modal>

      {confirmDel && (() => {
        const empCount = confirmDel._count?.employees ?? 0;
        const taskCount = confirmDel._count?.tasks ?? 0;
        const hasData = empCount + taskCount > 0;
        return (
          <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Filialni o'chirish" type="danger">
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                <strong className="text-rose-700">{confirmDel.name}</strong> filiali butunlay o'chirilsinmi?
              </p>

              {hasData && (
                <div className="bg-rose-50 border border-rose-200 rounded-card p-3 space-y-2">
                  <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5"><AlertTriangle size={13} strokeWidth={2.5}/> Bu filialda mavjud:</p>
                  <ul className="text-xs text-rose-800 space-y-1 list-disc pl-4">
                    {empCount > 0 && <li>{empCount} ta xodim</li>}
                    {taskCount > 0 && <li>{taskCount} ta buyurtma</li>}
                  </ul>
                  <p className="t-caption text-rose-600 leading-relaxed pt-1">
                    Xodimlar va buyurtmalar yo'qolmaydi — faqat filial tegidan ajratiladi.
                  </p>
                </div>
              )}

              <div className="flex gap-2.5">
                <button onClick={() => setConfirmDel(null)} className="btn-outline flex-1">Bekor qilish</button>
                <button onClick={handleDelete} className="btn-danger-solid flex-1">Ha, o'chirilsin</button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};

const Filiallar: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  return (
    <div className="space-y-5 pb-20">
      <div className="bg-white p-4 sm:p-5 rounded-card border border-slate-200">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Building2 className="text-[color:var(--primary)]" size={20} /> Filiallar
        </h2>
        <p className="t-caption mt-0.5">Multi-filial boshqaruvi</p>
      </div>
      <FiliallarTab currentUser={currentUser} />
    </div>
  );
};

export default Filiallar;
