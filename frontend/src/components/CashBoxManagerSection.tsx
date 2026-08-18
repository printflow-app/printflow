import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Plus, Trash2, Edit3, User } from 'lucide-react';
import { cashBoxApi } from '../api';
import { useEmployees } from '../hooks/queries';
import { Badge, EmptyState } from './ui';

const fmt = (n: number) =>
  new Intl.NumberFormat('uz-UZ').format(n || 0).replace(/,/g, ' ') + ' UZS';

// =============================================
// Kassalar boshqaruvi — Sozlamalar sahifasidagi seksiya.
// Kassa yaratish/tahrirlash/o'chirish + mas'ul xodimga biriktirish + balans.
// (Kassa sahifasida ham tez "Yangi kassa" bor; bu yer to'liq boshqaruv uchun.)
// =============================================
export const CashBoxManagerSection: React.FC<{
  activeBranchId?: string;
  onStatus: (type: 'success' | 'error', text: string) => void;
  onConfirm: (opts: { title: string; message: string; onConfirm: () => void | Promise<void> }) => void;
}> = ({ activeBranchId, onStatus, onConfirm }) => {
  const { data: employees = [] } = useEmployees();
  const boxesQuery = useQuery({
    queryKey: ['cashboxes-manage', activeBranchId],
    queryFn: async () => (await cashBoxApi.list(activeBranchId)).data,
  });
  const boxes: any[] = boxesQuery.data || [];

  const [name, setName] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  const employeeName = (id: string | null) =>
    (employees as any[]).find((e: any) => e.id === id)?.fullName || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await cashBoxApi.create({
        name: name.trim(),
        type: 'personal',
        branchId: activeBranchId || null,
        assignedUserId: assignedUserId || null,
      });
      setName('');
      setAssignedUserId('');
      onStatus('success', 'Kassa yaratildi');
      boxesQuery.refetch();
    } catch (err: any) {
      onStatus('error', err?.response?.data?.message || 'Kassa yaratishda xatolik');
    }
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditAssignee(b.assignedUserId || '');
  };

  const saveEdit = async (id: string) => {
    try {
      await cashBoxApi.update(id, { name: editName, assignedUserId: editAssignee || null });
      setEditingId(null);
      onStatus('success', 'Saqlandi');
      boxesQuery.refetch();
    } catch (err: any) {
      onStatus('error', err?.response?.data?.message || 'Saqlashda xatolik');
    }
  };

  const handleDelete = (b: any) => {
    onConfirm({
      title: "Kassani o'chirish",
      message: `"${b.name}" kassasi o'chirilsinmi?`,
      onConfirm: async () => {
        try {
          await cashBoxApi.remove(b.id);
          onStatus('success', "Kassa o'chirildi");
          boxesQuery.refetch();
        } catch (err: any) {
          onStatus('error', err?.response?.data?.message || "O'chirishda xatolik");
        }
      },
    });
  };

  return (
    <section className="space-y-4">
      <div className="bg-white p-4 rounded-card border border-slate-200">
        <h3 className="t-h2 flex items-center gap-2">
          <Wallet className="text-emerald-600" size={20} /> Kassalar
        </h3>
        <p className="t-caption mt-1">
          Kassir / moliyachi kassalari, mas'ul xodim va balans
        </p>
      </div>

      <div className="bg-white rounded-card border border-slate-200 p-4 sm:p-6">
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row flex-wrap gap-2 mb-5 pb-5 border-b border-slate-100">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-minimal flex-1 md:min-w-[220px]"
            placeholder="Kassa nomi (Kassir kassasi, Moliyachi kassasi...)"
          />
          <select
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            className="select-minimal md:w-64"
          >
            <option value="">Mas'ulsiz</option>
            {(employees as any[]).map((e: any) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            <Plus size={16} /> QO'SHISH
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {boxes.map((b: any) => {
            const editing = editingId === b.id;
            return (
              <div
                key={b.id}
                className={`group p-4 rounded-card border transition-colors duration-120 ${editing ? 'bg-primary-50 border-primary-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-minimal"
                    />
                    <select
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      className="select-minimal"
                    >
                      <option value="">Mas'ulsiz</option>
                      {(employees as any[]).map((e: any) => (
                        <option key={e.id} value={e.id}>{e.fullName}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(b.id)} className="btn-primary h-sm flex-1">SAQLASH</button>
                      <button onClick={() => setEditingId(null)} className="btn-outline h-sm flex-1">BEKOR</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="t-h3 truncate">{b.name}</span>
                          {b.type === 'main' && (
                            <Badge variant="neutral" showDot={false}>asosiy</Badge>
                          )}
                        </div>
                        <p className="t-caption mt-1 flex items-center gap-1">
                          <User size={12} /> {b.assignedUserName || employeeName(b.assignedUserId) || "Mas'ulsiz"}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-120">
                        <button onClick={() => startEdit(b)} className="icon-btn-sm hover:text-emerald-600 hover:bg-emerald-50">
                          <Edit3 size={16} />
                        </button>
                        {b.type !== 'main' && (
                          <button onClick={() => handleDelete(b)} className="icon-btn-sm hover:text-rose-600 hover:bg-rose-50">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`mt-3 text-base font-semibold tabular-nums ${(b.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(b.balance || 0)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {boxes.length === 0 && (
            <div className="col-span-full">
              <EmptyState icon={Wallet} title="Hozircha kassalar yo'q" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CashBoxManagerSection;
