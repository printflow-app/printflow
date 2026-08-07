import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, AlertTriangle, CheckCircle2, Download, Search, Pencil, Trash2, Plus, ArrowRightLeft, Inbox, Check, X } from 'lucide-react';
import { financeApi, customersApi, cashBoxApi } from '../api';
import { useQuery } from '@tanstack/react-query';
import {
  usePaymentTypes, useCustomers, useEmployees, useExpenseTypes,
  useVendors, useDepartments, useInvalidate,
} from '../hooks/queries';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import CurrencyInput from '../components/CurrencyInput';
import { SkeletonTable, SkeletonStats } from '../components/Skeleton';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { exportToXlsx } from '../utils/exportToXlsx';
import { toast } from 'react-toastify';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + " UZS";
};

const Kassa: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const p = currentUser.permissions || {};
  // Admin / super-admin can edit & delete transactions to fix mistakes.
  // Mirrors backend canManageFinance check (admin role bypasses that gate).
  const canManageFinance = currentUser.role?.name?.toLowerCase() === 'admin'
    || currentUser.role?.name?.toLowerCase() === 'superadmin'
    || !!p.canManageFinance;

  // "Faqat o'zi kiritgan" — backend ham filtrlaydi; bu yerda faqat UI matnlari uchun.
  const isAdminUser = currentUser.role?.name?.toLowerCase() === 'admin'
    || currentUser.role?.name?.toLowerCase() === 'superadmin'
    || currentUser.login === 'admin';
  const ownCashOnly = !isAdminUser && !!p.canViewOwnCashOnly;

  // Kassa (ko'p kassali tizim) ruxsatlari
  const canManageCashBoxes = isAdminUser || !!p.canManageCashBoxes;
  const canTransferCash = isAdminUser || !!p.canTransferCash;
  // Kirim/chiqim sanasini o'zgartirish (orqa sana) ruxsati.
  const canSetDate = isAdminUser || !!p.canSetTransactionDate;

  // Tanlangan kassa — tenant bo'yicha localStorage'da saqlanadi (filiallar naqshi kabi).
  const tenantId = (() => {
    try { return JSON.parse(localStorage.getItem('pf_user_info') || '{}')?.tenantId || ''; } catch { return ''; }
  })();
  const CB_KEY = `pf_active_cashbox_${tenantId}`;

  // Kirim/chiqim sanasi uchun — bugungi kun (YYYY-MM-DD, lokal).
  const getToday = () => new Date().toLocaleDateString('en-CA');
  // Tanlangan kun uchun tranzaksiya sanasini quradi. Bugun tanlansa (yaratishda)
  // — server hozirgi vaqtni ishlatishi uchun date yuborilmaydi; boshqa kun tanlansa
  // o'sha kunning mahalliy tush payti (12:00) — UTC kun chegarasi filtriga xavfsiz tushadi.
  const buildDatePayload = (dateStr: string, isEdit: boolean): { date?: string } => {
    if (!dateStr) return {};
    if (!isEdit && dateStr === getToday()) return {};
    return { date: new Date(`${dateStr}T12:00:00`).toISOString() };
  };

  const [page, setPage] = useState(1);
  // Default — joriy oyning 1-sanasidan oxirgi sanasigacha (turg'un oy oralig'i,
  // sirpanuvchi 30 kun emas). User filtrni qo'lda o'zgartirib qidirishi mumkin.
  const { monthStart, monthEnd } = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { monthStart: start.toLocaleDateString('en-CA'), monthEnd: end.toLocaleDateString('en-CA') };
  })();
  // "Applied" filtr — so'rovlarga ulashadi. Faqat lupa bosilganda yangilanadi.
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(monthEnd);
  // "Draft" input qiymatlari — har bosishda yangilanadi, lekin so'rov yubormaydi.
  const [draftStart, setDraftStart] = useState(monthStart);
  const [draftEnd, setDraftEnd] = useState(monthEnd);
  const [departmentId, setDepartmentId] = useState('');
  const [vendorFilterId, setVendorFilterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const applyDateFilter = () => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  };
  const draftDiffers = draftStart !== startDate || draftEnd !== endDate;

  // Reset selected department when active branch changes
  useEffect(() => { setDepartmentId(''); setVendorFilterId(''); }, [activeBranchId]);

  // Static/reference data — long staleTime via RQ defaults
  const { data: paymentTypes = [] } = usePaymentTypes();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: customers = [] } = useCustomers(activeBranchId);
  const { data: employees = [] } = useEmployees();
  const { data: vendors = [] } = useVendors(activeBranchId);
  const { data: departments = [] } = useDepartments(activeBranchId);

  // === KASSALAR (cashboxes) — ko'p kassali tizim ===
  const cashBoxesQuery = useQuery({
    queryKey: ['cashboxes', activeBranchId],
    queryFn: async () => (await cashBoxApi.list(activeBranchId)).data,
  });
  const cashBoxes: any[] = cashBoxesQuery.data || [];

  // '' = "Barcha kassalar" (ko'rinadigan kassalar yig'indisi). Aks holda bitta kassa.
  const [selectedCashBoxId, setSelectedCashBoxId] = useState<string>(() => {
    try { return localStorage.getItem(CB_KEY) || ''; } catch { return ''; }
  });
  // Tanlangan kassa ro'yxatdan yo'qolsa (filial almashsa) — "Barcha"ga qaytamiz.
  useEffect(() => {
    if (selectedCashBoxId && cashBoxes.length && !cashBoxes.some(b => b.id === selectedCashBoxId)) {
      setSelectedCashBoxId('');
    }
  }, [cashBoxes, selectedCashBoxId]);
  useEffect(() => {
    try {
      if (selectedCashBoxId) localStorage.setItem(CB_KEY, selectedCashBoxId);
      else localStorage.removeItem(CB_KEY);
    } catch { /* private mode */ }
  }, [selectedCashBoxId]);

  // Menga kelgan, qabul kutayotgan topshirishlar (panelda ko'rsatiladi).
  const incomingTransfersQuery = useQuery({
    queryKey: ['cash-transfers-incoming'],
    queryFn: async () => (await cashBoxApi.listTransfers({ direction: 'incoming', status: 'pending' })).data,
  });
  const incomingTransfers: any[] = incomingTransfersQuery.data || [];

  // Transactions & summary — branch+range+dept+page+cashbox dependent, custom cache keys
  const transactionsQuery = useQuery({
    queryKey: ['kassa-transactions', activeBranchId, selectedCashBoxId, startDate, endDate, departmentId, vendorFilterId, page],
    queryFn: async () => {
      const params = { branchId: activeBranchId, page, limit: 20, start: startDate, end: endDate, ...(departmentId ? { departmentId } : {}), ...(vendorFilterId ? { vendorId: vendorFilterId } : {}), ...(selectedCashBoxId ? { cashBoxId: selectedCashBoxId } : {}) };
      const r = await financeApi.getTransactions({ params });
      return r.data;
    },
  });
  const summaryQuery = useQuery({
    queryKey: ['kassa-summary', activeBranchId, selectedCashBoxId, startDate, endDate, departmentId, vendorFilterId],
    queryFn: async () => {
      const params = { branchId: activeBranchId, start: startDate, end: endDate, ...(departmentId ? { departmentId } : {}), ...(vendorFilterId ? { vendorId: vendorFilterId } : {}), ...(selectedCashBoxId ? { cashBoxId: selectedCashBoxId } : {}) };
      const r = await financeApi.getDailySummary({ params });
      return r.data;
    },
  });

  const transactions = transactionsQuery.data?.data || [];
  const meta = transactionsQuery.data?.meta || null;
  const summary = summaryQuery.data || null;
  const isLoading = transactionsQuery.isLoading || summaryQuery.isLoading;
  const invalidate = useInvalidate();

  // fetchData() shim — mutation handlers chaqirsa, RQ kassa key'larini invalidate qiladi
  const fetchData = async (_silent = false) => {
    transactionsQuery.refetch();
    summaryQuery.refetch();
    cashBoxesQuery.refetch(); // balanslar o'zgargan bo'lishi mumkin
    incomingTransfersQuery.refetch(); // yangi topshirishlar
    invalidate.customers(); // debt could have changed
    invalidate.tasks(); // task remainingAmount could have changed
  };

  // EXPORT — joriy filtr oralig'idagi barcha tranzaksiyalarni .xlsx faylga yozadi.
  // Sahifalashni chetlab o'tib limit=10000 bilan bir martalik so'rov yuboramiz.
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = {
        branchId: activeBranchId,
        page: 1,
        limit: 10000,
        start: startDate,
        end: endDate,
        ...(departmentId ? { departmentId } : {}),
      };
      const res = await financeApi.getTransactions({ params });
      const all = (res.data?.data || []) as any[];
      if (all.length === 0) {
        toast.info("Tanlangan oraliqda ma'lumot yo'q");
        return;
      }

      // Sanani toza, bir xil "YYYY-MM-DD HH:MM" ko'rinishida beramiz — lokal
      // formatga bog'liq "g'alati" chiqishlarni oldini oladi.
      const fmtDateTime = (v: any) => {
        const d = new Date(v);
        if (isNaN(d.getTime())) return '';
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      };

      exportToXlsx({
        filename: `kassa_${startDate}_${endDate}`,
        sheetName: 'Kassa',
        rows: all,
        columns: [
          { header: 'Sana', accessor: (t) => fmtDateTime(t.date || t.createdAt) },
          { header: 'Turi', accessor: (t) => t.type === 'kirim' ? 'Kirim' : 'Chiqim' },
          { header: 'Kassa', accessor: (t) => t.cashBox?.name || '' },
          { header: 'Kirim (UZS)', accessor: (t) => t.type === 'kirim' ? Number(t.amount) : '', type: 'number' },
          { header: 'Chiqim (UZS)', accessor: (t) => t.type === 'chiqim' ? Number(t.amount) : '', type: 'number' },
          { header: "To'lov turi", accessor: (t) => t.paymentType?.name || '' },
          { header: 'Mijoz / Hamkor', accessor: (t) => t.vendor?.name || t.customer?.name || t.customerName || '' },
          { header: 'Xizmat / Sabab', accessor: (t) => t.serviceType || t.expenseReason || t.expenseType?.name || '' },
          { header: 'Xodim', accessor: (t) => t.employee?.fullName || '' },
          { header: "Bo'lim", accessor: (t) => t.department?.name || '' },
        ],
      });
      toast.success(`${all.length} ta yozuv eksport qilindi`);
    } catch {
      toast.error('Eksportda xatolik');
    } finally {
      setIsExporting(false);
    }
  };

  // Modals
  const [isKirimModalOpen, setIsKirimModalOpen] = useState(false);
  const [isChiqimModalOpen, setIsChiqimModalOpen] = useState(false);
  // editingTx — when set, the matching modal is in edit mode (PATCH) instead of create (POST).
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Kassalar — topshirish, yangi kassa, qabul/rad modal holatlari
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromCashBoxId: '', toCashBoxId: '', amount: '', paymentTypeId: '', note: '' });
  const [isNewBoxModalOpen, setIsNewBoxModalOpen] = useState(false);
  const [newBoxForm, setNewBoxForm] = useState({ name: '', type: 'personal', assignedUserId: '' });
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useAutoRefresh(() => fetchData(true), {
    intervalMs: 15000,
    paused: isKirimModalOpen || isChiqimModalOpen,
  });

  // Forms
  const [kirimForm, setKirimForm] = useState({ amount: '', paymentTypeId: '', customerId: '', customerName: '', serviceType: '', taskId: '', forExistingDebt: false, vendorId: '', departmentId: '', date: getToday(), cashBoxId: '' });
  const [chiqimForm, setChiqimForm] = useState({ amount: '', paymentTypeId: '', expenseReason: '', expenseTypeId: '', employeeId: '', isEmployeeExpense: false, isVendorExpense: false, vendorId: '', departmentId: '', date: getToday(), isSalaryAdvance: false, cashBoxId: '' });
  const [customerTasks, setCustomerTasks] = useState<any[]>([]);

  const handleCustomerChange = async (cid: string) => {
    setKirimForm((f: any) => ({ ...f, customerId: cid, customerName: '', serviceType: '', taskId: '' }));
    if (!cid) {
      setCustomerTasks([]);
      return;
    }
    try {
      const res = await customersApi.getCustomerTasks(cid);
      setCustomerTasks(res.data || []);
    } catch {
      setCustomerTasks([]);
    }
  };

  const selectedCustomerInfo = (customers as any[]).find((c: any) => c.id === kirimForm.customerId);
  const hasDebt = selectedCustomerInfo ? (selectedCustomerInfo.totalDebt - selectedCustomerInfo.totalPaid > 0) : false;
  const currentDebtAmount = hasDebt ? (selectedCustomerInfo.totalDebt - selectedCustomerInfo.totalPaid) : 0;

  useEffect(() => {
    if (!hasDebt) {
      setKirimForm(prev => ({ ...prev, forExistingDebt: false }));
    }
  }, [hasDebt]);

  // Yangi yozuv qaysi kassaga tushishi kerak.
  //
  // Avval yuqoridagi filtr ("hozir shu kassani ko'ryapman") olinadi. Filtr
  // "Barcha kassalar"da bo'lsa-yu foydalanuvchida bitta kassa bo'lsa —
  // o'shanisi. Ilgari bu joy filtrga bevosita bog'langan edi va "Barcha"
  // tanlanganda yozuv `cashBoxId: null` bo'lib saqlanardi: pul hech qaysi
  // kassaga tushmasdi va kassalar balansi haqiqatdan chetlashardi.
  const defaultCashBoxId = () =>
    selectedCashBoxId || (cashBoxes.length === 1 ? cashBoxes[0].id : '');

  const resetKirimForm = () => setKirimForm({ amount: '', paymentTypeId: '', customerId: '', customerName: '', serviceType: '', taskId: '', forExistingDebt: false, vendorId: '', departmentId: '', date: getToday(), cashBoxId: defaultCashBoxId() });
  const resetChiqimForm = () => setChiqimForm({ amount: '', paymentTypeId: '', expenseReason: '', expenseTypeId: '', employeeId: '', isEmployeeExpense: false, isVendorExpense: false, vendorId: '', departmentId: '', date: getToday(), isSalaryAdvance: false, cashBoxId: defaultCashBoxId() });

  const closeKirimModal = () => {
    setIsKirimModalOpen(false);
    setEditingTx(null);
    resetKirimForm();
  };
  const closeChiqimModal = () => {
    setIsChiqimModalOpen(false);
    setEditingTx(null);
    resetChiqimForm();
  };

  // Ochilishda kassa to'ldiriladi. Bu kerak, chunki forma holati sahifa
  // birinchi yuklanganda tuziladi — o'shanda kassalar ro'yxati hali kelmagan
  // bo'ladi va sukut bo'sh qolib ketardi.
  const openKirimModal = () => {
    setKirimForm((f) => ({ ...f, cashBoxId: f.cashBoxId || defaultCashBoxId() }));
    setIsKirimModalOpen(true);
  };
  const openChiqimModal = () => {
    setChiqimForm((f) => ({ ...f, cashBoxId: f.cashBoxId || defaultCashBoxId() }));
    setIsChiqimModalOpen(true);
  };

  const handleAddKirim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const { date: _kdate, ...kirimRest } = kirimForm;
      const payload = {
        ...kirimRest,
        type: 'kirim',
        vendorId: kirimForm.vendorId && kirimForm.vendorId !== '_' ? kirimForm.vendorId : null,
        customerId: kirimForm.vendorId ? null : (kirimForm.customerId || null),
        taskId: kirimForm.taskId || null,
        departmentId: kirimForm.departmentId || null,
        branchId: activeBranchId || null,
        cashBoxId: kirimForm.cashBoxId || null,
        ...(canSetDate ? buildDatePayload(kirimForm.date, !!editingTx) : {}),
      };
      if (editingTx) {
        await financeApi.updateTransaction(editingTx.id, payload);
        showStatus('success', "Kirim yangilandi!");
      } else {
        await financeApi.createTransaction(payload);
        showStatus('success', "Kirim muvaffaqiyatli amalga oshirildi!");
      }
      closeKirimModal();
      fetchData(true);
    } catch (err) {
      showStatus('error', editingTx ? "Tahrirlashda xatolik" : "Kirim qo'shishda xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChiqim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const { date: _cdate, ...chiqimRest } = chiqimForm;
      const payload = {
        ...chiqimRest,
        type: 'chiqim',
        employeeId: chiqimForm.isEmployeeExpense ? (chiqimForm.employeeId || null) : null,
        vendorId: chiqimForm.isVendorExpense ? (chiqimForm.vendorId || null) : null,
        expenseTypeId: chiqimForm.isVendorExpense || chiqimForm.isEmployeeExpense ? null : (chiqimForm.expenseTypeId || null),
        isSalaryAdvance: chiqimForm.isEmployeeExpense ? chiqimForm.isSalaryAdvance : false,
        departmentId: chiqimForm.departmentId || null,
        branchId: activeBranchId || null,
        cashBoxId: chiqimForm.cashBoxId || null,
        ...(canSetDate ? buildDatePayload(chiqimForm.date, !!editingTx) : {}),
      };
      if (editingTx) {
        await financeApi.updateTransaction(editingTx.id, payload);
        showStatus('success', "Chiqim yangilandi!");
      } else {
        await financeApi.createTransaction(payload);
        showStatus('success', "Chiqim muvaffaqiyatli amalga oshirildi!");
      }
      closeChiqimModal();
      fetchData(true);
    } catch (err) {
      showStatus('error', editingTx ? "Tahrirlashda xatolik" : "Chiqim qo'shishda xatolik yuz berdi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pre-fill the matching modal with the row's data and open it in edit mode.
  // We don't allow type switch in edit (kirim ↔ chiqim) — for that, delete & re-add.
  const openEditModal = async (t: any) => {
    setEditingTx(t);
    if (t.type === 'kirim') {
      setKirimForm({
        amount: t.amount != null ? String(t.amount) : '',
        paymentTypeId: t.paymentTypeId || '',
        customerId: t.customerId || '',
        customerName: t.customerName || '',
        serviceType: t.serviceType || '',
        taskId: t.taskId || '',
        forExistingDebt: false,
        vendorId: t.vendorId || '',
        departmentId: t.departmentId || '',
        date: t.date ? new Date(t.date).toLocaleDateString('en-CA') : getToday(),
        // Yozuvning o'z kassasi — tahrirda pul boshqa kassaga ko'chib ketmasin.
        cashBoxId: t.cashBoxId || '',
      });
      // Preload customer's task list so the "bog'liq buyurtma" select works in edit mode.
      if (t.customerId) {
        try {
          const res = await customersApi.getCustomerTasks(t.customerId);
          setCustomerTasks(res.data || []);
        } catch {
          setCustomerTasks([]);
        }
      } else {
        setCustomerTasks([]);
      }
      setIsKirimModalOpen(true);
    } else {
      setChiqimForm({
        amount: t.amount != null ? String(t.amount) : '',
        paymentTypeId: t.paymentTypeId || '',
        expenseReason: t.expenseReason || '',
        expenseTypeId: t.expenseTypeId || '',
        employeeId: t.employeeId || '',
        isEmployeeExpense: !!t.employeeId && !t.vendorId,
        isVendorExpense: !!t.vendorId,
        vendorId: t.vendorId || '',
        departmentId: t.departmentId || '',
        date: t.date ? new Date(t.date).toLocaleDateString('en-CA') : getToday(),
        isSalaryAdvance: !!t.isSalaryAdvance,
        cashBoxId: t.cashBoxId || '',
      });
      setIsChiqimModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await financeApi.deleteTransaction(deleteTarget.id);
      showStatus('success', "Tranzaksiya o'chirildi");
      setDeleteTarget(null);
      fetchData(true);
    } catch {
      showStatus('error', "O'chirishda xatolik");
    } finally {
      setIsDeleting(false);
    }
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // === KASSALAR: topshirish / yangi kassa / qabul-rad ===
  const openTransferModal = () => {
    setTransferForm({
      fromCashBoxId: selectedCashBoxId || (cashBoxes[0]?.id || ''),
      toCashBoxId: '',
      amount: '',
      paymentTypeId: '',
      note: '',
    });
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.fromCashBoxId === transferForm.toCashBoxId) {
      showStatus('error', 'Bir xil kassaga topshirib bo\'lmaydi');
      return;
    }
    try {
      setIsSubmitting(true);
      await cashBoxApi.createTransfer({
        fromCashBoxId: transferForm.fromCashBoxId,
        toCashBoxId: transferForm.toCashBoxId,
        amount: Number(transferForm.amount),
        note: transferForm.note || undefined,
        paymentTypeId: transferForm.paymentTypeId || undefined,
      });
      setIsTransferModalOpen(false);
      showStatus('success', 'Pul topshirildi — qabul qilinishi kutilmoqda');
      fetchData(true);
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Topshirishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await cashBoxApi.create({
        name: newBoxForm.name,
        type: newBoxForm.type,
        branchId: activeBranchId || null,
        assignedUserId: newBoxForm.assignedUserId || null,
      });
      setIsNewBoxModalOpen(false);
      setNewBoxForm({ name: '', type: 'personal', assignedUserId: '' });
      showStatus('success', 'Kassa yaratildi');
      cashBoxesQuery.refetch();
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Kassa yaratishda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptTransfer = async (id: string) => {
    try {
      setRespondingId(id);
      await cashBoxApi.accept(id);
      showStatus('success', 'Qabul qilindi — kassangizga kirim bo\'ldi');
      fetchData(true);
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Qabul qilishda xatolik');
    } finally {
      setRespondingId(null);
    }
  };

  const handleRejectTransfer = async (id: string) => {
    try {
      setRespondingId(id);
      await cashBoxApi.reject(id);
      showStatus('success', 'Rad etildi — pul yuboruvchi kassaga qaytdi');
      fetchData(true);
    } catch (err: any) {
      showStatus('error', err?.response?.data?.message || 'Rad etishda xatolik');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in relative">
      {isLoading && (
        <div className="space-y-4 mb-4">
          <SkeletonStats count={3} />
          <SkeletonTable rows={6} cols={5} />
        </div>
      )}
      {isLoading ? null : (<>
      
      {/* Global Status Notification */}
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="font-bold text-sm">{statusMessage.text}</span>
        </div>
      )}

      {/* Kassa selektori + amallar */}
      {(cashBoxes.length > 0 || canManageCashBoxes) && (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-1 flex-1">
            <button
              onClick={() => setSelectedCashBoxId('')}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border ${!selectedCashBoxId ? 'bg-[color:var(--primary)] text-white border-transparent shadow' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
              Barcha kassalar
            </button>
            {cashBoxes.map((b: any) => {
              const active = selectedCashBoxId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedCashBoxId(b.id)}
                  title={b.assignedUserName ? `Mas'ul: ${b.assignedUserName}` : undefined}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-left transition-colors border ${active ? 'bg-[color:var(--primary)] text-white border-transparent shadow' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold whitespace-nowrap">{b.name}</span>
                    {b.type === 'main' && (
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>asosiy</span>
                    )}
                  </div>
                  {/* Bu — kassadagi HOZIRGI QOLDIQ (butun davr uchun), pastdagi
                      kartalar esa tanlangan sana oralig'i uchun. Ikkalasi turli
                      narsa; belgisiz ular bir-biriga zid ko'rinardi. */}
                  <div className={`text-[12px] font-bold tabular-nums mt-0.5 ${active ? 'text-white/90' : ((b.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                    <span className={`text-[9px] font-bold uppercase mr-1 ${active ? 'text-white/60' : 'text-slate-400'}`}>qoldiq</span>
                    {formatCurrency(b.balance || 0)}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 shrink-0">
            {canTransferCash && cashBoxes.length >= 2 && (
              <button onClick={openTransferModal} className="btn-outline h-sm">
                <ArrowRightLeft size={14}/> Topshirish
              </button>
            )}
            {canManageCashBoxes && (
              <button onClick={() => setIsNewBoxModalOpen(true)} className="btn-outline h-sm">
                <Plus size={14}/> Yangi kassa
              </button>
            )}
          </div>
        </div>
      )}

      {/* Qabul qilinishi kutilayotgan topshirishlar */}
      {incomingTransfers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Inbox size={16}/></div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">Qabul qilinishi kutilmoqda</h3>
              <p className="text-[12px] text-amber-700">Sizga topshirilgan pulni sanab, tasdiqlang</p>
            </div>
          </div>
          <div className="space-y-2">
            {incomingTransfers.map((t: any) => (
              <div key={t.id} className="bg-white rounded-xl border border-amber-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {t.fromCashBoxName || 'Kassa'} <span className="text-slate-400">→</span> {t.toCashBoxName || 'Kassa'}
                  </p>
                  <p className="text-[12px] text-slate-500 truncate">
                    {t.initiatedByName ? `${t.initiatedByName} yubordi` : 'Topshirildi'}
                    {t.note ? ` · ${t.note}` : ''} · {new Date(t.createdAt).toLocaleString('uz-UZ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-base font-bold text-emerald-600 tabular-nums mr-1">+{formatCurrency(t.amount)}</span>
                  <button onClick={() => handleAcceptTransfer(t.id)} disabled={respondingId === t.id} className="btn-success h-sm">
                    <Check size={14}/> Qabul qildim
                  </button>
                  <button onClick={() => handleRejectTransfer(t.id)} disabled={respondingId === t.id} className="btn-outline h-sm">
                    <X size={14}/> Rad etish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BO'LIMGA BIRIKTIRILMAGAN OGOHLANTIRISHI.
          Bo'lim maydoni Kassa formasiga keyinroq qo'shilgani uchun eski
          yozuvlarda u bo'sh. Ular hech qaysi bo'lim summasiga kirmaydi —
          buni aytmasak, rahbar "bo'limda chiqim yo'q" deb noto'g'ri
          xulosa qiladi. */}
      {departmentId && summary?.biriktirilmagan &&
       (summary.biriktirilmagan.kirim > 0 || summary.biriktirilmagan.chiqim > 0) && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/60">
          <div className="p-2 bg-amber-100 text-amber-600 rounded-lg flex-shrink-0"><AlertTriangle size={16} /></div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-amber-800">Bu summalar bo'lim bo'yicha to'liq emas</p>
            <p className="text-xs font-medium text-amber-700 mt-0.5 leading-relaxed">
              Hech qaysi bo'limga biriktirilmagan{' '}
              <b>{formatCurrency(summary.biriktirilmagan.kirim)}</b> kirim va{' '}
              <b>{formatCurrency(summary.biriktirilmagan.chiqim)}</b> chiqim bor — ular yuqoridagi
              hisobga KIRMAGAN. Yozuvni tahrirlab bo'limini belgilasangiz, hisobotga qo'shiladi.
            </p>
          </div>
        </div>
      )}

      {/* Daily Summary Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="label-caps">Kirim {startDate === endDate ? `(${startDate})` : `(${startDate} → ${endDate})`}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={16}/></div>
          </div>
          <p className="text-xl font-bold text-emerald-600 tracking-tight">{formatCurrency(summary?.totalKirim || 0)}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            {summary?.kirimBreakdown?.map((b: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{b.name}</span>
                <span className="text-emerald-500">+{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {!summary?.kirimBreakdown?.length && <p className="text-xs text-slate-400">Kirimlar yo'q</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="label-caps">Chiqim {startDate === endDate ? `(${startDate})` : `(${startDate} → ${endDate})`}</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={16}/></div>
          </div>
          <p className="text-xl font-bold text-rose-600 tracking-tight">{formatCurrency(summary?.totalChiqim || 0)}</p>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            {summary?.chiqimBreakdown?.map((b: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{b.name}</span>
                <span className="text-rose-500">-{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {!summary?.chiqimBreakdown?.length && <p className="text-xs text-slate-400">Chiqimlar yo'q</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="label-caps">Xarajat Yo'nalishlari</span>
            <div className="p-2 bg-slate-50 text-slate-400 rounded-lg"><Wallet size={16}/></div>
          </div>
          <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scroll pr-1">
            {summary?.expenseBreakdown?.map((b: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="text-slate-500">{b.name}</span>
                <span className="text-slate-700">{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {!summary?.expenseBreakdown?.length && <p className="text-xs text-slate-400">Xarajatlar yo'q</p>}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
            <span className="label-caps mb-1">{ownCashOnly ? 'Mening balansim' : 'Balans'}</span>
            <p className={`text-2xl font-bold tracking-tighter ${(summary?.balance || 0) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
              {formatCurrency(summary?.balance || 0)}
            </p>
            {ownCashOnly && (
              <span className="mt-1 text-[12px] font-medium text-orange-600">Faqat o'zingiz kiritgan</span>
            )}
            <div className="mt-2 px-3 py-1 bg-slate-100 rounded-full">
               <span className="text-xs font-medium text-slate-500">{startDate === endDate ? new Date(startDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' }) : `${startDate} → ${endDate}`}</span>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-slate-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h3 className="card-title flex items-center gap-2">
                <Wallet size={16} className="text-[color:var(--primary)]" /> Kassa amaliyotlari
              </h3>
              <p className="text-hint mt-0.5">Kunlik tranzaksiyalar tarixi</p>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
               <input
                 type="date"
                 value={draftStart}
                 max={draftEnd}
                 onChange={(e) => setDraftStart(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') applyDateFilter(); }}
                 className="text-xs font-medium text-slate-600 border-none focus:ring-0 cursor-pointer bg-transparent py-1"
               />
               <span className="text-[11px] font-bold text-slate-400">→</span>
               <input
                 type="date"
                 value={draftEnd}
                 min={draftStart}
                 onChange={(e) => setDraftEnd(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') applyDateFilter(); }}
                 className="text-xs font-medium text-slate-600 border-none focus:ring-0 cursor-pointer bg-transparent py-1"
               />
               <button
                 onClick={applyDateFilter}
                 disabled={!draftDiffers}
                 title="Qidirish"
                 className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${draftDiffers ? 'bg-orange-500 hover:bg-orange-600 text-white shadow' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
               >
                 <Search size={13} strokeWidth={2.5} />
               </button>
               <button
                 onClick={() => { const t = new Date().toLocaleDateString('en-CA'); setDraftStart(t); setDraftEnd(t); setStartDate(t); setEndDate(t); setPage(1); }}
                 className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-xs font-medium rounded-md transition-colors text-slate-600"
               >
                 Bugun
               </button>
            </div>
          </div>
          {departments.length > 0 && (
            <select
              value={departmentId}
              onChange={e => { setDepartmentId(e.target.value); setPage(1); }}
              className="select-minimal h-control-sm w-auto text-xs"
            >
              <option value="">Barcha bo'limlar</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {/* Hamkor filtri — hamkorlarga oid kirim/chiqimlarni ko'rish uchun */}
          {(vendors as any[]).length > 0 && (
            <select
              value={vendorFilterId}
              onChange={e => { setVendorFilterId(e.target.value); setPage(1); }}
              className="select-minimal h-control-sm w-auto text-xs"
              title="Ma'lum hamkorga oid kirim/chiqimlar"
            >
              <option value="">Barcha hamkorlar</option>
              {(vendors as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          )}
          <div className="flex gap-2">
             {(currentUser.role?.name?.toLowerCase() === 'admin' || p.canExportFinance) && (
               <button
                 onClick={handleExport}
                 disabled={isExporting}
                 className="btn-outline h-sm flex-1 sm:flex-none"
                 title="Joriy oraliqdagi tranzaksiyalarni Excel'ga eksport qilish"
               >
                 <Download size={14}/> {isExporting ? 'Eksport...' : 'Eksport'}
               </button>
             )}
             {p.canAddIncome && (
               <button onClick={openKirimModal} className="btn-success h-sm flex-1 sm:flex-none">
                 <TrendingUp size={14}/> Kirim
               </button>
             )}
             {p.canAddExpense && (
               <button onClick={openChiqimModal} className="btn-danger h-sm flex-1 sm:flex-none">
                 <TrendingDown size={14}/> Chiqim
               </button>
             )}
          </div>
        </div>

        <div className="overflow-x-auto custom-scroll overflow-y-auto max-h-[55vh]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
              <tr className="border-b border-slate-100">
                <th className="py-3 px-5 label-caps w-12">Turi</th>
                <th className="py-3 px-5 label-caps">Mijoz / Sabab</th>
                <th className="py-3 px-5 label-caps text-right">Summa</th>
                <th className="py-3 px-5 label-caps text-center hidden md:table-cell">To'lov</th>
                <th className="py-3 px-5 label-caps text-right pr-6">Sana</th>
                {canManageFinance && (
                  <th className="py-3 px-3 label-caps text-center w-24">Amallar</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(transactions as any[]).map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3 px-5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.type === 'kirim' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'kirim' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                      </div>
                  </td>
                  <td className="py-3 px-5">
                      <p className="font-bold text-slate-800 text-xs tracking-tight">
                        {t.type === 'kirim'
                          ? (t.vendor?.name ? `Hamkor: ${t.vendor.name}` : (t.customer?.name || t.customerName || t.serviceType || '—'))
                          : (t.vendor?.name ? `Hamkor: ${t.vendor.name}` : (t.employeeId && !p.canViewSalary) ? 'Xodim maoshi' : (t.expenseReason || (t.expenseType?.name + (t.employee?.fullName ? ' - ' + t.employee.fullName : ''))))}
                      </p>
                      {t.vendor && <span className="text-[12px] font-medium text-slate-600 mt-0.5">{Array.isArray(t.vendor.roles) && t.vendor.roles.length ? t.vendor.roles.join(', ') : 'Hamkor'}</span>}
                      {!t.vendor && t.expenseType && <span className="text-[12px] font-medium text-slate-400 mt-0.5">{t.expenseType.name}</span>}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                      <span className={`font-bold text-xs tabular-nums ${t.type === 'kirim' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {(t.type === 'chiqim' && t.employeeId && !p.canViewSalary) ? '***' : (t.type === 'kirim' ? '+' : '-') + formatCurrency(t.amount)}
                      </span>
                  </td>
                  <td className="py-3 px-5 text-center hidden md:table-cell">
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200/60 uppercase tracking-tighter">
                        {t.paymentType?.name || '—'}
                      </span>
                  </td>
                  <td className="py-3 px-5 text-right pr-6 whitespace-nowrap">
                      <p className="text-[11px] font-bold text-slate-400 tabular-nums">{new Date(t.date).toLocaleDateString('uz-UZ')}</p>
                      <p className="text-[10px] font-medium text-slate-300 mt-0.5 tabular-nums">{new Date(t.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  {canManageFinance && (
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(t)}
                          title="Tahrirlash"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                        >
                          <Pencil size={13} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          title="O'chirish"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                   <td colSpan={canManageFinance ? 6 : 5} className="py-20 text-center">
                     <div className="flex flex-col items-center justify-center opacity-30">
                       <Wallet size={40} className="mb-4" />
                       <p className="font-bold uppercase text-xs">Tanlangan davrda amaliyotlar yo'q</p>
                     </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {meta && meta.lastPage > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-4 bg-slate-50/30">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-outline h-sm disabled:opacity-30"
            >
              Oldingi
            </button>
            <span className="text-xs font-medium text-slate-500">
              Sahifa {page} / {meta.lastPage}
            </span>
            <button 
              disabled={page === meta.lastPage}
              onClick={() => setPage(p => p + 1)}
              className="btn-outline h-sm disabled:opacity-30"
            >
              Keyingi
            </button>
          </div>
        )}
      </div>

      {/* Modal: Kirim Qo'shish / Tahrirlash */}
      <Modal
        isOpen={isKirimModalOpen}
        onClose={closeKirimModal}
        title={editingTx ? "Kirimni Tahrirlash" : "Kirim Amaliyoti"}
        type="success"
      >
        <form onSubmit={handleAddKirim} className="space-y-4">
          {vendors.length > 0 && (
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button type="button" onClick={() => setKirimForm(f => ({...f, vendorId: ''}))} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-xl transition-colors ${!kirimForm.vendorId ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>MIJOZDAN</button>
              <button type="button" onClick={() => setKirimForm(f => ({...f, vendorId: '_', customerId: '', customerName: ''}))} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-xl transition-colors ${kirimForm.vendorId ? 'bg-white shadow text-slate-600' : 'text-slate-400'}`}>HAMKORDAN</button>
            </div>
          )}

          {kirimForm.vendorId ? (
            <div className="animate-fade-in">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Hamkorni tanlang</label>
              <select required value={kirimForm.vendorId === '_' ? '' : kirimForm.vendorId} onChange={e => setKirimForm(f => ({...f, vendorId: e.target.value}))} className="select-minimal">
                <option value="">Tanlang...</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{Array.isArray(v.roles) && v.roles.length ? ` — ${v.roles.join(', ')}` : ''}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Mijozni tanlang</label>
              <SearchableSelect
                options={customers.map(c => ({ id: c.id, label: c.name, subLabel: c.phone || 'Tel yo\'q', value: c }))}
                value={kirimForm.customerId}
                onChange={(id) => handleCustomerChange(id)}
                placeholder="Mijoz qidirish..."
              />
              {!kirimForm.customerId && (
                <div className="mt-2 animate-fade-in">
                  <input type="text" value={kirimForm.customerName} onChange={e => setKirimForm(f => ({ ...f, customerName: e.target.value }))} className="input-minimal text-slate-700 font-bold" placeholder="Noma'lum mijoz ismi (ixtiyoriy)..."/>
                </div>
              )}
            </div>
          )}

          {!kirimForm.vendorId && customerTasks.length > 0 && (
            <div className="animate-fade-in">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1 text-orange-500">Bog'liq buyurtma (qarzni shu task'ga belgilash)</label>
              <select
                value={kirimForm.taskId}
                onChange={e => {
                  const selectedId = e.target.value;
                  const selectedTask = customerTasks.find((t: any) => t.id === selectedId);
                  setKirimForm(f => ({
                    ...f,
                    taskId: selectedId,
                    serviceType: selectedTask ? (selectedTask.orderName || selectedTask.title) : '',
                    // Buyurtmaning bo'limi allaqachon ma'lum — uni o'zi
                    // qo'yamiz, foydalanuvchidan qayta so'ramaymiz. Ko'rinib
                    // turadi va kerak bo'lsa o'zgartirsa bo'ladi.
                    departmentId: selectedTask?.departmentId || f.departmentId,
                  }));
                }}
                className="select-minimal h-11 font-bold text-orange-700"
              >
                <option value="">— Buyurtmani tanlang (ixtiyoriy) —</option>
                {customerTasks
                  .filter((t: any) => Number(t.remainingAmount || 0) > 0)
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.orderName || t.title} — qoldiq: {new Intl.NumberFormat('uz-UZ').format(Number(t.remainingAmount || 0))}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {!kirimForm.vendorId && hasDebt && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-orange-900 flex items-center gap-2">
                <AlertCircle size={14} className="text-orange-500" />
                Mijoz qarzi: <span className="font-bold">{formatCurrency(currentDebtAmount)}</span>
              </p>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={kirimForm.forExistingDebt} onChange={(e) => setKirimForm({...kirimForm, forExistingDebt: e.target.checked})} className="w-5 h-5 rounded-lg border-2 border-orange-300 text-orange-500 focus:ring-orange-200 transition-all cursor-pointer" />
                <span className="text-xs font-bold text-orange-800">Qarzdorlikni qoplash uchun</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Xizmat Nomi / Izoh</label>
            <input type="text" required={!kirimForm.forExistingDebt} value={kirimForm.serviceType} onChange={(e) => setKirimForm({...kirimForm, serviceType: e.target.value})} className="input-minimal" placeholder={kirimForm.forExistingDebt ? "Qarz to'lovi" : "Masalan: Banner bosish..."} />
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Summa</label>
            <CurrencyInput
              value={kirimForm.amount}
              onChange={(uzs) => setKirimForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
              colorClass="text-emerald-600 focus:border-emerald-500"
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">To'lov Turi</label>
            <select required value={kirimForm.paymentTypeId} onChange={(e) => setKirimForm({...kirimForm, paymentTypeId: e.target.value})} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>

          {/* KASSA — pul aynan qaysi kassaga tushishi.
              Bitta kassa bo'lsa ko'rsatilmaydi: tanlov yo'q, o'zi qo'yiladi. */}
          {cashBoxes.length > 1 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Qaysi kassaga</label>
              <select required value={kirimForm.cashBoxId} onChange={(e) => setKirimForm({ ...kirimForm, cashBoxId: e.target.value })} className="select-minimal">
                <option value="">Tanlang...</option>
                {cashBoxes.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* BO'LIM — busiz yozuv hech qaysi bo'lim hisobotiga tushmaydi.
              Ilgari bu maydon umuman yo'q edi: filtri bor edi, lekin yozadigan
              joyi yo'q, shuning uchun bo'lim tanlanganda hisobot kam summa
              ko'rsatardi. */}
          {departments.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Bo'lim</label>
              <select value={kirimForm.departmentId} onChange={(e) => setKirimForm({ ...kirimForm, departmentId: e.target.value })} className="select-minimal">
                <option value="">Bo'limsiz</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {canSetDate && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Sana (qaysi kunga)</label>
              <input type="date" value={kirimForm.date} onChange={(e) => setKirimForm(f => ({ ...f, date: e.target.value }))} className="input-minimal" />
            </div>
          )}


          <div className="flex gap-3 pt-4">
            <button type="button" onClick={closeKirimModal} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-success h-11 shadow-emerald-500/20">
              {isSubmitting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : (editingTx ? "SAQLASH" : "TASDIQLASH")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Chiqim Qo'shish / Tahrirlash */}
      <Modal
        isOpen={isChiqimModalOpen}
        onClose={closeChiqimModal}
        title={editingTx ? "Chiqimni Tahrirlash" : "Chiqim / Xarajat"}
        type="danger"
      >
        <form onSubmit={handleAddChiqim} className="space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-2">
            <button type="button" onClick={() => setChiqimForm(f => ({...f, isEmployeeExpense: false, isVendorExpense: false}))} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-xl transition-colors ${!chiqimForm.isEmployeeExpense && !chiqimForm.isVendorExpense ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>UMUMIY</button>
            <button type="button" onClick={() => setChiqimForm(f => ({...f, isEmployeeExpense: true, isVendorExpense: false}))} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-xl transition-colors ${chiqimForm.isEmployeeExpense ? 'bg-white shadow text-orange-600' : 'text-slate-400'}`}>HODIM</button>
            {vendors.length > 0 && <button type="button" onClick={() => setChiqimForm(f => ({...f, isVendorExpense: true, isEmployeeExpense: false}))} className={`flex-1 py-2 text-[11px] font-bold uppercase rounded-xl transition-colors ${chiqimForm.isVendorExpense ? 'bg-white shadow text-slate-600' : 'text-slate-400'}`}>HAMKOR</button>}
          </div>

          {!chiqimForm.isEmployeeExpense && !chiqimForm.isVendorExpense && (
            <div className="animate-fade-in">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Xarajat Turi</label>
              <select required value={chiqimForm.expenseTypeId} onChange={(e) => setChiqimForm({...chiqimForm, expenseTypeId: e.target.value})} className="select-minimal">
                <option value="">Tanlang...</option>
                {expenseTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
              </select>
            </div>
          )}
          {chiqimForm.isEmployeeExpense && (
            <div className="animate-fade-in space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Hodimni tanlang</label>
                <SearchableSelect
                  options={employees.map(e => ({ id: e.id, label: e.fullName, subLabel: e.role?.name || 'Xodim', value: e }))}
                  value={chiqimForm.employeeId}
                  onChange={(id) => setChiqimForm(f => ({ ...f, employeeId: id }))}
                  placeholder="Hodim qidirish..."
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer bg-orange-50 border border-orange-200 rounded-2xl p-3">
                <input
                  type="checkbox"
                  checked={chiqimForm.isSalaryAdvance}
                  onChange={(e) => setChiqimForm(f => ({ ...f, isSalaryAdvance: e.target.checked }))}
                  className="w-5 h-5 rounded-lg border-2 border-orange-300 text-orange-500 focus:ring-orange-200 mt-0.5 cursor-pointer"
                />
                <span className="text-xs font-bold text-orange-800">
                  Bu avans (oylikdan ushlanadi)
                  <span className="block text-[11px] font-medium text-orange-500 mt-0.5">Belgilansa — oy oxirida maoshdan avtomatik ayiriladi. Belgilanmasa — oddiy xarajat qoplash (maoshga tegmaydi).</span>
                </span>
              </label>
            </div>
          )}
          {chiqimForm.isVendorExpense && (
            <div className="animate-fade-in">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Hamkorni tanlang</label>
              <select required value={chiqimForm.vendorId} onChange={e => setChiqimForm(f => ({...f, vendorId: e.target.value}))} className="select-minimal">
                <option value="">Tanlang...</option>
                {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}{Array.isArray(v.roles) && v.roles.length ? ` — ${v.roles.join(', ')}` : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Xarajat Sababi (Ixtiyoriy)</label>
            <input type="text" value={chiqimForm.expenseReason} onChange={(e) => setChiqimForm({...chiqimForm, expenseReason: e.target.value})} className="input-minimal" placeholder="Masalan: Kommunal to'lov, Material..." />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Summa</label>
            <CurrencyInput
              value={chiqimForm.amount}
              onChange={(uzs) => setChiqimForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
              colorClass="text-rose-600 focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">To'lov Turi</label>
            <select required value={chiqimForm.paymentTypeId} onChange={(e) => setChiqimForm({...chiqimForm, paymentTypeId: e.target.value})} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>

          {/* BO'LIM — chiqimlarda bu ayniqsa muhim edi: birorta chiqim
              buyurtmaga bog'lanmagani uchun bo'lim tanlanganda hisobot
              CHIQIMNI DOIM 0 ko'rsatardi. */}
          {/* KASSA — pul aynan qaysi kassadan chiqishi. */}
          {cashBoxes.length > 1 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Qaysi kassadan</label>
              <select required value={chiqimForm.cashBoxId} onChange={(e) => setChiqimForm({ ...chiqimForm, cashBoxId: e.target.value })} className="select-minimal">
                <option value="">Tanlang...</option>
                {cashBoxes.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {departments.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Bo'lim</label>
              <select value={chiqimForm.departmentId} onChange={(e) => setChiqimForm({ ...chiqimForm, departmentId: e.target.value })} className="select-minimal">
                <option value="">Bo'limsiz</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          {canSetDate && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Sana (qaysi kunga)</label>
              <input type="date" value={chiqimForm.date} onChange={(e) => setChiqimForm(f => ({ ...f, date: e.target.value }))} className="input-minimal" />
            </div>
          )}


          <div className="flex gap-3 pt-4">
            <button type="button" onClick={closeChiqimModal} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-danger h-11 shadow-rose-500/20">
              {isSubmitting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : (editingTx ? "SAQLASH" : "TASDIQLASH")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="O'chirishni tasdiqlang"
        type="danger"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Quyidagi {deleteTarget.type === 'kirim' ? 'kirim' : 'chiqim'} tranzaksiyasi o'chiriladi va u qilgan barcha o'zgarishlar (mijoz to'lovi, xodimga berilgan summa, buyurtma qoldig'i) qaytariladi. Bu amalni qaytarib bo'lmaydi.
            </p>
            <div className={`p-4 rounded-2xl border ${deleteTarget.type === 'kirim' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Summa</span>
                <span className={`font-bold text-lg ${deleteTarget.type === 'kirim' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {(deleteTarget.type === 'kirim' ? '+' : '-') + formatCurrency(deleteTarget.amount)}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-700 truncate">
                {deleteTarget.vendor?.name
                  ? `Hamkor: ${deleteTarget.vendor.name}`
                  : (deleteTarget.customer?.name || deleteTarget.customerName || deleteTarget.serviceType || deleteTarget.expenseReason || deleteTarget.expenseType?.name || '—')}
              </p>
              <p className="text-[11px] font-medium text-slate-400 mt-1">{new Date(deleteTarget.date).toLocaleString('uz-UZ')}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 btn-outline h-11"
              >
                BEKOR QILISH
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 btn-danger h-11 shadow-rose-500/20"
              >
                {isDeleting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : "O'CHIRISH"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Pulni topshirish (kassalararo) */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Pulni topshirish"
        type="default"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Qaysi kassadan</label>
            <select required value={transferForm.fromCashBoxId} onChange={e => setTransferForm(f => ({ ...f, fromCashBoxId: e.target.value }))} className="select-minimal">
              <option value="">Tanlang...</option>
              {cashBoxes.map((b: any) => <option key={b.id} value={b.id}>{b.name} — {formatCurrency(b.balance || 0)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Qaysi kassaga</label>
            <select required value={transferForm.toCashBoxId} onChange={e => setTransferForm(f => ({ ...f, toCashBoxId: e.target.value }))} className="select-minimal">
              <option value="">Tanlang...</option>
              {cashBoxes.filter((b: any) => b.id !== transferForm.fromCashBoxId).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}{b.assignedUserName ? ` — ${b.assignedUserName}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Summa</label>
            <CurrencyInput
              value={transferForm.amount}
              onChange={(uzs) => setTransferForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
              colorClass="text-slate-800 focus:border-[color:var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">To'lov turi (ixtiyoriy)</label>
            <select value={transferForm.paymentTypeId} onChange={e => setTransferForm(f => ({ ...f, paymentTypeId: e.target.value }))} className="select-minimal">
              <option value="">Tanlang...</option>
              {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Izoh (ixtiyoriy)</label>
            <input type="text" value={transferForm.note} onChange={e => setTransferForm(f => ({ ...f, note: e.target.value }))} className="input-minimal" placeholder="Masalan: Kunlik tushum" />
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[12px] text-slate-500 flex items-start gap-2">
            <AlertCircle size={14} className="text-slate-400 mt-0.5 shrink-0" />
            <span>Topshirilgach pul sizning kassangizdan chiqim bo'ladi. Qabul qiluvchi tasdiqlaganda uning kassasiga kirim bo'ladi.</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary h-11">
              {isSubmitting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : 'TOPSHIRISH'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Yangi kassa */}
      <Modal
        isOpen={isNewBoxModalOpen}
        onClose={() => setIsNewBoxModalOpen(false)}
        title="Yangi kassa"
        type="default"
      >
        <form onSubmit={handleCreateBox} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Kassa nomi</label>
            <input type="text" required value={newBoxForm.name} onChange={e => setNewBoxForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Masalan: Kassir kassasi, Moliyachi kassasi..." />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 px-1">Mas'ul xodim (ixtiyoriy)</label>
            <SearchableSelect
              options={employees.map(e => ({ id: e.id, label: e.fullName, subLabel: e.role?.name || 'Xodim', value: e }))}
              value={newBoxForm.assignedUserId}
              onChange={(id) => setNewBoxForm(f => ({ ...f, assignedUserId: id }))}
              placeholder="Xodim qidirish..."
            />
            <p className="text-[12px] text-slate-400 mt-1.5 px-1">Biriktirilgan xodim (agar "Boshqa kassalarni ko'rish" ruxsati bo'lmasa) faqat shu kassani ko'radi.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsNewBoxModalOpen(false)} className="flex-1 btn-outline h-11">BEKOR QILISH</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 btn-primary h-11">
              {isSubmitting ? <div className="spinner mx-auto" style={{ width: 16, height: 16, borderWidth: 2 }}></div> : 'YARATISH'}
            </button>
          </div>
        </form>
      </Modal>

    </>)}
    </div>
  );
};

export default Kassa;
