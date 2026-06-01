import React, { useState, useEffect } from 'react';
import {
  Clock, UserCheck, Calendar, CheckCircle2, AlertCircle, Check, X,
  LogIn, LogOut, Users, MapPin, AlarmClock, ThumbsUp, ThumbsDown, Activity, Download,
} from 'lucide-react';
import { attendanceApi, settingsApi, overtimeApi } from '../api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEmployees } from '../hooks/queries';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { exportToXlsx } from '../utils/exportToXlsx';
import { toast } from 'react-toastify';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee?: { fullName: string; role?: { name: string } };
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
  const canViewAll = isAdmin || currentUser.permissions?.canViewAllAttendance;

  // ── Self-service state ─────────────────────────────────────
  const [isMarking, setIsMarking] = useState(false);

  // ── Manager-only state ─────────────────────────────────────
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [workSettings, setWorkSettings] = useState({
    workStart: { hour: 9, minute: 0 },
    workEnd: { hour: 17, minute: 0 },
    workDays: [1, 2, 3, 4, 5, 6],
  });

  const [filterDate, setFilterDate] = useState(getTodayString());

  const [rejectingRequest, setRejectingRequest] = useState<OvertimeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Manual entry modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ employeeId: '', date: getTodayString(), checkIn: '', checkOut: '' });
  const [manualLoading, setManualLoading] = useState(false);

  const [matrixDate, setMatrixDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  // ============ RQ Queries ============
  const qc = useQueryClient();
  const myTodayQuery = useQuery({
    queryKey: ['attendance-myToday'],
    queryFn: async () => (await attendanceApi.getMyToday()).data || null,
  });
  const myRecordsQuery = useQuery({
    queryKey: ['attendance-myRecords'],
    queryFn: async () => (await attendanceApi.getMyRecords()).data || [],
  });
  const recordsQuery = useQuery({
    queryKey: ['attendance-records', filterDate],
    queryFn: async () => (await attendanceApi.getRecords(filterDate)).data || [],
    enabled: canViewAll,
  });
  const { data: rawEmployees = [] } = useEmployees();
  const overtimeQuery = useQuery({
    queryKey: ['overtime-requests'],
    queryFn: async () => (await overtimeApi.findAll()).data || [],
    enabled: canViewAll,
  });
  const monthlyQuery = useQuery({
    queryKey: ['attendance-monthly', matrixDate.year, matrixDate.month],
    queryFn: async () => (await attendanceApi.getMonthlyRecords(matrixDate.year, matrixDate.month)).data || [],
    enabled: canViewAll,
  });
  const settingsQuery = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const [start, end, days] = await Promise.all([
        settingsApi.get('workStart'),
        settingsApi.get('workEnd'),
        settingsApi.get('workDays'),
      ]);
      return {
        workStart: start.data || { hour: 9, minute: 0 },
        workEnd: end.data || { hour: 17, minute: 0 },
        workDays: days.data || [1, 2, 3, 4, 5, 6],
      };
    },
    enabled: canManage,
  });

  const myToday = (myTodayQuery.data as AttendanceRecord | null) || null;
  const myRecords = (myRecordsQuery.data as AttendanceRecord[]) || [];
  const records = (recordsQuery.data as AttendanceRecord[]) || [];
  const overtimeRequests = (overtimeQuery.data as OvertimeRequest[]) || [];
  const monthlyRecords = (monthlyQuery.data as AttendanceRecord[]) || [];
  const employees = (rawEmployees as any[]).filter((emp: any) => {
    const roleName = emp.role?.name?.toLowerCase() || '';
    return emp.login !== 'admin' &&
           roleName !== 'admin' && roleName !== 'superadmin' &&
           roleName !== 'rahbar' && roleName !== 'owner';
  });
  const isLoading = myTodayQuery.isLoading || myRecordsQuery.isLoading || recordsQuery.isLoading;

  // Sync workSettings from RQ data
  useEffect(() => {
    if (settingsQuery.data) {
      setWorkSettings(settingsQuery.data as any);
    }
  }, [settingsQuery.data]);

  function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // ── Shim functions — invalidate RQ caches, RQ auto-refetches ─────
  const fetchMyToday = async () => { await myTodayQuery.refetch(); };
  const fetchMyRecords = async () => { await myRecordsQuery.refetch(); };

  // ── EXPORT: tanlangan oyning davomat yozuvlarini Excel'ga ─────
  // Long format — bitta yozuv bitta qator. Faqat checkIn bo'lgan kunlar chiqadi
  // (kelmagan kunlar matrix'da nuqta sifatida ko'rinadi, lekin DB'da rekord yo'q).
  const handleExportMonthly = () => {
    if (monthlyRecords.length === 0) {
      toast.info("Bu oy uchun davomat yozuvlari yo'q");
      return;
    }
    const monthName = new Date(matrixDate.year, matrixDate.month - 1, 1)
      .toLocaleString('uz-UZ', { month: 'long' });
    const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '';
    const statusOf = (r: AttendanceRecord) => {
      if (!r.checkIn) return 'Kelmagan';
      const parts: string[] = [r.lateMinutes > 0 ? `Kech (${r.lateMinutes}m)` : 'Vaqtida'];
      if (r.overtimeMinutes && r.overtimeMinutes > 0) parts.push(`Ortiqcha +${r.overtimeMinutes}m`);
      return parts.join(', ');
    };
    // Xodim nomi ↔ records sortlash uchun
    const sorted = [...monthlyRecords].sort((a, b) => {
      const aN = a.employee?.fullName || '';
      const bN = b.employee?.fullName || '';
      return aN.localeCompare(bN) || a.date.localeCompare(b.date);
    });

    exportToXlsx({
      filename: `davomat_${matrixDate.year}-${String(matrixDate.month).padStart(2, '0')}`,
      sheetName: `${monthName} ${matrixDate.year}`,
      rows: sorted,
      columns: [
        { header: 'Sana', accessor: (r: AttendanceRecord) => r.date },
        { header: 'Xodim', accessor: (r: AttendanceRecord) => r.employee?.fullName || '' },
        { header: 'Lavozim', accessor: (r: AttendanceRecord) => r.employee?.role?.name || '' },
        { header: 'Kelgan vaqti', accessor: (r: AttendanceRecord) => fmtTime(r.checkIn) },
        { header: 'Ketgan vaqti', accessor: (r: AttendanceRecord) => fmtTime(r.checkOut) },
        { header: 'Kech kelgan (min)', accessor: (r: AttendanceRecord) => r.lateMinutes || 0 },
        { header: 'Ortiqcha (min)', accessor: (r: AttendanceRecord) => r.overtimeMinutes || 0 },
        { header: 'Holat', accessor: (r: AttendanceRecord) => statusOf(r) },
      ],
    });
    toast.success(`${sorted.length} ta yozuv eksport qilindi`);
  };

  const handleSelfMark = async () => {
    if (isMarking) return;
    setIsMarking(true);

    // Ketish (check-out) uchun GPS kerak emas
    const isCheckout = buttonState === 'ketdim';

    let geoData: { lat?: number; lng?: number } = {};

    if (!isCheckout) {
      const getPosition = (): Promise<GeolocationPosition> =>
        new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 0 }),
        );

      try {
        const pos = await getPosition();
        geoData = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr: any) {
        if (geoErr?.code === 1) showStatus('error', 'Iltimos, brauzerdan lokatsiyaga ruxsat bering');
        else showStatus('error', 'Joylashuv aniqlanmadi. Qayta urinib ko\'ring');
        setIsMarking(false);
        return;
      }
    }

    try {
      const res = await attendanceApi.selfMark(geoData);
      const action = res.data?.action;
      if (action === 'checkin') showStatus('success', 'Keldim — Davomat belgilandi');
      else if (action === 'checkout') showStatus('success', 'Ketdim — Yaxshi kun bo\'lsin');
      else if (action === 'done') showStatus('error', 'Bugun davomat tugatilgan');
      await Promise.all([fetchMyToday(), fetchMyRecords()]);
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Xatolik yuz berdi');
    } finally {
      setIsMarking(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await Promise.all([
        settingsApi.set('workStart', workSettings.workStart),
        settingsApi.set('workEnd', workSettings.workEnd),
        settingsApi.set('workDays', workSettings.workDays),
      ]);
      showStatus('success', 'Ish vaqti sozlamalari saqlandi!');
      setIsSettingsModalOpen(false);
    } catch {
      showStatus('error', 'Saqlashda xatolik yuz berdi!');
    }
  };

  // Shim'lar — mutation handler'lar shu nomlarni chaqirib qoladi
  const fetchRecords = async () => { qc.invalidateQueries({ queryKey: ['attendance-records'] }); };
  const fetchOvertime = async () => { qc.invalidateQueries({ queryKey: ['overtime-requests'] }); };
  const fetchMonthlyRecords = async () => { qc.invalidateQueries({ queryKey: ['attendance-monthly'] }); };

  useAutoRefresh(
    async () => {
      await Promise.all([
        fetchMyToday(),
        canViewAll ? fetchRecords() : Promise.resolve(),
        canViewAll ? fetchOvertime() : Promise.resolve(),
        canViewAll ? fetchMonthlyRecords() : Promise.resolve(),
      ]);
    },
    {
      // Focus-only: no idle polling (was a visible 20s "reload" of the whole
      // records + monthly matrix). Still refreshes when the tab regains focus
      // and after any mutation handler calls fetch*().
      intervalMs: 0,
      paused: isSettingsModalOpen || !!rejectingRequest,
    },
  );

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

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.employeeId) { showStatus('error', 'Xodimni tanlang'); return; }
    if (!manualForm.date) { showStatus('error', 'Sanani kiriting'); return; }
    if (!manualForm.checkIn && !manualForm.checkOut) { showStatus('error', 'Kamida keldi yoki ketti vaqtini kiriting'); return; }
    setManualLoading(true);
    try {
      await attendanceApi.manualMark({
        employeeId: manualForm.employeeId,
        date: manualForm.date,
        checkIn: manualForm.checkIn || undefined,
        checkOut: manualForm.checkOut || undefined,
      });
      showStatus('success', 'Davomat muvaffaqiyatli kiritildi');
      setShowManualModal(false);
      setManualForm({ employeeId: '', date: getTodayString(), checkIn: '', checkOut: '' });
      await Promise.all([fetchRecords(), fetchMonthlyRecords()]);
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Saqlashda xatolik');
    } finally {
      setManualLoading(false);
    }
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) return <LoadingSpinner fullPage />;

  const pendingOvertime = overtimeRequests.filter(r => r.status === 'PENDING');
  const reviewedOvertime = overtimeRequests.filter(r => r.status !== 'PENDING').slice(0, 10);

  // Determine button state
  const isCheckedIn = !!myToday?.checkIn;
  const isCheckedOut = !!myToday?.checkOut;
  const buttonState: 'keldim' | 'ketdim' | 'done' = !isCheckedIn ? 'keldim' : !isCheckedOut ? 'ketdim' : 'done';

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
          <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Activity size={22} className="text-orange-500" /> Davomat
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            GPS geofencing orqali kelish va ketish
          </p>
        </div>
        {canManage && canViewAll && (
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="w-11 h-11 flex items-center justify-center bg-slate-100 text-slate-500 rounded-2xl border border-slate-200 hover:bg-white hover:text-orange-600 hover:border-orange-200 transition-all"
              title="Ish vaqti sozlamalari"
            >
              <Clock size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── KELDIM / KETDIM Card ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-orange-100 bg-orange-50/40">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <UserCheck size={16} className="text-orange-500" /> Mening Davomatim — Bugun
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {currentUser.fullName} · {getTodayString()}
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Big action button */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center gap-3">
            <button
              onClick={handleSelfMark}
              disabled={isMarking || buttonState === 'done'}
              className={`relative w-44 h-44 rounded-full font-bold uppercase tracking-widest text-base shadow-2xl transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                buttonState === 'keldim'
                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/40'
                  : buttonState === 'ketdim'
                  ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/40'
                  : 'bg-emerald-500 text-white shadow-emerald-500/40'
              }`}
            >
              <div className="flex flex-col items-center gap-1.5">
                {buttonState === 'keldim' && <><LogIn size={32} strokeWidth={2.5} /><span>Keldim</span></>}
              {buttonState === 'ketdim' && <><LogOut size={32} strokeWidth={2.5} /><span>Ketdim</span></>}
              {buttonState === 'done' && <><CheckCircle2 size={32} strokeWidth={2.5} /><span>Tayyor</span></>}
            </div>
            {isMarking && (
              <div className="absolute inset-0 rounded-full bg-white/20 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
          {buttonState === 'ketdim' && (
            <p className="text-[9px] font-bold text-orange-600 animate-pulse mt-1">
              Ortiqcha ish izohini Telegram'da yozing
            </p>
          )}
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <MapPin size={11} /> GPS orqali ofis hududi tekshiriladi
          </div>
          </div>

          {/* Status panel */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl border p-4 ${myToday?.checkIn ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <LogIn size={14} className={myToday?.checkIn ? 'text-emerald-600' : 'text-slate-300'} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Kelish</span>
              </div>
              <p className={`text-2xl font-bold font-mono tabular-nums ${myToday?.checkIn ? 'text-emerald-700' : 'text-slate-300'}`}>
                {formatTime(myToday?.checkIn || null)}
              </p>
              {myToday?.lateMinutes && myToday.lateMinutes > 0 ? (
                <p className="text-[10px] font-bold text-rose-600 mt-1">+{myToday.lateMinutes} m kech</p>
              ) : myToday?.checkIn ? (
                <p className="text-[10px] font-bold text-emerald-600 mt-1">Vaqtida</p>
              ) : (
                <p className="text-[10px] font-bold text-slate-400 mt-1">Hali belgilanmagan</p>
              )}
            </div>

            <div className={`rounded-2xl border p-4 ${myToday?.checkOut ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <LogOut size={14} className={myToday?.checkOut ? 'text-sky-600' : 'text-slate-300'} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Ketish</span>
              </div>
              <p className={`text-2xl font-bold font-mono tabular-nums ${myToday?.checkOut ? 'text-sky-700' : 'text-slate-300'}`}>
                {formatTime(myToday?.checkOut || null)}
              </p>
              {myToday?.overtimeMinutes && myToday.overtimeMinutes > 0 ? (
                <p className="text-[10px] font-bold text-violet-600 mt-1">+{myToday.overtimeMinutes} m ortiqcha</p>
              ) : myToday?.checkOut ? (
                <p className="text-[10px] font-bold text-sky-600 mt-1">Tugadi</p>
              ) : (
                <p className="text-[10px] font-bold text-slate-400 mt-1">Ish davom etmoqda</p>
              )}
            </div>

            <div className="col-span-2 flex items-center justify-between bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Holat</span>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg ${
                buttonState === 'keldim' ? 'bg-slate-200 text-slate-600' :
                buttonState === 'ketdim' ? 'bg-orange-100 text-orange-700 animate-pulse' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {buttonState === 'keldim' && 'Kelmagan'}
                {buttonState === 'ketdim' && 'Ishda'}
                {buttonState === 'done' && 'Tugadi'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── My Recent Records ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Calendar size={14} className="text-orange-400" /> Mening Tarixim
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">So'nggi 30 kun</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Sana</th>
                <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Keldi</th>
                <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ketdi</th>
                <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Kechikish</th>
                <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ortiqcha</th>
              </tr>
            </thead>
            <tbody>
              {myRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Calendar size={28} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Hozircha yozuv yo'q</p>
                  </td>
                </tr>
              ) : (
                myRecords.map(r => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-orange-50/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-[11px] text-slate-700 tabular-nums">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <LogIn size={12} className={r.checkIn ? 'text-emerald-500' : 'text-slate-200'} />
                        <span className={`font-bold tabular-nums ${r.checkIn ? 'text-emerald-600' : 'text-slate-300'}`}>{formatTime(r.checkIn)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <LogOut size={12} className={r.checkOut ? 'text-sky-500' : 'text-slate-200'} />
                        <span className={`font-bold tabular-nums ${r.checkOut ? 'text-sky-600' : 'text-slate-300'}`}>{formatTime(r.checkOut)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.lateMinutes > 0 ? (
                        <span className="inline-flex items-center bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-rose-100">+{r.lateMinutes} m</span>
                      ) : r.checkIn ? (
                        <span className="inline-flex items-center bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-emerald-100">OK</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.overtimeMinutes && r.overtimeMinutes > 0 ? (
                        <span className="inline-flex items-center bg-violet-50 text-violet-700 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-violet-100">+{r.overtimeMinutes} m</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MANAGER-ONLY SECTIONS — gated by canViewAllAttendance         */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {canViewAll && (
        <>
          {/* All employees journal */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Users size={14} className="text-orange-400" />
                  Barcha Xodimlar Davomati
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{filterDate} • {records.length} yozuv</p>
              </div>
              <div className="flex items-center gap-3">
                {canManage && (
                  <button
                    onClick={() => { setManualForm(f => ({ ...f, date: filterDate, employeeId: '' })); setShowManualModal(true); }}
                    className="flex items-center gap-1.5 h-9 px-3 bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-xl shadow-sm transition-all"
                  >
                    <LogIn size={12} strokeWidth={3} /> Manual kiritish
                  </button>
                )}
                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                  {records.filter(r => r.checkIn).length}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold text-sky-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
                  {records.filter(r => r.checkOut).length}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold text-rose-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                  {records.filter(r => r.lateMinutes > 0).length}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Xodim</th>
                    <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Keldi</th>
                    <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ketdi</th>
                    <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Kechikish</th>
                    <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Ortiqcha</th>
                    <th className="px-4 py-3 text-left text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Holat</th>
                    {canManage && <th className="px-4 py-3 text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]"></th>}
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <Calendar size={26} />
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-800 mb-1">Bu sanada davomat yo'q</p>
                            <p className="text-sm text-slate-500">Xodimlar QR orqali kelganda yoki qo'lda yozsangiz, ro'yxat shu yerda ko'rinadi.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map(record => (
                      <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center border border-orange-200">
                              {record.employee?.fullName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{record.employee?.fullName}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">{record.employee?.role?.name || 'Xodim'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <LogIn size={12} className={record.checkIn ? 'text-emerald-500' : 'text-slate-200'} />
                            <span className={`font-bold tabular-nums ${record.checkIn ? 'text-emerald-600' : 'text-slate-300'}`}>{formatTime(record.checkIn)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <LogOut size={12} className={record.checkOut ? 'text-sky-500' : 'text-slate-200'} />
                            <span className={`font-bold tabular-nums ${record.checkOut ? 'text-sky-600' : 'text-slate-300'}`}>{formatTime(record.checkOut)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {record.lateMinutes > 0 ? (
                            <span className="inline-flex items-center bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-rose-100">+{record.lateMinutes} m</span>
                          ) : record.checkIn ? (
                            <span className="inline-flex items-center bg-emerald-50 text-emerald-600 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-emerald-100">OK</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {record.overtimeMinutes && record.overtimeMinutes > 0 ? (
                            <span className="inline-flex items-center bg-violet-50 text-violet-700 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-violet-100">+{record.overtimeMinutes} m</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {!record.checkIn ? (
                            <span className="text-slate-300 text-[8px] font-bold uppercase">Kelmagan</span>
                          ) : !record.checkOut ? (
                            <span className="text-orange-600 text-[8px] font-bold uppercase animate-pulse">Ishda</span>
                          ) : (
                            <span className="text-emerald-600 text-[8px] font-bold uppercase">Tugallandi</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-3 py-3">
                            <button
                              onClick={() => {
                                setManualForm({
                                  employeeId: record.employeeId,
                                  date: record.date,
                                  checkIn: record.checkIn ? new Date(record.checkIn).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                                  checkOut: record.checkOut ? new Date(record.checkOut).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                                });
                                setShowManualModal(true);
                              }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
                              title="Tahrirlash"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overtime requests */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-violet-50 to-white">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <AlarmClock size={14} className="text-violet-500" />
                  Ortiqcha Ish So'rovlari
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Telegram bot orqali xodim yuborgan izohlar</p>
              </div>
              {pendingOvertime.length > 0 && (
                <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-3 py-1 rounded-lg border border-violet-200">
                  {pendingOvertime.length} kutilmoqda
                </span>
              )}
            </div>
            {overtimeRequests.length === 0 ? (
              <div className="py-12 text-center">
                <AlarmClock size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Hozircha so'rov yo'q</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingOvertime.map(req => (
                  <div key={req.id} className="p-4 hover:bg-violet-50/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center border border-violet-200 flex-shrink-0">
                          {req.employee.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{req.employee.fullName}</p>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{req.date}</span>
                            <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-[9px] font-bold px-2 py-0.5 rounded-md">+{req.minutes} daqiqa</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{req.message}</p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => handleApproveOvertime(req)} className="flex items-center gap-1 h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg shadow-sm transition-all">
                            <ThumbsUp size={10} /> Tasdiqlash
                          </button>
                          <button onClick={() => { setRejectingRequest(req); setRejectReason(''); }} className="flex items-center gap-1 h-8 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all">
                            <ThumbsDown size={10} /> Rad etish
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {reviewedOvertime.map(req => (
                  <div key={req.id} className="p-4 opacity-60">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200 flex-shrink-0">
                        {req.employee.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{req.employee.fullName}</p>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">{req.date}</span>
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md ${req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                            {req.status === 'APPROVED' ? <><Check size={10} strokeWidth={3}/> Tasdiqlangan</> : <><X size={10} strokeWidth={3}/> Rad etilgan</>}
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

          {/* Monthly matrix */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Calendar size={14} className="text-orange-400" /> Oylik Davomat Jadvali
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <select value={matrixDate.month} onChange={e => setMatrixDate(p => ({ ...p, month: parseInt(e.target.value) }))} className="select-minimal text-xs font-bold h-9 py-0">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('uz-UZ', { month: 'long' })}</option>
                  ))}
                </select>
                <select value={matrixDate.year} onChange={e => setMatrixDate(p => ({ ...p, year: parseInt(e.target.value) }))} className="select-minimal text-xs font-bold h-9 py-0">
                  {[...Array(5)].map((_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return <option key={y} value={y}>{y}</option>;
                  })}
                </select>
                {(isAdmin || currentUser.permissions?.canExportAttendance) && (
                  <button
                    onClick={handleExportMonthly}
                    className="flex items-center gap-2 h-9 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-sm transition-all"
                    title="Tanlangan oy davomatini Excel'ga eksport qilish"
                  >
                    <Download size={13} strokeWidth={2.5}/> EKSPORT
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-[9px] font-bold text-slate-400 uppercase border-r border-slate-100 min-w-[120px]">Xodim</th>
                    {Array.from({ length: new Date(matrixDate.year, matrixDate.month, 0).getDate() }).map((_, i) => (
                      <th key={i} className="px-1 py-2 text-center text-[8px] font-bold text-slate-400 uppercase w-6">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const empRecords = monthlyRecords.filter(r => r.employeeId === emp.id);
                    return (
                      <tr key={emp.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                        <td className="px-2 py-2 border-r border-slate-100">
                          <p className="text-[10px] font-bold text-slate-700 truncate max-w-[110px]" title={emp.fullName}>{emp.fullName}</p>
                        </td>
                        {Array.from({ length: new Date(matrixDate.year, matrixDate.month, 0).getDate() }).map((_, i) => {
                          const dateStr = `${matrixDate.year}-${String(matrixDate.month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                          const dayRecord = empRecords.find(r => r.date === dateStr);
                          let dotClass = 'bg-slate-100';
                          let title = 'Kelmagan';
                          if (dayRecord?.checkIn) {
                            if (dayRecord.lateMinutes > 0) { dotClass = 'bg-rose-400'; title = `Kech qolgan: ${dayRecord.lateMinutes}m`; }
                            else { dotClass = 'bg-emerald-400'; title = 'Vaqtida kelgan'; }
                          }
                          if (dayRecord?.overtimeMinutes && dayRecord.overtimeMinutes > 0) {
                            dotClass = 'bg-violet-500'; title = `Ortiqcha: +${dayRecord.overtimeMinutes}m`;
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
        </>
      )}

      {/* MODAL: SETTINGS — manager only */}
      {canManage && (
        <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Ish Vaqti Sozlamalari" maxWidth="max-w-lg">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2"><LogIn size={12} /> Ish Boshlanishi:</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="23" value={workSettings.workStart.hour}
                    onChange={e => setWorkSettings({ ...workSettings, workStart: { ...workSettings.workStart, hour: parseInt(e.target.value) || 0 } })}
                    className="input-minimal text-center font-bold h-10 border-emerald-200" />
                  <span className="font-bold text-slate-300">:</span>
                  <input type="number" min="0" max="59" value={workSettings.workStart.minute}
                    onChange={e => setWorkSettings({ ...workSettings, workStart: { ...workSettings.workStart, minute: parseInt(e.target.value) || 0 } })}
                    className="input-minimal text-center font-bold h-10 border-emerald-200" />
                </div>
              </div>
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2"><LogOut size={12} /> Ish Tugashi:</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="23" value={workSettings.workEnd.hour}
                    onChange={e => setWorkSettings({ ...workSettings, workEnd: { ...workSettings.workEnd, hour: parseInt(e.target.value) || 0 } })}
                    className="input-minimal text-center font-bold h-10 border-rose-200" />
                  <span className="font-bold text-slate-300">:</span>
                  <input type="number" min="0" max="59" value={workSettings.workEnd.minute}
                    onChange={e => setWorkSettings({ ...workSettings, workEnd: { ...workSettings.workEnd, minute: parseInt(e.target.value) || 0 } })}
                    className="input-minimal text-center font-bold h-10 border-rose-200" />
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
                        const newDays = isActive ? workSettings.workDays.filter(d => d !== idx) : [...workSettings.workDays, idx].sort();
                        setWorkSettings({ ...workSettings, workDays: newDays });
                      }}
                      className={`h-10 rounded-xl text-[9px] font-bold uppercase transition-all border-2 ${isActive ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-200' : 'bg-white border-slate-100 text-slate-400 hover:border-orange-200'}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="btn-outline flex-1 h-12 rounded-xl text-[10px] uppercase font-bold tracking-widest">Bekor</button>
              <button type="submit" className="btn-primary flex-1 h-12 rounded-xl text-[10px] uppercase font-bold tracking-widest bg-orange-600 border-none shadow-orange-200">Saqlash</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: MANUAL ENTRY */}
      <Modal isOpen={showManualModal} onClose={() => setShowManualModal(false)} title="Qo'lda Davomat Kiritish" maxWidth="max-w-md">
        <form onSubmit={handleManualSave} className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Xodim</label>
            <select
              required
              value={manualForm.employeeId}
              onChange={e => setManualForm(f => ({ ...f, employeeId: e.target.value }))}
              className="select-minimal text-sm font-bold"
            >
              <option value="">— Xodimni tanlang —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Sana</label>
            <input
              type="date"
              required
              value={manualForm.date}
              onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))}
              className="input-minimal text-sm font-bold"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-bold text-emerald-600 uppercase mb-1.5 px-1 flex items-center gap-1">
                <LogIn size={10} /> Keldi vaqti
              </label>
              <input
                type="time"
                value={manualForm.checkIn}
                onChange={e => setManualForm(f => ({ ...f, checkIn: e.target.value }))}
                className="input-minimal text-sm font-bold text-center"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-sky-600 uppercase mb-1.5 px-1 flex items-center gap-1">
                <LogOut size={10} /> Ketti vaqti
              </label>
              <input
                type="time"
                value={manualForm.checkOut}
                onChange={e => setManualForm(f => ({ ...f, checkOut: e.target.value }))}
                className="input-minimal text-sm font-bold text-center"
              />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide">
              Faqat qurilmasi yo'q yoki texnik muammo yuz bergan xodimlar uchun. Barcha tahrirlar log'da saqlanadi.
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowManualModal(false)} className="btn-outline h-11 flex-1 rounded-xl font-bold uppercase text-[9px] tracking-widest">Bekor</button>
            <button type="submit" disabled={manualLoading} className="h-11 flex-1 rounded-xl font-bold uppercase text-[9px] tracking-widest bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white shadow-md transition-all">
              {manualLoading ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: REJECT OVERTIME */}
      <Modal isOpen={!!rejectingRequest} onClose={() => setRejectingRequest(null)} title="So'rovni rad etish">
        <div className="space-y-4">
          {rejectingRequest && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-700 uppercase">{rejectingRequest.employee.fullName}</p>
              <p className="text-xs text-slate-500 mt-1">{rejectingRequest.message}</p>
            </div>
          )}
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5 px-1">Sabab (ixtiyoriy)</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="input-minimal min-h-[80px] text-xs" placeholder="Nima uchun rad etmoqchisiz..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setRejectingRequest(null)} className="btn-outline h-11 flex-1 rounded-xl font-bold uppercase text-[9px] tracking-widest">Bekor</button>
            <button onClick={handleRejectOvertime} className="h-11 flex-1 rounded-xl font-bold uppercase text-[9px] tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-md">Rad etish</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Davomat;
