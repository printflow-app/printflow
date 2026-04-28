import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Clock, RefreshCw, UserCheck, Timer, Calendar, CheckCircle2, AlertCircle, LogIn, LogOut, Users } from 'lucide-react';
import { attendanceApi, employeesApi, settingsApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee: { fullName: string; role?: { name: string } };
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
}

interface TokenData {
  id: string;
  token: string;
  expiresAt: string;
}

const TOKEN_LIFETIME_MS = 10 * 60 * 1000; // 10 daqiqa

const Davomat: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0); // soniyada
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sozlamalar modali uchun
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [workSettings, setWorkSettings] = useState({ 
    workStart: { hour: 9, minute: 0 },
    workEnd: { hour: 17, minute: 0 },
    workDays: [1, 2, 3, 4, 5, 6] // 0=Sun, 1=Mon...
  });

  // Xodim skaner modali uchun
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({ employeeId: '', action: 'checkin' as 'checkin' | 'checkout' });
  const [manualToken, setManualToken] = useState('');
  const [filterDate, setFilterDate] = useState(getTodayString());

  // Monthly matrix state
  const [matrixDate, setMatrixDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);

  function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const fetchToken = useCallback(async () => {
    try {
      const res = await attendanceApi.getToken();
      setTokenData(res.data);
      const expiresAt = new Date(res.data.expiresAt).getTime();
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    } catch {
      // backend offline bo'lishi mumkin
    }
  }, []);

  const fetchSettings = async () => {
    try {
      const [start, end, days] = await Promise.all([
        settingsApi.get('workStart'),
        settingsApi.get('workEnd'),
        settingsApi.get('workDays')
      ]);
      setWorkSettings({
        workStart: start.data || { hour: 9, minute: 0 },
        workEnd: end.data || { hour: 17, minute: 0 },
        workDays: days.data || [1, 2, 3, 4, 5, 6]
      });
    } catch {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        settingsApi.set('workStart', workSettings.workStart),
        settingsApi.set('workEnd', workSettings.workEnd),
        settingsApi.set('workDays', workSettings.workDays)
      ]);
      showStatus('success', 'Ish vaqti sozlamalari saqlandi! ✅');
      setIsSettingsModalOpen(false);
    } catch {
      showStatus('error', 'Saqlashda xatolik yuz berdi!');
    }
  };

  const fetchRecords = useCallback(async () => {
    try {
      const res = await attendanceApi.getRecords(filterDate);
      setRecords(res.data || []);
    } catch {
      setRecords([]);
    }
  }, [filterDate]);

  const fetchEmployees = async () => {
    try {
      const res = await employeesApi.findAll();
      setEmployees(res.data || []);
    } catch {}
  };

  const fetchMonthlyRecords = useCallback(async () => {
    if (!(isAdmin || currentUser.permissions?.canViewAttendance)) return;
    try {
      const res = await attendanceApi.getMonthlyRecords(matrixDate.year, matrixDate.month);
      setMonthlyRecords(res.data || []);
    } catch {
      setMonthlyRecords([]);
    }
  }, [isAdmin, currentUser.permissions, matrixDate]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchToken(), fetchRecords(), fetchEmployees(), fetchSettings()]);
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchMonthlyRecords();
  }, [fetchMonthlyRecords]);

  // Countdown timer
  useEffect(() => {
    if (!(isAdmin || currentUser.permissions?.canManageAttendance)) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Token muddati tugadi — yangi token ol
          fetchToken();
          return TOKEN_LIFETIME_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAdmin, currentUser.permissions, fetchToken]);

  const handleRefreshToken = async () => {
    try {
      const res = await attendanceApi.refreshToken();
      setTokenData(res.data);
      setTimeLeft(TOKEN_LIFETIME_MS / 1000);
      showStatus('success', 'Yangi QR kod yaratildi!');
    } catch {
      showStatus('error', 'Xatolik yuz berdi!');
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanForm.employeeId || !manualToken) {
      showStatus('error', 'Xodim va token majburiy!');
      return;
    }
    try {
      if (scanForm.action === 'checkin') {
        await attendanceApi.checkIn({ employeeId: scanForm.employeeId, token: manualToken });
        showStatus('success', 'Kelish muvaffaqiyatli belgilandi! ✅');
      } else {
        await attendanceApi.checkOut({ employeeId: scanForm.employeeId, token: manualToken });
        showStatus('success', 'Ketish muvaffaqiyatli belgilandi! 🚀');
      }
      setIsScanModalOpen(false);
      fetchRecords();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Xatolik!';
      showStatus('error', msg);
    }
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  };

  const timerMinutes = Math.floor(timeLeft / 60);
  const timerSeconds = timeLeft % 60;
  const timerPercent = (timeLeft / (TOKEN_LIFETIME_MS / 1000)) * 100;

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Status notification */}
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm tracking-tight">{statusMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <QrCode size={22} className="text-orange-500" /> Davomat Tizimi
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            QR-asosli kirim/chiqim nazorati
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="text-xs font-black text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>
          {(isAdmin || currentUser.permissions?.canManageAttendance) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-11 h-11 flex items-center justify-center bg-slate-100 text-slate-500 rounded-2xl border border-slate-200 hover:bg-white hover:text-orange-600 hover:border-orange-200 transition-all"
                title="Ish vaqti sozlamalari"
              >
                <Clock size={18} />
              </button>
              <button
                onClick={() => setIsScanModalOpen(true)}
                className="flex items-center gap-2 h-11 px-6 bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all"
              >
                <UserCheck size={16} /> Belgilash
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* QR Code Panel */}
        {(isAdmin || currentUser.permissions?.canManageAttendance) && (
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col items-center gap-5">
            <div className="text-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center justify-center gap-2">
                <QrCode size={16} className="text-orange-500" /> Joriy QR Kod
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Xodim skaner qiladi
              </p>
            </div>

            {/* QR Code */}
            {tokenData ? (
              <div className="relative p-4 bg-white rounded-2xl border-4 border-orange-100 shadow-inner">
                {(() => {
                  const currentSiteUrl = window.location.origin;
                  const finalQrUrl = `${currentSiteUrl}/attendance/scan?token=${tokenData.token}`;
                  return (
                    <QRCodeCanvas 
                      value={finalQrUrl} 
                      size={256} 
                      level="H" 
                      includeMargin={true} 
                    />
                  );
                })()}
                {timeLeft < 60 && (
                  <div className="absolute inset-0 bg-rose-500/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <p className="text-rose-600 font-black text-[10px] uppercase tracking-widest animate-pulse">Yangilanmoqda...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-[160px] h-[160px] bg-slate-100 rounded-2xl flex items-center justify-center">
                <QrCode size={40} className="text-slate-300" />
              </div>
            )}

            {/* Countdown Timer */}
            <div className="w-full space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Timer size={10} /> Muddat tugashiga
                </span>
                <span className={`text-base font-black tabular-nums ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-orange-600'}`}>
                  {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${timerPercent > 30 ? 'bg-orange-500' : timerPercent > 10 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleRefreshToken}
              className="flex items-center gap-1.5 w-full h-10 justify-center bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-slate-500 hover:text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              <RefreshCw size={12} /> Yangi Kod
            </button>

            {/* Token value (for manual entry) */}
            <div className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Qo'lda kiritish kodi</p>
              <p className="text-[9px] font-mono text-slate-600 break-all leading-tight opacity-70 italic">{tokenData?.token}</p>
            </div>
          </div>
        )}

        {/* Records Table */}
        <div className={`${(isAdmin || currentUser.permissions?.canManageAttendance) ? 'lg:col-span-3' : 'lg:col-span-5'} bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Users size={14} className="text-orange-400" />
                Davomat Jurnali
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                {filterDate} • {records.length} yozuv
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                {records.filter(r => r.checkIn).length}
              </div>
              <div className="flex items-center gap-1 text-[9px] font-black text-orange-600">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                {records.filter(r => r.checkOut).length}
              </div>
              <div className="flex items-center gap-1 text-[9px] font-black text-rose-500">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                {records.filter(r => r.lateMinutes > 0).length}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Xodim</th>
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Keldi</th>
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Ketdi</th>
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Kechikish</th>
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Holat</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <QrCode size={30} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">Ma'lumot yo'q</p>
                    </td>
                  </tr>
                ) : (
                  records.map(record => (
                    <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center border border-orange-200">
                            {record.employee?.fullName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{record.employee?.fullName}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{record.employee?.role?.name || 'Xodim'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <LogIn size={12} className={record.checkIn ? 'text-emerald-500' : 'text-slate-200'} />
                          <span className={`font-black tabular-nums ${record.checkIn ? 'text-emerald-600' : 'text-slate-300'}`}>
                            {formatTime(record.checkIn)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <LogOut size={12} className={record.checkOut ? 'text-sky-500' : 'text-slate-200'} />
                          <span className={`font-black tabular-nums ${record.checkOut ? 'text-sky-600' : 'text-slate-300'}`}>
                            {formatTime(record.checkOut)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {record.lateMinutes > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 text-[9px] font-black px-2 py-0.5 rounded-lg border border-rose-100">
                             +{record.lateMinutes} m
                          </span>
                        ) : record.checkIn ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[9px] font-black px-2 py-0.5 rounded-lg border border-emerald-100">
                            OK
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {!record.checkIn ? (
                          <span className="text-slate-300 text-[8px] font-black uppercase">Kelmagan</span>
                        ) : !record.checkOut ? (
                          <span className="text-orange-600 text-[8px] font-black uppercase animate-pulse">Ishda</span>
                        ) : (
                          <span className="text-emerald-600 text-[8px] font-black uppercase">Tugallandi</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Oylik Jadval (Monthly Matrix) */}
      {(isAdmin || currentUser.permissions?.canViewAttendance) && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Calendar size={14} className="text-orange-400" />
                Oylik Davomat Jadvali
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={matrixDate.month}
                onChange={e => setMatrixDate(p => ({ ...p, month: parseInt(e.target.value) }))}
                className="select-minimal text-xs font-black h-9 py-0"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('uz-UZ', { month: 'long' })}</option>
                ))}
              </select>
              <select
                value={matrixDate.year}
                onChange={e => setMatrixDate(p => ({ ...p, year: parseInt(e.target.value) }))}
                className="select-minimal text-xs font-black h-9 py-0"
              >
                {[...Array(5)].map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-[9px] font-black text-slate-400 uppercase border-r border-slate-100 min-w-[120px]">
                    Xodim
                  </th>
                  {Array.from({length: new Date(matrixDate.year, matrixDate.month, 0).getDate()}).map((_, i) => (
                    <th key={i} className="px-1 py-2 text-center text-[8px] font-black text-slate-400 uppercase w-6">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const empRecords = monthlyRecords.filter(r => r.employeeId === emp.id);
                  return (
                    <tr key={emp.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-2 py-2 border-r border-slate-100">
                        <p className="text-[10px] font-black text-slate-700 truncate max-w-[110px]" title={emp.fullName}>
                          {emp.fullName}
                        </p>
                      </td>
                      {Array.from({length: new Date(matrixDate.year, matrixDate.month, 0).getDate()}).map((_, i) => {
                        const dateStr = `${matrixDate.year}-${String(matrixDate.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                        const dayRecord = empRecords.find(r => r.date === dateStr);
                        
                        let dotClass = 'bg-slate-100'; // Kelmagan
                        let title = 'Kelmagan';
                        if (dayRecord?.checkIn) {
                          if (dayRecord.lateMinutes > 0) {
                            dotClass = 'bg-rose-400';
                            title = `Kech qolgan: ${dayRecord.lateMinutes}m`;
                          } else {
                            dotClass = 'bg-emerald-400';
                            title = 'Vaqtida kelgan';
                          }
                        }
                        
                        return (
                          <td key={i} className="px-1 py-1 tabular-nums text-center">
                            <div className={`w-2.5 h-2.5 rounded-full mx-auto shadow-sm ${dotClass}`} title={`${dateStr}: ${title}`} />
                          </td>
                        );
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: SETTINGS */}
       <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Ish Vaqti Sozlamalari" maxWidth="max-w-lg">
        <form onSubmit={handleSaveSettings} className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
             <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
               <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2"><LogIn size={12}/> Ish Boshlanishi:</p>
               <div className="flex items-center gap-2">
                  <input 
                    type="number" min="0" max="23" 
                    value={workSettings.workStart.hour} 
                    onChange={e => setWorkSettings({...workSettings, workStart: {...workSettings.workStart, hour: parseInt(e.target.value) || 0}})}
                    className="input-minimal text-center font-black h-10 border-emerald-200"
                  />
                  <span className="font-bold text-slate-300">:</span>
                  <input 
                    type="number" min="0" max="59" 
                    value={workSettings.workStart.minute} 
                    onChange={e => setWorkSettings({...workSettings, workStart: {...workSettings.workStart, minute: parseInt(e.target.value) || 0}})}
                    className="input-minimal text-center font-black h-10 border-emerald-200"
                  />
               </div>
             </div>

             <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
               <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2"><LogOut size={12}/> Ish Tugashi:</p>
               <div className="flex items-center gap-2">
                  <input 
                    type="number" min="0" max="23" 
                    value={workSettings.workEnd.hour} 
                    onChange={e => setWorkSettings({...workSettings, workEnd: {...workSettings.workEnd, hour: parseInt(e.target.value) || 0}})}
                    className="input-minimal text-center font-black h-10 border-rose-200"
                  />
                  <span className="font-bold text-slate-300">:</span>
                  <input 
                    type="number" min="0" max="59" 
                    value={workSettings.workEnd.minute} 
                    onChange={e => setWorkSettings({...workSettings, workEnd: {...workSettings.workEnd, minute: parseInt(e.target.value) || 0}})}
                    className="input-minimal text-center font-black h-10 border-rose-200"
                  />
               </div>
             </div>
           </div>

           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Calendar size={12}/> Ish Kunlari (Grafik):</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'].map((day, idx) => {
                  const isActive = workSettings.workDays.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const newDays = isActive 
                          ? workSettings.workDays.filter(d => d !== idx)
                          : [...workSettings.workDays, idx].sort();
                        setWorkSettings({...workSettings, workDays: newDays});
                      }}
                      className={`h-10 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${
                        isActive 
                          ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-200' 
                          : 'bg-white border-slate-100 text-slate-400 hover:border-orange-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
           </div>

           <div className="flex gap-3">
             <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="btn-outline flex-1 h-12 rounded-xl text-[10px] uppercase font-black tracking-widest">Bekor Berish</button>
             <button type="submit" className="btn-primary flex-1 h-12 rounded-xl text-[10px] uppercase font-black tracking-widest bg-orange-600 border-none shadow-orange-200">Saqlash</button>
           </div>
        </form>
      </Modal>

      {/* MODAL: SCAN / MANUAL */}
      <Modal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} title="Davomat Belgilash">
        <form onSubmit={handleScan} className="space-y-4">
          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setScanForm(f => ({ ...f, action: 'checkin' }))}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${scanForm.action === 'checkin' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LogIn size={12} /> Keldi
            </button>
            <button
              type="button"
              onClick={() => setScanForm(f => ({ ...f, action: 'checkout' }))}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${scanForm.action === 'checkout' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LogOut size={12} /> Ketdi
            </button>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 px-1">Xodim</label>
            <select
              required
              value={scanForm.employeeId}
              onChange={e => setScanForm(f => ({ ...f, employeeId: e.target.value }))}
              className="select-minimal text-xs font-black h-11"
            >
              <option value="">Tanlang...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 px-1">
              QR Token kodi
            </label>
            <input
              type="text"
              required
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              className="input-minimal font-mono text-[10px] h-11"
              placeholder="QR-dagi kodni kiritish"
            />
          </div>

          {tokenData && (
            <button
              type="button"
              onClick={() => setManualToken(tokenData.token)}
              className="w-full py-2 text-[9px] font-black text-orange-600 uppercase tracking-widest border border-dashed border-orange-200 rounded-lg hover:bg-white transition-colors"
            >
              Joriy kodni to'ldirish
            </button>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-outline h-11 flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest" onClick={() => setIsScanModalOpen(false)}>Yopish</button>
            <button type="submit" className={`btn-primary h-11 flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest ${scanForm.action === 'checkin' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-sky-500 hover:bg-sky-600'} border-none shadow-md`}>
              Tasdiqlash
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Davomat;
