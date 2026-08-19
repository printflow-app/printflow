import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Save, Check, RotateCcw, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { payrollApi } from '../api';
import CurrencyInput from './CurrencyInput';

const fmt = (n: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)).replace(/,/g, ' ');

type Edit = { fixedSalary?: number; bonus?: number; bonusNote?: string; penalty?: number; penaltyNote?: string };

// =============================================
// Maosh (Payroll) bo'limi — Xodimlar sahifasidagi oylik hisob-kitob jadvali.
// Har xodim: fiksa + bonus − jarima = sof maosh; berish kerak = sof − avans − qarz.
// =============================================
export const PayrollSection: React.FC<{
  activeBranchId?: string;
  canManage: boolean;
}> = ({ activeBranchId, canManage }) => {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['payroll', period, activeBranchId],
    queryFn: async () => (await payrollApi.list(period, activeBranchId)).data as any[],
  });
  const rows: any[] = q.data || [];

  // Input qiymati: tahrir bo'lsa undan, aks holda serverdan.
  const val = (row: any, field: keyof Edit): number =>
    edits[row.employeeId]?.[field] !== undefined ? (edits[row.employeeId] as any)[field] : row[field];
  const setEdit = (id: string, field: keyof Edit, value: any) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }));

  const liveNet = (row: any) => Math.round(val(row, 'fixedSalary') + val(row, 'bonus') - val(row, 'penalty'));
  const liveToPay = (row: any) =>
    row.status === 'paid' ? row.paidAmount : Math.round(liveNet(row) - row.advances - row.prevDebt);

  const handleSave = async (row: any) => {
    try {
      setBusyId(row.employeeId);
      await payrollApi.save({
        employeeId: row.employeeId,
        period,
        fixedSalary: val(row, 'fixedSalary'),
        bonus: val(row, 'bonus'),
        bonusNote: edits[row.employeeId]?.bonusNote ?? row.bonusNote,
        penalty: val(row, 'penalty'),
        penaltyNote: edits[row.employeeId]?.penaltyNote ?? row.penaltyNote,
      });
      toast.success('Saqlandi');
      await q.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setBusyId(null);
    }
  };

  const handlePay = async (row: any) => {
    try {
      setBusyId(row.employeeId);
      // Avval joriy tahrirlarni saqlaymiz (fiksa/bonus/jarima to'lovga kirsin).
      await payrollApi.save({
        employeeId: row.employeeId,
        period,
        fixedSalary: val(row, 'fixedSalary'),
        bonus: val(row, 'bonus'),
        bonusNote: edits[row.employeeId]?.bonusNote ?? row.bonusNote,
        penalty: val(row, 'penalty'),
        penaltyNote: edits[row.employeeId]?.penaltyNote ?? row.penaltyNote,
      });
      const res = await payrollApi.pay({ employeeId: row.employeeId, period });
      const paid = res.data?.paidAmount || 0;
      const carried = res.data?.carriedDebt || 0;
      toast.success(carried > 0
        ? `To'landi: ${fmt(paid)}. Ortiqcha avans keyingi oyga qarz: ${fmt(carried)}`
        : `To'landi: ${fmt(paid)} UZS`);
      await q.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "To'lashda xatolik");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevert = async (row: any) => {
    try {
      setBusyId(row.employeeId);
      await payrollApi.revert({ employeeId: row.employeeId, period });
      toast.success('To\'lov bekor qilindi');
      await q.refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Bekor qilishda xatolik');
    } finally {
      setBusyId(null);
    }
  };

  // Jami (footer)
  const totals = rows.reduce(
    (acc, r) => {
      acc.net += liveNet(r);
      acc.adv += r.advances;
      acc.toPay += Math.max(0, liveToPay(r));
      return acc;
    },
    { net: 0, adv: 0, toPay: 0 },
  );

  return (
    <section className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-card border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="card-title flex items-center gap-2">
            <Wallet className="text-emerald-500" size={20} /> Maosh (oylik hisob-kitob)
          </h3>
          <p className="t-caption mt-0.5">
            Fiksa + bonus − jarima − avans = berish kerak
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="label-caps">Oy</label>
          <input
            type="month"
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setEdits({}); }}
            className="input-minimal w-auto h-control-sm text-sm font-semibold"
          />
        </div>
      </div>

      <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="table-minimal md:min-w-[860px]">
            <thead>
              <tr>
                <th>Xodim</th>
                <th className="hidden md:table-cell text-right">Fiksa</th>
                <th className="hidden md:table-cell text-right">Bonus</th>
                <th className="hidden md:table-cell text-right">Jarima</th>
                <th className="hidden md:table-cell text-right">Sof maosh</th>
                <th className="hidden md:table-cell text-right">Avans (oy)</th>
                <th className="hidden md:table-cell text-right">Oldingi qarz</th>
                <th className="text-right">Berish kerak</th>
                <th className="text-center">Amal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const paid = row.status === 'paid';
                const busy = busyId === row.employeeId;
                const toPay = liveToPay(row);
                return (
                  <React.Fragment key={row.employeeId}>
                  <tr>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* Sxema bo'yicha hisoblangan bo'lsa — tafsilotni ochish */}
                        {row.breakdown?.length ? (
                          <button
                            onClick={() => setOpenRow(openRow === row.employeeId ? null : row.employeeId)}
                            title="Hisob tafsiloti"
                            className="w-5 h-5 rounded-control text-slate-400 hover:text-primary-600 hover:bg-primary-50 flex items-center justify-center flex-shrink-0"
                          >
                            {openRow === row.employeeId ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        ) : (
                          <span className="w-5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{row.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {row.roleName}
                            {row.jonli && <span className="ml-1.5 text-primary-500 font-semibold">· jonli hisob</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* FIKSA VA BONUS — sxema bo'lsa tahrirlanmaydi.
                        Ular har ochilganda davomat/buyurtmalardan qayta
                        hisoblanadi, ya'ni qo'lda yozilgan raqam baribir
                        keyingi ochilishda yo'qolardi. Tahrirlashga ruxsat
                        berish — ishlamaydigan tugmani ko'rsatish demak.
                        Tuzatish kerak bo'lsa sxemaning o'zi o'zgartiriladi. */}
                    <td className="hidden md:table-cell w-32">
                      {paid || row.jonli ? (
                        <span
                          className="block text-right text-xs font-bold tabular-nums text-slate-600"
                          title={row.jonli ? 'Sxema bo\'yicha jonli hisoblanadi' : undefined}
                        >
                          {fmt(row.fixedSalary)}
                        </span>
                      ) : (
                        <CurrencyInput value={String(val(row, 'fixedSalary') || '')} onChange={(u) => setEdit(row.employeeId, 'fixedSalary', u || 0)} colorClass="text-slate-800" className="input-minimal h-9 text-xs text-right" />
                      )}
                    </td>
                    <td className="hidden md:table-cell w-32">
                      {paid || row.jonli ? (
                        <span
                          className="block text-right text-xs font-bold tabular-nums text-emerald-600"
                          title={row.jonli ? 'Sxema bo\'yicha jonli hisoblanadi' : undefined}
                        >
                          {row.bonus ? '+' + fmt(row.bonus) : '—'}
                        </span>
                      ) : (
                        <CurrencyInput value={String(val(row, 'bonus') || '')} onChange={(u) => setEdit(row.employeeId, 'bonus', u || 0)} colorClass="text-emerald-600" className="input-minimal h-9 text-xs text-right" />
                      )}
                    </td>
                    <td className="hidden md:table-cell w-32">
                      {paid ? (
                        <span className="block text-right text-xs font-bold tabular-nums text-rose-600">{row.penalty ? '−' + fmt(row.penalty) : '—'}</span>
                      ) : (
                        <CurrencyInput value={String(val(row, 'penalty') || '')} onChange={(u) => setEdit(row.employeeId, 'penalty', u || 0)} colorClass="text-rose-600" className="input-minimal h-9 text-xs text-right" />
                      )}
                    </td>
                    <td className="hidden md:table-cell text-right"><span className="text-xs font-bold tabular-nums text-slate-700">{fmt(liveNet(row))}</span></td>
                    <td className="hidden md:table-cell text-right"><span className="text-xs font-bold tabular-nums text-primary-600">{row.advances ? '−' + fmt(row.advances) : '—'}</span></td>
                    <td className="hidden md:table-cell text-right"><span className="text-xs font-bold tabular-nums text-rose-500">{row.prevDebt ? '−' + fmt(row.prevDebt) : '—'}</span></td>
                    <td className="text-right whitespace-nowrap">
                      <span className={`text-sm font-bold tabular-nums ${toPay < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{fmt(toPay)}</span>
                      {toPay < 0 && <p className="text-xs font-medium text-rose-500">keyingi oyga qarz</p>}
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        {paid ? (
                          <>
                            <span className="badge-success">To'langan</span>
                            {canManage && (
                              <button onClick={() => handleRevert(row)} disabled={busy} title="Bekor qilish" className="icon-btn-sm hover:text-rose-600 disabled:opacity-40">
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </>
                        ) : canManage ? (
                          <>
                            <button onClick={() => handleSave(row)} disabled={busy} title="Saqlash" className="icon-btn-sm disabled:opacity-40">
                              <Save size={16} />
                            </button>
                            <button onClick={() => handlePay(row)} disabled={busy} className="btn-success h-sm">
                              <Check size={12} /> To'lash
                            </button>
                          </>
                        ) : (
                          <span className="t-caption">qoralama</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Hisob tafsiloti — qaysi qator nimadan chiqdi, qaysi biri
                      shart bajarilmagani uchun tushib qolgan. */}
                  {openRow === row.employeeId && row.breakdown?.length > 0 && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={9}>
                        <div className="max-w-3xl space-y-1.5 py-1">
                          {row.breakdown.map((b: any) => (
                            <div key={b.id} className="flex items-center gap-3 text-xs">
                              <span className={`w-4 flex-shrink-0 font-bold ${b.skipped ? 'text-slate-300' : 'text-emerald-600'}`}>
                                {b.skipped ? '—' : '✓'}
                              </span>
                              <span className={`font-bold w-44 flex-shrink-0 ${b.skipped ? 'text-slate-400' : 'text-slate-700'}`}>
                                {b.label}
                              </span>
                              <span className={`font-bold tabular-nums w-24 text-right ${
                                b.skipped ? 'text-slate-300' : b.group === 'jarima' ? 'text-rose-600' : 'text-slate-800'
                              }`}>
                                {b.group === 'jarima' && b.amount ? '−' : ''}{fmt(b.amount)}
                              </span>
                              <span className={`${b.skipped ? 'text-slate-400' : 'text-slate-500'} font-medium`}>{b.note}</span>
                            </div>
                          ))}

                          {row.taklifJarima > 0 && !paid && canManage && (
                            <div className="flex flex-wrap items-center gap-3 pt-2 mt-2 border-t border-slate-200">
                              <span className="text-xs font-semibold text-rose-700">
                                Taklif qilingan jarima: {fmt(row.taklifJarima)} so'm
                              </span>
                              <button
                                onClick={() => setEdit(row.employeeId, 'penalty', row.taklifJarima)}
                                className="btn-danger h-sm"
                              >
                                Qabul qilish
                              </button>
                              <span className="t-caption">
                                yoki jarima ustuniga o'zingiz yozing
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center">
                    <div className="flex flex-col items-center py-12 text-slate-400">
                      <TrendingDown size={20} className="mb-3" />
                      <p className="text-xs font-semibold">Xodimlar topilmadi</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td><span className="label-caps">Jami</span></td>
                  <td colSpan={3} className="hidden md:table-cell"></td>
                  <td className="hidden md:table-cell text-right"><span className="text-xs font-bold tabular-nums text-slate-700">{fmt(totals.net)}</span></td>
                  <td className="hidden md:table-cell text-right"><span className="text-xs font-bold tabular-nums text-primary-600">−{fmt(totals.adv)}</span></td>
                  <td className="hidden md:table-cell"></td>
                  <td className="text-right"><span className="text-sm font-bold tabular-nums text-emerald-700">{fmt(totals.toPay)}</span></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </section>
  );
};

export default PayrollSection;
