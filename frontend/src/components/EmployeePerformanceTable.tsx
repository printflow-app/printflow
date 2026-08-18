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
  if (previous === null || previous === undefined) return <span className="text-xs font-medium text-slate-400">—</span>;
  const diff = current - previous;
  if (Math.abs(diff) < 2) return <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-slate-500"><Minus size={12} />0</span>;
  return diff > 0
    ? <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-emerald-600"><TrendingUp size={12} />+{diff}</span>
    : <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-rose-600"><TrendingDown size={12} />{diff}</span>;
};

const EmployeePerformanceTable: React.FC<Props> = ({ rows, velocity, prevRows, title, showTrend, showBar }) => {
  const getVelocityData = (empId: string) => velocity.find(v => v.employeeId === empId);
  const getPrevScore = (empId: string) => prevRows?.find(r => r.employeeId === empId)?.velocityScore ?? null;

  return (
    <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="card-title flex items-center gap-2">
            <Award size={18} className="text-[color:var(--primary)]" /> {title}
          </h3>
          <p className="t-caption mt-0.5">
            Bajarilgan buyurtmalar, muddatga rioya va daromad ulushi
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table-minimal">
          <thead>
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Xodim</th>
              <th className="text-right">Bajarilgan</th>
              <th className="text-right hidden md:table-cell">Jarayonda</th>
              <th className="text-right hidden md:table-cell">Muddatga rioya</th>
              <th className="text-right hidden lg:table-cell">Avg vaqt</th>
              <th className="text-right hidden md:table-cell">Daromad</th>
              <th className="text-right">Score</th>
              {showTrend && <th className="text-right hidden md:table-cell">Trend</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={showTrend ? 9 : 8} className="p-8 text-center text-slate-500">Ma'lumot yo'q</td></tr>
            )}
            {rows.map((r, i) => {
              const vel = getVelocityData(r.employeeId);
              const prevScore = getPrevScore(r.employeeId);
              const avgHours = vel?.avgTaskHours ?? r.avgVelocityHours;
              const barPct = Math.round((r.velocityScore / (rows[0]?.velocityScore || 1)) * 100);

              return (
                <tr key={r.employeeId} className={i < 3 ? 'bg-primary-50/50' : ''}>
                  <td className="text-slate-500 tabular-nums">{i + 1}</td>
                  <td>
                    <div className="font-semibold text-slate-800">{r.fullName}</div>
                    <div className="text-xs text-slate-500">{r.roleName || '—'}</div>
                  </td>
                  <td className="text-right tabular-nums font-semibold text-emerald-600">{r.completedTasks}</td>
                  <td className="text-right tabular-nums font-semibold text-amber-600 hidden md:table-cell">{r.pendingTasks}</td>
                  <td className="text-right hidden md:table-cell">
                    {vel?.deadlineMeetRate != null
                      ? <span className={`font-semibold tabular-nums ${vel.deadlineMeetRate >= 80 ? 'text-emerald-600' : vel.deadlineMeetRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{vel.deadlineMeetRate}%</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="text-right tabular-nums text-slate-600 hidden lg:table-cell">{avgHours != null ? `${avgHours}h` : '—'}</td>
                  <td className="text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap hidden md:table-cell">
                    {vel ? fmt(vel.totalRevenue) : '—'}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {showBar && (
                        <div className="hidden md:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[color:var(--primary)] rounded-full transition-all" style={{ width: `${barPct}%` }} />
                        </div>
                      )}
                      <span className="badge-primary tabular-nums min-w-[36px] justify-center">{r.velocityScore}</span>
                    </div>
                  </td>
                  {showTrend && (
                    <td className="text-right hidden md:table-cell">
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
