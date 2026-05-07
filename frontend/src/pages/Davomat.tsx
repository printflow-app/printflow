import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  QrCode, Clock, RefreshCw, UserCheck, Calendar, CheckCircle2, AlertCircle,
  LogIn, LogOut, Users, Printer, Wifi, AlarmClock, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { attendanceApi, employeesApi, settingsApi, overtimeApi } from '../api';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee: { fullName: string; role?: { name: string } };
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  overtimeMinutes?: number;
}

interface OvertimeRequest {
  id: string;
  employeeId: string;
  employee: { fullName: string; role?: { name: string } };
  date: string;
  message: string;
  minutes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const Davomat: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const canManage = isAdmin || currentUser.permissions?.canManageAttendance;
  const canView = isAdmin || currentUser.permissions?.canViewAttendance;

  const [token, setToken] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [workSettings, setWorkSettings] = useState({
    workStart: { hour: 9, minute: 0 },
    workEnd: { hour: 17, minute: 0 },
    workDays: [1, 2, 3, 4, 5, 6],
  });

  // Manual scan modal
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanForm, setScanForm] = useState({ employeeId: '', action: 'checkin' as 'checkin' | 'checkout' });
  const [manualToken, setManualToken] = useState('');

  // Filters
  const [filterDate, setFilterDate] = useState(getTodayString());

  // Confirm rotate token
  const [isRotateConfirmOpen, setIsRotateConfirmOpen] = useState(false);

  // Reject overtime modal
  const [rejectingRequest, setRejectingRequest] = useState<OvertimeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Monthly matrix
  const [matrixDate, setMatrixDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
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
      setToken(res.data?.token || null);
    } catch {
      // Backend offline bo'lishi mumkin
    }
  }, []);

  const fetchSettings = async () => {
    try {
      const [start, end, days] = await Promise.all([
        settingsApi.get('workStart'),
        settingsApi.get('workEnd'),
        settingsApi.get('workDays'),
      ]);
      setWorkSettings({
        workStart: start.data || { hour: 9, minute: 0 },
        workEnd: end.data || { hour: 17, minute: 0 },
        workDays: days.data || [1, 2, 3, 4, 5, 6],
      });
    } catch {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        settingsApi.set('workStart', workSettings.workStart),
        settingsApi.set('workEnd', workSettings.workEnd),
        settingsApi.set('workDays', workSettings.workDays),
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
      const filteredEmployees = (res.data || []).filter((emp: any) => {
        const roleName = emp.role?.name?.toLowerCase() || '';
        return emp.login !== 'admin' && 
               roleName !== 'admin' && 
               roleName !== 'superadmin' && 
               roleName !== 'rahbar' && 
               roleName !== 'owner';
      });
      setEmployees(filteredEmployees);
    } catch {}
  };

  const fetchOvertime = useCallback(async () => {
    if (!canView) return;
    try {
      const res = await overtimeApi.findAll();
      setOvertimeRequests(res.data || []);
    } catch {
      setOvertimeRequests([]);
    }
  }, [canView]);

  const fetchMonthlyRecords = useCallback(async () => {
    if (!canView) return;
    try {
      const res = await attendanceApi.getMonthlyRecords(matrixDate.year, matrixDate.month);
      setMonthlyRecords(res.data || []);
    } catch {
      setMonthlyRecords([]);
    }
  }, [canView, matrixDate]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([
        canManage ? fetchToken() : Promise.resolve(),
        fetchRecords(),
        fetchEmployees(),
        fetchSettings(),
        fetchOvertime(),
      ]);
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchMonthlyRecords(); }, [fetchMonthlyRecords]);

  // Real-time refresh — har 20 soniyada (modal ochiq emasligini tekshiramiz)
  useAutoRefresh(
    async () => {
      await Promise.all([fetchRecords(), fetchOvertime(), fetchMonthlyRecords()]);
    },
    {
      intervalMs: 20000,
      paused: isSettingsModalOpen || isScanModalOpen || isRotateConfirmOpen || !!rejectingRequest,
    },
  );

  const handleRotateToken = async () => {
    try {
      const res = await attendanceApi.rotateToken();
      setToken(res.data?.token || null);
      setIsRotateConfirmOpen(false);
      showStatus('success', 'Yangi QR kod yaratildi. Eski kod endi ishlamaydi.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Xatolik yuz berdi.';
      showStatus('error', msg);
    }
  };

  const handlePrintQr = () => {
    const printWindow = window.open('', 'PRINT', 'height=800,width=600');
    if (!printWindow) return;
    const canvas = document.querySelector<HTMLCanvasElement>('#attendance-qr-canvas canvas');
    const dataUrl = canvas?.toDataURL('image/png');
    if (!dataUrl) {
      showStatus('error', 'QR rasmga aylantirishda xatolik');
      return;
    }
    printWindow.document.write(`
      <html><head><title>Davomat QR Kodi</title>
      <style>
        body { margin: 0; padding: 40px; font-family: sans-serif; text-align: center; }
        h1 { font-size: 22px; margin-bottom: 6px; color: #1e293b; }
        p { color: #64748b; font-size: 13px; margin: 4px 0 28px; }
        img { max-width: 320px; border: 8px solid #fed7aa; border-radius: 16px; padding: 12px; background: white; }
        .footer { margin-top: 28px; font-size: 11px; color: #94a3b8; }
      </style>
      </head><body>
        <h1>📷 Davomat QR Kodi</h1>
        <p>Kelganda va ketganda ushbu QR ni telefoningiz bilan skanerlang</p>
        <img src="${dataUrl}" alt="QR" />
        <div class="footer">Faqat ofis Wi-Fi tarmog'idan ishlaydi</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
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
      setManualToken('');
      fetchRecords();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Xatolik!';
      showStatus('error', msg);
    }
  };

  const handleApproveOvertime = async (req: OvertimeRequest) => {
    try {
      await overtimeApi.approve(req.id);
      showStatus('success', `${req.employee.fullName} ortiqcha ish vaqti tasdiqlandi`);
      fetchOvertime();
      fetchRecords();
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Tasdiqlashda xatolik');
    }
  };

  const handleRejectOvertime = async () => {
    if (!rejectingRequest) return;
    try {
      await overtimeApi.reject(rejectingRequest.id, rejectReason);
      showStatus('success', 'So\'rov rad etildi');
      setRejectingRequest(null);
      setRejectReason('');
      fetchOvertime();
    } catch {
      showStatus('error', 'Rad etishda xatolik');
    }
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) return <LoadingSpinner fullPage />;

  const pendingOvertime = overtimeRequests.filter(r => r.status === 'PENDING');
  const reviewedOvertime = overtimeRequests.filter(r => r.status !== 'PENDING').slice(0, 10);

  const qrUrl = token ? `${window.location.origin}/attendance/scan?token=${token}` : '';

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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <QrCode size={22} className="text-orange-500" /> Davomat Tizimi
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Ofis Wi-Fi orqali QR-skanerlash
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="text-xs font-black text-slate-700 bg-transparent outline-none cursor-pointer"
            />
          </div>
          {canManage && (
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
                <UserCheck size={16} /> Qo'lda Belgilash
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* QR Code Panel */}
        {canManage && (
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col items-center gap-4">
            <div className="text-center">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center justify-center gap-2">
                <QrCode size={16} className="text-orange-500" /> Statik QR Kod
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Print qiling va ofisga ilib qo'ying
              </p>
            </div>

            {token ? (
              <div id="attendance-qr-canvas" className="relative p-4 bg-white rounded-2xl border-4 border-orange-100 shadow-inner">
                <QRCodeCanvas value={qrUrl} size={224} level="H" includeMargin={true} />
              </div>
            ) : (
              <div className="w-[240px] h-[240px] bg-slate-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 gap-2">
                <QrCode size={40} className="text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-4">
                  QR kod hali yaratilmagan
                </p>
              </div>
            )}

            {token && (
              <div className="w-full flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                <Wifi size={12} className="text-emerald-600" />
                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">
                  Faqat ofis Wi-Fi tarmog'idan ishlaydi
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 w-full">
              {token && (
                <button
                  onClick={handlePrintQr}
                  className="flex items-center justify-center gap-1.5 h-10 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-300 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  <Printer size={12} /> Print
                </button>
              )}
              <button
                onClick={() => setIsRotateConfirmOpen(true)}
                className={`flex items-center justify-center gap-1.5 h-10 ${token ? 'bg-slate-50 hover:bg-orange-50 border-slate-200 hover:border-orange-300 text-slate-500 hover:text-orange-600' : 'col-span-2 bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-400 text-orange-700'} border text-[10px] font-black uppercase tracking-widest rounded-xl transition-all`}
              >
                <RefreshCw size={12} /> {token ? 'Yangi Kod' : 'QR Yaratish'}
              </button>
            </div>

            {token && (
              <div className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Token (qo'lda kiritish)</p>
                <p className="text-[9px] font-mono text-slate-600 break-all leading-tight opacity-70 italic">{token}</p>
              </div>
            )}
          </div>
        )}

        {/* Records Table */}
        <div className={`${canManage ? 'lg:col-span-3' : 'lg:col-span-5'} bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden`}>
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
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Ortiqcha</th>
                  <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Holat</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
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
                        {record.overtimeMinutes && record.overtimeMinutes > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-[9px] font-black px-2 py-0.5 rounded-lg border border-violet-100">
                            +{record.overtimeMinutes} m
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

      {/* OVERTIME REQUESTS */}
      {canView && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-white">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <AlarmClock size={14} className="text-violet-500" />
                Ortiqcha Ish So'rovlari
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                Telegram bot orqali xodim yuborgan izohlar
              </p>
            </div>
            {pendingOvertime.length > 0 && (
              <span className="text-[10px] font-black text-violet-700 bg-violet-100 px-3 py-1 rounded-lg border border-violet-200">
                {pendingOvertime.length} kutilmoqda
              </span>
            )}
          </div>

          {overtimeRequests.length === 0 ? (
            <div className="py-12 text-center">
              <AlarmClock size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">Hozircha so'rov yo'q</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Pending — yuqorida */}
              {pendingOvertime.map(req => (
                <div key={req.id} className="p-4 hover:bg-violet-50/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 font-black text-xs flex items-center justify-center border border-violet-200 flex-shrink-0">
                        {req.employee.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{req.employee.fullName}</p>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{req.date}</span>
                          <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-[9px] font-black px-2 py-0.5 rounded-md">
                            +{req.minutes} daqiqa
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{req.message}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleApproveOvertime(req)}
                          className="flex items-center gap-1 h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm transition-all"
                        >
                          <ThumbsUp size={10} /> Tasdiqlash
                        </button>
                        <button
                          onClick={() => { setRejectingRequest(req); setRejectReason(''); }}
                          className="flex items-center gap-1 h-8 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                        >
                          <ThumbsDown size={10} /> Rad etish
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Reviewed — pastga */}
              {reviewedOvertime.map(req => (
                <div key={req.id} className="p-4 opacity-60">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 font-black text-xs flex items-center justify-center border border-slate-200 flex-shrink-0">
                      {req.employee.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{req.employee.fullName}</p>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{req.date}</span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md ${req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                          {req.status === 'APPROVED' ? '✓ Tasdiqlangan' : '✗ Rad etilgan'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{req.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Oylik Jadval (Monthly Matrix) */}
      {canView && (
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
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
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
                  {Array.from({ length: new Date(matrixDate.year, matrixDate.month, 0).getDate() }).map((_, i) => (
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
                      {Array.from({ length: new Date(matrixDate.year, matrixDate.month, 0).getDate() }).map((_, i) => {
                        const dateStr = `${matrixDate.year}-${String(matrixDate.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                        const dayRecord = empRecords.find(r => r.date === dateStr);

                        let dotClass = 'bg-slate-100';
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
                        if (dayRecord?.overtimeMinutes && dayRecord.overtimeMinutes > 0) {
                          dotClass = 'bg-violet-500';
                          title = `Ortiqcha: +${dayRecord.overtimeMinutes}m`;
                        }

                        return (
                          <td key={i} className="px-1 py-1 tabular-nums text-center">
                            <div className={`w-2.5 h-2.5 rounded-full mx-auto shadow-sm ${dotClass}`} title={`${dateStr}: ${title}`} />
                          </td>
                        );
                      })}
                    </tr>
                  );
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
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2"><LogIn size={12} /> Ish Boshlanishi:</p>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="23"
                  value={workSettings.workStart.hour}
                  onChange={e => setWorkSettings({ ...workSettings, workStart: { ...workSettings.workStart, hour: parseInt(e.target.value) || 0 } })}
                  className="input-minimal text-center font-black h-10 border-emerald-200" />
                <span className="font-bold text-slate-300">:</span>
                <input type="number" min="0" max="59"
                  value={workSettings.workStart.minute}
                  onChange={e => setWorkSettings({ ...workSettings, workStart: { ...workSettings.workStart, minute: parseInt(e.target.value) || 0 } })}
                  className="input-minimal text-center font-black h-10 border-emerald-200" />
              </div>
            </div>

            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2"><LogOut size={12} /> Ish Tugashi:</p>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="23"
                  value={workSettings.workEnd.hour}
                  onChange={e => setWorkSettings({ ...workSettings, workEnd: { ...workSettings.workEnd, hour: parseInt(e.target.value) || 0 } })}
                  className="input-minimal text-center font-black h-10 border-rose-200" />
                <span className="font-bold text-slate-300">:</span>
                <input type="number" min="0" max="59"
                  value={workSettings.workEnd.minute}
                  onChange={e => setWorkSettings({ ...workSettings, workEnd: { ...workSettings.workEnd, minute: parseInt(e.target.value) || 0 } })}
                  className="input-minimal text-center font-black h-10 border-rose-200" />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Calendar size={12} /> Ish Kunlari (Grafik):</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'].map((day, idx) => {
                const isActive = workSettings.workDays.includes(idx);
                return (
                  <button key={idx} type="button"
                    onClick={() => {
                      const newDays = isActive
                        ? workSettings.workDays.filter(d => d !== idx)
                        : [...workSettings.workDays, idx].sort();
                      setWorkSettings({ ...workSettings, workDays: newDays });
                    }}
                    className={`h-10 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${isActive
                      ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-200'
                      : 'bg-white border-slate-100 text-slate-400 hover:border-orange-200'}`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="btn-outline flex-1 h-12 rounded-xl text-[10px] uppercase font-black tracking-widest">Bekor</button>
            <button type="submit" className="btn-primary flex-1 h-12 rounded-xl text-[10px] uppercase font-black tracking-widest bg-orange-600 border-none shadow-orange-200">Saqlash</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SCAN / MANUAL */}
      <Modal isOpen={isScanModalOpen} onClose={() => setIsScanModalOpen(false)} title="Davomat Belgilash">
        <form onSubmit={handleScan} className="space-y-4">
          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl">
            <button type="button" onClick={() => setScanForm(f => ({ ...f, action: 'checkin' }))}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${scanForm.action === 'checkin' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <LogIn size={12} /> Keldi
            </button>
            <button type="button" onClick={() => setScanForm(f => ({ ...f, action: 'checkout' }))}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${scanForm.action === 'checkout' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <LogOut size={12} /> Ketdi
            </button>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 px-1">Xodim</label>
            <select required value={scanForm.employeeId}
              onChange={e => setScanForm(f => ({ ...f, employeeId: e.target.value }))}
              className="select-minimal text-xs font-black h-11">
              <option value="">Tanlang...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 px-1">QR Token kodi</label>
            <input type="text" required value={manualToken}
              onChange={e => setManualToken(e.target.value)}
              className="input-minimal font-mono text-[10px] h-11"
              placeholder="QR-dagi kodni kiritish" />
          </div>

          {token && (
            <button type="button" onClick={() => setManualToken(token)}
              className="w-full py-2 text-[9px] font-black text-orange-600 uppercase tracking-widest border border-dashed border-orange-200 rounded-lg hover:bg-white transition-colors">
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

      {/* MODAL: ROTATE TOKEN CONFIRM */}
      <Modal isOpen={isRotateConfirmOpen} onClose={() => setIsRotateConfirmOpen(false)} title="Yangi QR yaratish?">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Yangi QR yaratilsa, <strong>oldingi printlangan QR endi ishlamaydi</strong>. Yangi QR ni print qilib ofisga ilib qo'yishingiz kerak bo'ladi.
          </p>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setIsRotateConfirmOpen(false)} className="btn-outline h-11 flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest">Bekor</button>
            <button onClick={handleRotateToken} className="h-11 flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest bg-orange-600 hover:bg-orange-700 text-white shadow-md">
              Ha, yarat
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: REJECT OVERTIME */}
      <Modal isOpen={!!rejectingRequest} onClose={() => setRejectingRequest(null)} title="So'rovni rad etish">
        <div className="space-y-4">
          {rejectingRequest && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[11px] font-black text-slate-700 uppercase">{rejectingRequest.employee.fullName}</p>
              <p className="text-xs text-slate-500 mt-1">{rejectingRequest.message}</p>
            </div>
          )}
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 px-1">Sabab (ixtiyoriy)</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="input-minimal min-h-[80px] text-xs"
              placeholder="Nima uchun rad etmoqchisiz..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setRejectingRequest(null)} className="btn-outline h-11 flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest">Bekor</button>
            <button onClick={handleRejectOvertime} className="h-11 flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-md">
              Rad etish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Davomat;
