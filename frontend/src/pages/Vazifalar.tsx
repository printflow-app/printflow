import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Package, ClipboardList, Trash2, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { teamTasksApi } from '../api';
import { useEmployees } from '../hooks/queries';
import Modal from '../components/Modal';

// =============================================
// JAMOA DOSKASI — "kim hozir nima bilan band?"
//
// Buyurtma kanbanidan farqi: u yerda fokus buyurtmada, bu yerda ODAMDA.
// Shuning uchun kartada birinchi o'rinda mas'ul turadi, va doskada
// buyurtmalar ham, operatsion vazifalar ham birga ko'rinadi — rahbarga
// xodimning butun yuki kerak.
// =============================================

const USTUNLAR: { key: 'reja' | 'jarayon' | 'bajarildi'; nom: string; rang: string }[] = [
  { key: 'reja', nom: 'Qilinishi kerak', rang: 'bg-slate-400' },
  { key: 'jarayon', nom: 'Jarayonda', rang: 'bg-orange-500' },
  { key: 'bajarildi', nom: 'Bajarilgan', rang: 'bg-emerald-500' },
];

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' }) : null;

const Vazifalar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const perm = currentUser?.permissions || {};
  const isAdmin = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  // Ko'rish ruxsati sahifa darajasida tekshirilgan; bu yerda o'zgartirish.
  const canManage = isAdmin || !!perm.canManageTeamTasks;
  const qc = useQueryClient();
  const { data: employees = [] } = useEmployees();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigneeId: '', deadlineAt: '' });
  // Bo'sh bo'lsa hamma xodim ko'rinadi; tanlansa faqat o'shaniki.
  const [filterEmp, setFilterEmp] = useState('');

  const { data: board, isLoading } = useQuery({
    queryKey: ['team-board', activeBranchId],
    queryFn: async () => (await teamTasksApi.board(activeBranchId)).data,
    refetchInterval: 20000,
  });

  const reload = () => qc.invalidateQueries({ queryKey: ['team-board'] });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await teamTasksApi.create({
        ...form,
        branchId: activeBranchId || null,
        deadlineAt: form.deadlineAt || null,
      });
      setForm({ title: '', description: '', assigneeId: '', deadlineAt: '' });
      setModalOpen(false);
      reload();
      toast.success(
        form.assigneeId
          ? "Vazifa yaratildi — mas'ulga Telegramga xabar yuborildi"
          : 'Vazifa yaratildi',
      );
    } catch {
      toast.error('Vazifa yaratishda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const move = async (id: string, status: string) => {
    try { await teamTasksApi.update(id, { status }); reload(); }
    catch { toast.error("Ko'chirishda xatolik"); }
  };

  // ── DRAG & DROP ────────────────────────────────────────────────────
  // Faqat operatsion vazifalar ko'chiriladi. Buyurtma tortilsa, uni
  // bloklaymiz va qayerdan ko'chirish kerakligini aytamiz — buyurtmaning
  // bosqichi Kanbanda saqlanadi, bu doska uni faqat ko'rsatadi. Aks holda
  // ikki joyda ikki xil holat paydo bo'lardi.
  const [dragged, setDragged] = useState<{ id: string; tur: string } | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Ma'lumot React holatida EMAS, `dataTransfer` da tashiladi.
  //
  // Holat orqali qilganda drop payti `dragged` hali null bo'lib qolardi:
  // dragstart va drop orasida React qayta render qilishga ulgurmaydi.
  // Sinovda aynan shu bo'ldi — hech qanday so'rov ketmadi. `dataTransfer`
  // esa brauzerning o'zi tomonidan sudrash davomida saqlanadi.
  //
  // Tur alohida MIME sifatida yoziladi, chunki `dragover` paytida
  // qiymatni o'qish brauzerda taqiqlangan — faqat TUR ro'yxati ko'rinadi.
  const MIME_TASK = 'application/x-pf-task';
  const MIME_ORDER = 'application/x-pf-order';

  const onDragStart = (e: React.DragEvent, it: any) => {
    setDragged({ id: it.id, tur: it.tur });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(it.tur === 'buyurtma' ? MIME_ORDER : MIME_TASK, it.id);
    e.dataTransfer.setData('text/plain', it.id);
  };

  const onDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setOverCol(null);
    setDragged(null);

    // Buyurtma ham tushiriladi — lekin ko'chirilmaydi, tushuntirish beriladi.
    // Butunlay bloklansak `drop` umuman ishlamas va foydalanuvchi nima
    // uchun ko'chmaganini bilmasdi.
    if (e.dataTransfer.getData(MIME_ORDER)) {
      toast.info("Buyurtma bosqichini bu yerda o'zgartirib bo'lmaydi — uni \"Xizmatlar (Kanban)\" sahifasida ko'chiring. Bu yerda u avtomatik yangilanadi.");
      return;
    }

    if (!canManage) return;

    const id = e.dataTransfer.getData(MIME_TASK) || e.dataTransfer.getData('text/plain');
    if (id) await move(id, status);
  };

  const remove = async (id: string) => {
    try { await teamTasksApi.remove(id); reload(); toast.success("Vazifa o'chirildi"); }
    catch { toast.error("O'chirishda xatolik"); }
  };

  const filtered = (items: any[]) =>
    filterEmp ? items.filter((x) => x.masul?.id === filterEmp) : items;

  // Har xodim nechta faol ish bilan band — doskaning asosiy savoli.
  const yuk = new Map<string, number>();
  for (const key of ['reja', 'jarayon'] as const) {
    for (const it of board?.[key] || []) {
      if (it.masul?.id) yuk.set(it.masul.id, (yuk.get(it.masul.id) || 0) + 1);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Jamoa vazifalari</h2>
          <p className="text-[12px] font-semibold text-slate-400">
            Buyurtmalar va operatsion ishlar birga — kim nima bilan band
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterEmp}
            onChange={(e) => setFilterEmp(e.target.value)}
            className="select-minimal h-control-sm w-auto text-xs font-bold"
          >
            <option value="">Barcha xodimlar</option>
            {(employees as any[]).map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.fullName}{yuk.get(e.id) ? ` (${yuk.get(e.id)})` : ''}
              </option>
            ))}
          </select>
          {canManage && (
            <button onClick={() => setModalOpen(true)} className="btn-primary h-sm">
              <Plus size={14} strokeWidth={2.5} /> Vazifa
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {USTUNLAR.map((u) => <div key={u.key} className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {USTUNLAR.map((u) => {
            const items = filtered(board?.[u.key] || []);
            return (
              <div
                key={u.key}
                onDragOver={(e) => {
                  // Tushirishga har doim ruxsat beramiz — buyurtma bo'lsa
                  // `onDrop` sababini tushuntiradi. Lekin ustunni faqat
                  // haqiqatan ko'chiriladigan vazifa uchun yoritamiz.
                  e.preventDefault();
                  const isOrder = e.dataTransfer.types.includes(MIME_ORDER);
                  e.dataTransfer.dropEffect = isOrder ? 'none' : 'move';
                  setOverCol(isOrder ? null : u.key);
                }}
                onDragLeave={() => setOverCol((c) => (c === u.key ? null : c))}
                onDrop={(e) => onDrop(e, u.key)}
                className={`rounded-2xl border p-3 transition-colors ${
                  overCol === u.key
                    ? 'bg-orange-50/70 border-orange-300 border-dashed'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${u.rang}`} />
                    <span className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">{u.nom}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{items.length}</span>
                </div>

                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto custom-scroll pr-1">
                  {items.length === 0 && (
                    <p className="text-[11px] font-bold text-slate-300 text-center py-8">Bo'sh</p>
                  )}
                  {items.map((it: any) => (
                    <div
                      key={`${it.tur}-${it.id}`}
                      draggable={canManage}
                      onDragStart={(e) => onDragStart(e, it)}
                      onDragEnd={() => { setDragged(null); setOverCol(null); }}
                      title={it.tur === 'buyurtma' ? "Buyurtma bosqichi Kanban sahifasida o'zgartiriladi" : "Bosqichga sudrab o'tkazing"}
                      className={`bg-white rounded-xl border p-3 shadow-sm group transition-opacity ${
                        it.tur === 'buyurtma'
                          ? 'border-slate-100 cursor-not-allowed'
                          : 'border-slate-100 cursor-grab active:cursor-grabbing'
                      } ${dragged?.id === it.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`p-1.5 rounded-lg shrink-0 ${it.tur === 'buyurtma' ? 'bg-slate-50 text-slate-500' : 'bg-orange-50 text-orange-500'}`}>
                          {it.tur === 'buyurtma' ? <Package size={12} /> : <ClipboardList size={12} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 leading-snug">{it.sarlavha}</p>
                          {it.izoh && <p className="text-[11px] font-semibold text-slate-400 mt-1 leading-relaxed">{it.izoh}</p>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {it.masul ? (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                                {it.masul.ism}
                                {it.qoshimcha_masullar > 0 && ` +${it.qoshimcha_masullar}`}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-rose-400">mas'ul yo'q</span>
                            )}
                            {it.muddat && (
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <Clock size={9} /> {fmtDate(it.muddat)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Buyurtmalar bu yerda ko'chirilmaydi — ular o'z
                          kanbanida boshqariladi, aks holda ikki joyda ikki
                          xil holat paydo bo'lardi. */}
                      {it.tur === 'vazifa' && canManage && (
                        <div className="flex gap-1 mt-2.5 pt-2.5 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                          {USTUNLAR.filter((x) => x.key !== u.key).map((x) => (
                            <button
                              key={x.key}
                              onClick={() => move(it.id, x.key)}
                              className="text-[10px] font-bold text-slate-400 hover:text-orange-600 px-1.5 py-1 rounded hover:bg-orange-50 transition-colors"
                            >
                              → {x.nom}
                            </button>
                          ))}
                          <button onClick={() => remove(it.id)} className="ml-auto text-slate-300 hover:text-rose-500 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Yangi vazifa">
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Sarlavha</label>
            <input
              required autoFocus value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: Qarzdorlar bilan ishlash"
              className="input-minimal w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Izoh</label>
            <textarea
              rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Nima qilish kerakligini yozing (ixtiyoriy)"
              className="input-minimal w-full resize-y"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest flex items-center gap-1.5">
              <Users size={11} /> Kim qilishi kerak
            </label>
            <select
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              className="select-minimal w-full font-bold"
            >
              <option value="">— Tanlanmagan —</option>
              {(employees as any[]).map((e: any) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <p className="text-[11px] font-semibold text-slate-400 mt-1.5">
              Xodim tanlansa — unga Telegram orqali xabar yuboriladi.
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Muddat</label>
            <input
              type="date" value={form.deadlineAt}
              onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })}
              className="input-minimal w-full"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-outline flex-1 h-11">BEKOR</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 h-11">
              {saving ? 'Saqlanmoqda...' : 'YARATISH'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Vazifalar;
