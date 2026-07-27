import { useState } from 'react';
import {
  Plus, X, Trash2, Calendar, AlertCircle, Pencil, CheckCircle2, Circle, Clock,
  Layers, FileText, GripVertical, Check
} from 'lucide-react';
import { taskManagerApi } from '../api';
import { useTaskFunnels, useInvalidate } from '../hooks/queries';
import { useUI } from '../ui';

// =============================================
// TaskManager — Kanban uslubdagi varonkalar.
// Frontend Topshiriqlar Kanban'iga o'xshash: varonkalar = ustunlar, ichida
// tasklar — drag-drop bilan boshqa varonkaga ko'chiriladi.
// =============================================

type Funnel = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  tasks: TaskItem[];
};

type TaskItem = {
  id: string;
  funnelId: string;
  title: string;
  description: string | null;
  deadlineAt: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
};

// Voronka yorliqlari — tizim palitrasidan (brand orange + semantik +
// neytral tonlar). Tashqi hue (ko'k/binafsha/pushti) ishlatilmaydi.
const FUNNEL_COLORS = ['#f97316', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#fb923c', '#34d399', '#0f172a'];
const STATUS_OPTIONS: { value: string; label: string; icon: any; color: string; bg: string }[] = [
  { value: 'open',        label: 'Yangi',      icon: Circle,       color: '#64748b', bg: 'bg-slate-100 text-slate-700 border-[color:var(--border)]' },
  { value: 'in_progress', label: 'Jarayonda',  icon: Clock,        color: '#f97316', bg: 'bg-orange-50 text-orange-700 border-orange-100' },
  { value: 'done',        label: 'Bajarildi',  icon: CheckCircle2, color: '#10b981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
];

function formatDeadline(d: string | null): { text: string; tone: 'danger' | 'warning' | 'muted' } {
  if (!d) return { text: "Muddat yo'q", tone: 'muted' };
  const date = new Date(d);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const text = date.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
  if (diffDays < 0)  return { text: `${text} (${Math.abs(diffDays)} kun kechikdi)`, tone: 'danger' };
  if (diffDays === 0) return { text: `${text} (bugun)`, tone: 'warning' };
  if (diffDays <= 2) return { text: `${text} (${diffDays} kun qoldi)`, tone: 'warning' };
  return { text, tone: 'muted' };
}

export default function TaskManager() {
  const { toast, confirm } = useUI();
  const { data: funnels = [] as Funnel[] } = useTaskFunnels() as { data: Funnel[] };
  const invalidate = useInvalidate();

  const [showFunnelModal, setShowFunnelModal] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);
  const [funnelForm, setFunnelForm] = useState<{ name: string; color: string }>({ name: '', color: FUNNEL_COLORS[0] });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [createTaskFunnelId, setCreateTaskFunnelId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{ title: string; description: string; deadlineAt: string; status: string }>({
    title: '', description: '', deadlineAt: '', status: 'open',
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Drag-drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverFunnelId, setDragOverFunnelId] = useState<string | null>(null);

  const load = () => invalidate.taskFunnels();

  // ── Funnel modal handlers ────────────────────────────────────────────────
  const openCreateFunnel = () => {
    setEditingFunnel(null);
    setFunnelForm({ name: '', color: FUNNEL_COLORS[0] });
    setErrorMsg('');
    setShowFunnelModal(true);
  };
  const openEditFunnel = (f: Funnel) => {
    setEditingFunnel(f);
    setFunnelForm({ name: f.name, color: f.color || FUNNEL_COLORS[0] });
    setErrorMsg('');
    setShowFunnelModal(true);
  };
  const saveFunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funnelForm.name.trim()) { setErrorMsg('Varonka nomi kerak'); return; }
    setSaving(true);
    try {
      if (editingFunnel) {
        await taskManagerApi.updateFunnel(editingFunnel.id, funnelForm);
      } else {
        await taskManagerApi.createFunnel(funnelForm);
      }
      setShowFunnelModal(false);
      load();
      toast(editingFunnel ? 'Varonka yangilandi' : 'Varonka yaratildi', 'success');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };
  const deleteFunnel = async () => {
    if (!editingFunnel) return;
    const ok = await confirm({
      title: 'Varonkani o\'chirish',
      message: `"${editingFunnel.name}" varonkasi va undagi barcha tasklar o'chiriladi. Davom etilsinmi?`,
      confirmText: 'O\'chirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await taskManagerApi.deleteFunnel(editingFunnel.id);
      setShowFunnelModal(false);
      load();
      toast('Varonka o\'chirildi', 'success');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'O\'chirishda xatolik');
    }
  };

  // ── Task modal handlers ──────────────────────────────────────────────────
  const openCreateTask = (funnelId: string) => {
    setEditingTask(null);
    setCreateTaskFunnelId(funnelId);
    setTaskForm({ title: '', description: '', deadlineAt: '', status: 'open' });
    setErrorMsg('');
    setShowTaskModal(true);
  };
  const openEditTask = (t: TaskItem) => {
    setEditingTask(t);
    setCreateTaskFunnelId(null);
    setTaskForm({
      title: t.title,
      description: t.description || '',
      deadlineAt: t.deadlineAt ? new Date(t.deadlineAt).toISOString().slice(0, 10) : '',
      status: t.status,
    });
    setErrorMsg('');
    setShowTaskModal(true);
  };
  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) { setErrorMsg('Task nomi kerak'); return; }
    setSaving(true);
    try {
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        deadlineAt: taskForm.deadlineAt || null,
        status: taskForm.status,
      };
      if (editingTask) {
        await taskManagerApi.updateTask(editingTask.id, payload);
      } else if (createTaskFunnelId) {
        await taskManagerApi.createTask({ ...payload, funnelId: createTaskFunnelId });
      }
      setShowTaskModal(false);
      load();
      toast(editingTask ? 'Task yangilandi' : 'Task yaratildi', 'success');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };
  const deleteTask = async (t: TaskItem) => {
    const ok = await confirm({
      title: 'Taskni o\'chirish',
      message: `"${t.title}" o'chirilsinmi?`,
      confirmText: 'O\'chirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await taskManagerApi.deleteTask(t.id);
      load();
      toast('Task o\'chirildi', 'success');
    } catch (err: any) {
      toast(err.response?.data?.message || 'O\'chirishda xatolik', 'error');
    }
  };
  const toggleStatus = async (t: TaskItem) => {
    const nextStatus =
      t.status === 'open' ? 'in_progress' :
      t.status === 'in_progress' ? 'done' : 'open';
    try {
      await taskManagerApi.updateTask(t.id, { status: nextStatus });
      load();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Statusni o\'zgartirib bo\'lmadi', 'error');
    }
  };

  // ── Drag-drop ────────────────────────────────────────────────────────────
  const onTaskDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', taskId); } catch { /* some browsers */ }
  };
  const onColumnDragOver = (e: React.DragEvent, funnelId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFunnelId(funnelId);
  };
  const onColumnDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverFunnelId(null);
    }
  };
  const onColumnDrop = async (e: React.DragEvent, targetFunnelId: string) => {
    e.preventDefault();
    setDragOverFunnelId(null);
    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    setDraggedTaskId(null);
    if (!taskId) return;
    const sourceFunnel = funnels.find(f => f.tasks?.some(t => t.id === taskId));
    if (sourceFunnel?.id === targetFunnelId) return;
    try {
      await taskManagerApi.updateTask(taskId, { funnelId: targetFunnelId });
      load();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Ko\'chirib bo\'lmadi', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Task Menejer</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Varonkalar va ichidagi tasklar — drag-drop yordamida ustunlararo ko'chiring
          </p>
        </div>
        <button 
          className="btn h-10 px-4 flex items-center gap-2 rounded-xl text-xs font-bold self-start"
          onClick={openCreateFunnel}
        >
          <Plus size={14} strokeWidth={2.5} /> Yangi Varonka
        </button>
      </div>

      {/* Empty State */}
      {funnels.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-[color:var(--border)] rounded-2xl p-16 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 bg-slate-50 border border-[color:var(--border)] rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Layers size={26} strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">Varonkalar yo'q</h3>
            <p className="text-xs text-slate-500 font-medium mt-1 max-w-xs mx-auto">
              Tasklarni guruhlash va jarayonlarni kuzatish uchun birinchi varonkangizni yarating.
            </p>
          </div>
          <button 
            className="btn h-10 px-4 text-xs font-bold"
            onClick={openCreateFunnel}
          >
            <Plus size={14} strokeWidth={2.5} /> Birinchi Varonkani Yaratish
          </button>
        </div>
      ) : (
        /* Kanban Board Container */
        <div className="flex gap-4 overflow-x-auto pb-4 items-start select-none">
          {funnels.map(f => {
            const isDragOver = dragOverFunnelId === f.id;
            return (
              <div
                key={f.id}
                onDragOver={(e) => onColumnDragOver(e, f.id)}
                onDragLeave={onColumnDragLeave}
                onDrop={(e) => onColumnDrop(e, f.id)}
                className={`w-80 flex-shrink-0 rounded-2xl border transition-all duration-200 flex flex-col max-h-[calc(100vh-210px)] ${
                  isDragOver 
                    ? 'border-dashed border-orange-400 bg-orange-50/20' 
                    : 'border-[color:var(--border)]/80 bg-slate-50/70'
                }`}
              >
                {/* Column Header */}
                <div className="p-4 flex items-center gap-2.5 border-b border-[color:var(--border)]/60 bg-white/50 rounded-t-2xl">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: f.color }} />
                  <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex-1 truncate">
                    {f.name}
                  </span>
                  <span className="text-[10px] font-extrabold bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-md">
                    {f.tasks?.length || 0}
                  </span>
                  <button
                    onClick={() => openEditFunnel(f)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Varonkani tahrirlash"
                  >
                    <Pencil size={13} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Task Card List */}
                <div className="p-3 flex flex-col gap-2 overflow-y-auto flex-1">
                  {(f.tasks || []).map(t => {
                    const deadline = formatDeadline(t.deadlineAt);
                    const dragging = draggedTaskId === t.id;

                    const deadlineBadge = 
                      deadline.tone === 'danger' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      deadline.tone === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-slate-100 text-slate-500 border border-[color:var(--border)]/50';

                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onTaskDragStart(e, t.id)}
                        onDragEnd={() => { setDraggedTaskId(null); setDragOverFunnelId(null); }}
                        className={`bg-white border rounded-xl p-4 flex flex-col justify-between cursor-grab active:cursor-grabbing transition-all ${
                          dragging 
                            ? 'opacity-40 border-orange-500 scale-[0.98]' 
                            : 'border-[color:var(--border)] hover:border-slate-300 hover:shadow'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical size={13} className="text-slate-300 mt-1 flex-shrink-0 cursor-grab" />
                          <div className="flex-1 min-w-0">
                            {/* Title & Status checkbox */}
                            <div className="flex items-start gap-2.5">
                              <button
                                onClick={() => toggleStatus(t)}
                                className={`mt-0.5 h-4.5 w-4.5 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${
                                  t.status === 'done' 
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20' 
                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                }`}
                              >
                                {t.status === 'done' && <Check size={11} strokeWidth={3} />}
                              </button>
                              
                              <p className={`font-extrabold text-xs leading-snug tracking-tight text-slate-800 break-words ${
                                t.status === 'done' ? 'line-through text-slate-400 font-semibold' : ''
                              }`}>
                                {t.title}
                              </p>
                            </div>

                            {/* Description */}
                            {t.description && (
                              <p className="text-[11px] font-medium text-slate-500 line-clamp-2 mt-2 leading-relaxed pl-7">
                                {t.description}
                              </p>
                            )}

                            {/* Footer (Deadline & Actions) */}
                            <div className="flex items-center justify-between gap-3 mt-4 pl-7">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${deadlineBadge}`}>
                                <Calendar size={10} strokeWidth={2.5} />
                                <span className="truncate">{deadline.text}</span>
                              </span>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => openEditTask(t)}
                                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-all"
                                  title="Tahrirlash"
                                >
                                  <Pencil size={11} strokeWidth={2.5} />
                                </button>
                                <button
                                  onClick={() => deleteTask(t)}
                                  className="p-1 text-rose-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all"
                                  title="O'chirish"
                                >
                                  <Trash2 size={11} strokeWidth={2.5} />
                                </button>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(f.tasks || []).length === 0 && (
                    <div className="p-8 text-center border border-dashed border-[color:var(--border)] rounded-xl bg-white/20">
                      <FileText size={20} className="mx-auto mb-2 text-slate-300 opacity-60" />
                      <p className="text-[10px] font-bold text-slate-400">Varonka bo'sh</p>
                    </div>
                  )}
                </div>

                {/* Add Task Trigger */}
                <div className="p-3 border-t border-[color:var(--border)]/60 bg-white/30 rounded-b-2xl">
                  <button
                    onClick={() => openCreateTask(f.id)}
                    className="w-full py-2 border border-dashed border-slate-300 hover:border-orange-400 hover:bg-orange-50/10 text-slate-500 hover:text-orange-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} strokeWidth={2.5} /> Task qo'shish
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Funnel Modal */}
      {showFunnelModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm">
            <div className="modal-header">
              <h2>{editingFunnel ? 'Varonkani Tahrirlash' : 'Yangi Varonka'}</h2>
              <button className="modal-close" onClick={() => setShowFunnelModal(false)}><X size={20} /></button>
            </div>
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3.5 text-xs font-bold mb-4 flex items-center gap-2">
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}
            <form onSubmit={saveFunnel} className="space-y-4">
              <div className="form-group">
                <label>Varonka Nomi</label>
                <input
                  autoFocus 
                  required 
                  value={funnelForm.name}
                  onChange={e => setFunnelForm({ ...funnelForm, name: e.target.value })}
                  placeholder="Sotuv, Marketing, ..."
                />
              </div>
              <div className="form-group">
                <label>Rang</label>
                <div className="flex gap-2 flex-wrap">
                  {FUNNEL_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFunnelForm({ ...funnelForm, color: c })}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        background: c,
                        borderColor: funnelForm.color === c ? '#0f172a' : 'transparent',
                        boxShadow: funnelForm.color === c ? `0 0 8px ${c}88` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  type="submit" 
                  className="btn flex-1 h-11 text-xs uppercase font-bold tracking-wide" 
                  disabled={saving}
                >
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
                {editingFunnel && (
                  <button
                    type="button" 
                    onClick={deleteFunnel} 
                    className="h-11 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors flex items-center justify-center"
                    title="Varonkani O'chirish"
                  >
                    <Trash2 size={16} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <div className="modal-header">
              <h2>{editingTask ? 'Taskni Tahrirlash' : 'Yangi Task'}</h2>
              <button className="modal-close" onClick={() => setShowTaskModal(false)}><X size={20} /></button>
            </div>
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl p-3.5 text-xs font-bold mb-4 flex items-center gap-2">
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}
            <form onSubmit={saveTask} className="space-y-4">
              <div className="form-group">
                <label>Task Nomi</label>
                <input
                  autoFocus 
                  required 
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Masalan: Mijoz bilan shartnoma imzolash"
                />
              </div>
              <div className="form-group">
                <label>Izoh (Tafsilotlar)</label>
                <textarea
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Kontekst, eslatmalar..."
                  rows={3}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Muddat</label>
                  <input
                    type="date" 
                    value={taskForm.deadlineAt}
                    onChange={e => setTaskForm({ ...taskForm, deadlineAt: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={taskForm.status}
                    onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button 
                type="submit" 
                className="btn w-full h-11 text-xs uppercase font-bold tracking-wide mt-2" 
                disabled={saving}
              >
                {saving ? 'Saqlanmoqda...' : (editingTask ? 'Saqlash' : 'Yaratish')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
