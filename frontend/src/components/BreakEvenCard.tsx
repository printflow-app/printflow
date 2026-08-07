import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, AlertCircle, Plus, Trash2, Settings2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { financeApi } from '../api';
import { useDepartments } from '../hooks/queries';

// =============================================
// ZARARSIZLIK NUQTASI
//
// "Shu oy nolga chiqish uchun yana qancha kerak?" — bo'lim kesimida.
// Poligrafiya va tashqi reklama alohida nolga chiqadi; ularning
// xarajati ham, tushumi ham aralashmaydi.
//
// Xarajat ikki yo'l bilan aniqlanadi (tashkilot tanlaydi):
//   avtomatik — kassadagi haqiqiy chiqimlardan
//   qo'lda    — jadvalga o'zi yozadi
// Avtomatik rejimda ham qo'lda qator qo'shish mumkin.
// =============================================

const fmt = (n: any) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })
    .format(Number(n) || 0)
    .replace(/,/g, ' ');

const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Bitta bo'lim (yoki umumiy) uchun progress qatori.
 *
 * BO'SH BO'LIMLAR HAM KO'RSATILADI. Ilgari xarajati va tushumi nol bo'lgan
 * bo'lim yashirilardi — natijada tashkilotda bo'limlar bo'la turib kartada
 * faqat "Umumiy" va "Bo'limsiz" ko'rinib, hamma narsa buzilgandek
 * taassurot qoldirardi. Nol ham ma'lumot: "bu bo'lim shu oy hali hech
 * narsa qilmadi" degani.
 */
const ScopeRow: React.FC<{ s: any; asosiy?: boolean }> = ({ s, asosiy }) => {
  const done = !!s.nolga_chiqdi;
  const pct = Math.max(0, Math.min(100, Number(s.foiz) || 0));
  const bosh = s.kerakli_qoplama === 0 && s.tushum === 0;

  return (
    <div className={asosiy ? '' : 'pt-3 mt-3 border-t border-slate-100'}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={`font-bold ${asosiy ? 'text-[13px] text-slate-800' : 'text-xs text-slate-600'}`}>
          {s.nom}
        </span>
        <span className={`text-[11px] font-bold ${bosh ? 'text-slate-300' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
          {bosh ? "ma'lumot yo'q" : done ? 'nolga chiqdi' : `${pct}%`}
        </span>
      </div>
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${asosiy ? 'h-3' : 'h-1.5'}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-emerald-500' : 'bg-orange-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Zararsiz nuqtaning O'ZI doim ko'rinadi. Ilgari u faqat qoplangandan
          keyin chiqardi, ya'ni "yana qancha kerak" degan savolga javob bor edi,
          "jami qancha kerak" degan savolga esa yo'q. */}
      <div className="flex justify-between gap-2 mt-1 text-[11px] font-bold">
        <span className="text-slate-500 truncate">
          {bosh ? '—' : `${fmt(s.tushum)} / ${fmt(s.kerakli_qoplama)} kerak`}
        </span>
        <span className={`shrink-0 ${done ? 'text-emerald-600' : 'text-slate-400'}`}>
          {bosh
            ? 'xarajat/tushum biriktirilmagan'
            : s.qolgan_summa > 0
              ? `${fmt(s.qolgan_summa)} qoldi`
              : 'qoplandi'}
        </span>
      </div>
    </div>
  );
};

const BreakEvenCard: React.FC = () => {
  const qc = useQueryClient();
  const { data: departments = [] } = useDepartments(undefined);
  const [editing, setEditing] = useState(false);
  const [rejim, setRejim] = useState<'auto' | 'manual'>('auto');
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['break-even'],
    queryFn: async () => (await financeApi.getBreakEven()).data,
    staleTime: 60_000,
  });

  const openEditor = async () => {
    try {
      const cfg = (await financeApi.getBreakEvenConfig()).data;
      setRejim(cfg.rejim || 'auto');
      setRows(cfg.xarajatlar || []);
    } catch { setRejim('auto'); setRows([]); }
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await financeApi.saveBreakEvenConfig({ rejim, xarajatlar: rows });
      qc.invalidateQueries({ queryKey: ['break-even'] });
      setEditing(false);
      toast.success('Saqlandi');
    } catch { toast.error('Saqlashda xatolik'); }
    finally { setSaving(false); }
  };

  if (isLoading) return <div className="bg-white rounded-2xl border border-slate-200 p-5 h-48 animate-pulse" />;
  if (!data) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${data.umumiy?.nolga_chiqdi ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
            <Target size={16} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-800">Zararsizlik nuqtasi</p>
            <p className="text-[11px] font-semibold text-slate-400">
              {data.oy} · {data.rejim === 'manual' ? "qo'lda kiritilgan xarajat" : 'kassa xarajatlaridan'}
            </p>
          </div>
        </div>
        <button
          onClick={openEditor}
          className="text-[11px] font-bold text-slate-400 hover:text-orange-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
        >
          <Settings2 size={12} /> Xarajatlar
        </button>
      </div>

      <ScopeRow s={data.umumiy} asosiy />

      {/* Bo'limlar alohida — ularning moliyasi aralashmaydi */}
      {(data.bolimlar || []).map((b: any) => <ScopeRow key={b.id || 'yoq'} s={b} />)}

      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doimiy</p>
          <p className="text-xs font-bold text-slate-700">{fmt(data.umumiy?.doimiy_xarajat)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vaqti-vaqti bilan</p>
          <p className="text-xs font-bold text-slate-700">{fmt(data.umumiy?.vaqtinchalik_ulush)}</p>
        </div>
      </div>

      {/* "Bo'limsiz" da katta pul turgani odatda xato emas — shunchaki
          xarajat/tushum kiritilayotganda bo'lim ko'rsatilmagan. Buni
          aytmasak, rahbar "nega bo'limlarim bo'sh?" deb hayron qoladi. */}
      {(() => {
        const bs = (data.bolimlar || []).find((b: any) => b.id === null);
        const bor = (data.bolimlar || []).some((b: any) => b.id !== null);
        if (!bs || !bor || (bs.kerakli_qoplama === 0 && bs.tushum === 0)) return null;
        return (
          <p className="mt-3 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-2.5 leading-relaxed">
            <b className="text-slate-700">"Bo'limsiz"</b> — bo'limi ko'rsatilmagan xarajat va
            tushum. Ular hech qaysi bo'lim hisobiga kirmaydi. Bo'limlar bo'yicha aniq
            taqsimot uchun Kassada kirim/chiqim kiritayotganda bo'limni tanlang, yoki
            bu yerda qo'lda xarajat qo'shib har biriga bo'lim belgilang.
          </p>
        );
      })()}

      {!data.malumot_yetarli && (
        <p className="mt-3 text-[11px] font-semibold text-amber-600 flex items-start gap-1.5 leading-relaxed">
          <AlertCircle size={11} className="mt-0.5 shrink-0" /> {data.izoh}
        </p>
      )}

      {/* ── XARAJAT TAHRIRLASH ────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[88vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <p className="text-sm font-bold text-slate-800">Xarajatlar</p>
              <button onClick={() => setEditing(false)} className="text-slate-300 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Rejim */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { v: 'auto' as const, t: 'Kassadan avtomatik', d: "Haqiqiy chiqimlardan hisoblanadi. Pastdagi qatorlar ustiga qo'shiladi." },
                  { v: 'manual' as const, t: "Faqat qo'lda", d: 'Kassa hisobga olinmaydi — faqat quyidagi jadval.' },
                ]).map(m => (
                  <button
                    key={m.v} type="button" onClick={() => setRejim(m.v)}
                    className={`text-left p-3 rounded-xl border transition-colors ${rejim === m.v ? 'border-orange-400 bg-orange-50/60' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <p className={`text-[13px] font-bold ${rejim === m.v ? 'text-orange-700' : 'text-slate-700'}`}>{m.t}</p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5 leading-relaxed">{m.d}</p>
                  </button>
                ))}
              </div>

              {/* JADVAL — sarlavhali ustunlar bilan. Ilgari qatorlar
                  sarlavhasiz turardi va qaysi maydon nima ekani faqat
                  placeholder'dan bilinardi; to'ldirilgach u ham yo'qolardi. */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2.5">Xarajat nomi</th>
                        <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2.5 text-right w-36">Summa</th>
                        <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2.5 w-32">Qanchalik tez-tez</th>
                        <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2.5 w-24 text-center">Necha oyda</th>
                        <th className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2.5 w-40">Bo'lim</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-[12px] font-semibold text-slate-400 text-center py-8">
                            Xarajat qo'shilmagan
                          </td>
                        </tr>
                      )}
                      {rows.map((r, i) => {
                        const upd = (patch: any) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                        // Oylik ulush — kiritayotgan odam natijani darrov ko'rsin.
                        const oylik = r.tur === 'vaqtinchalik'
                          ? Math.round((Number(r.summa) || 0) / Math.max(1, Number(r.oyda_bir) || 12))
                          : Number(r.summa) || 0;
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2">
                              <input
                                value={r.nom} placeholder="Ijara, maosh, kommunal..."
                                onChange={e => upd({ nom: e.target.value })}
                                className="input-minimal h-9 text-xs w-full"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number" value={r.summa || ''} placeholder="0"
                                onChange={e => upd({ summa: Number(e.target.value) })}
                                className="input-minimal h-9 text-xs w-full text-right tabular-nums"
                              />
                              {r.tur === 'vaqtinchalik' && oylik > 0 && (
                                <p className="text-[10px] font-bold text-orange-500 text-right mt-0.5">
                                  = {fmt(oylik)}/oy
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={r.tur}
                                onChange={e => upd({ tur: e.target.value })}
                                className="select-minimal h-9 text-[12px] w-full"
                              >
                                <option value="doimiy">Har oy</option>
                                <option value="vaqtinchalik">Vaqti-vaqti</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.tur === 'vaqtinchalik' ? (
                                <input
                                  type="number" min={1} value={r.oyda_bir || 12}
                                  onChange={e => upd({ oyda_bir: Number(e.target.value) })}
                                  className="input-minimal h-9 text-xs w-full text-center"
                                />
                              ) : (
                                <span className="text-[11px] font-bold text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={r.departmentId || ''}
                                onChange={e => upd({ departmentId: e.target.value || null })}
                                className="select-minimal h-9 text-[12px] w-full"
                              >
                                <option value="">Umumiy (barcha bo'lim)</option>
                                {(departments as any[]).map((d: any) => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                                className="text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => setRows([...rows, { id: uid(), nom: '', summa: 0, tur: 'doimiy', departmentId: null }])}
                  className="w-full h-10 border-t border-slate-200 text-[12px] font-bold text-slate-500 hover:text-orange-600 hover:bg-orange-50/50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus size={13} /> Xarajat qo'shish
                </button>
              </div>

              {/* Jami — kiritilganlarning oylik yig'indisi */}
              {rows.length > 0 && (
                <div className="flex justify-between items-baseline px-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Qo'lda kiritilganlar, oyiga
                  </span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">
                    {fmt(rows.reduce((s, r) => s + (r.tur === 'vaqtinchalik'
                      ? (Number(r.summa) || 0) / Math.max(1, Number(r.oyda_bir) || 12)
                      : Number(r.summa) || 0), 0))} so'm
                  </span>
                </div>
              )}

              <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
                "Vaqti-vaqti" tanlansa, summa necha oyda bir marta bo'lishiga bo'linib,
                har oyga taqsimlanadi. Aks holda u chiqqan oyda zarar, qolgan oylarda
                soxta foyda ko'rinardi. Bo'lim tanlansa xarajat faqat o'sha bo'limning
                nolga chiqishiga ta'sir qiladi.
              </p>
              {departments.length === 0 && (
                <p className="text-[11px] font-semibold text-amber-600 leading-relaxed">
                  Bo'limlar hali yaratilmagan — Filiallar sahifasida qo'shsangiz,
                  xarajatlarni ular bo'yicha ajratish mumkin bo'ladi.
                </p>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setEditing(false)} className="btn-outline flex-1 h-11">BEKOR</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1 h-11">
                {saving ? 'Saqlanmoqda...' : 'SAQLASH'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreakEvenCard;
