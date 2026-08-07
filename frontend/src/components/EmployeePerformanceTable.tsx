import React from 'react';
import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

interface KpiRow {
  employeeId: string;
  fullName: string;
  roleName: string | null;
  completedTasks: number;
  pendingTasks: number;
  lateMinutes: number;
  velocityScore: number;
  totalActivity?: number;
  avgVelocityHours?: number | null;
}

interface VelocityRow {
  employeeId: string;
  totalRevenue: number;
  deadlineMeetRate: number | null;
  avgTaskHours?: number | null;
}

interface Props {
  rows: KpiRow[];
  velocity: VelocityRow[];
  prevRows?: KpiRow[];
  title: string;
  showTrend?: boolean;
  showBar?: boolean;
}

// Aniq raqam — yumaloqlanmaydi (mingliklar bo'sh joy bilan, kerak bo'lsa tiyingacha).
const fmt = (n: number) => {
  const v = Number(n) || 0;
  const hasFraction = Math.abs(v % 1) > 1e-9;
  return new Intl.NumberFormat('uz-UZ', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(v).replace(/,/g, ' ');
};

const ScoreDelta = ({ current, previous }: { current: number; previous: number | null }) => {
  if (previous === null || previous === undefined) return <span className="text-[10px] font-bold text-slate-300">—</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 2) return <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400"><Minus size={9} />0</span>;
  return diff > 0
    ? <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600"><TrendingUp size={9} />+{diff}</span>
    : <span className="flex items-center gap-0.5 text-[10px] font-bold text-rose-500"><TrendingDown size={9} />{diff}</span>;
};

const EmployeePerformanceTable: React.FC<Props> = ({ rows, velocity, prevRows, title, showTrend, showBar }) => {
  const getVelocityData = (empId: string) => velocity.find(v => v.employeeId === empId);
  const getPrevScore = (empId: string) => prevRows?.find(r => r.employeeId === empId)?.velocityScore ?? null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Award size={18} className="text-orange-500" /> {title}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Bajarilgan buyurtmalar, muddatga rioya va daromad ulushi
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">#</th>
              <th className="text-left p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Xodim</th>
              <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bajarilgan</th>
              <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jarayonda</th>
              <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Muddatga rioya</th>
              <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg vaqt</th>
              <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Daromad</th>
              <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</th>
              {showTrend && <th className="text-right p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trend</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={showTrend ? 9 : 8} className="p-8 text-center text-slate-400 font-bold text-xs uppercase">Ma'lumot yo'q</td></tr>
            )}
            {rows.map((r, i) => {
              const vel = getVelocityData(r.employeeId);
              const prevScore = getPrevScore(r.employeeId);
              const avgHours = vel?.avgTaskHours ?? r.avgVelocityHours;
              const barPct = Math.round((r.velocityScore / (rows[0]?.velocityScore || 1)) * 100);

              return (
                <tr key={r.employeeId} className={`border-t border-slate-100 hover:bg-orange-50/20 transition-colors ${i < 3 ? 'bg-orange-50/10' : ''}`}>
                  <td className="p-3 font-bold text-slate-500 text-[12px]">{i + 1}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{r.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-bold">{r.roleName || '—'}</div>
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-600">{r.completedTasks}</td>
                  <td className="p-3 text-right font-bold text-amber-500">{r.pendingTasks}</td>
                  <td className="p-3 text-right">
                    {vel?.deadlineMeetRate != null
                      ? <span className={`font-bold text-xs ${vel.deadlineMeetRate >= 80 ? 'text-emerald-600' : vel.deadlineMeetRate >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>{vel.deadlineMeetRate}%</span>
                      : <span className="text-slate-300 font-bold text-xs">—</span>}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-600">{avgHours != null ? `${avgHours}h` : '—'}</td>
                  <td className="p-3 text-right font-bold text-slate-700 tabular-nums text-xs whitespace-nowrap">
                    {vel ? fmt(vel.totalRevenue) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {showBar && (
                        <div className="hidden md:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                        </div>
                      )}
                      <span className="inline-block px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md font-bold text-xs min-w-[36px] text-center">{r.velocityScore}</span>
                    </div>
                  </td>
                  {showTrend && (
                    <td className="p-3 text-right">
                      <ScoreDelta current={r.velocityScore} previous={prevScore} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeePerformanceTable;
