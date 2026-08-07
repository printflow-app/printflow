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
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Wallet className="text-emerald-500" size={24} /> Maosh (oylik hisob-kitob)
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Fiksa + bonus − jarima − avans = berish kerak
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase">Oy</label>
          <input
            type="month"
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setEdits({}); }}
            className="input-minimal w-auto h-control-sm text-sm font-bold"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-100">
                <th className="py-3 px-4 label-caps">Xodim</th>
                <th className="py-3 px-3 label-caps text-right">Fiksa</th>
                <th className="py-3 px-3 label-caps text-right">Bonus</th>
                <th className="py-3 px-3 label-caps text-right">Jarima</th>
                <th className="py-3 px-3 label-caps text-right">Sof maosh</th>
                <th className="py-3 px-3 label-caps text-right">Avans (oy)</th>
                <th className="py-3 px-3 label-caps text-right">Oldingi qarz</th>
                <th className="py-3 px-3 label-caps text-right">Berish kerak</th>
                <th className="py-3 px-3 label-caps text-center">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const paid = row.status === 'paid';
                const busy = busyId === row.employeeId;
                const toPay = liveToPay(row);
                return (
                  <React.Fragment key={row.employeeId}>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {/* Sxema bo'yicha hisoblangan bo'lsa — tafsilotni ochish */}
                        {row.breakdown?.length ? (
                          <button
                            onClick={() => setOpenRow(openRow === row.employeeId ? null : row.employeeId)}
                            title="Hisob tafsiloti"
                            className="w-5 h-5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 flex items-center justify-center flex-shrink-0"
                          >
                            {openRow === row.employeeId ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        ) : (
                          <span className="w-5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-800">{row.fullName}</p>
                          <p className="text-[11px] text-slate-400">
                            {row.roleName}
                            {row.avtomatik && <span className="ml-1.5 text-orange-500 font-bold">· avtomatik</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 w-32">
                      {paid ? (
                        <span className="block text-right text-xs font-bold tabular-nums text-slate-600">{fmt(row.fixedSalary)}</span>
                      ) : (
                        <CurrencyInput value={String(val(row, 'fixedSalary') || '')} onChange={(u) => setEdit(row.employeeId, 'fixedSalary', u || 0)} colorClass="text-slate-800" className="input-minimal h-9 text-xs text-right" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 w-32">
                      {paid ? (
                        <span className="block text-right text-xs font-bold tabular-nums text-emerald-600">{row.bonus ? '+' + fmt(row.bonus) : '—'}</span>
                      ) : (
                        <CurrencyInput value={String(val(row, 'bonus') || '')} onChange={(u) => setEdit(row.employeeId, 'bonus', u || 0)} colorClass="text-emerald-600" className="input-minimal h-9 text-xs text-right" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 w-32">
                      {paid ? (
                        <span className="block text-right text-xs font-bold tabular-nums text-rose-600">{row.penalty ? '−' + fmt(row.penalty) : '—'}</span>
                      ) : (
                        <CurrencyInput value={String(val(row, 'penalty') || '')} onChange={(u) => setEdit(row.employeeId, 'penalty', u || 0)} colorClass="text-rose-600" className="input-minimal h-9 text-xs text-right" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold tabular-nums text-slate-700">{fmt(liveNet(row))}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold tabular-nums text-orange-600">{row.advances ? '−' + fmt(row.advances) : '—'}</td>
                    <td className="py-2.5 px-3 text-right text-xs font-bold tabular-nums text-rose-500">{row.prevDebt ? '−' + fmt(row.prevDebt) : '—'}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span className={`text-sm font-bold tabular-nums ${toPay < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{fmt(toPay)}</span>
                      {toPay < 0 && <p className="text-[10px] font-bold text-rose-400">keyingi oyga qarz</p>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {paid ? (
                          <>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md uppercase">To'langan</span>
                            {canManage && (
                              <button onClick={() => handleRevert(row)} disabled={busy} title="Bekor qilish" className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors disabled:opacity-40">
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </>
                        ) : canManage ? (
                          <>
                            <button onClick={() => handleSave(row)} disabled={busy} title="Saqlash" className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors disabled:opacity-40">
                              <Save size={14} />
                            </button>
                            <button onClick={() => handlePay(row)} disabled={busy} className="btn-success h-sm">
                              <Check size={13} /> To'lash
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-300 uppercase">qoralama</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Hisob tafsiloti — qaysi qator nimadan chiqdi, qaysi biri
                      shart bajarilmagani uchun tushib qolgan. */}
                  {openRow === row.employeeId && row.breakdown?.length > 0 && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="max-w-3xl space-y-1.5">
                          {row.breakdown.map((b: any) => (
                            <div key={b.id} className="flex items-center gap-3 text-[12px]">
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
                            <div className="flex items-center gap-3 pt-2 mt-2 border-t border-slate-200">
                              <span className="text-[12px] font-bold text-rose-700">
                                Taklif qilingan jarima: {fmt(row.taklifJarima)} so'm
                              </span>
                              <button
                                onClick={() => setEdit(row.employeeId, 'penalty', row.taklifJarima)}
                                className="h-7 px-3 text-[11px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                              >
                                Qabul qilish
                              </button>
                              <span className="text-[11px] font-medium text-slate-400">
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
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <TrendingDown size={36} className="mb-3" />
                      <p className="font-bold uppercase text-xs">Xodimlar topilmadi</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                <tr>
                  <td className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Jami</td>
                  <td colSpan={3}></td>
                  <td className="py-3 px-3 text-right text-xs font-bold tabular-nums text-slate-700">{fmt(totals.net)}</td>
                  <td className="py-3 px-3 text-right text-xs font-bold tabular-nums text-orange-600">−{fmt(totals.adv)}</td>
                  <td></td>
                  <td className="py-3 px-3 text-right text-sm font-bold tabular-nums text-emerald-700">{fmt(totals.toPay)}</td>
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
