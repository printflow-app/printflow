import { useState } from 'react';
import {
  Plus, X, Trash2, Calendar, AlertCircle, Pencil, CheckCircle2, Circle, Clock,
  Layers, FileText, GripVertical,
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

const FUNNEL_COLORS = ['#FF6B00', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#0ea5e9', '#ec4899'];
const STATUS_OPTIONS: { value: string; label: string; icon: any; color: string }[] = [
  { value: 'open',        label: 'Yangi',      icon: Circle,       color: '#64748b' },
  { value: 'in_progress', label: 'Jarayonda',  icon: Clock,        color: '#3b82f6' },
  { value: 'done',        label: 'Bajarildi',  icon: CheckCircle2, color: '#10b981' },
];

function formatDeadline(d: string | null): { text: string; tone: 'danger' | 'warning' | 'muted' } {
  if (!d) return { text: 'Muddat yo\'q', tone: 'muted' };
  const date = new Date(d);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const text = date.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short', year: 'numeric' });
  if (diffDays < 0)  return { text: `${text} (${Math.abs(diffDays)} kun kechikti)`, tone: 'danger' };
  if (diffDays <= 2) return { text: `${text} (${diffDays === 0 ? 'bugun' : diffDays + ' kun qoldi'})`, tone: 'warning' };
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex-between">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>Task Menejer</h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
            Varonkalar va ichidagi tasklar — drag-drop bilan ko'chiring
          </p>
        </div>
        <button className="btn" onClick={openCreateFunnel}>
          <Plus size={16} /> Yangi Varonka
        </button>
      </div>

      {/* Empty state */}
      {funnels.length === 0 ? (
        <div style={{
          background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12,
          padding: 48, textAlign: 'center', marginTop: 20,
        }}>
          <Layers size={48} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 6 }}>Varonkalar yo'q</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 20 }}>
            Tasklarni guruhlash uchun birinchi varonkangizni yarating.
          </p>
          <button className="btn" onClick={openCreateFunnel}>
            <Plus size={16} /> Birinchi Varonka
          </button>
        </div>
      ) : (
        // ── Kanban board ─────────────────────────────────────────────────
        <div style={{
          display: 'flex', gap: 14, marginTop: 20, paddingBottom: 8,
          overflowX: 'auto', alignItems: 'flex-start',
        }}>
          {funnels.map(f => {
            const isDragOver = dragOverFunnelId === f.id;
            return (
              <div
                key={f.id}
                onDragOver={(e) => onColumnDragOver(e, f.id)}
                onDragLeave={onColumnDragLeave}
                onDrop={(e) => onColumnDrop(e, f.id)}
                style={{
                  width: 320, flexShrink: 0,
                  background: isDragOver ? `${f.color}10` : '#f8fafc',
                  border: `2px solid ${isDragOver ? f.color : 'transparent'}`,
                  borderRadius: 12, padding: 10,
                  transition: 'all 0.15s ease',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  maxHeight: 'calc(100vh - 220px)',
                }}
              >
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '4px 6px',
                }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: f.color, flexShrink: 0,
                  }} />
                  <span style={{
                    fontWeight: 800, fontSize: '0.9rem',
                    color: '#0f172a', textTransform: 'uppercase',
                    letterSpacing: 0.3, flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.name}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                    background: '#e2e8f0', color: '#475569',
                  }}>
                    {f.tasks?.length || 0}
                  </span>
                  <button
                    onClick={() => openEditFunnel(f)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: '#94a3b8', padding: 4, display: 'flex',
                    }}
                    title="Varonkani tahrirlash"
                  >
                    <Pencil size={13} />
                  </button>
                </div>

                {/* Tasks list (scrollable) */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 6,
                  overflowY: 'auto', flex: 1, padding: 2,
                }}>
                  {(f.tasks || []).map(t => {
                    const status = STATUS_OPTIONS.find(s => s.value === t.status) || STATUS_OPTIONS[0];
                    const StatusIcon = status.icon;
                    const deadline = formatDeadline(t.deadlineAt);
                    const deadlineColor =
                      deadline.tone === 'danger'  ? '#dc2626' :
                      deadline.tone === 'warning' ? '#d97706' : '#64748b';
                    const dragging = draggedTaskId === t.id;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => onTaskDragStart(e, t.id)}
                        onDragEnd={() => { setDraggedTaskId(null); setDragOverFunnelId(null); }}
                        style={{
                          background: 'white',
                          border: `1px solid ${dragging ? f.color : '#e2e8f0'}`,
                          borderRadius: 10, padding: 10,
                          cursor: 'grab',
                          opacity: dragging ? 0.4 : 1,
                          transform: dragging ? 'scale(0.97)' : 'none',
                          boxShadow: dragging ? `0 4px 16px ${f.color}40` : '0 1px 2px rgba(0,0,0,0.04)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                          <GripVertical size={12} color="#cbd5e1" style={{ marginTop: 3, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Title + status icon */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                            }}>
                              <button
                                onClick={() => toggleStatus(t)}
                                title={`Status: ${status.label}`}
                                style={{
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                  color: status.color, padding: 0, display: 'flex', flexShrink: 0,
                                }}
                              >
                                <StatusIcon size={15} strokeWidth={2.4} />
                              </button>
                              <span style={{
                                fontWeight: 700, fontSize: '0.85rem', color: '#0f172a',
                                textDecoration: t.status === 'done' ? 'line-through' : 'none',
                                opacity: t.status === 'done' ? 0.55 : 1,
                                flex: 1, minWidth: 0,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {t.title}
                              </span>
                            </div>
                            {/* Description */}
                            {t.description && (
                              <div style={{
                                fontSize: '0.75rem', color: '#475569', marginBottom: 6,
                                lineHeight: 1.4,
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>
                                {t.description}
                              </div>
                            )}
                            {/* Deadline + actions */}
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                            }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: '0.7rem', color: deadlineColor, fontWeight: 700, minWidth: 0,
                              }}>
                                <Calendar size={11} />
                                <span style={{
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{deadline.text}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                <button
                                  onClick={() => openEditTask(t)}
                                  style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: '#94a3b8', padding: 4, display: 'flex',
                                  }}
                                  title="Tahrirlash"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => deleteTask(t)}
                                  style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: '#dc2626', padding: 4, display: 'flex',
                                  }}
                                  title="O'chirish"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(f.tasks || []).length === 0 && (
                    <div style={{
                      padding: '20px 8px', textAlign: 'center',
                      color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600,
                      border: '1px dashed #e2e8f0', borderRadius: 8,
                    }}>
                      <FileText size={20} color="#cbd5e1" style={{ margin: '0 auto 6px' }} />
                      <div>Tasklar yo'q</div>
                    </div>
                  )}
                </div>

                {/* Add task button */}
                <button
                  onClick={() => openCreateTask(f.id)}
                  style={{
                    background: 'transparent', border: '1px dashed #cbd5e1',
                    color: '#64748b', padding: '8px 12px', borderRadius: 8,
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = f.color;
                    (e.currentTarget as HTMLButtonElement).style.color = f.color;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#cbd5e1';
                    (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
                  }}
                >
                  <Plus size={13} /> Task qo'shish
                </button>
              </div>
            );
          })}

        </div>
      )}

      {/* ── Funnel modal ─────────────────────────────────────────────────── */}
      {showFunnelModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>{editingFunnel ? 'Varonkani tahrirlash' : 'Yangi varonka'}</h2>
              <button className="modal-close" onClick={() => setShowFunnelModal(false)}><X size={22} /></button>
            </div>
            {errorMsg && (
              <div style={{
                padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2',
                color: '#dc2626', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}
            <form onSubmit={saveFunnel}>
              <div className="form-group">
                <label>Nomi *</label>
                <input
                  autoFocus required value={funnelForm.name}
                  onChange={e => setFunnelForm({ ...funnelForm, name: e.target.value })}
                  placeholder="Sotuv, Marketing, ..."
                />
              </div>
              <div className="form-group">
                <label>Rang</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FUNNEL_COLORS.map(c => (
                    <div
                      key={c}
                      onClick={() => setFunnelForm({ ...funnelForm, color: c })}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                        background: c,
                        border: funnelForm.color === c ? '3px solid #0f172a' : '3px solid transparent',
                        boxShadow: funnelForm.color === c ? `0 4px 10px ${c}55` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn" style={{ flex: 1, height: 44 }} disabled={saving}>
                  {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
                {editingFunnel && (
                  <button
                    type="button" onClick={deleteFunnel} className="btn"
                    style={{
                      background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2',
                      height: 44, padding: '0 16px',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Task modal ───────────────────────────────────────────────────── */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>{editingTask ? 'Taskni tahrirlash' : 'Yangi task'}</h2>
              <button className="modal-close" onClick={() => setShowTaskModal(false)}><X size={22} /></button>
            </div>
            {errorMsg && (
              <div style={{
                padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2',
                color: '#dc2626', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}
            <form onSubmit={saveTask}>
              <div className="form-group">
                <label>Task nomi *</label>
                <input
                  autoFocus required value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Masalan: Klient bilan bog'lanish"
                />
              </div>
              <div className="form-group">
                <label>Izoh</label>
                <textarea
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Qisqacha tafsilot, kontekst..."
                  rows={4}
                  style={{
                    width: '100%', border: '1px solid var(--border)', borderRadius: 6,
                    padding: '10px 14px', fontFamily: 'inherit', fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Muddat</label>
                  <input
                    type="date" value={taskForm.deadlineAt}
                    onChange={e => setTaskForm({ ...taskForm, deadlineAt: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={taskForm.status}
                    onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}
                    style={{
                      width: '100%', height: 44, border: '1px solid var(--border)',
                      borderRadius: 6, padding: '0 14px', fontFamily: 'inherit',
                    }}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn" style={{ width: '100%', height: 44, marginTop: 12 }} disabled={saving}>
                {saving ? 'Saqlanmoqda...' : (editingTask ? 'Yangilash' : 'Yaratish')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
