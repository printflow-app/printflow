import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Plus, Trash2, Edit3, User } from 'lucide-react';
import { cashBoxApi } from '../api';
import { useEmployees } from '../hooks/queries';

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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Wallet className="text-emerald-500" size={24} /> Kassalar
        </h3>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
          Kassir / moliyachi kassalari, mas'ul xodim va balans
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm">
        <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-3 mb-6 pb-6 border-b border-slate-100">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 h-12 text-base font-bold bg-slate-50 border-2 border-slate-50 rounded-xl px-5 outline-none focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-300 shadow-inner"
            placeholder="Kassa nomi (Kassir kassasi, Moliyachi kassasi...)"
          />
          <select
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)}
            className="h-12 md:w-64 bg-slate-50 border-2 border-slate-50 rounded-xl px-4 outline-none focus:bg-white focus:border-emerald-500 text-sm font-bold text-slate-600"
          >
            <option value="">Mas'ulsiz</option>
            {(employees as any[]).map((e: any) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>
          <button
            type="submit"
            className="h-12 px-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-[0.1em] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} /> QO'SHISH
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxes.map((b: any) => {
            const editing = editingId === b.id;
            return (
              <div
                key={b.id}
                className={`p-5 rounded-2xl border-2 transition-all group ${editing ? 'bg-white border-emerald-500 shadow-lg' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-emerald-200 hover:shadow-md'}`}
              >
                {editing ? (
                  <div className="flex flex-col gap-2.5">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full h-10 text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-emerald-500"
                    />
                    <select
                      value={editAssignee}
                      onChange={(e) => setEditAssignee(e.target.value)}
                      className="w-full h-10 text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-emerald-500"
                    >
                      <option value="">Mas'ulsiz</option>
                      {(employees as any[]).map((e: any) => (
                        <option key={e.id} value={e.id}>{e.fullName}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(b.id)} className="flex-1 h-8 bg-emerald-500 text-white text-[10px] font-bold rounded-md hover:bg-emerald-600">SAQLASH</button>
                      <button onClick={() => setEditingId(null)} className="flex-1 h-8 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md hover:bg-slate-200">BEKOR</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-800 truncate">{b.name}</span>
                          {b.type === 'main' && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">asosiy</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <User size={11} /> {b.assignedUserName || employeeName(b.assignedUserId) || "Mas'ulsiz"}
                        </p>
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => startEdit(b)} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 border border-slate-100 flex items-center justify-center">
                          <Edit3 size={14} />
                        </button>
                        {b.type !== 'main' && (
                          <button onClick={() => handleDelete(b)} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`mt-3 text-lg font-bold tabular-nums ${(b.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmt(b.balance || 0)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {boxes.length === 0 && (
            <div className="col-span-full py-16 text-center border-4 border-dashed border-slate-100 rounded-[2rem]">
              <Wallet size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">Hozircha kassalar yo'q</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CashBoxManagerSection;
