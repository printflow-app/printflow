import React, { useState, useEffect } from 'react';
import { TrendingUp, Filter, CheckCircle } from 'lucide-react';
import { financeApi, branchesApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Kpi from './Kpi';

// =============================================
// STATISTIKA — Joriy operatsion ko'rsatkichlar
// Jami kirim, bajarilgan buyurtmalar + Xodimlar samaradorligi.
// Tahlil grafiklarni va chiqim hisobotlarni → Hisobotlar sahifasiga.
// =============================================

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + ' UZS';

const Moliya: React.FC<{ currentUser?: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const [dashboard, setDashboard] = useState({ totalKirim: 0, totalChiqim: 0, balance: 0, completedTasks: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [branches, setBranches] = useState<any[]>([]);
  const [localBranchId, setLocalBranchId] = useState(activeBranchId || '');

  const localYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const setFilter = (type: 'all' | 'today' | 'week' | 'month') => {
    setActiveFilter(type);
    const today = new Date();
    if (type === 'today') {
      const d = localYMD(today); setStartDate(d); setEndDate(d);
    } else if (type === 'week') {
      const w = new Date(); w.setDate(w.getDate() - 7);
      setStartDate(localYMD(w)); setEndDate(localYMD(today));
    } else if (type === 'month') {
      const m = new Date(); m.setDate(m.getDate() - 30);
      setStartDate(localYMD(m)); setEndDate(localYMD(today));
    } else {
      setStartDate(''); setEndDate('');
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;
      if (localBranchId) params.branchId = localBranchId;

      const [dashRes, branchRes] = await Promise.all([
        financeApi.getDashboard({ params }),
        branchesApi.findAll(),
      ]);
      setDashboard(dashRes.data || { totalKirim: 0, totalChiqim: 0, balance: 0, completedTasks: 0 });
      setBranches(branchRes.data || []);
    } catch (err) {
      console.error('Statistika yuklashda xato:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [startDate, endDate, localBranchId, activeBranchId]);

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 px-1">
            <Filter size={18} className="text-[#FF6B00]" /> Filtrlar
          </h3>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 px-1">Sana bo'yicha tahlil</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t xl:border-t-0 border-slate-100 pt-3 xl:pt-0">
          <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto shadow-inner">
            {(['all', 'today', 'week', 'month'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${activeFilter === f ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f === 'all' ? 'Barchasi' : f === 'today' ? 'Bugun' : f === 'week' ? 'Hafta' : 'Oy'}
              </button>
            ))}
          </div>

          {branches.length > 0 && (
            <select
              value={localBranchId}
              onChange={e => setLocalBranchId(e.target.value)}
              className="select-minimal h-[32px] text-[10px] font-black py-0 px-3 bg-slate-50 border-slate-200 text-slate-600 rounded-lg min-w-[150px]"
            >
              <option value="">Barcha filiallar</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPI Cards — Kirim + Bajarilgan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125" />
          <div className="relative">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3 border border-emerald-200 shadow-sm">
              <TrendingUp size={18} />
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Jami Kirim</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(dashboard.totalKirim)}</h3>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125" />
          <div className="relative">
            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3 border border-blue-200 shadow-sm">
              <CheckCircle size={18} />
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bajarilgan Buyurtmalar</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{dashboard.completedTasks || 0} ta</h3>
          </div>
        </div>
      </div>

      {/* Employee KPI / Samaradorlik */}
      <Kpi currentUser={currentUser} />
    </div>
  );
};

export default Moliya;
