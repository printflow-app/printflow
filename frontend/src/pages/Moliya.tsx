import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, Filter, CheckCircle } from 'lucide-react';
import { financeApi, branchesApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + " UZS";
};

const Moliya: React.FC<{ currentUser?: any; activeBranchId?: string }> = ({ activeBranchId }) => {
  const [dashboard, setDashboard] = useState({ totalKirim: 0, totalChiqim: 0, balance: 0, completedTasks: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [paymentTypeStats, setPaymentTypeStats] = useState<{ kirim: any[], chiqim: any[] }>({ kirim: [], chiqim: [] });
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all'|'today'|'week'|'month'>('all');
  const [branches, setBranches] = useState<any[]>([]);
  const [localBranchId, setLocalBranchId] = useState(activeBranchId || '');

  // Local-date YYYY-MM-DD — `toISOString()` shifts to UTC and silently rolls back
  // by a day for users in UTC+ timezones during early-morning hours.
  const localYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const setFilter = (type: 'all'|'today'|'week'|'month') => {
    setActiveFilter(type);
    const today = new Date();
    if (type === 'today') {
      const d = localYMD(today);
      setStartDate(d);
      setEndDate(d);
    } else if (type === 'week') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(localYMD(w));
      setEndDate(localYMD(today));
    } else if (type === 'month') {
      const m = new Date();
      m.setDate(m.getDate() - 30);
      setStartDate(localYMD(m));
      setEndDate(localYMD(today));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;
      if (localBranchId) params.branchId = localBranchId;
      else if (activeBranchId && localBranchId === undefined) params.branchId = activeBranchId; // Fallback if needed

      const [dashRes, chartRes, statsRes, breakdownRes, branchRes] = await Promise.all([
        financeApi.getDashboard({ params }),
        financeApi.getDinamika({ params }),
        financeApi.getStatsByPaymentType({ params }),
        financeApi.getExpenseBreakdown({ params }),
        branchesApi.findAll(),
      ]);
      setDashboard(dashRes.data || { totalKirim: 0, totalChiqim: 0, balance: 0, completedTasks: 0 });
      setChartData(chartRes.data || []);
      setPaymentTypeStats(statsRes.data || { kirim: [], chiqim: [] });
      setExpenseBreakdown(breakdownRes.data || []);
      setBranches(branchRes.data || []);
    } catch (err) {
      console.error("Moliya hisobot yuklashda xato:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, localBranchId, activeBranchId]);

  if (isLoading && chartData.length === 0) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* Filters Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
           <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 px-1"><Filter size={18} className="text-[#FF6B00]" /> Filtrlar</h3>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 px-1 font-sans">Sana bo'yicha tahlil</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 border-t xl:border-t-0 border-slate-100 pt-3 xl:pt-0">
            <div className="flex bg-slate-100 p-0.5 rounded-lg w-full sm:w-auto shadow-inner">
              <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${activeFilter === 'all' ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}>Barchasi</button>
              <button onClick={() => setFilter('today')} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${activeFilter === 'today' ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}>Bugun</button>
              <button onClick={() => setFilter('week')} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${activeFilter === 'week' ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}>Hafta</button>
              <button onClick={() => setFilter('month')} className={`flex-1 sm:flex-none px-4 py-1.5 text-[10px] font-black rounded-md transition-all ${activeFilter === 'month' ? 'bg-white shadow-sm text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}>Oy</button>
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

            <div className="hidden sm:flex items-center gap-2">
               <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 px-3 py-1.5 rounded-lg bg-slate-50/50">
                  Hisobotlar markazi
               </div>
            </div>
         </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125"></div>
          <div className="relative">
            <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-3 border border-emerald-200 shadow-sm"><TrendingUp size={18}/></div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Jami Kirim</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(dashboard.totalKirim)}</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125"></div>
          <div className="relative">
            <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-3 border border-rose-200 shadow-sm"><TrendingDown size={18}/></div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Jami Chiqim</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{formatCurrency(dashboard.totalChiqim)}</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 opacity-40 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125"></div>
          <div className="relative">
            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3 border border-blue-200 shadow-sm"><CheckCircle size={18}/></div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Bajarilgan Buyurtmalar</p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">{dashboard.completedTasks || 0} ta</h3>
          </div>
        </div>
        <div className="bg-slate-900 p-4 rounded-xl shadow-lg relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-800 rounded-full -mr-12 -mb-12 opacity-40 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <div className="w-9 h-9 bg-[#FF6B00] text-white rounded-xl flex items-center justify-center mb-3 ring-4 ring-orange-500/20 shadow-lg"><Wallet size={18}/></div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sof Foyda (Balans)</p>
            <h3 className="text-xl font-black text-white tracking-tight">{formatCurrency(dashboard.balance)}</h3>
          </div>
        </div>
      </div>

      {/* Charts Group */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dynamic Line Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative lg:col-span-2">
           {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-xl items-center justify-center flex p-10"><LoadingSpinner /></div>}
           
           <div className="flex justify-between items-center mb-5">
             <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Moliyaviy Dinamika</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Kirim, Chiqim va Qoldiq tahlili</p>
             </div>
           </div>
           
            <div className="h-[280px] sm:h-[350px] min-h-[250px] w-full bg-slate-50/20 rounded-xl overflow-hidden">
              <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={10} 
                    fontWeight={700} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8'}} 
                    dy={10}
                    minTickGap={30}
                    tickFormatter={(val) => {
                      try {
                        const date = new Date(val);
                        return isNaN(date.getTime()) ? val : date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
                      } catch { return val; }
                    }}
                  />
                  <YAxis 
                    fontSize={10} 
                    fontWeight={700} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8'}} 
                    dx={-5}
                    tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', fontSize: '12px', padding: '12px' }}
                    formatter={(value: any) => formatCurrency(value)}
                    labelStyle={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '24px' }} />
                  <Line type="monotone" name="Kirim" dataKey="kirim" stroke="#10b981" strokeWidth={4} dot={{r: 0}} activeDot={{r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2}} />
                  <Line type="monotone" name="Chiqim" dataKey="chiqim" stroke="#ef4444" strokeWidth={4} dot={{r: 0}} activeDot={{r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2}} />
                  <Line type="monotone" name="Qoldiq" dataKey="balance" stroke="#FF6B00" strokeWidth={4} strokeDasharray="5 5" dot={{r: 0}} activeDot={{r: 6, fill: '#FF6B00', stroke: '#fff', strokeWidth: 2}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
        </div>

        {/* Payment Type Distribution - Kirim */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
           <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2 mb-0.5">
             <TrendingUp className="text-emerald-500" size={16} /> Kirim turlari
           </h3>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">To'lov turlari bo'yicha</p>
           
           <div className="h-[220px] w-full overflow-hidden">
              {paymentTypeStats.kirim.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={paymentTypeStats.kirim}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentTypeStats.kirim.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#FF6B00', '#6366f1'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest">Ma'lumot yo'q</div>
              )}
           </div>
        </div>

        {/* Payment Type Distribution - Chiqim */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative">
           <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2 mb-0.5">
             <TrendingDown className="text-rose-500" size={16} /> Chiqim turlari
           </h3>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">Xarajat turlari bo'yicha</p>
           
           <div className="h-[220px] w-full overflow-hidden">
              {paymentTypeStats.chiqim.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={paymentTypeStats.chiqim}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentTypeStats.chiqim.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#ef4444', '#f59e0b', '#3b82f6', '#6366f1'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest">Ma'lumot yo'q</div>
              )}
           </div>
        </div>
        {/* Expense Breakdown by Category */}
        {(isAdmin || currentUser?.permissions?.canViewExpenseCharts) && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative lg:col-span-2">
            {isLoading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-xl items-center justify-center flex"><LoadingSpinner /></div>}
            <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2 mb-0.5">
              <TrendingDown className="text-rose-500" size={16} /> Chiqim Tahlili (Kategoriyalar bo'yicha)
            </h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-5">Xarajatlar bo'limi bo'yicha taqsimot</p>
            
            {expenseBreakdown.length === 0 ? (
              <div className="h-[220px] flex flex-col items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest">Ma'lumot yo'q</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Pie chart */}
                <div className="h-[220px] w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%" debounce={100} minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseBreakdown.map((_, i) => (
                          <Cell key={i} fill={['#ef4444','#f59e0b','#3b82f6','#8b5cf6','#10b981','#ec4899','#06b6d4','#f97316','#6366f1','#84cc16'][i % 10]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend list */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scroll pr-2">
                  {expenseBreakdown.map((item, i) => {
                    const total = expenseBreakdown.reduce((s, x) => s + x.value, 0);
                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                    const colors = ['#ef4444','#f59e0b','#3b82f6','#8b5cf6','#10b981','#ec4899','#06b6d4','#f97316','#6366f1','#84cc16'];
                    return (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % 10] }} />
                          <span className="text-[11px] font-bold text-slate-600 truncate">{item.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] font-black text-slate-800">{formatCurrency(item.value)}</p>
                          <p className="text-[9px] font-bold text-slate-400">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Moliya;
