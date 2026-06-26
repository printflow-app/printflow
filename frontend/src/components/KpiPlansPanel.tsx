import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Trash2, X, Users, User, TrendingUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { kpiPlansApi } from '../api';
import { useEmployees, useRoles } from '../hooks/queries';

// =============================================
// KpiPlansPanel — KPI rejalari (maqsadlar) + bajarilish progressi.
//  - Rahbar (canManage): lavozim/xodimga target qo'yadi, rejani o'chiradi.
//  - Hamma (readOnly ham): xodimlar progressini ko'radi; o'zinikisi ajratilgan.
// Davr: joriy oy (backend hisoblaydi). Statistika va Hisobotda ishlatiladi.
// =============================================

interface MetricDef { key: string; label: string; unit: string; hint: string; }
interface Goal {
  planId: string; scope: 'role' | 'employee'; metricKey: string;
  label: string; unit: string; target: number; current: number; percent: number;
}
interface EmpProgress { employeeId: string; fullName: string; roleName: string | null; goals: Goal[]; }
interface Plan {
  id: string; scope: 'role' | 'employee'; roleId: string | null; employeeId: string | null;
  metricKey: string; targetValue: number; isActive: boolean;
}

interface Props { currentUser: any; activeBranchId?: string; readOnly?: boolean; }

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(Number(n) || 0)).replace(/,/g, ' ');

const barColor = (pct: number) =>
  pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : 'bg-rose-400';
const barTextColor = (pct: number) =>
  pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-sky-600' : 'text-rose-500';

const KpiPlansPanel: React.FC<Props> = ({ currentUser, activeBranchId, readOnly }) => {
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const canManage = !readOnly && (isAdmin || !!currentUser?.permissions?.canViewKpi);
  const qc = useQueryClient();

  const metricsQ = useQuery({
    queryKey: ['kpi-metrics'],
    queryFn: async () => (await kpiPlansApi.metrics()).data as MetricDef[],
    staleTime: 1000 * 60 * 30,
  });
  const plansQ = useQuery({
    queryKey: ['kpi-plans'],
    queryFn: async () => (await kpiPlansApi.list()).data as Plan[],
    enabled: canManage,
  });
  const progressQ = useQuery({
    queryKey: ['kpi-progress', activeBranchId || 'all'],
    queryFn: async () =>
      (await kpiPlansApi.progress({ branchId: activeBranchId || undefined })).data as {
        periodKey: string; employees: EmpProgress[];
      },
  });

  const { data: employees = [] } = useEmployees();
  const { data: roles = [] } = useRoles(activeBranchId);

  const metrics = metricsQ.data || [];
  const plans = plansQ.data || [];
  const periodKey = progressQ.data?.periodKey || '';
  const empProgress = progressQ.data?.employees || [];

  // Faqat maqsadi bor xodimlar; o'zini ustga chiqaramiz
  const visibleProgress = useMemo(() => {
    const withGoals = empProgress.filter((e) => e.goals.length > 0);
    return withGoals.sort((a, b) => {
      if (a.employeeId === currentUser?.id) return -1;
      if (b.employeeId === currentUser?.id) return 1;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [empProgress, currentUser?.id]);

  // ── Create modal ───────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    scope: 'role' as 'role' | 'employee',
    roleId: '', employeeId: '', metricKey: '', targetValue: '',
  });

  const empById = useMemo(
    () => Object.fromEntries((employees as any[]).map((e) => [e.id, e])), [employees]);
  const roleById = useMemo(
    () => Object.fromEntries((roles as any[]).map((r) => [r.id, r])), [roles]);
  const metricById = useMemo(
    () => Object.fromEntries(metrics.map((m) => [m.key, m])), [metrics]);

  const openCreate = () => {
    setForm({ scope: 'role', roleId: '', employeeId: '', metricKey: metrics[0]?.key || '', targetValue: '' });
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.metricKey) return toast.error('Metrikani tanlang');
    if (form.scope === 'role' && !form.roleId) return toast.error('Lavozimni tanlang');
    if (form.scope === 'employee' && !form.employeeId) return toast.error('Xodimni tanlang');
    const target = Number(form.targetValue);
    if (!isFinite(target) || target <= 0) return toast.error("To'g'ri target kiriting");
    setSaving(true);
    try {
      await kpiPlansApi.create({
        scope: form.scope,
        roleId: form.scope === 'role' ? form.roleId : undefined,
        employeeId: form.scope === 'employee' ? form.employeeId : undefined,
        metricKey: form.metricKey,
        targetValue: target,
        branchId: activeBranchId || undefined,
      });
      toast.success('Reja qo\'shildi');
      setShowModal(false);
      qc.invalidateQueries({ queryKey: ['kpi-plans'] });
      qc.invalidateQueries({ queryKey: ['kpi-progress'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await kpiPlansApi.delete(id);
      qc.invalidateQueries({ queryKey: ['kpi-plans'] });
      qc.invalidateQueries({ queryKey: ['kpi-progress'] });
    } catch {
      toast.error("O'chirishda xatolik");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-orange-50 to-white">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Target size={15} className="text-orange-500" /> KPI Rejalari
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Oylik maqsadlar va bajarilishi{periodKey ? ` · ${periodKey}` : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 h-9 px-3 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-sm transition-all"
          >
            <Plus size={13} strokeWidth={3} /> Reja qo'shish
          </button>
        )}
      </div>

      {/* Rahbar: mavjud rejalar (shablon/override) ro'yxati */}
      {canManage && plans.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2">
          {plans.map((p) => {
            const m = metricById[p.metricKey];
            const who = p.scope === 'role'
              ? (roleById[p.roleId || '']?.name || 'Lavozim')
              : (empById[p.employeeId || '']?.fullName || 'Xodim');
            return (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg pl-2.5 pr-1.5 py-1 text-[10px] font-bold text-slate-600"
              >
                {p.scope === 'role'
                  ? <Users size={11} className="text-orange-500" />
                  : <User size={11} className="text-sky-500" />}
                <span className="text-slate-800">{who}</span>
                <span className="text-slate-400">·</span>
                <span>{m?.label || p.metricKey}</span>
                <span className={barTextColor(50)}>{fmt(p.targetValue)} {m?.unit}</span>
                <button onClick={() => handleDelete(p.id)} className="ml-1 text-slate-300 hover:text-rose-500">
                  <Trash2 size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Progress — xodimlar bo'yicha */}
      <div className="p-4">
        {progressQ.isLoading ? (
          <div className="py-10 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">Yuklanmoqda...</div>
        ) : visibleProgress.length === 0 ? (
          <div className="py-12 text-center">
            <TrendingUp size={28} className="mx-auto text-slate-200 mb-2" />
            <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">
              {canManage ? "Hali reja yo'q — \"Reja qo'shish\" bilan boshlang" : "Sizga hali reja qo'yilmagan"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleProgress.map((emp) => {
              const isMe = emp.employeeId === currentUser?.id;
              return (
                <div
                  key={emp.employeeId}
                  className={`rounded-2xl border p-4 ${isMe ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center border ${isMe ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {emp.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 uppercase tracking-tight truncate">
                        {emp.fullName}{isMe && <span className="ml-1.5 text-[8px] text-orange-500">(siz)</span>}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase truncate">{emp.roleName || 'Xodim'}</p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    {emp.goals.map((g) => {
                      const pct = Math.min(100, g.percent);
                      return (
                        <div key={g.planId}>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-bold text-slate-600">{g.label}</span>
                            <span className="font-bold tabular-nums">
                              <span className="text-slate-800">{fmt(g.current)}</span>
                              <span className="text-slate-400"> / {fmt(g.target)} {g.unit}</span>
                              <span className={`ml-1.5 ${barTextColor(g.percent)}`}>{g.percent}%</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className={`h-full rounded-full ${barColor(g.percent)} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Target size={15} className="text-orange-500" /> Yangi KPI rejasi
              </h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {/* Scope */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Kimga</label>
                <div className="inline-flex bg-slate-100 rounded-xl p-1 w-full">
                  {(['role', 'employee'] as const).map((s) => (
                    <button
                      key={s} type="button"
                      onClick={() => setForm((f) => ({ ...f, scope: s }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${form.scope === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                    >
                      {s === 'role' ? <Users size={12} /> : <User size={12} />}
                      {s === 'role' ? 'Lavozim' : 'Xodim'}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] font-bold text-slate-400 mt-1 px-1">
                  {form.scope === 'role' ? "Lavozimdagi hamma xodimga tushadi" : "Bitta xodimga (lavozim shablonini override qiladi)"}
                </p>
              </div>

              {/* Target subyekt */}
              {form.scope === 'role' ? (
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Lavozim</label>
                  <select required value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))} className="select-minimal text-sm font-bold">
                    <option value="">— Lavozimni tanlang —</option>
                    {(roles as any[]).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Xodim</label>
                  <select required value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="select-minimal text-sm font-bold">
                    <option value="">— Xodimni tanlang —</option>
                    {(employees as any[]).map((emp) => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
                  </select>
                </div>
              )}

              {/* Metric */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Metrika</label>
                <select required value={form.metricKey} onChange={(e) => setForm((f) => ({ ...f, metricKey: e.target.value }))} className="select-minimal text-sm font-bold">
                  <option value="">— Metrikani tanlang —</option>
                  {metrics.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>)}
                </select>
                {form.metricKey && <p className="text-[8px] font-bold text-slate-400 mt-1 px-1">{metricById[form.metricKey]?.hint}</p>}
              </div>

              {/* Target */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">
                  Oylik maqsad (target){form.metricKey ? ` — ${metricById[form.metricKey]?.unit}` : ''}
                </label>
                <input type="number" min="1" step="any" required value={form.targetValue}
                  onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))}
                  placeholder="masalan 50" className="input-minimal text-sm font-bold" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline h-11 flex-1 rounded-xl font-bold uppercase text-[9px] tracking-widest">Bekor</button>
                <button type="submit" disabled={saving} className="h-11 flex-1 rounded-xl font-bold uppercase text-[9px] tracking-widest bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white shadow-md transition-all">
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KpiPlansPanel;
