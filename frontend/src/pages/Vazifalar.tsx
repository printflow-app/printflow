import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Clock, Package, ClipboardList, Trash2, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { teamTasksApi } from '../api';
import { useEmployees } from '../hooks/queries';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

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

const fmtSumma = (n: any) =>
  Number(n) > 0 ? `${Math.round(Number(n) / 1000).toLocaleString('uz-UZ')} ming` : null;

/**
 * Muddatgacha necha kun qolgani — brauzer taqvimi bo'yicha (foydalanuvchi
 * Toshkentda, shuning uchun mahalliy kun to'g'ri javob beradi).
 * Manfiy = kechikkan.
 */
const kunFarqi = (d: any): number | null => {
  if (!d) return null;
  const t = new Date(d);
  if (isNaN(t.getTime())) return null;
  const b = new Date();
  const kun = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const bugun = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((kun - bugun) / 86400000);
};

/**
 * Muddat yorlig'i. Ilgari sana har doim bir xil kulrang edi va kechikkan
 * ish ko'zga tashlanmasdi — doskaning butun mazmuni esa aynan shu:
 * nimadan orqada qolyapmiz. Bajarilgan ustunda ogohlantirish ko'rsatilmaydi.
 */
const muddatUslubi = (muddat: any, bajarilgan: boolean) => {
  const farq = kunFarqi(muddat);
  if (farq === null) return null;
  if (bajarilgan) return { klass: 'text-slate-500', matn: fmtDate(muddat)!, ogoh: false };
  if (farq < 0) return { klass: 'text-rose-600 font-bold', matn: `${Math.abs(farq)} kun kechikdi`, ogoh: true };
  if (farq === 0) return { klass: 'text-amber-600 font-bold', matn: 'Bugun', ogoh: true };
  if (farq === 1) return { klass: 'text-amber-600', matn: 'Ertaga', ogoh: false };
  return { klass: 'text-slate-500', matn: fmtDate(muddat)!, ogoh: false };
};

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

  // O'CHIRISH — tasdiqlashsiz emas.
  //
  // Ilgari savatcha tugmasi bosilishi bilanoq vazifa yo'q bo'lardi va uni
  // qaytarib bo'lmasdi. Kartalar zich joylashgani uchun noto'g'ri bosish
  // oson. Brauzer `confirm()` i o'rniga tizimning o'z oynasi ishlatiladi.
  const [ochiriladigan, setOchiriladigan] = useState<{ id: string; sarlavha: string } | null>(null);
  const [ochirilyapti, setOchirilyapti] = useState(false);

  const remove = async () => {
    if (!ochiriladigan) return;
    setOchirilyapti(true);
    try { await teamTasksApi.remove(ochiriladigan.id); reload(); toast.success("Vazifa o'chirildi"); }
    catch { toast.error("O'chirishda xatolik"); }
    finally { setOchirilyapti(false); setOchiriladigan(null); }
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

  // Yuk qatori — doskaning savoliga ("kim band?") javob ustunlarni
  // sanamasdan turib ko'rinsin. Ilgari bu raqam faqat filtr ro'yxatining
  // ichida yashiringan edi, ya'ni uni ko'rish uchun ro'yxatni ochish kerak
  // edi. Chip bosilsa — o'sha xodim bo'yicha filtr.
  const yukRoyxati = (employees as any[])
    .map((e: any) => ({ id: e.id, ism: e.fullName as string, soni: yuk.get(e.id) || 0 }))
    .filter((e) => e.soni > 0)
    .sort((a, b) => b.soni - a.soni);

  // Kechikkanlar — reja va jarayondagi, muddati o'tgan ishlar.
  const kechikkan = (['reja', 'jarayon'] as const)
    .flatMap((k) => filtered(board?.[k] || []))
    .filter((it: any) => {
      const f = kunFarqi(it.muddat);
      return f !== null && f < 0;
    }).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="t-h2">Jamoa vazifalari</h2>
          <p className="t-caption">
            Buyurtmalar va operatsion ishlar birga — kim nima bilan band
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterEmp}
            onChange={(e) => setFilterEmp(e.target.value)}
            className="select-minimal h-control-sm w-auto text-xs font-semibold"
          >
            <option value="">Barcha xodimlar</option>
            {(employees as any[]).map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.fullName}{yuk.get(e.id) ? ` (${yuk.get(e.id)})` : ''}
              </option>
            ))}
          </select>
          {canManage && (
            <button data-tour-id="vazifa-add" onClick={() => setModalOpen(true)} className="btn-primary h-sm">
              <Plus size={16} /> Vazifa
            </button>
          )}
        </div>
      </div>

      {/* YUK QATORI — kim nechta faol ish bilan band. Bosilsa filtr. */}
      {yukRoyxati.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {kechikkan > 0 && (
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control bg-rose-50 text-rose-600 text-xs font-semibold">
              <AlertTriangle size={12} /> {kechikkan} ta kechikkan
            </span>
          )}
          {yukRoyxati.map((e) => {
            const tanlangan = filterEmp === e.id;
            return (
              <button
                key={e.id}
                onClick={() => setFilterEmp(tanlangan ? '' : e.id)}
                title={tanlangan ? 'Filtrni olib tashlash' : `Faqat ${e.ism}`}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control text-xs font-semibold transition-colors duration-120 ${
                  tanlangan
                    ? 'bg-[color:var(--primary)] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600'
                }`}
              >
                {e.ism}
                <span className={`px-1.5 rounded ${tanlangan ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>
                  {e.soni}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {USTUNLAR.map((u) => <div key={u.key} className="h-64 bg-white rounded-card border border-slate-200 animate-pulse" />)}
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
                className={`rounded-card border p-3 transition-colors ${
                  overCol === u.key
                    ? 'bg-orange-50/70 border-orange-300 border-dashed'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${u.rang}`} />
                    <span className="label-caps text-slate-700">{u.nom}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">{items.length}</span>
                </div>

                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto custom-scroll pr-1">
                  {items.length === 0 && (
                    <p className="t-caption font-medium text-center py-8">
                      {filterEmp ? 'Bu xodimda ish yo\'q' : 'Bo\'sh'}
                    </p>
                  )}
                  {items.map((it: any) => (
                    <div
                      key={`${it.tur}-${it.id}`}
                      draggable={canManage}
                      onDragStart={(e) => onDragStart(e, it)}
                      onDragEnd={() => { setDragged(null); setOverCol(null); }}
                      title={it.tur === 'buyurtma' ? "Buyurtma bosqichi Kanban sahifasida o'zgartiriladi" : "Bosqichga sudrab o'tkazing"}
                      className={`bg-white rounded-card border p-3 group transition-opacity ${
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
                          {it.izoh && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{it.izoh}</p>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {it.masul ? (
                              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-control">
                                {it.masul.ism}
                                {it.qoshimcha_masullar > 0 && ` +${it.qoshimcha_masullar}`}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-rose-500">mas'ul yo'q</span>
                            )}
                            {(() => {
                              const m = muddatUslubi(it.muddat, u.key === 'bajarildi');
                              if (!m) return null;
                              return (
                                <span className={`text-xs font-semibold flex items-center gap-1 ${m.klass}`}>
                                  {m.ogoh ? <AlertTriangle size={12} /> : <Clock size={12} />} {m.matn}
                                </span>
                              );
                            })()}
                            {it.tur === 'buyurtma' && fmtSumma(it.summa) && (
                              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                {fmtSumma(it.summa)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Buyurtmalar bu yerda ko'chirilmaydi — ular o'z
                          kanbanida boshqariladi, aks holda ikki joyda ikki
                          xil holat paydo bo'lardi.

                          Tugmalar KATTA EKRANDA hover'da chiqadi, kichigida
                          doim ko'rinadi: telefonda hover yo'q va sudrab
                          ko'chirish ham ishlamaydi — tugmalar yashirilsa
                          vazifani umuman ko'chirib bo'lmasdi. */}
                      {it.tur === 'vazifa' && canManage && (
                        <div className="flex gap-1 mt-2.5 pt-2.5 border-t border-slate-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                          {USTUNLAR.filter((x) => x.key !== u.key).map((x) => (
                            <button
                              key={x.key}
                              onClick={() => move(it.id, x.key)}
                              className="text-xs font-semibold text-slate-500 hover:text-orange-600 px-1.5 py-1 rounded hover:bg-orange-50 transition-colors duration-120"
                            >
                              → {x.nom}
                            </button>
                          ))}
                          <button
                            onClick={() => setOchiriladigan({ id: it.id, sarlavha: it.sarlavha })}
                            title="Vazifani o'chirish"
                            className="ml-auto text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={12} />
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
            <label className="form-label">Sarlavha</label>
            <input
              required autoFocus value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: Qarzdorlar bilan ishlash"
              className="input-minimal w-full"
            />
          </div>
          <div>
            <label className="form-label">Izoh</label>
            <textarea
              rows={3} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Nima qilish kerakligini yozing (ixtiyoriy)"
              className="textarea-minimal w-full"
            />
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Users size={12} /> Kim qilishi kerak
            </label>
            <select
              value={form.assigneeId}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              className="select-minimal w-full"
            >
              <option value="">— Tanlanmagan —</option>
              {(employees as any[]).map((e: any) => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <p className="text-hint mt-1.5">
              Xodim tanlansa — unga Telegram orqali xabar yuboriladi.
            </p>
          </div>
          <div>
            <label className="form-label">Muddat</label>
            <input
              type="date" value={form.deadlineAt}
              onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })}
              className="input-minimal w-full"
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-outline flex-1">BEKOR</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saqlanmoqda...' : 'YARATISH'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!ochiriladigan}
        title="Vazifani o'chirish"
        message={<>
          <span className="font-bold text-slate-800">{ochiriladigan?.sarlavha}</span> butunlay
          o'chiriladi. Buni qaytarib bo'lmaydi.
        </>}
        confirmText="O'chirish"
        danger
        busy={ochirilyapti}
        onConfirm={remove}
        onClose={() => setOchiriladigan(null)}
      />
    </div>
  );
};

export default Vazifalar;
