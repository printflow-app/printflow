import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, UserPlus, CheckCircle2, Clock, X,
  Wallet, Layers, Trash2, ArrowRight, ClipboardList, AlertCircle,
  Users, AlertTriangle, Package, Building2,
  Archive, ArchiveRestore, Handshake, AlertOctagon, Download, Pencil
} from 'lucide-react';
import { exportToXlsx } from '../utils/exportToXlsx';
import { tasksApi, taskExpensesApi, servicesApi, settingsApi } from '../api';
import {
  useBranches, useEmployees, useCustomers, usePaymentTypes,
  useServices, useVendors, useTaskColumns, useTasks, useDepartments,
  useInvalidate,
} from '../hooks/queries';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import CurrencyInput from '../components/CurrencyInput';
import { SkeletonKanban } from '../components/Skeleton';
import LinkliMatn from '../components/LinkliMatn';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { TaskIdentityBadges, TaskDeadlineBadges } from './Topshiriqlar/TaskBadges';
import MasulTanlash from './Topshiriqlar/MasulTanlash';

interface AttachmentRecord {
  id: string;
  name: string;
  mimeType?: string | null;
  data: string; // base64 data URL
  size?: number;
  createdAt?: string;
  _legacy?: boolean; // server eski JSON ustun'dan synthesize qilgan bo'lsa true — delete imkonsiz
}

interface Task {
  id: string;
  orderName?: string;
  title: string;
  description: string;
  columnId: string;
  // Eski JSON TEXT ustun — list endpoint'lar endi qaytarmaydi. findOne'da ham
  // backwards-compat sifatida bor; manba sifatida attachmentRecords ishlatiladi.
  attachments?: string;
  attachmentRecords?: AttachmentRecord[];
  hasAttachments?: boolean; // List endpoint shu bayroqni qaytaradi (kartada belgi)

  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  paymentTypeId?: string;
  paymentType?: { name: string };
  histories?: any[];
  displayId?: string;
  quantity?: number;
  assignees: string; // JSON string in DB
  deadlineAt?: string | null;
  createdAt?: string;
  branchId?: string;
}

interface Column {
  id: string;
  title: string;
  isDone?: boolean; // true → bu ustundagi buyurtmalar "Bajarilgan" deb hisoblanadi
}

const Topshiriqlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const p = currentUser.permissions || {};
  const isAdmin =
    currentUser.role?.name?.toLowerCase() === 'admin' ||
    currentUser.login === 'admin';
  const canCreateTask = p.canCreateTask || isAdmin;
  const canEditTask = p.canEditTask || isAdmin;
  const canMoveTask = p.canMoveTask || isAdmin;
  const canDeleteTask = p.canDeleteTask || isAdmin;

  // ============ React Query data hooks ============
  // Bularning hammasi cache'lanadi, tab almashganda darhol ochiladi.
  // Mutatsiyalardan keyin invalidate.* chaqirilsa avtomatik refetch bo'ladi.
  const { data: rawEmployees = [] } = useEmployees();
  const { data: columns = [], isLoading: colsLoading } = useTaskColumns(activeBranchId) as { data: Column[]; isLoading: boolean };
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(activeBranchId) as { data: Task[]; isLoading: boolean };
  const { data: paymentTypes = [] } = usePaymentTypes();
  const { data: customers = [] } = useCustomers(activeBranchId);
  const { data: branches = [] } = useBranches();

  // Services & Vendors — faqat permission bor va aktiv branch mavjudligida
  const canSeeServices = (p.canViewServices || currentUser.role?.name?.toLowerCase() === 'admin');
  const canSeeVendors  = (p.canViewVendors  || currentUser.role?.name?.toLowerCase() === 'admin');
  const { data: rawServices = [] } = useServices(canSeeServices ? activeBranchId : undefined);
  const { data: rawVendors  = [] } = useVendors(canSeeVendors  ? activeBranchId : undefined);
  const services = rawServices;
  const vendors  = rawVendors;

  // Filter out admin/owner roles from assignee employees — same logic as before
  const employees = (rawEmployees as any[]).filter((emp: any) => {
    const roleName = emp.role?.name?.toLowerCase() || '';
    return emp.login !== 'admin' &&
      roleName !== 'admin' &&
      roleName !== 'superadmin' &&
      roleName !== 'rahbar' &&
      roleName !== 'owner';
  });

  const isLoading = colsLoading || tasksLoading;
  const invalidate = useInvalidate();
  const queryClient = useQueryClient();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  // Attachment upload progress (% 0..100). null = upload aktiv emas.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'task' | 'column' | 'task-delete', id: string, title: string }>({ isOpen: false, type: 'task', id: '', title: '' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Sprint 2: Prepayment rule — RQ cache bilan, 5 daqiqa stale time.
  // Oldin har Topshiriqlar mount'da useEffect orqali fetch qilinardi (StrictMode
  // bilan ikki marta) — endi tab almashganda cache'dan darhol keladi.
  const { data: minPrepaymentPct = 70 } = useQuery({
    queryKey: ['settings', 'MIN_PREPAYMENT_PERCENTAGE'],
    queryFn: async () => {
      const r = await settingsApi.get('MIN_PREPAYMENT_PERCENTAGE');
      return r.data?.value ? Number(r.data.value) : 70;
    },
    staleTime: 5 * 60_000,
  });
  const [prepaymentWarningAccepted, setPrepaymentWarningAccepted] = useState(false);

  const [vendorCostForm, setVendorCostForm] = useState({ vendorId: '', amount: '' });
  const [isUpdatingVendor, setIsUpdatingVendor] = useState(false);

  // Sprint 5: Costing & profitability
  const [taskExpenses, setTaskExpenses] = useState<any[]>([]);
  const [expenseForm, setExpenseForm] = useState({ expenseName: '', amount: '' });
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Sprint 2: Archived orders view
  const [isArxivModalOpen, setIsArxivModalOpen] = useState(false);
  const [arxivTasks, setArxivTasks] = useState<any[]>([]);
  const [isArxivLoading, setIsArxivLoading] = useState(false);

  // Kanban search
  const [searchTerm, setSearchTerm] = useState('');

  // fetchData() — backward-compat shim. Mutation handler'lar buni chaqirib qoladi.
  // Endi state setlamaydi; RQ cache'ini invalidate qiladi va RQ avtomatik refetch qiladi.
  // Customers'ni atayin invalidate qilmaymiz — task mutation customers state'ini
  // o'zgartirmaydi va har 12 sek customers fetch qilish ortiqcha trafik edi.
  const fetchData = async (_silent = false) => {
    invalidate.tasks();
    invalidate.taskColumns();
  };

  // Departments — RQ hook bilan, manual fetch effect o'rniga
  const { data: departments = [] } = useDepartments(
    activeBranchId || undefined
  );
  // Reset selected department when active branch changes
  useEffect(() => { setSelectedDepartmentId(''); }, [activeBranchId]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Modals
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMoveTaskModalOpen, setIsMoveTaskModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isNewColumnModalOpen, setIsNewColumnModalOpen] = useState(false);
  const [isNewOptionModalOpen, setIsNewOptionModalOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  // Bosqich qo'shish/tahrirlash. editingColumnId !== null → tahrirlash rejimi.
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [isSavingColumn, setIsSavingColumn] = useState(false);
  const [newColumnIsDone, setNewColumnIsDone] = useState(false); // "Bajarilgan" bosqichi flagi
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'vendors' | 'costing'>('details');

  // Real-time refresh — pause while user has any modal open to avoid clobbering input
  const isAnyModalOpen =
    isNewTaskModalOpen || isDetailModalOpen || isMoveTaskModalOpen ||
    isOverrideModalOpen || isNewColumnModalOpen || isArxivModalOpen ||
    confirmModal.isOpen || isNewOptionModalOpen;
  useAutoRefresh(() => fetchData(true), {
    intervalMs: 25000,
    paused: isAnyModalOpen,
  });

  useEffect(() => {
    if (activeTab === 'vendors' && selectedTask) {
      setVendorCostForm({
        vendorId: (selectedTask as any).vendorId || '',
        amount: String((selectedTask as any).vendorCost || '')
      });
    }
    if (activeTab === 'costing' && selectedTask) {
      loadTaskExpenses(selectedTask.id);
    }
  }, [activeTab, selectedTask?.id]);

  // Overrides form
  const [overrides, setOverrides] = useState<any[]>([]); // {materialId, name, unit, quantity}

  const [newTaskForm, setNewTaskForm] = useState({
    orderName: '', title: '', description: '', assigneeIds: [] as string[], columnId: '',
    customerId: '', customerName: '', customerPhone: '',
    totalAmount: '', depositAmount: '', paymentTypeId: '',
    items: [] as any[],
    manualTotal: '',
    justification: '',
    deadlineAt: '',
  });
  // Bajaruvchi (Task Routing)
  const [executorType, setExecutorType] = useState<'self' | 'branch' | 'vendor'>('self');
  const [executorBranchId, setExecutorBranchId] = useState('');
  // Departments — fetched via useDepartments() RQ hook below.
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  // Sotuvni kim oldi — KPI shu xodimga yoziladi (kiritgan odamdan farq qilishi mumkin).
  const [salesEmployeeId, setSalesEmployeeId] = useState('');
  // Vendor assignment (used when executorType === 'vendor')
  const [vendorAssign, setVendorAssign] = useState({ vendorId: '', amount: '', note: '' });
  const [currentOrderService, setCurrentOrderService] = useState({
    serviceId: '', selectedOptionIds: [] as string[], quantity: '', coefficient: '', totalAmount: 0,
    variants: [] as Array<{ atributlar: Record<string, string>; soni: number | string }>,
  });
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<any[]>([]);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [moveForm, setMoveForm] = useState({ columnId: '', assigneeIds: [] as string[], note: '', newFiles: [] as { name: string; url: string }[] });
  const moveFileInputRef = useRef<HTMLInputElement>(null);
  const [isMoveDragOver, setIsMoveDragOver] = useState(false);
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  // Mas'ul tanlash dropdowni — tashqariga bosilganda yopiladi (avval faqat input bosilsa yopilardi)
  useEffect(() => {
    if (!isAssigneeDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-assignee-dropdown]')) {
        setIsAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isAssigneeDropdownOpen]);
  const [newOptionForm, setNewOptionForm] = useState({ name: '', value: '', priceAdd: '' });
  const [isSavingOption, setIsSavingOption] = useState(false);
  const [arxivPage, setArxivPage] = useState(1);
  const ARXIV_PAGE_SIZE = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to parse JSON fields
  const parseJson = (val: string): any[] => {
    try { return JSON.parse(val || "[]"); } catch { return []; }
  };

  // Helper to check if employee is busy
  const isEmployeeBusy = (empId: string) => {
    return tasks.some(t => {
      const ids = parseJson(t.assignees);
      return ids.includes(empId);
    });
  };

  // Bajarilgan buyurtma shoshilinch bo'lmaydi — kartaning qizil/sariq
  // ramkasi ham faqat tugallanmagan ish uchun (TaskBadges bilan bir xil
  // qoida).
  const getCardUrgencyClass = (task: Task, bajarilgan = false) => {
    if (bajarilgan) return 'border-slate-200/60 hover:border-orange-400';
    const now = new Date();
    const dl = task.deadlineAt ? new Date(task.deadlineAt) : null;
    const cr = task.createdAt ? new Date(task.createdAt) : null;
    const ageH = cr ? (now.getTime() - cr.getTime()) / 3600000 : 0;
    if (dl && now > dl) return 'border-red-300 bg-red-50/40 hover:border-red-400';
    if (dl && (dl.getTime() - now.getTime()) < 7200000) return 'border-orange-300 bg-orange-50/30 hover:border-orange-500';
    if (!dl && ageH > 10) return 'border-amber-200 bg-amber-50/20 hover:border-amber-400';
    return 'border-slate-200/60 hover:border-orange-400';
  };



  // Drag-n-drop (Simple API based)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const onTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    // Add slight delay for the opacity so the drag ghost looks normal
    setTimeout(() => setDraggedTaskId(taskId), 0);
  };

  const onTaskDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    if (!draggedTaskId || !canMoveTask) return;
    const taskId = draggedTaskId;
    setDraggedTaskId(null);

    // Optimistic update — kartani darhol yangi ustun'ga ko'chiramiz, server javobini
    // kutmasdan. Network sekin bo'lsa ham foydalanuvchi natijani darhol ko'radi.
    // Server failure'da quyida invalidate qilamiz va kartani asl joyiga qaytaradi.
    const tasksKey = ['tasks', activeBranchId ?? 'all'];
    const colsKey = ['taskColumns', activeBranchId ?? 'all'];

    const prevTasks = queryClient.getQueryData<any[]>(tasksKey);
    const prevCols = queryClient.getQueryData<any[]>(colsKey);

    if (prevTasks) {
      queryClient.setQueryData<any[]>(tasksKey, prevTasks.map((t: any) =>
        t.id === taskId ? { ...t, columnId: targetColumnId } : t
      ));
    }
    if (prevCols) {
      queryClient.setQueryData<any[]>(colsKey, prevCols.map((col: any) => {
        // Eski ustundan olib tashlash
        const filteredTasks = (col.tasks || []).filter((t: any) => t.id !== taskId);
        if (col.id === targetColumnId) {
          // Yangi ustunga qo'shish (boshiga)
          const movingTask = prevCols.flatMap((c: any) => c.tasks || []).find((t: any) => t.id === taskId);
          if (movingTask) {
            return { ...col, tasks: [{ ...movingTask, columnId: targetColumnId }, ...filteredTasks] };
          }
        }
        return { ...col, tasks: filteredTasks };
      }));
    }

    try {
      await tasksApi.update(taskId, { columnId: targetColumnId }, currentUser.id);
      // Muvaffaqiyat — server javobi bilan sinxron qilish uchun invalidate.
      // Optimistik holat allaqachon to'g'ri, refetch'gacha kartani jovida turadi.
      fetchData(true);
    } catch (err) {
      // Rollback — optimistik o'zgarishlarni qaytarib olamiz.
      if (prevTasks) queryClient.setQueryData(tasksKey, prevTasks);
      if (prevCols) queryClient.setQueryData(colsKey, prevCols);
      showStatus('error', "Bosqichni o'zgartirishda xatolik!");
      console.error(err);
    }
  };

  const openNewTaskModal = (initialColId?: string) => {
    setNewTaskForm({
      orderName: '', title: '', description: '', assigneeIds: [],
      columnId: initialColId || (columns[0]?.id || ''),
      customerId: '', customerName: '', customerPhone: '',
      totalAmount: '', depositAmount: '', paymentTypeId: paymentTypes[0]?.id || '',
      items: [], manualTotal: '', justification: '', deadlineAt: '',
    });
    setExecutorType('self');
    setExecutorBranchId('');
    setVendorAssign({ vendorId: '', amount: '', note: '' });
    setCurrentOrderService({ serviceId: '', selectedOptionIds: [], quantity: '', coefficient: '', totalAmount: 0, variants: [] });
    setSelectedServiceOptions([]);
    setPriceBreakdown(null);
    setPrepaymentWarningAccepted(false);
    setIsNewTaskModalOpen(true);
  };

  // Xizmat tanlanganda opsiyalarni yuklash
  const handleServiceChange = (serviceId: string) => {
    setCurrentOrderService(f => ({ ...f, serviceId, selectedOptionIds: [], totalAmount: 0 }));
    setPriceBreakdown(null);
    if (!serviceId) { setSelectedServiceOptions([]); return; }
    const svc = services.find((s: any) => s.id === serviceId);
    setSelectedServiceOptions(svc?.options || []);
    // Yangi xizmat tanlanganda — eski variantlarni o'chiramiz va agar yangi xizmatda
    // variant o'qlari bo'lsa, bo'sh bitta qator bilan boshlanadi.
    const axes: string[] = Array.isArray(svc?.variantAxes) ? svc.variantAxes : [];
    const initialVariants = axes.length > 0
      ? [{ atributlar: Object.fromEntries(axes.map((a) => [a, ''])), soni: '' as number | string }]
      : [];
    setCurrentOrderService(f => ({ ...f, variants: initialVariants }));
    if (svc) recalculatePrice({ serviceId, selectedOptionIds: [] });
  };

  // Narx hisoblash — client-side (API calllarsiz, tez)
  const recalculatePrice = (overrides?: any) => {
    const form = { ...currentOrderService, ...overrides };
    if (!form.serviceId) return;
    const svc = services.find((s: any) => s.id === form.serviceId);
    if (!svc) return;
    // Variantlar mavjud bo'lsa — quantity = sum(soni); aks holda inputdan olamiz
    const variantsArr = Array.isArray(form.variants) ? form.variants : [];
    const variantQty = variantsArr.reduce((s: number, v: any) => s + (Number(v.soni) || 0), 0);
    const qty = variantQty > 0 ? variantQty : (Number(form.quantity) || 1);
    const coeff = Number(form.coefficient) || 1;
    const opts = svc.options || [];
    const selectedOpts = opts.filter((o: any) => (form.selectedOptionIds || []).includes(o.id));
    const optionsTotal = selectedOpts.reduce((sum: number, o: any) => sum + Number(o.priceAdd), 0);
    const baseTotal = Number(svc.basePrice) + optionsTotal;
    const total = Math.round(baseTotal * qty * coeff);
    setPriceBreakdown({ basePrice: svc.basePrice, optionsTotal, baseTotal, quantity: qty, coefficient: coeff, total });
    setCurrentOrderService(f => ({ ...f, ...overrides, totalAmount: total }));
  };

  const toggleOption = (optId: string) => {
    const newIds = currentOrderService.selectedOptionIds.includes(optId)
      ? currentOrderService.selectedOptionIds.filter(x => x !== optId)
      : [...currentOrderService.selectedOptionIds, optId];
    recalculatePrice({ selectedOptionIds: newIds });
  };

  // Joriy tanlangan xizmatdan buyurtma qatori (item) quradi. State o'zgartirmaydi —
  // shu sababli ham "RO'YXATGA QO'SHISH" tugmasi, ham submit paytida ishlatish mumkin.
  // serviceId tanlanmagan bo'lsa null qaytaradi.
  const buildOrderItem = () => {
    if (!currentOrderService.serviceId) return null;
    const svc = services.find(s => s.id === currentOrderService.serviceId);
    // Variantlardan to'liq tozalangan ro'yxat — bo'sh qatorlarni o'tkazib yuboramiz
    const cleanedVariants = (currentOrderService.variants || [])
      .map(v => ({
        atributlar: Object.fromEntries(
          Object.entries(v.atributlar || {})
            .filter(([_, val]) => String(val || '').trim() !== '')
            .map(([k, val]) => [k, String(val).trim()])
        ),
        soni: Number(v.soni) || 0,
      }))
      .filter(v => Object.keys(v.atributlar).length > 0 && v.soni > 0);
    const variantsQty = cleanedVariants.reduce((s, v) => s + v.soni, 0);
    const effectiveQty = variantsQty > 0 ? variantsQty : (Number(currentOrderService.quantity) || 1);

    return {
      ...currentOrderService,
      quantity: effectiveQty,
      variants: cleanedVariants.length > 0 ? cleanedVariants : undefined,
      title: svc?.name || 'Xizmat',
      description: `${svc?.name} (${effectiveQty} ${svc?.unit || 'dona'})`,
      optionsSummary: selectedServiceOptions.filter(o => currentOrderService.selectedOptionIds.includes(o.id)).map(o => `${o.name}: ${o.value}`).join(', ')
    };
  };

  const addItemToOrder = () => {
    const newItem = buildOrderItem();
    if (!newItem) return;

    setNewTaskForm(f => {
      const newItems = [...f.items, newItem];
      const newTotal = newItems.reduce((sum, it) => sum + it.totalAmount, 0);
      return { ...f, items: newItems, totalAmount: String(newTotal) };
    });

    // Reset current item form
    setCurrentOrderService({ serviceId: '', selectedOptionIds: [], quantity: '', coefficient: '', totalAmount: 0, variants: [] });
    setSelectedServiceOptions([]);
    setPriceBreakdown(null);
  };

  const removeItemFromOrder = (index: number) => {
    setNewTaskForm(f => {
      const newItems = f.items.filter((_, i) => i !== index);
      const newTotal = newItems.reduce((sum, it) => sum + it.totalAmount, 0);
      return { ...f, items: newItems, totalAmount: String(newTotal) };
    });
  };

  // Har bir xizmatning narxini alohida o'zgartirish — shu narx aynan o'sha taskka yoziladi.
  // Jami narx = xizmatlar narxlari yig'indisi (qayta taqsimlash yo'q).
  const updateItemPrice = (index: number, uzs: number) => {
    setNewTaskForm(f => {
      const newItems = f.items.map((it, i) => i === index ? { ...it, totalAmount: Number(uzs) || 0 } : it);
      const newTotal = newItems.reduce((sum, it) => sum + (Number(it.totalAmount) || 0), 0);
      return { ...f, items: newItems, totalAmount: String(newTotal) };
    });
  };

  /**
   * Xizmat qatoridagi bo'lim / mas'ul / izohni o'zgartiradi.
   *
   * Narxdan farqli — bu maydonlar jamiga ta'sir qilmaydi, shuning uchun
   * `totalAmount` qayta hisoblanmaydi.
   */
  const updateItemField = (
    index: number,
    field: 'departmentId' | 'assigneeIds' | 'description' | 'attachments',
    value: any,
  ) => {
    setNewTaskForm(f => ({
      ...f,
      items: f.items.map((it: any, i: number) => (i === index ? { ...it, [field]: value } : it)),
    }));
  };

  // HAR XIZMATNING O'Z FAYLLARI. Ref'lar massiv bo'lib saqlanadi —
  // xizmatlar soni oldindan noma'lum va qator o'chirilganda indekslar
  // suriladi, shuning uchun har render'da qayta biriktiriladi.
  const itemFileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null);

  const processItemFiles = (files: File[], idx: number) => {
    const wrongFormat = files.filter(f => !isAllowedAttachment(f));
    const tooLarge = files.filter(f => isAllowedAttachment(f) && isTooLarge(f));
    const allowed = files.filter(f => isAllowedAttachment(f) && !isTooLarge(f));
    if (wrongFormat.length > 0) {
      showStatus('error', `${wrongFormat.length} ta fayl rad etildi: faqat rasm (.png/.jpg/.webp/.gif) yoki dizayn (.tif/.cdr) formatlari qabul qilinadi`);
    }
    if (tooLarge.length > 0) {
      showStatus('error', `${tooLarge.length} ta fayl juda katta (max ${formatMb(MAX_ATTACHMENT_BYTES)})`);
    }
    allowed.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTaskForm(f => ({
          ...f,
          items: f.items.map((it: any, i: number) =>
            i === idx
              ? { ...it, attachments: [...(it.attachments || []), { name: file.name, url: reader.result as string }] }
              : it),
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleItemFileSelect = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    processItemFiles(Array.from(e.target.files || []), idx);
    e.target.value = '';
  };

  const handleItemDrop = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemIdx(null);
    processItemFiles(Array.from(e.dataTransfer.files || []), idx);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

    // Foydalanuvchi xizmatni tanlab, lekin "RO'YXATGA QO'SHISH"ni bosmagan bo'lsa —
    // tanlovini yo'qotmaslik uchun shu xizmatni avtomatik buyurtmaga qo'shamiz.
    const pendingItem = buildOrderItem();
    const effectiveItems = pendingItem ? [...newTaskForm.items, pendingItem] : newTaskForm.items;

    if (effectiveItems.length === 0) {
      showStatus('error', "Kamida bitta xizmat qo'shing!");
      return;
    }

    // TANLANGAN, LEKIN RO'YXATGA QO'SHILMAGAN XIZMAT.
    //
    // Mas'ul endi xizmat qatorida tanlanadi, qator esa faqat ro'yxatga
    // qo'shilgandan keyin paydo bo'ladi. Shu sabab bunday xizmatni
    // shundoq o'tkazib yuborsak, foydalanuvchi "mas'ul tanlang" degan
    // xabarni oladi-yu, tanlaydigan joyni topa olmasdi. Uni ro'yxatga
    // o'zimiz qo'shamiz — mas'ul tanlagichi bilan birga ko'rinadi.
    if (pendingItem && executorType === 'self') {
      addItemToOrder();
      showStatus('error', "Xizmat ro'yxatga qo'shildi — endi unga mas'ul tanlang");
      return;
    }
    // MAS'UL HAR XIZMATDA TEKSHIRILADI.
    //
    // Ilgari bu yer buyurtma darajasidagi `assigneeIds` ga qarardi.
    // Umumiy tanlagich olib tashlangandan keyin u ro'yxat hech qachon
    // to'lmay qoldi — natijada hamma maydon to'ldirilgan bo'lsa ham
    // "Kamida bitta mas'ulni tanlang" chiqib, buyurtma saqlanmasdi.
    if (executorType === 'self') {
      const masulsiz = effectiveItems.filter((it: any) => !(it.assigneeIds || []).length);
      if (masulsiz.length) {
        showStatus(
          'error',
          masulsiz.length === effectiveItems.length
            ? "Har bir xizmatga mas'ul tanlang!"
            : `Mas'ul tanlanmagan xizmat: ${masulsiz.map((it: any) => it.title).join(', ')}`,
        );
        return;
      }
    }
    if (executorType === 'branch' && !executorBranchId) {
      showStatus('error', "Bajaruvchi filialni tanlang!");
      return;
    }
    if (executorType === 'vendor' && !vendorAssign.vendorId) {
      showStatus('error', "Hamkorni tanlang!");
      return;
    }
    // Bo'lim majburiy — LEKIN har xizmatga alohida tanlangan bo'lsa,
    // buyurtma darajasidagisi kerak emas (u holda maydon ham
    // ko'rsatilmaydi). Aks holda foydalanuvchi ko'rinmaydigan maydonni
    // to'ldirishi talab qilinardi.
    const barchaXizmatdaBolim =
      effectiveItems.length > 0 && effectiveItems.every((it: any) => !!it.departmentId);
    if (departments.length > 0 && !selectedDepartmentId && !barchaXizmatdaBolim) {
      showStatus('error', "Bo'limni tanlang — yoki har bir xizmatga alohida belgilang");
      return;
    }

    try {
      const payload = {
        orderName: newTaskForm.orderName,
        customerId: newTaskForm.customerId,
        customerName: newTaskForm.customerName,
        customerPhone: newTaskForm.customerPhone,
        totalDeposit: Number(newTaskForm.depositAmount) || 0,
        paymentTypeId: newTaskForm.paymentTypeId,
        columnId: newTaskForm.columnId,
        justification: newTaskForm.justification,
        assigneeIds: executorType !== 'branch' ? newTaskForm.assigneeIds : [],
        deadlineAt: newTaskForm.deadlineAt || null,
        branchId: activeBranchId || undefined,
        executorBranchId: executorType === 'branch' ? executorBranchId : null,
        departmentId: selectedDepartmentId || null,
        salesEmployeeId: salesEmployeeId || null,
        // Har task O'Z xizmatining aniq narxini oladi — umumiy summa qayta taqsimlanmaydi.
        items: effectiveItems.map(it => ({
          ...it,
          totalAmount: Math.round(Number(it.totalAmount) || 0),
          vendorId: executorType === 'vendor' ? vendorAssign.vendorId : undefined,
          vendorCost: executorType === 'vendor' ? Number(vendorAssign.amount) : 0,
        }))
      };

      await tasksApi.createBulk(payload, currentUser.id);

      setIsNewTaskModalOpen(false);
      setExecutorType('self');
      setExecutorBranchId('');
      setVendorAssign({ vendorId: '', amount: '', note: '' });
      showStatus('success', "Buyurtma yaratildi!");
      fetchData(true);
    } catch (err) {
      showStatus('error', "Xatolik yuz berdi!");
    }
  };

  const handleArchiveTask = async () => {
    if (!confirmModal.id) return;
    try {
      await tasksApi.archive(confirmModal.id);
      setIsDetailModalOpen(false);
      setConfirmModal({ ...confirmModal, isOpen: false });
      showStatus('success', "Buyurtma arxivlandi.");
      fetchData(true);
    } catch (err) {
      showStatus('error', "Arxivlashda xato!");
    }
  };

  // Buyurtmani BUTUNLAY o'chirish — faqat admin. Backend ham admin huquqini tekshiradi.
  const handleDeleteTask = async () => {
    if (!confirmModal.id) return;
    try {
      await tasksApi.remove(confirmModal.id);
      setIsDetailModalOpen(false);
      setConfirmModal({ ...confirmModal, isOpen: false });
      showStatus('success', "Buyurtma butunlay o'chirildi.");
      fetchData(true);
    } catch (err: any) {
      showStatus('error', err?.response?.status === 403
        ? "Buni faqat administrator qila oladi!"
        : "O'chirishda xato!");
    }
  };

  // Buyurtmaga biriktiriladigan fayl formatlari:
  //  - Dizayn fayllari: .tif/.cdr (qo'l bilan ochiladi)
  //  - Oddiy rasmlar: .png/.jpg/.jpeg/.webp/.gif (modal'da inline ko'rinadi)
  // MIME atayin tekshirilmaydi: CDR uchun brauzerlar ko'pincha bo'sh yoki
  // 'application/octet-stream' qaytaradi; haqiqiy filtr — kengaytma.
  const ALLOWED_ATTACHMENT_EXT = ['.tif', '.tiff', '.cdr', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const ALLOWED_ATTACHMENT_ACCEPT = '.tif,.tiff,.cdr,.png,.jpg,.jpeg,.webp,.gif,image/*';
  // Backend body limiti 50MB. Base64 ~1.33x kattalashtirgani uchun xom fayl ~36MB.
  // Xavfsiz chegara — 35MB.
  const MAX_ATTACHMENT_BYTES = 35 * 1024 * 1024;
  const isAllowedAttachment = (file: File): boolean => {
    const name = (file.name || '').toLowerCase();
    return ALLOWED_ATTACHMENT_EXT.some(ext => name.endsWith(ext));
  };
  const isTooLarge = (file: File): boolean => file.size > MAX_ATTACHMENT_BYTES;
  const formatMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    if (!isAllowedAttachment(file)) {
      showStatus('error', "Faqat rasm (.png/.jpg/.webp/.gif) yoki dizayn (.tif/.cdr) fayllari qabul qilinadi");
      e.target.value = '';
      return;
    }
    if (isTooLarge(file)) {
      showStatus('error', `Fayl juda katta (${formatMb(file.size)}). Maksimal: ${formatMb(MAX_ATTACHMENT_BYTES)}`);
      e.target.value = '';
      return;
    }

    // Darhol progress ko'rsatamiz — FileReader ham 30MB fayl uchun 2-5 sek
    // ketishi mumkin, foydalanuvchi "qotib qolgan" deb o'ylamasin.
    setUploadProgress(0);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      // Append-only endpoint — alohida TaskAttachment row sifatida saqlaydi.
      // Body: faqat yangi fayl (eski fayllar serverda qoladi, ulardan birortasi
      // re-uploaded bo'lmaydi).
      try {
        const res = await tasksApi.appendAttachment(
          selectedTask.id,
          { name: file.name, url: base64String },
          (pct) => setUploadProgress(pct),
        );
        // Server yangi row qaytarayotgan bo'lsa, optimistik tarzda qo'shamiz.
        const newRecord: AttachmentRecord = res?.data
          ? { id: res.data.id, name: res.data.name, mimeType: res.data.mimeType, data: res.data.data, size: res.data.size, createdAt: res.data.createdAt }
          : { id: `tmp-${Date.now()}`, name: file.name, data: base64String };
        setSelectedTask({
          ...selectedTask,
          attachmentRecords: [...(selectedTask.attachmentRecords || []), newRecord],
          hasAttachments: true,
        });
        showStatus('success', "Fayl yuklandi!");
        fetchData(true);
      } catch (err) {
        showStatus('error', "Yuklashda xato!");
      } finally {
        setUploadProgress(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // TaskAttachment row'ni render uchun shaklga keltiradi (rasm/non-rasm).
  // NOTE: TIFF (.tif/.tiff) data URLlari `data:image/tiff` bilan boshlanadi, lekin
  // brauzerlar ularni <img>'da render qilmaydi — shuning uchun `isImage: false`
  // qilib download card'ga yo'naltiramiz.
  const parseAttachmentItem = (item: AttachmentRecord): { id: string; name: string; url: string; isImage: boolean; isLegacy: boolean } => {
    const url = item.data || '';
    const name = item.name || 'Fayl';
    const isTiff = /\.tiff?$/i.test(name) || url.startsWith('data:image/tif');
    const isImage = (url.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) && !isTiff;
    return { id: item.id, name, url, isImage, isLegacy: !!item._legacy };
  };

  // Reliable download for base64 data URLs — some browsers ignore <a download> on
  // very large data URIs or when navigating cross-origin, so we always go through
  // an explicit blob + anchor click.
  const downloadAttachment = (att: { name: string; url: string }) => {
    try {
      const m = /^data:([^;,]+);base64,(.*)$/.exec(att.url);
      if (m) {
        const mime = m[1] || 'application/octet-stream';
        const binary = atob(m[2]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = att.name || 'fayl';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } else {
        const a = document.createElement('a');
        a.href = att.url;
        a.download = att.name || 'fayl';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      showStatus('error', "Yuklab olishda xato");
    }
  };

  const processMoveFiles = (files: File[]) => {
    const wrongFormat = files.filter(f => !isAllowedAttachment(f));
    const tooLarge = files.filter(f => isAllowedAttachment(f) && isTooLarge(f));
    const allowed = files.filter(f => isAllowedAttachment(f) && !isTooLarge(f));
    if (wrongFormat.length > 0) {
      showStatus('error', `${wrongFormat.length} ta fayl rad etildi: faqat rasm (.png/.jpg/.webp/.gif) yoki dizayn (.tif/.cdr) formatlari qabul qilinadi`);
    }
    if (tooLarge.length > 0) {
      showStatus('error', `${tooLarge.length} ta fayl juda katta (max ${formatMb(MAX_ATTACHMENT_BYTES)})`);
    }
    allowed.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMoveForm(f => ({ ...f, newFiles: [...f.newFiles, { name: file.name, url: reader.result as string }] }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleMoveFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processMoveFiles(files);
    e.target.value = '';
  };

  const handleMoveDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMoveDragOver(false);
    processMoveFiles(Array.from(e.dataTransfer.files || []));
  };

  const openAddColumn = () => {
    setEditingColumnId(null);
    setNewColumnTitle('');
    setNewColumnIsDone(false);
    setIsNewColumnModalOpen(true);
  };

  const openEditColumn = (col: Column) => {
    setEditingColumnId(col.id);
    setNewColumnTitle(col.title);
    setNewColumnIsDone(!!col.isDone);
    setIsNewColumnModalOpen(true);
  };

  // Bosqich qo'shish (yangi) yoki nomini yangilash (tahrirlash).
  // isSavingColumn guard — double-submit (tez ikki marta bosish) duplikatining oldini oladi.
  const handleSaveColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newColumnTitle.trim();
    if (!title || isSavingColumn) return;
    setIsSavingColumn(true);
    try {
      if (editingColumnId) {
        await tasksApi.updateColumn(editingColumnId, {
          title,
          isDone: newColumnIsDone,
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        });
        showStatus('success', 'Bosqich saqlandi.');
      } else {
        await tasksApi.createColumn({
          title,
          orderIdx: columns.length,
          isDone: newColumnIsDone,
          ...(activeBranchId ? { branchId: activeBranchId } : {}),
        });
      }
      setNewColumnTitle('');
      setEditingColumnId(null);
      setNewColumnIsDone(false);
      setIsNewColumnModalOpen(false);
      fetchData(true);
    } catch (err) {
      showStatus('error', editingColumnId ? "Nomni yangilashda xatolik!" : "Bosqich qo'shishda xatolik!");
      console.error(err);
    } finally {
      setIsSavingColumn(false);
    }
  };

  const handleRemoveColumn = async () => {
    if (!confirmModal.id) return;
    try {
      await tasksApi.deleteColumn(confirmModal.id, activeBranchId);
      setConfirmModal({ ...confirmModal, isOpen: false });
      showStatus('success', "Bosqich o'chirildi.");
      fetchData(true);
    } catch (err) {
      showStatus('error', "O'chirishda xato!");
    }
  };

  const openDetailModal = async (task: Task) => {
    // Kanban list endpoint endi attachments qaytarmaydi (katta base64 CDR/TIF
    // fayllarini 12 sek polling'da qayta yuklamaslik uchun). Detail ochilganda
    // to'liq taskni alohida olamiz — shu joyda attachments ham keladi.
    setSelectedTask(task);
    setIsDetailModalOpen(true);
    setActiveTab('details');
    setVendorCostForm({
      vendorId: (task as any).vendorId || '',
      amount: (task as any).vendorCost ? String((task as any).vendorCost) : ''
    });
    try {
      const taskOverrides = (task as any).overrides;
      if (taskOverrides) {
        setOverrides(parseJson(taskOverrides));
      } else {
        setOverrides([]);
      }
      // logView va to'liq task'ni parallel chaqiramiz.
      const [fullRes] = await Promise.all([
        tasksApi.findOne(task.id),
        tasksApi.logView(task.id, currentUser.id).catch(() => null),
      ]);
      if (fullRes?.data) {
        // Faqat attachments'ni qo'shamiz — boshqa maydonlar list'dan qoldirilgan
        // versiya bilan ustun bo'lishi mumkin (eskirgan), shuning uchun to'liq
        // server javobini ishlatamiz.
        setSelectedTask(fullRes.data);
      }
    } catch (err) {
      console.warn("Detail load fail", err);
    }
  };

  const openMoveModal = (task: Task) => {
    setSelectedTask(task);
    setMoveForm({ columnId: task.columnId, assigneeIds: parseJson(task.assignees), note: '', newFiles: [] });
    setIsMoveTaskModalOpen(true);
  };

  const handleMoveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !moveForm.columnId) return;

    try {
      // Yangi fayllarni alohida append qilamiz — bu eski attachments massivini qayta
      // yubormaslik uchun. Har bir fayl uchun upload progress ko'rsatiladi.
      if (moveForm.newFiles.length > 0) {
        for (let i = 0; i < moveForm.newFiles.length; i++) {
          const f = moveForm.newFiles[i];
          setUploadProgress(0);
          await tasksApi.appendAttachment(
            selectedTask.id,
            f,
            (pct) => setUploadProgress(pct),
          );
        }
        setUploadProgress(null);
      }

      // Endi attachmentsiz move/assignees update'ini jo'natamiz — body kichik.
      await tasksApi.update(selectedTask.id, {
        columnId: moveForm.columnId,
        assignees: JSON.stringify(moveForm.assigneeIds),
        historyNote: moveForm.note,
      }, currentUser.id);
      setIsMoveTaskModalOpen(false);
      showStatus('success', "Buyurtma ko'chirildi.");
      fetchData(true);
    } catch (err) {
      setUploadProgress(null);
      showStatus('error', "Ko'chirishda xatolik!");
    }
  };


  const toggleAssigneeForMove = (id: string) => {
    setMoveForm(prev => {
      const ids = [...prev.assigneeIds];
      if (ids.includes(id)) {
        return { ...prev, assigneeIds: ids.filter(x => x !== id) };
      } else {
        return { ...prev, assigneeIds: [...ids, id] };
      }
    });
  };

  const handleSaveOverrides = async () => {
    if (!selectedTask) return;
    try {
      await tasksApi.update(selectedTask.id, { overrides: JSON.stringify(overrides) }, currentUser.id);
      setIsOverrideModalOpen(false);
      showStatus('success', "Material sarfi yangilandi!");
      fetchData(true);
    } catch (err) {
      showStatus('error', "Saqlashda xatolik!");
    }
  };

  const openArxivModal = async () => {
    setIsArxivModalOpen(true);
    setIsArxivLoading(true);
    setArxivPage(1);
    try {
      const res = await tasksApi.getArchived();
      setArxivTasks(res.data || []);
    } catch {
      setArxivTasks([]);
    } finally {
      setIsArxivLoading(false);
    }
  };


  const loadTaskExpenses = async (taskId: string) => {
    try {
      const res = await taskExpensesApi.list(taskId);
      setTaskExpenses(res.data || []);
    } catch {
      setTaskExpenses([]);
    }
  };

  const handleAddExpense = async () => {
    if (!selectedTask || !expenseForm.expenseName.trim() || !expenseForm.amount) return;
    setIsAddingExpense(true);
    try {
      await taskExpensesApi.create(selectedTask.id, {
        expenseName: expenseForm.expenseName.trim(),
        amount: Number(expenseForm.amount),
      });
      setExpenseForm({ expenseName: '', amount: '' });
      await loadTaskExpenses(selectedTask.id);
      showStatus('success', "Xarajat qo'shildi!");
    } catch {
      showStatus('error', "Xarajat qo'shishda xato!");
    } finally {
      setIsAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!selectedTask) return;
    try {
      await taskExpensesApi.remove(selectedTask.id, expenseId);
      await loadTaskExpenses(selectedTask.id);
      showStatus('success', "Xarajat o'chirildi.");
    } catch {
      showStatus('error', "O'chirishda xato!");
    }
  };

  const handleAddServiceOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrderService.serviceId || !newOptionForm.name || !newOptionForm.value) return;
    if (!activeBranchId) {
      showStatus('error', 'Avval aktiv filialni tanlang');
      return;
    }
    setIsSavingOption(true);
    try {
      await servicesApi.addOption(currentOrderService.serviceId, {
        name: newOptionForm.name,
        value: newOptionForm.value,
        priceAdd: Number(newOptionForm.priceAdd) || 0,
      }, activeBranchId);
      // Invalidate services cache; RQ will refetch. For the immediate options
      // update we need fresh data — fetch once inline, then invalidate for cache.
      const svcRes = await servicesApi.findAll(activeBranchId!);
      invalidate.services();
      const updatedSvc = (svcRes.data || []).find((s: any) => s.id === currentOrderService.serviceId);
      if (updatedSvc) setSelectedServiceOptions(updatedSvc.options || []);
      setNewOptionForm({ name: '', value: '', priceAdd: '' });
      setIsNewOptionModalOpen(false);
      showStatus('success', "Yangi opsiya qo'shildi!");
    } catch {
      showStatus('error', "Opsiya qo'shishda xatolik!");
    } finally {
      setIsSavingOption(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount).replace(/,/g, ' ') + " UZS";
  };

  // Restrict to own tasks when user lacks canViewAllTasks but has canViewOwnTasks
  const visibleTasks = (isAdmin || p.canViewAllTasks)
    ? tasks
    : p.canViewOwnTasks
      ? tasks.filter(t => parseJson(t.assignees).includes(currentUser.id))
      : tasks;

  // Client-side search: filter by displayId, title, orderName, or customerName
  const filteredTasks = searchTerm.trim()
    ? visibleTasks.filter(t => {
      const q = searchTerm.toLowerCase();
      return (
        t.displayId?.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.orderName?.toLowerCase().includes(q) ||
        t.customerName?.toLowerCase().includes(q)
      );
    })
    : visibleTasks;

  // EXPORT — ko'rinayotgan topshiriqlarni Excel'ga (search/permission filtri qo'llanilgan)
  const handleExport = () => {
    if (filteredTasks.length === 0) {
      showStatus('error', "Eksport qilish uchun ma'lumot yo'q");
      return;
    }
    const stamp = new Date().toLocaleDateString('en-CA');
    const colTitleById = new Map(columns.map((c: Column) => [c.id, c.title]));
    const empById = new Map((rawEmployees as any[]).map((e: any) => [e.id, e.fullName]));
    exportToXlsx({
      filename: `topshiriqlar_${stamp}`,
      sheetName: 'Topshiriqlar',
      rows: filteredTasks,
      columns: [
        { header: 'ID', accessor: (t: Task) => t.displayId || t.id.slice(0, 8) },
        { header: 'Buyurtma nomi', accessor: (t: Task) => t.orderName || t.title },
        { header: 'Mijoz', accessor: (t: Task) => t.customerName || '' },
        { header: 'Telefon', accessor: (t: Task) => t.customerPhone || '' },
        { header: 'Bosqich', accessor: (t: Task) => colTitleById.get(t.columnId) || '' },
        { header: 'Soni', accessor: (t: Task) => Number(t.quantity || 1) },
        { header: 'Jami (UZS)', accessor: (t: Task) => Number(t.totalAmount || 0) },
        { header: 'Zakolat (UZS)', accessor: (t: Task) => Number(t.depositAmount || 0) },
        { header: 'Qoldiq (UZS)', accessor: (t: Task) => Number(t.remainingAmount || 0) },
        { header: "To'lov turi", accessor: (t: Task) => t.paymentType?.name || '' },
        { header: 'Bajaruvchilar', accessor: (t: Task) => {
          try { return (JSON.parse(t.assignees || '[]') as string[]).map((id) => empById.get(id) || id).join(', '); }
          catch { return ''; }
        }},
        { header: 'Muddat', accessor: (t: Task) => t.deadlineAt ? new Date(t.deadlineAt).toLocaleDateString('uz-UZ') : '' },
        { header: 'Yaratilgan', accessor: (t: Task) => t.createdAt ? new Date(t.createdAt).toLocaleDateString('uz-UZ') : '' },
      ],
    });
    showStatus('success', `${filteredTasks.length} ta topshiriq eksport qilindi`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full animate-fade-in">

      {/* Global Status Notification */}
      {/* Portal + z-[2000]: Modal (z-[1000], backdrop-blur) ochiq bo'lganda
          toast modal ortida ko'rinmay qolmasligi uchun. Buyurtma qo'shishdagi
          validatsiya xatolari shu toast orqali ko'rsatiladi. */}
      {statusMessage && createPortal(
        <div className={`fixed top-6 right-6 z-[2000] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="font-bold text-sm tracking-tight">{statusMessage.text}</span>
        </div>,
        document.body,
      )}

      {/* Toolbar — sahifa sarlavhasi shell headerda; bu yerda faqat amallar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-white p-3 rounded-xl border border-[color:var(--border)] z-10 mx-1 sm:mx-0">
        {/* Search input */}
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ID, nomi yoki mijoz bo'yicha qidirish..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-minimal pl-9 pr-8"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors flex items-center"
              title="Tozalash"
            ><X size={13} strokeWidth={2.5}/></button>
          )}
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          <button onClick={openArxivModal} className="btn-outline h-sm">
            <Archive size={13} /> Arxiv
          </button>
          {(isAdmin || p.canExportTasks) && (
            <button onClick={handleExport} className="btn-outline h-sm" title="Topshiriqlarni Excel'ga eksport qilish">
              <Download size={13} /> Eksport
            </button>
          )}
          {p.canManageColumns && (
            <button data-tour-id="kanban-add-column" onClick={openAddColumn} className="btn-outline h-sm border-dashed">
              <Plus size={13} /> Bosqich
            </button>
          )}
          {canCreateTask && (
            <button data-tour-id="buyurtma-add" onClick={() => openNewTaskModal()} className="btn-primary h-sm">
              <Plus size={14} strokeWidth={2.5} /> Buyurtma
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 flex gap-4 sm:gap-6 overflow-x-auto pb-8 items-start snap-x custom-scroll px-1 sm:px-0" style={{ minHeight: '65vh' }}>
        {isLoading ? (
          <div className="w-full"><SkeletonKanban columns={4} /></div>
        ) : columns.length === 0 ? (
          <div className="w-full h-96 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
              <ClipboardList size={28} />
            </div>
            <p className="text-base font-bold text-slate-800">Kanban bosqichlari yo'q</p>
            <p className="text-sm text-slate-500 text-center max-w-sm">Birinchi navbatda Kanban ustunlarini yarating (Yangi → Jarayonda → Tayyor kabi). Sozlamalar bo'limidan qo'shing.</p>
          </div>
        ) : (
          // Tasklar bo'lmasa ham ustunlar (bo'sh holatda) ko'rsatiladi —
          // foydalanuvchi bosqichlarni ko'rib, ularga yangi buyurtma qo'sha oladi.
          columns.map(col => {
            const now_s = new Date();
            const myId = currentUser?.id;
            const colTasks = filteredTasks
              .filter(t => t.columnId === col.id)
              .sort((a, b) => {
                const aIsMine = myId ? parseJson(a.assignees).includes(myId) : false;
                const bIsMine = myId ? parseJson(b.assignees).includes(myId) : false;
                if (aIsMine !== bIsMine) return aIsMine ? -1 : 1;
                const urgency = (t: Task) => {
                  const dl = t.deadlineAt ? new Date(t.deadlineAt) : null;
                  const cr = t.createdAt ? new Date(t.createdAt) : null;
                  const ageH = cr ? (now_s.getTime() - cr.getTime()) / 3600000 : 0;
                  if (dl && now_s > dl) return 0;
                  if (dl && (dl.getTime() - now_s.getTime()) < 7200000) return 1;
                  if (!dl && ageH > 10) return 2;
                  return 3;
                };
                return urgency(a) - urgency(b);
              });
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverColId(col.id); }}
                onDragLeave={(e) => {
                  // Only remove highlight if actually leaving the column
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverColId(null);
                  }
                }}
                onDrop={(e) => onTaskDrop(e, col.id)}
                className={`min-w-[88vw] sm:min-w-[320px] w-[88vw] sm:w-[320px] max-h-full flex flex-col rounded-2xl p-2.5 border shadow-sm flex-shrink-0 snap-center transition-all duration-300 ${dragOverColId === col.id
                  ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-400/50 scale-[1.02]'
                  : 'bg-slate-100/50 border-slate-200/50'
                  }`}
              >
                {/* Column Header */}
                <div className="flex justify-between items-center px-2 mb-2 mt-1 group">
                  <div className="flex items-center gap-1.5 flex-1 pr-2 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.isDone ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                    <h3 className="label-caps text-slate-700 truncate">{col.title}</h3>
                    <span className="text-xs font-medium text-slate-400 flex-shrink-0">{colTasks.length}</span>
                    {col.isDone && (
                      <span title="Bu bosqich bajarilgan deb sanaladi" className="badge-success flex-shrink-0"><CheckCircle2 size={10} className="mr-0.5" /> Bajarilgan</span>
                    )}
                  </div>
                  {p.canManageColumns && (
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditColumn(col)} title="Nomini tahrirlash" className="icon-btn w-6 h-6"><Pencil size={12} /></button>
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'column', id: col.id, title: col.title })} title="O'chirish" className="icon-btn w-6 h-6 hover:text-rose-600"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>

                {/* Column Tasks Scrollable Area */}
                <div className="flex flex-col gap-3 sm:gap-4 flex-1 overflow-y-auto px-1 pb-4 custom-scroll max-h-[70vh]">
                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 px-3 text-center border-2 border-dashed border-slate-200 rounded-xl">
                      <ClipboardList size={20} className="text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-400">Bo'sh</p>
                    </div>
                  )}
                  {colTasks.map(task => {
                    const isMyTask = myId ? parseJson(task.assignees).includes(myId) : false;
                    return (
                      <div
                        key={task.id}
                        draggable={canMoveTask}
                        onDragStart={canMoveTask ? (e) => onTaskDragStart(e, task.id) : undefined}
                        onDragEnd={canMoveTask ? () => { setDraggedTaskId(null); setDragOverColId(null); } : undefined}
                        onClick={() => openDetailModal(task)}
                        className={`p-3.5 rounded-xl shadow-sm border ${canMoveTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:shadow-md transition-all duration-300 group animate-fade-in flex flex-col ${draggedTaskId === task.id
                          ? 'opacity-40 scale-95 ring-2 ring-orange-500 shadow-xl border-orange-500 bg-white'
                          : isMyTask
                            ? 'bg-slate-50/60 border-slate-300 ring-1 ring-slate-200 hover:border-slate-400 hover:shadow-slate-500/10'
                            : `bg-white ${getCardUrgencyClass(task, !!col.isDone)} hover:shadow-orange-500/10`
                          }`}
                      >
                        <TaskIdentityBadges task={task as any} vendor={(task as any).vendor} isMyTask={isMyTask} />
                        <h4 className="font-semibold text-slate-900 text-sm mb-1 leading-snug transition-colors line-clamp-2">
                          {task.orderName ? `${task.orderName} — ` : ''}{task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-slate-500 mb-2.5 line-clamp-2 leading-normal">{task.description}</p>
                        )}

                        <TaskDeadlineBadges task={task as any} activeBranchId={activeBranchId} branches={branches} bajarilgan={!!col.isDone} />

                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {task.totalAmount > 0 && (
                            <span className="badge-success gap-1">
                              <Wallet size={10} /> {new Intl.NumberFormat('uz-UZ').format(task.totalAmount)}
                            </span>
                          )}
                          {task.remainingAmount > 0 && (
                            <span className="badge-danger gap-1">
                              <AlertCircle size={10} /> {new Intl.NumberFormat('uz-UZ').format(task.remainingAmount)}
                            </span>
                          )}
                          {(task as any).executorBranch && (
                            <span className="badge-neutral gap-1">
                              <ArrowRight size={10} /> {(task as any).executorBranch.name}
                            </span>
                          )}
                          {(task as any).vendor && (
                            <span className="badge-neutral gap-1">
                              <Handshake size={10} /> {(task as any).vendor.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {parseJson(task.assignees).map((id: string) => {
                              const emp = employees.find(e => e.id === id);
                              return (
                                <div key={id} title={emp?.fullName} className="w-5 h-5 rounded-full bg-orange-50 border border-white flex items-center justify-center text-xs font-semibold text-orange-600">
                                  {emp?.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>
                              );
                            })}
                            {parseJson(task.assignees).length === 0 && (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={11} className="text-slate-300" />
                            <span className="text-xs font-medium text-slate-400">{parseJson(task.assignees).length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Floating Add Column Button at the end */}
        {p.canManageColumns && (
          <button onClick={openAddColumn} className="min-w-[240px] h-16 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/30 transition-all shrink-0">
            <Plus size={18} />
            <span className="text-sm font-medium">Yangi bosqich</span>
          </button>
        )}
      </div>

      {/* MODAL: NEW TASK */}
      <Modal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        title="Yangi Buyurtma"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleAddTask} className="flex flex-col gap-6">
          {/* Order Details */}
          <div className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm space-y-4">
            <div>
              <label className="form-label">Buyurtma Nomi (Masalan: Bahor To'yi, Reklama Loyiha)</label>
              <input
                type="text"
                placeholder="Buyurtma nomini kiriting..."
                value={newTaskForm.orderName}
                onChange={e => setNewTaskForm(f => ({ ...f, orderName: e.target.value }))}
                className="input-minimal font-bold text-slate-700 h-12 border-2"
              />
            </div>
          </div>
          {/* Customer Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-inner">
            <div className="md:col-span-2">
              <SearchableSelect
                label="Mijozni tanlang"
                placeholder="Mijoz ismini yozing yoki tanlang..."
                options={customers.map(c => ({ id: c.id, label: c.name, subLabel: c.phone || 'Tel yo\'q', value: c }))}
                value={newTaskForm.customerId}
                onChange={(id, val) => setNewTaskForm(f => ({ ...f, customerId: id, customerName: val.name, customerPhone: val.phone || f.customerPhone }))}
              />
              {!newTaskForm.customerId && (
                <div className="mt-3 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" placeholder="Yangi mijoz ismi..." value={newTaskForm.customerName} onChange={e => setNewTaskForm(f => ({ ...f, customerName: e.target.value }))} className="input-minimal bg-white border-2" />
                    <input type="text" placeholder="Telefon raqami..." value={newTaskForm.customerPhone} onChange={e => setNewTaskForm(f => ({ ...f, customerPhone: e.target.value }))} className="input-minimal bg-white border-2" />
                  </div>
                  {/* Dublikat aniqlash — yozilgan telefon bazadagi mijozga mos kelsa,
                      yangi mijoz yaratish o'rniga o'shani tanlashni taklif qilamiz. */}
                  {(() => {
                    const digits = (newTaskForm.customerPhone || '').replace(/\D/g, '');
                    if (digits.length < 7) return null;
                    const dup = customers.find(c => (c.phone || '').replace(/\D/g, '') === digits);
                    if (!dup) return null;
                    return (
                      <div className="mt-2 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 animate-fade-in">
                        <p className="text-xs font-bold text-amber-700">
                          Bu raqam bazada bor: <span className="text-amber-900">{dup.name}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setNewTaskForm(f => ({ ...f, customerId: dup.id, customerName: dup.name, customerPhone: dup.phone || f.customerPhone }))}
                          className="flex-shrink-0 h-7 px-3 bg-amber-500 text-white text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-amber-600 transition-all"
                        >
                          Tanlash
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Service Items List */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-slate-500 px-1 flex items-center gap-2">
              <Layers size={13} /> Buyurtma Tarkibi ({newTaskForm.items.length})
            </h4>

            {newTaskForm.items.length > 0 && (
              <div className="space-y-2">
                {newTaskForm.items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-white border-2 border-slate-100 p-3 rounded-2xl animate-slide-up group">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{it.title}</span>
                          <span className="text-[11px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded uppercase">x {it.quantity}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 mt-0.5 italic">{it.optionsSummary}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 sm:w-40">
                          <CurrencyInput
                            value={String(it.totalAmount || '')}
                            onChange={(uzs) => updateItemPrice(idx, uzs || 0)}
                            colorClass="text-slate-800"
                            className="input-minimal font-bold text-right h-9 text-sm"
                          />
                        </div>
                        <button type="button" onClick={() => removeItemFromOrder(idx)} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* HAR XIZMAT ALOHIDA ISH BO'LADI — o'z bo'limi, mas'uli va
                        izohi bilan. Bitta buyurtmadagi vizitka poligrafiyaga,
                        bortli harf tashqi reklamaga tushishi mumkin: ular boshqa
                        bo'lim, boshqa odam va boshqa ko'rsatma talab qiladi.
                        Bo'sh qoldirilsa — buyurtma darajasidagi qiymat ishlaydi. */}
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {departments.length > 0 && (
                        <select
                          value={it.departmentId || ''}
                          onChange={e => updateItemField(idx, 'departmentId', e.target.value)}
                          className="select-minimal h-9 text-xs font-bold"
                        >
                          <option value="">Bo'lim — buyurtmadagidek</option>
                          {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      )}
                      {/* MAS'ULLAR — bittadan ko'p bo'lishi mumkin.
                          Har xodim uchun alohida tugma o'rniga qidiruvli
                          ro'yxat: 20 xodimda tugmalar devori xizmat
                          qatorini bosib ketardi. */}
                      <div className="sm:col-span-1">
                        <MasulTanlash
                          odamlar={employees.map((e: any) => ({
                            id: e.id,
                            fullName: e.fullName,
                            roleName: e.role?.name,
                            band: isEmployeeBusy(e.id),
                          }))}
                          tanlangan={it.assigneeIds || []}
                          onChange={(ids) => updateItemField(idx, 'assigneeIds', ids)}
                          placeholder="Mas'ul — buyurtmadagidek"
                        />
                      </div>

                      {/* IZOH — ko'rsatma bo'lishi mumkin, shuning uchun
                          keng joy. `input-minimal` bir qatorli qat'iy
                          balandlikda edi va uzun matn ko'rinmasdi. */}
                      <div className="sm:col-span-2">
                        <textarea
                          rows={4}
                          value={it.description || ''}
                          onChange={e => updateItemField(idx, 'description', e.target.value)}
                          placeholder="Shu xizmat uchun izoh / ko'rsatma (ixtiyoriy)"
                          className="textarea-minimal text-xs min-h-[96px]"
                        />
                      </div>

                      {/* FAYL — HAR XIZMATGA ALOHIDA.
                          Vizitka dizayni bilan banner maketi boshqa fayl va
                          boshqa odamga kerak; buyurtma darajasida bitta
                          joyga yig'ilsa, kim qaysi faylni olishini bilmaydi. */}
                      <div className="sm:col-span-2">
                        <div
                          onClick={() => itemFileInputRefs.current[idx]?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverItemIdx(idx); }}
                          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverItemIdx(null); }}
                          onDrop={(e) => handleItemDrop(e, idx)}
                          className={`border border-dashed rounded-xl px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                            dragOverItemIdx === idx
                              ? 'border-orange-500 bg-orange-50/50'
                              : 'border-slate-200 hover:border-orange-400 hover:bg-orange-50/30'
                          }`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dragOverItemIdx === idx ? '#f97316' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                          <span className="text-xs font-medium text-slate-500">
                            Shu xizmat uchun rasm / dizayn — <span className="text-orange-500 underline">tanlang</span>
                          </span>
                          {(it.attachments || []).length > 0 && (
                            <span className="ml-auto text-xs font-bold text-orange-500 shrink-0">
                              {(it.attachments || []).length} ta
                            </span>
                          )}
                        </div>
                        <input
                          type="file"
                          hidden
                          multiple
                          accept={ALLOWED_ATTACHMENT_ACCEPT}
                          ref={(el) => { itemFileInputRefs.current[idx] = el; }}
                          onChange={(e) => handleItemFileSelect(e, idx)}
                        />
                        {(it.attachments || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {(it.attachments || []).map((f: any, fi: number) => (
                              <span key={fi} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-1 py-0.5 text-xs font-medium text-slate-600">
                                {f.name}
                                <button
                                  type="button"
                                  title="Olib tashlash"
                                  onClick={() => updateItemField(idx, 'attachments',
                                    (it.attachments || []).filter((_: any, j: number) => j !== fi))}
                                  className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-rose-500"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Item Form */}
            <div className="bg-orange-50/50 border border-orange-100 rounded-3xl p-5 space-y-4">
              <h4 className="text-[11px] font-bold text-orange-600 uppercase tracking-widest flex items-center gap-2 mb-2">
                <Plus size={13} /> Xizmat Qo'shish
              </h4>

              <SearchableSelect
                placeholder="Xizmatni tanlang..."
                options={services.map(s => ({ id: s.id, label: s.name, subLabel: `${Number(s.basePrice).toLocaleString()} UZS/${s.unit}`, value: s }))}
                value={currentOrderService.serviceId}
                onChange={(id) => handleServiceChange(id)}
              />

              {currentOrderService.serviceId && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-500">
                      Opsiyalar: {selectedServiceOptions.length === 0 && <span className="text-slate-300 font-bold normal-case">(mavjud emas)</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setNewOptionForm({ name: '', value: '', priceAdd: '' }); setIsNewOptionModalOpen(true); }}
                      className="text-[11px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-200 transition-all flex items-center gap-1"
                    >
                      <Plus size={9} /> YANGI OPSIYA
                    </button>
                  </div>
                  {selectedServiceOptions.length > 0 && (
                    <div>
                      <div className="flex flex-wrap gap-2">
                        {selectedServiceOptions.map((opt: any) => {
                          const active = currentOrderService.selectedOptionIds.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleOption(opt.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-2 transition-all ${active ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-500/20' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                                }`}
                            >
                              {active && <CheckCircle2 size={12} />}
                              <span>{opt.name}: {opt.value}</span>
                              <span className={`font-bold ${active ? 'text-orange-200' : 'text-orange-500'}`}>{Number(opt.priceAdd).toLocaleString()} UZS</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const selSvc = services.find(s => s.id === currentOrderService.serviceId) as any;
                    const axes: string[] = Array.isArray(selSvc?.variantAxes) ? selSvc.variantAxes : [];
                    const hasVariants = axes.length > 0;
                    const variantQtySum = (currentOrderService.variants || [])
                      .reduce((s, v) => s + (Number(v.soni) || 0), 0);
                    return (
                      <>
                        {hasVariants && (
                          <div className="bg-white border-2 border-amber-100 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                                Variant qatorlari
                              </p>
                              <span className="text-xs font-bold text-slate-500">
                                Jami: <strong className="text-amber-700">{variantQtySum}</strong> {selSvc?.unit || 'dona'}
                              </span>
                            </div>

                            {/* Ustun sarlavhalari — har qator ustida bir marta */}
                            {(currentOrderService.variants || []).length > 0 && (
                              <div className="flex items-center gap-2 px-0.5">
                                {axes.map((axis) => (
                                  <div key={axis} className="flex-1 min-w-0 text-[11px] font-bold text-amber-700 uppercase tracking-widest">
                                    {axis}
                                  </div>
                                ))}
                                <div className="w-20 text-[11px] font-bold text-amber-700 uppercase tracking-widest text-right">
                                  Soni
                                </div>
                                <div className="w-9" />
                              </div>
                            )}

                            <div className="space-y-2">
                              {(currentOrderService.variants || []).map((row, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  {axes.map((axis) => (
                                    <input
                                      key={axis}
                                      type="text"
                                      value={row.atributlar?.[axis] ?? ''}
                                      onChange={(e) => {
                                        const next = [...(currentOrderService.variants || [])];
                                        next[idx] = {
                                          ...next[idx],
                                          atributlar: { ...next[idx].atributlar, [axis]: e.target.value },
                                        };
                                        recalculatePrice({ variants: next });
                                      }}
                                      className="flex-1 min-w-0 h-9 px-2.5 text-xs font-bold border border-amber-200 rounded-lg outline-none focus:border-amber-500 bg-white"
                                    />
                                  ))}
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.soni === 0 ? '' : row.soni}
                                    onChange={(e) => {
                                      const next = [...(currentOrderService.variants || [])];
                                      next[idx] = { ...next[idx], soni: e.target.value === '' ? '' : Number(e.target.value) };
                                      recalculatePrice({ variants: next });
                                    }}
                                    className="w-20 h-9 px-2.5 text-xs font-bold border border-amber-200 rounded-lg outline-none focus:border-amber-500 bg-white text-right"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (currentOrderService.variants || []).filter((_, i) => i !== idx);
                                      recalculatePrice({ variants: next });
                                    }}
                                    className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                    title="Qatorni o'chirish"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const empty = { atributlar: Object.fromEntries(axes.map((a) => [a, ''])), soni: '' as number | string };
                                const next = [...(currentOrderService.variants || []), empty];
                                recalculatePrice({ variants: next });
                              }}
                              className="w-full h-9 border-2 border-dashed border-amber-200 rounded-lg text-xs font-bold text-amber-600 uppercase tracking-widest hover:bg-amber-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Plus size={12} /> Qator qo'shish
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">
                              Miqdor <span className="text-slate-400 capitalize font-medium">({selSvc?.unit})</span>
                              {hasVariants && variantQtySum > 0 && <span className="ml-1 text-amber-600 normal-case">— variantlardan</span>}
                            </label>
                            <input
                              type="number" min="0.1" step="0.1"
                              value={hasVariants && variantQtySum > 0 ? variantQtySum : currentOrderService.quantity}
                              onChange={e => recalculatePrice({ quantity: e.target.value })}
                              disabled={hasVariants && variantQtySum > 0}
                              className="input-minimal font-bold text-orange-700 h-11 bg-white border-2 border-orange-100 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Koeffitsiyent</label>
                            <input
                              type="number" min="0.1" step="0.1"
                              value={currentOrderService.coefficient}
                              onChange={e => recalculatePrice({ coefficient: e.target.value })}
                              className="input-minimal font-bold text-orange-700 h-11 bg-white border-2 border-orange-100"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {priceBreakdown && (
                    <div className="bg-white border-2 border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-0.5">Xizmat summasi</p>
                        <span className="text-lg font-bold text-orange-700">{priceBreakdown.total.toLocaleString()} UZS</span>
                      </div>
                      <button
                        type="button"
                        onClick={addItemToOrder}
                        className="w-full sm:w-auto h-11 px-6 bg-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                      >
                        RO'YXATGA QO'SHISH
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
            <div className="md:col-span-2 p-4 sm:p-5 bg-emerald-50/50 border border-emerald-100 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Jami narx</p>
                  <span className="text-2xl font-bold text-slate-800">{Number(newTaskForm.totalAmount).toLocaleString()} UZS</span>
                </div>
                <p className="text-xs text-slate-400 sm:text-right max-w-xs">
                  Har bir xizmatning narxini yuqoridagi ro'yxatda alohida o'zgartirishingiz mumkin. Har xizmat o'z aniq summasi bilan alohida task bo'lib yaratiladi.
                </p>
              </div>
            </div>

            <div>
              <label className="form-label">Sizga berilgan zakolat</label>
              <CurrencyInput
                value={newTaskForm.depositAmount}
                onChange={(uzs) => setNewTaskForm(f => ({ ...f, depositAmount: String(uzs) }))}
                colorClass="text-slate-600"
              />
            </div>

            {(() => {
              const finalTotal = newTaskForm.manualTotal ? Number(newTaskForm.manualTotal) : Number(newTaskForm.totalAmount);
              const deposit = Number(newTaskForm.depositAmount);
              const pct = finalTotal > 0 ? Math.round((deposit / finalTotal) * 100) : 100;
              if (finalTotal <= 0 || pct >= minPrepaymentPct) return null;
              return (
                <div className="md:col-span-2 animate-fade-in">
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <AlertOctagon className="text-amber-500 mt-0.5 shrink-0" size={18} />
                      <div>
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">Zakolat kam!</p>
                        <p className="text-xs font-bold text-amber-700 mt-0.5">
                          Zakolat <strong>{pct}%</strong> ni tashkil etadi. Tavsiya etilgan minimal: <strong>{minPrepaymentPct}%</strong>
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prepaymentWarningAccepted}
                        onChange={e => setPrepaymentWarningAccepted(e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <span className="text-xs font-bold text-amber-700 uppercase">Men bu holat haqida xabardorman va davom etishga ruxsatim bor</span>
                    </label>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="form-label">To'lov Turi (Zakolat uchun)</label>
              <select value={newTaskForm.paymentTypeId} onChange={(e) => setNewTaskForm({ ...newTaskForm, paymentTypeId: e.target.value })} className="select-minimal h-12 font-bold">
                <option value="">Tanlang...</option>
                {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              {/* Sarlavha "Mas'ul Jamoani Tanlang" edi — mas'ul endi bu
                  yerda tanlanmaydi, shuning uchun bo'lim nomi ham qolgan
                  mazmuniga (bajaruvchi, bo'lim, sotuv KPI) moslashtirildi. */}
              <label className="form-label px-1">Bajaruvchi va bo'lim</label>

              {/* Bajaruvchi — executor routing (self / branch / vendor) */}
              {(branches.length > 0 || vendors.length > 0) && (isAdmin || p.canAssignToOtherBranches) && (
                <div className="mb-3 mt-5 space-y-2 animate-fade-in">
                  <p className="text-xs font-medium text-slate-500 px-1">Bajaruvchi</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'self', label: "O'zimiz", icon: <Building2 size={13} /> },
                      ...(branches.length > 0 ? [{ key: 'branch', label: 'Filialga', icon: <ArrowRight size={13} /> }] : []),
                      ...(vendors.length > 0 ? [{ key: 'vendor', label: 'Hamkorga', icon: <Handshake size={13} /> }] : []),
                    ].map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => { setExecutorType(opt.key as any); setExecutorBranchId(''); }}
                        className={`flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-bold uppercase tracking-widest border-2 transition-all ${executorType === opt.key
                          ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-orange-300'
                          }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                  {executorType === 'branch' && (
                    <select
                      value={executorBranchId}
                      onChange={e => { setExecutorBranchId(e.target.value); setNewTaskForm(f => ({ ...f, assigneeIds: [] })); }}
                      className="select-minimal h-10 font-bold text-orange-600 border-orange-300 w-full"
                    >
                      <option value="">— Bajaruvchi filialni tanlang —</option>
                      {branches.filter(b => b.id !== activeBranchId).map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                  {executorType === 'vendor' && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={vendorAssign.vendorId}
                        onChange={e => setVendorAssign(v => ({ ...v, vendorId: e.target.value }))}
                        className="select-minimal h-10 font-bold text-orange-700 border-orange-200 col-span-1"
                      >
                        <option value="">— Hamkorni tanlang —</option>
                        {vendors.map((v: any) => (
                          <option key={v.id} value={v.id}>{v.name}{Array.isArray(v.roles) && v.roles.length ? ` (${v.roles.join(', ')})` : ''}</option>
                        ))}
                      </select>
                      <CurrencyInput
                        value={vendorAssign.amount}
                        onChange={v => setVendorAssign(f => ({ ...f, amount: v ? String(v) : '' }))}
                        colorClass="text-orange-600 font-bold h-10 border-orange-200 col-span-1"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Department (Bo'lim) — bo'lim bor bo'lsa MAJBURIY (buyurtmani filtrash uchun).
                  Visible only if the active branch has at least one department defined. */}
              {/* BUYURTMA DARAJASIDAGI BO'LIM.
                  Har xizmatga alohida bo'lim tanlangan bo'lsa, bu yerda
                  qayta so'rash ortiqcha — ikki joyda bir narsani tanlab
                  o'tirish chalkashtiradi va ziddiyat ehtimolini tug'diradi.
                  Shuning uchun barcha xizmatda bo'lim ko'rsatilgan bo'lsa,
                  bu blok yashiriladi. */}
              {departments.length > 0 && !(
                newTaskForm.items.length > 0 &&
                newTaskForm.items.every((it: any) => !!it.departmentId)
              ) && (
                <div className="space-y-2 mt-5 mb-7">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                    <Layers size={11} /> Bo'lim <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedDepartmentId}
                    onChange={e => setSelectedDepartmentId(e.target.value)}
                    className={`select-minimal h-10 font-bold w-full ${!selectedDepartmentId ? 'border-rose-200 bg-rose-50/40' : ''}`}
                  >
                    <option value="">— Bo'limni tanlang —</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {!selectedDepartmentId && (
                    <p className="text-xs text-rose-500 font-bold">Buyurtma uchun bo'lim tanlash majburiy</p>
                  )}
                </div>
              )}

              {/* BUYURTMANI KIM OLDI — KPI shu xodimga yoziladi.
                  Kiritgan odam bilan bir xil bo'lmasligi mumkin: doimiy mijoz
                  ko'pincha rahbarga qo'ng'iroq qiladi, rahbar kiritadi, lekin
                  sotuvni menejer olgan bo'ladi. Ilgari bunday holatda KPI
                  umuman yozilmasdi (rahbar Employee jadvalida yo'q). */}
              <div className="space-y-2 mt-5 mb-7">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-1.5">
                  <Users size={11} /> Buyurtmani kim oldi (KPI)
                </label>
                <select
                  value={salesEmployeeId}
                  onChange={e => setSalesEmployeeId(e.target.value)}
                  className="select-minimal h-10 font-bold w-full"
                >
                  <option value="">— Belgilanmagan —</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.fullName}</option>
                  ))}
                </select>
                <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                  Sotuv KPI'si shu xodimga yoziladi. Buyurtmani o'zingiz olgan bo'lsangiz
                  o'zingizni tanlang.
                </p>
              </div>


              {/* BUYURTMA DARAJASIDAGI MAS'UL TANLAGICH OLIB TASHLANDI.
                  Mas'ul endi HAR XIZMATDA alohida tanlanadi (yuqoridagi
                  xizmatlar ro'yxatida). Ikkalasi turganda bir odam ikki
                  joyda tanlanardi va qaysi biri kuchda ekani noaniq edi. */}
            </div>

            {/* Deadline field */}
            <div className="md:col-span-2">
              <label className="form-label flex items-center gap-1.5">
                <Clock size={11} className="text-amber-500" /> Topshiriq muddati (ixtiyoriy)
              </label>
              <input
                type="datetime-local"
                value={newTaskForm.deadlineAt}
                onChange={e => setNewTaskForm(f => ({ ...f, deadlineAt: e.target.value }))}
                className="input-minimal"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 mt-6 border-t border-slate-100">
              <button
                type="button"
                className="btn-outline flex-1"
                onClick={() => setIsNewTaskModalOpen(false)}
              >
                Bekor qilish
              </button>
              {(() => {
                const finalTotal = newTaskForm.manualTotal ? Number(newTaskForm.manualTotal) : Number(newTaskForm.totalAmount);
                const deposit = Number(newTaskForm.depositAmount);
                const pct = finalTotal > 0 ? Math.round((deposit / finalTotal) * 100) : 100;
                const blocked = finalTotal > 0 && pct < minPrepaymentPct && !prepaymentWarningAccepted;
                return (
                  <button
                    type="submit"
                    disabled={blocked}
                    className="btn-primary flex-[1.5]"
                  >
                    Buyurtma qo'shish
                  </button>
                );
              })()}
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: TASK DETAILS (REFACTORED) */}
      {selectedTask && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedTask.title}
          maxWidth="max-w-3xl"
          footer={
            <div className="flex justify-between items-center w-full">
              <div className="flex flex-col">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-0.5 px-0.5">Qolgan qarz</p>
                <span className="text-sm font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-xl border border-rose-100">{formatCurrency(selectedTask.remainingAmount)}</span>
              </div>
              {canMoveTask && (
                <button
                  onClick={() => { setIsDetailModalOpen(false); openMoveModal(selectedTask); }}
                  className="btn-primary flex items-center gap-3 h-14 px-8 sm:px-12 text-xs sm:text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-orange-500 to-orange-700 border-none shadow-xl shadow-orange-500/20 active:scale-95"
                >
                  BOSQICHNI O'ZGARTIRISH <ArrowRight size={18} />
                </button>
              )}
            </div>
          }
        >
          <div className="flex flex-col h-full">
            <div className="flex bg-slate-100/50 p-1 rounded-2xl mb-6">
              <button onClick={() => setActiveTab('details')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'details' ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}>TAFSILOTLAR</button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}>TARIXI</button>
            </div>

            {activeTab === 'details' ? (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-slate-200 transition-all">
                    <p className="text-xs font-medium text-slate-500 mb-1">Mijoz</p>
                    <p className="font-bold text-slate-800 text-sm">{selectedTask.customerName || "Noma'lum"}</p>
                    <p className="text-xs font-bold text-slate-500 mt-1.5">{selectedTask.customerPhone || 'Tel kiritilmagan'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-medium text-slate-500">Mas'ul Jamoa</p>
                      {canEditTask && (
                        <button onClick={() => { setIsDetailModalOpen(false); openMoveModal(selectedTask); }} className="text-xs font-bold text-slate-600 hover:text-slate-700 transition-colors uppercase">Tahrirlash</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parseJson(selectedTask.assignees).map((id: string) => (
                        <span key={id} className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 shadow-sm">{employees.find(e => e.id === id)?.fullName || 'Xodim'}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {(() => {
                  const variants = Array.isArray((selectedTask as any).variants)
                    ? (selectedTask as any).variants as Array<{ atributlar: Record<string, string>; soni: number }>
                    : [];
                  if (variants.length === 0) return null;

                  // Ustun nomlari — xizmatning variantAxes'idan (asosiy manba).
                  // Agar service yo'q bo'lsa yoki axes bo'sh bo'lsa, fallback —
                  // data'dagi kalitlardan olamiz.
                  const serviceAxes: string[] = Array.isArray((selectedTask as any).service?.variantAxes)
                    ? (selectedTask as any).service.variantAxes
                    : [];
                  const allAxes = serviceAxes.length > 0
                    ? serviceAxes
                    : Array.from(new Set(variants.flatMap(v => Object.keys(v.atributlar || {}))));
                  const totalSum = variants.reduce((s, v) => s + (Number(v.soni) || 0), 0);
                  const unit = (selectedTask as any).service?.unit || 'dona';

                  return (
                    <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-amber-200">
                        <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
                          <Package size={14} /> Variant qatorlari
                        </h4>
                        <span className="text-xs font-bold text-amber-700">
                          Jami: {totalSum} {unit}
                        </span>
                      </div>

                      {/* Jadval ko'rinishi: har ustun atribut + soni */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left">
                              {allAxes.map((axis) => (
                                <th key={axis} className="px-3 py-2 text-[11px] font-bold text-amber-700 uppercase tracking-widest border-b border-amber-200">
                                  {axis}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-[11px] font-bold text-amber-700 uppercase tracking-widest border-b border-amber-200 text-right">
                                Soni
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v, i) => (
                              <tr key={i} className="hover:bg-white/60 transition-colors">
                                {allAxes.map((axis) => (
                                  <td key={axis} className="px-3 py-2 font-bold text-slate-700 border-b border-amber-100/60">
                                    {v.atributlar?.[axis] || '—'}
                                  </td>
                                ))}
                                <td className="px-3 py-2 font-bold text-slate-800 tabular-nums text-right border-b border-amber-100/60">
                                  {v.soni}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={allAxes.length} className="px-3 pt-3 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                                Jami:
                              </td>
                              <td className="px-3 pt-3 font-bold text-amber-700 tabular-nums text-right">
                                {totalSum} {unit}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-medium text-slate-500 flex items-center gap-2"><ClipboardList size={14} /> BATAFSIL IZOH</h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadProgress !== null}
                      className="text-xs font-bold text-slate-500 uppercase hover:text-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Rasm (PNG/JPG) yoki dizayn (TIF/CDR)"
                    >
                      {uploadProgress !== null
                        ? <><Clock size={11} className="animate-spin" /> Yuklanmoqda... {uploadProgress}%</>
                        : <><Plus size={11} /> Fayl yuklash (rasm yoki dizayn)</>
                      }
                    </button>
                    <input type="file" hidden ref={fileInputRef} accept={ALLOWED_ATTACHMENT_ACCEPT} onChange={handleFileUpload} />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed mb-4">
                    {selectedTask.description
                      ? <LinkliMatn matn={selectedTask.description} />
                      : "Izox kiritilmagan..."}
                  </p>

                  {/* Attached files — endi alohida TaskAttachment row'lardan. parseJson
                      o'rniga to'g'ridan-to'g'ri array ishlatamiz, har re-render'da 30MB
                      JSON parse qilish yo'q. */}
                  {(selectedTask.attachmentRecords?.length ?? 0) > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">Yuklangan fayllar ({selectedTask.attachmentRecords!.length})</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedTask.attachmentRecords!.map((raw) => {
                          const att = parseAttachmentItem(raw);
                          // CDR/TIF — non-renderable in browser, always download.
                          // Other images (jpg/png/...) — preview + dedicated download button.
                          return att.isImage ? (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="aspect-video rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all group relative cursor-zoom-in block"
                              title="Yangi oynada kattalashtirib ochish"
                            >
                              <img src={att.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={att.name} />
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadAttachment(att); }}
                                title="Yuklab olish"
                                className="absolute top-2 right-2 p-2 rounded-lg bg-white/90 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Download size={14} className="text-slate-700" />
                              </button>
                            </a>
                          ) : (
                            <div key={att.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-sm transition-all group">
                              <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-700 truncate" title={att.name}>{att.name}</p>
                                <p className="text-[11px] text-slate-400 font-bold uppercase">{/\.cdr$/i.test(att.name) ? 'CorelDRAW' : /\.tiff?$/i.test(att.name) ? 'TIFF rasm' : 'Fayl'}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => downloadAttachment(att)}
                                title="Yuklab olish"
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors shrink-0"
                              >
                                <Download size={14} strokeWidth={2.5} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-medium text-slate-500 flex items-center gap-2 font-sans"><Package size={14} /> XLMASHYO SARFI (TAXMINIY)</h4>
                    <button onClick={() => setIsOverrideModalOpen(true)} className="text-xs font-bold text-slate-600 hover:text-slate-700 transition-colors uppercase">Sarfni tahrirlash</button>
                  </div>
                  {overrides.length === 0 ? (
                    <p className="text-xs font-bold text-slate-300 italic">Xomashyo sarfi belgilanmagan</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {overrides.map(ov => (
                        <div key={ov.materialId} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5 line-clamp-1">{ov.name}</p>
                            <p className="text-xs font-bold text-slate-800">{ov.quantity} {ov.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Oldingi izohlar — bosqich o'zgartirishlarda yozilgan barcha kommentlar.
                    Tarixi tabga o'tmasdan ham hammasi ko'rinib turadi. */}
                {(() => {
                  const notes = (selectedTask.histories || [])
                    .filter((h: any) => h.note && String(h.note).trim().length > 0);
                  if (notes.length === 0) return null;
                  return (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-medium text-slate-500 flex items-center gap-2">
                          <ClipboardList size={14} /> IZOHLAR ({notes.length})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scroll pr-1">
                        {notes.map((h: any, i: number) => (
                          <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                                {h.employee?.fullName || 'Tizim'}
                              </span>
                              <span className="text-[11px] font-bold text-slate-300 tabular-nums">
                                {new Date(h.createdAt).toLocaleDateString('uz-UZ')} {new Date(h.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 italic">"<LinkliMatn matn={h.note} />"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {(canDeleteTask || isAdmin) && (
                  <div className="flex justify-end items-center gap-5 pt-2">
                    {canDeleteTask && (
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'task', id: selectedTask.id, title: selectedTask.title })} className="text-xs font-bold text-amber-400 hover:text-amber-600 transition-colors flex items-center gap-2 uppercase tracking-widest"><Archive size={14} /> Buyurtmani arxivlash</button>
                    )}
                    {isAdmin && (
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'task-delete', id: selectedTask.id, title: selectedTask.title })} className="text-xs font-bold text-rose-400 hover:text-rose-600 transition-colors flex items-center gap-2 uppercase tracking-widest"><Trash2 size={14} /> Butunlay o'chirish</button>
                    )}
                  </div>
                )}
              </div>
            ) : activeTab === 'history' ? (
              <div className="space-y-4 animate-fade-in custom-scroll max-h-[50vh]">
                {(!selectedTask.histories || selectedTask.histories.length === 0) ? (
                  <div className="py-20 flex flex-col items-center justify-center opacity-20">
                    <ClipboardList size={40} className="mb-4" />
                    <p className="font-bold uppercase text-xs">Tarixiy ma'lumotlar mavjud emas</p>
                  </div>
                ) : (
                  selectedTask.histories.map((h: any, i: number) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 items-start hover:bg-white hover:shadow-sm transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm font-bold text-slate-400 text-xs">
                        {h.employee?.fullName?.charAt(0) || 'T'}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{h.employee?.fullName || 'Tizim'}</p>
                          <p className="text-[11px] font-bold text-slate-300">
                            {new Date(h.createdAt).toLocaleDateString('uz-UZ')} {new Date(h.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">{h.action}</p>
                        <p className="text-xs font-semibold text-slate-500 leading-relaxed italic">{h.details}</p>
                        {h.note && (
                          <div className="mt-3 p-3 bg-white/80 rounded-xl border border-slate-200/60 shadow-inner">
                            <p className="text-xs font-bold text-slate-500 italic">"{h.note}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === 'vendors' ? (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="text-xs font-medium text-slate-500 flex items-center gap-2 mb-1">
                    <Handshake size={14} className="text-orange-500" /> Hamkorga biriktirish
                  </h4>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2 px-1">Hamkorni tanlang</label>
                    <select
                      value={vendorCostForm.vendorId}
                      onChange={e => setVendorCostForm(f => ({ ...f, vendorId: e.target.value }))}
                      className="select-minimal font-bold text-slate-700 h-11"
                    >
                      <option value="">— Biriktirilmagan —</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}{Array.isArray(v.roles) && v.roles.length ? ` (${v.roles.join(', ')})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2 px-1">Xizmat narxi (Hamkorga to'lanadigan summa)</label>
                    <CurrencyInput
                      value={vendorCostForm.amount}
                      onChange={(uzs) => setVendorCostForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
                      colorClass="text-orange-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedTask) return;
                      setIsUpdatingVendor(true);
                      try {
                        await tasksApi.update(selectedTask.id, {
                          vendorId: vendorCostForm.vendorId || null,
                          vendorCost: Number(vendorCostForm.amount) || 0
                        }, currentUser.id);
                        showStatus('success', "Hamkor ma'lumotlari yangilandi!");
                        // Update local state to reflect changes without full fetch if possible, 
                        // but fetchData(true) is safer.
                        fetchData(true);
                        setIsDetailModalOpen(false);
                      } catch {
                        showStatus('error', "Saqlashda xatolik!");
                      } finally {
                        setIsUpdatingVendor(false);
                      }
                    }}
                    disabled={isUpdatingVendor}
                    className="w-full h-12 bg-orange-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isUpdatingVendor ? 'SAQLANMOQDA...' : "SAQLASH"}
                  </button>
                </div>

                {(selectedTask as any).vendor && (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs font-bold text-amber-800">
                      Bu buyurtma <strong>{(selectedTask as any).vendor.name}</strong> hamkoriga biriktirilgan.
                      Kelishilgan narx: <strong>{formatCurrency((selectedTask as any).vendorCost || 0)}</strong>.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* ══ TANNARX VA MOLIYA TAB ══════════════════════════════════════ */
              <div className="space-y-5 animate-fade-in">

                {/* ── Dashboard Calculator ── */}
                {(() => {
                  const totalCost = taskExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
                  const revenue = Number(selectedTask.totalAmount) || 0;
                  const netProfit = revenue - totalCost;
                  const qty = Number(selectedTask.quantity) || 1;
                  const unitCost = totalCost / qty;
                  const unitProfit = netProfit / qty;
                  const margin = revenue > 0 ? (netProfit / revenue * 100) : 0;
                  return (
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden">
                      {/* Revenue + Cost */}
                      <div className="grid grid-cols-2 divide-x divide-stone-200 border-b border-stone-200">
                        <div className="p-4">
                          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Umumiy Daromad</p>
                          <p className="text-sm font-bold text-stone-800 font-mono">{revenue.toLocaleString()} UZS</p>
                        </div>
                        <div className="p-4">
                          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Jami Xarajat</p>
                          <p className="text-sm font-bold text-stone-700 font-mono">{totalCost.toLocaleString()} UZS</p>
                        </div>
                      </div>
                      {/* Net Profit hero */}
                      <div className="p-4 border-b border-stone-200">
                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Sof Foyda</p>
                        <div className="flex items-baseline gap-3">
                          <p className={`text-2xl font-bold font-mono tracking-tight ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {netProfit.toLocaleString()} UZS
                          </p>
                          {revenue > 0 && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-500 border border-rose-200'}`}>
                              {netProfit >= 0 ? '+' : ''}{margin.toFixed(1)}% marja
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Unit metrics */}
                      <div className="grid grid-cols-2 divide-x divide-stone-200">
                        <div className="p-4">
                          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">1 dona — Tannarx</p>
                          <p className="text-sm font-bold text-stone-700 font-mono">{unitCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} UZS</p>
                          <p className="text-[11px] text-stone-400 font-bold mt-0.5">{qty} dona asosida</p>
                        </div>
                        <div className="p-4">
                          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">1 donadan Foyda</p>
                          <p className={`text-sm font-bold font-mono ${unitProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {unitProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} UZS
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Add Expense Form ── */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                  <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Xarajat Qo'shish</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Xarajat turi (Yo'l kira...)"
                      value={expenseForm.expenseName}
                      onChange={e => setExpenseForm(f => ({ ...f, expenseName: e.target.value }))}
                      className="input-minimal bg-white border border-stone-200 text-xs h-10 rounded-xl px-3 focus:border-stone-400 focus:outline-none"
                    />
                    <CurrencyInput
                      value={expenseForm.amount}
                      onChange={(uzs) => setExpenseForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
                      colorClass="text-stone-700"
                      placeholder="Summa"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExpense}
                    disabled={isAddingExpense || !expenseForm.expenseName.trim() || !expenseForm.amount}
                    className="w-full h-10 bg-stone-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-900 transition-all active:scale-95"
                  >
                    {isAddingExpense ? 'QOSHILMOQDA...' : "+ XARAJAT QO'SHISH"}
                  </button>
                </div>

                {/* ── Expense List ── */}
                {taskExpenses.length === 0 ? (
                  <div className="py-10 flex items-center justify-center">
                    <p className="text-xs font-bold uppercase text-stone-300 tracking-widest">Hali xarajat qo'shilmagan</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {taskExpenses.map((exp: any) => (
                      <div key={exp.id} className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-stone-800 uppercase tracking-tight">{exp.expenseName}</p>
                          <p className="text-[11px] text-stone-400 font-bold mt-0.5">{new Date(exp.createdAt).toLocaleDateString('uz-UZ')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-stone-700 font-mono">{Number(exp.amount).toLocaleString()} UZS</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-stone-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 px-1 border-t border-stone-200 mt-2">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Jami xarajat</span>
                      <span className="text-sm font-bold text-stone-800 font-mono">
                        {taskExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0).toLocaleString()} UZS
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: EDIT/MOVE TASK */}
      <Modal
        isOpen={isMoveTaskModalOpen}
        onClose={() => setIsMoveTaskModalOpen(false)}
        title="Buyurtmani Tahrirlash & Ko'chirish"
      >
        <form onSubmit={handleMoveTask} className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-500 shadow-sm shadow-slate-500/10"><Users size={20} /></div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tanlangan task</p>
              <p className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{selectedTask?.title}</p>
            </div>
          </div>

          <div>
            <label className="form-label">Yangi holat (Varonka)</label>
            <select value={moveForm.columnId} onChange={(e) => setMoveForm({ ...moveForm, columnId: e.target.value })} className="select-minimal font-bold text-orange-600">
              {columns.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
            </select>
          </div>

          <div className="relative" data-assignee-dropdown>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-3 px-1 border-b border-slate-100 pb-2 flex justify-between">
              Mas'ul Jamoani Yangilash
              <span className="text-slate-500">{moveForm.assigneeIds.length} ta tanlandi</span>
            </label>

            <div
              onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
              className="w-full min-h-[50px] p-3 rounded-2xl bg-slate-50 border-2 border-slate-100 flex flex-wrap gap-2 cursor-pointer hover:border-slate-300 transition-all mb-2"
            >
              {moveForm.assigneeIds.length === 0 ? (
                <span className="text-sm font-bold text-slate-400 flex items-center gap-2 px-1"><UserPlus size={16} /> Mas'ullarni tanlash...</span>
              ) : (
                moveForm.assigneeIds.map(id => {
                  const emp = employees.find(e => e.id === id);
                  return (
                    <span key={id} className="bg-white px-3 py-1 rounded-xl border border-slate-100 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 animate-fade-in">
                      {emp?.fullName}
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleAssigneeForMove(id); }} className="hover:text-rose-500">×</button>
                    </span>
                  )
                })
              )}
            </div>

            {isAssigneeDropdownOpen && (
              <div className="absolute z-50 bottom-full left-0 right-0 mb-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 animate-slide-up max-h-[250px] flex flex-col">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Qidirish..."
                    value={empSearchTerm}
                    onChange={(e) => setEmpSearchTerm(e.target.value)}
                    className="w-full pl-9 h-10 text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-slate-500 transition-all"
                  />
                </div>
                <div className="overflow-y-auto custom-scroll space-y-1">
                  {employees
                    .filter(e => e.fullName.toLowerCase().includes(empSearchTerm.toLowerCase()))
                    .map(emp => {
                      const active = moveForm.assigneeIds.includes(emp.id);
                      const busy = isEmployeeBusy(emp.id) && !parseJson(selectedTask?.assignees || "[]").includes(emp.id);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleAssigneeForMove(emp.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${active ? 'bg-slate-50 text-slate-700' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <div className="text-left">
                            <p className="text-xs font-bold uppercase tracking-tight">{emp.fullName}</p>
                            <p className="text-xs font-bold opacity-60">{emp.role?.name || 'Xodim'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {busy && <span className="text-[11px] font-bold bg-amber-100/50 text-amber-600 px-2 py-0.5 rounded border border-amber-200 uppercase">band</span>}
                            {active && <CheckCircle2 size={16} className="text-slate-500" />}
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">O'zgarish Haqida Izoh (History)</label>
            {/* `input-minimal` emas, `textarea-minimal`: birinchisi bir
                qatorli qat'iy balandlikka ega va uzun izoh yozganda matn
                ko'rinmay qolardi. Bu maydon buyurtma tarixiga yoziladi,
                shuning uchun yozgan narsangiz ko'rinib turishi kerak. */}
            <textarea
              required
              rows={4}
              value={moveForm.note}
              onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })}
              className="textarea-minimal min-h-[120px]"
              placeholder="Nima ish qilindi? Masalan: Dizayn tasdiqlandi, mijoz bilan kelishildi..."
            />
          </div>

          {/* Design file upload */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase px-1">Rasm yoki dizayn fayl (ixtiyoriy)</label>
              {moveForm.newFiles.length > 0 && (
                <span className="text-[11px] font-bold text-orange-500">{moveForm.newFiles.length} ta fayl tanlandi</span>
              )}
            </div>
            <div
              onClick={() => moveFileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsMoveDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsMoveDragOver(false); }}
              onDrop={handleMoveDrop}
              // Ixcham qator: fayl biriktirish IXTIYORIY, lekin katta
              // tashlash maydoni oynaning yarmini egallab, asosiy ish —
              // izoh yozish — pastga siqilib qolardi. Sudrab tashlash
              // baribir ishlaydi, faqat ko'rinishi kichraydi.
              className={`border border-dashed rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all ${
                isMoveDragOver
                  ? 'border-orange-500 bg-orange-50/50'
                  : 'border-slate-200 hover:border-orange-400 hover:bg-orange-50/30'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isMoveDragOver ? "#f97316" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-colors shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              <span className="text-xs font-medium text-slate-500">
                Rasm yoki dizayn faylni tashlang yoki <span className="text-orange-500 underline">tanlang</span>
              </span>
            </div>
            <input type="file" hidden multiple accept={ALLOWED_ATTACHMENT_ACCEPT} ref={moveFileInputRef} onChange={handleMoveFileSelect} />

            {moveForm.newFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {moveForm.newFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <span className="text-xs font-bold text-slate-700 truncate">{f.name}</span>
                    </div>
                    <button type="button" onClick={() => setMoveForm(fm => ({ ...fm, newFiles: fm.newFiles.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-rose-500 transition-colors ml-2 shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 items-end justify-end">
            <button
              type="button"
              disabled={uploadProgress !== null}
              className="btn-outline h-14 flex-1 rounded-2xl font-bold uppercase tracking-widest text-xs px-8 disabled:opacity-50"
              onClick={() => setIsMoveTaskModalOpen(false)}
            >
              BEKOR
            </button>
            <button
              type="submit"
              disabled={uploadProgress !== null}
              className="btn-primary h-14 flex-[2] rounded-2xl font-bold uppercase tracking-widest text-xs shadow-slate-500/20 px-10 disabled:opacity-60"
            >
              {uploadProgress !== null
                ? `YUKLANMOQDA... ${uploadProgress}%`
                : "O'ZGARTIRISHNI SAQLASH"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW / EDIT COLUMN */}
      <Modal
        isOpen={isNewColumnModalOpen}
        onClose={() => { setIsNewColumnModalOpen(false); setEditingColumnId(null); }}
        title={editingColumnId ? 'Bosqich nomini tahrirlash' : 'Yangi Bosqich Qoshish'}
        type="warning"
      >
        <form onSubmit={handleSaveColumn} className="space-y-5">
          <div>
            <label className="form-label">Ustun Nomi</label>
            <input
              type="text"
              required
              autoFocus
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              className="input-minimal h-12 text-sm font-bold uppercase tracking-wider"
              placeholder="Masalan: PECHATDA..."
            />
          </div>

          {/* "Bajarilgan" bosqichi — hisobotlar shu ustundagi buyurtmalarni sanaydi */}
          <button
            type="button"
            onClick={() => setNewColumnIsDone(v => !v)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${newColumnIsDone ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${newColumnIsDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-transparent'}`}>
              <CheckCircle2 size={16} />
            </span>
            <span className="min-w-0">
              <span className={`block text-xs font-bold uppercase tracking-wider ${newColumnIsDone ? 'text-emerald-700' : 'text-slate-600'}`}>"Bajarilgan" bosqichi</span>
              <span className="block text-xs text-slate-400 font-medium mt-0.5">Buyurtma shu ustunga yetganda — hisobotlarda "bajarilgan" deb sanaladi.</span>
            </span>
          </button>

          <div className="flex gap-3 pt-2 items-end justify-end">
            <button type="button" className="btn-outline h-14 flex-1 rounded-xl uppercase font-bold text-xs tracking-widest px-8" onClick={() => { setIsNewColumnModalOpen(false); setEditingColumnId(null); }}>BEKOR</button>
            <button type="submit" disabled={isSavingColumn} className="btn-primary h-14 flex-1 rounded-xl uppercase font-bold text-xs tracking-widest shadow-amber-500/10 bg-amber-500 hover:bg-amber-600 px-10 disabled:opacity-50">{isSavingColumn ? '...' : (editingColumnId ? 'YANGILASH' : 'YARATISH')}</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CONFIRM DELETE */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.type === 'task' ? "Buyurtmani arxivlash" : confirmModal.type === 'task-delete' ? "Buyurtmani butunlay o'chirish" : "Bosqichni o'chirish"}
        type="danger"
      >
        <div className="space-y-6">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1" size={24} />
            <div>
              <p className="text-sm font-bold text-rose-900 uppercase">Diqqat!</p>
              <p className="text-xs font-bold text-rose-700 mt-1">
                {confirmModal.type === 'task'
                  ? <>Siz <strong>{confirmModal.title}</strong> buyurtmasini arxivlamoqchisiz. Buyurtma arxivga ko'chiriladi.</>
                  : confirmModal.type === 'task-delete'
                  ? <>Siz <strong>{confirmModal.title}</strong> buyurtmasini <strong>butunlay</strong> o'chirmoqchisiz. Barcha bog'liq yozuvlar (tarix, xarajatlar, fayllar) ham o'chadi. Bu amalni ortga qaytarib bo'lmaydi!</>
                  : <>Siz <strong>{confirmModal.title}</strong> bosqichini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!</>
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2 items-end justify-end">
            <button
              type="button"
              className="btn-outline h-14 flex-1 rounded-2xl font-bold uppercase text-xs tracking-widest px-8"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="h-14 flex-1 bg-rose-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all px-10"
              onClick={confirmModal.type === 'task' ? handleArchiveTask : confirmModal.type === 'task-delete' ? handleDeleteTask : handleRemoveColumn}
            >
              {confirmModal.type === 'task' ? 'Ha, arxivlash' : confirmModal.type === 'task-delete' ? "Ha, butunlay o'chir" : "Ha, o'chirilsin"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: ARXIVLANGAN BUYURTMALAR */}
      <Modal
        isOpen={isArxivModalOpen}
        onClose={() => setIsArxivModalOpen(false)}
        title="Arxivlangan Buyurtmalar"
        maxWidth="max-w-2xl"
      >
        <div>
          {isArxivLoading ? (
            <div className="py-20 flex flex-col items-center justify-center opacity-30">
              <div className="animate-spin w-8 h-8 border-2 border-orange-500 rounded-full border-t-transparent mb-3" />
              <p className="text-xs font-bold uppercase">Yuklanmoqda...</p>
            </div>
          ) : arxivTasks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center opacity-20">
              <ArchiveRestore size={40} className="mb-4" />
              <p className="text-xs font-bold uppercase">Arxivlangan buyurtmalar yo'q</p>
            </div>
          ) : (() => {
            const totalPages = Math.ceil(arxivTasks.length / ARXIV_PAGE_SIZE);
            const paginated = arxivTasks.slice((arxivPage - 1) * ARXIV_PAGE_SIZE, arxivPage * ARXIV_PAGE_SIZE);
            return (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-xs font-medium text-slate-500">
                    Jami: <span className="text-slate-600">{arxivTasks.length}</span> ta
                  </p>
                  <p className="text-xs font-bold text-slate-400">
                    {arxivPage}/{totalPages} sahifa
                  </p>
                </div>
                <div className="space-y-2 mb-4">
                  {paginated.map((task: any) => (
                    <div key={task.id} className="flex items-start justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex-1 pr-3 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {task.orderName && <span className="text-orange-600 font-bold text-xs shrink-0">{task.orderName} —</span>}
                          <span className="text-xs font-bold text-slate-800 uppercase truncate">{task.title}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 italic line-clamp-1">{task.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {task.totalAmount > 0 && (
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{Number(task.totalAmount).toLocaleString()} UZS</span>
                          )}
                          {task.customerName && (
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{task.customerName}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 uppercase shrink-0 mt-0.5">
                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString('uz-UZ') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setArxivPage(p => Math.max(1, p - 1))}
                      disabled={arxivPage === 1}
                      className="h-8 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← OLDINGI
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                        <button
                          key={pg}
                          onClick={() => setArxivPage(pg)}
                          className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${pg === arxivPage
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                            : 'border border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500'
                            }`}
                        >
                          {pg}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setArxivPage(p => Math.min(totalPages, p + 1))}
                      disabled={arxivPage === totalPages}
                      className="h-8 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      KEYINGI →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </Modal>

      {/* MODAL: YANGI OPSIYA QO'SHISH */}
      <Modal
        isOpen={isNewOptionModalOpen}
        onClose={() => setIsNewOptionModalOpen(false)}
        title="Yangi Opsiya Qo'shish"
        type="warning"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleAddServiceOption} className="space-y-4">
          <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100">
            <p className="text-[11px] font-bold text-orange-600 uppercase tracking-widest">
              Xizmat: {services.find(s => s.id === currentOrderService.serviceId)?.name || '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 px-1">Opsiya Nomi *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Masalan: Rangi, O'lchami..."
              value={newOptionForm.name}
              onChange={e => setNewOptionForm(f => ({ ...f, name: e.target.value }))}
              className="input-minimal h-11 font-bold border-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 px-1">Qiymat *</label>
            <input
              type="text"
              required
              placeholder="Masalan: Qizil, A4, Laminate..."
              value={newOptionForm.value}
              onChange={e => setNewOptionForm(f => ({ ...f, value: e.target.value }))}
              className="input-minimal h-11 font-bold border-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 px-1">Qo'shimcha narx (asosiy narxga qo'shiladi, UZS)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={newOptionForm.priceAdd}
              onChange={e => setNewOptionForm(f => ({ ...f, priceAdd: e.target.value }))}
              className="input-minimal h-11 font-bold border-2 text-orange-600"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsNewOptionModalOpen(false)} className="btn-outline h-11 flex-1 rounded-xl uppercase font-bold text-xs tracking-widest">BEKOR</button>
            <button
              type="submit"
              disabled={isSavingOption}
              className="h-11 flex-[2] bg-orange-500 text-white rounded-xl uppercase font-bold text-xs tracking-widest shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              {isSavingOption ? 'SAQLANMOQDA...' : "QO'SHISH"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT MATERIAL CONSUMPTION OVERRIDES */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        title="Material Sarfini Tahrirlash"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <AlertTriangle size={14} /> Diqqat!
            </p>
            <p className="text-xs font-bold text-slate-700 leading-relaxed uppercase">
              Bu yerda kiritgan o'zgarishlaringiz faqat ushbu buyurtma uchun amal qiladi.
              Siz bu yerda bo'yoq yoki qog'oz miqdorini buyurtma dizayniga qarab ko'paytirishingiz yoki kamaytirishingiz mumkin.
            </p>
          </div>

          <div className="space-y-4">
            {overrides.map((ov, idx) => (
              <div key={ov.materialId} className="flex flex-col gap-2 p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center px-1">
                  <p className="text-xs font-medium text-slate-500">{ov.name}</p>
                  <p className="text-[11px] font-bold text-slate-300 uppercase">{ov.unit}</p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    value={ov.quantity}
                    onChange={(e) => {
                      const newOv = [...overrides];
                      newOv[idx].quantity = e.target.value;
                      setOverrides(newOv);
                    }}
                    className="input-minimal h-14 bg-slate-50 border-2 border-slate-100 focus:border-slate-500 font-bold text-slate-600 text-xl"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 uppercase">MIQDOR</div>
                </div>
              </div>
            ))}

            {overrides.length === 0 && (
              <div className="py-10 text-center opacity-30">
                <Package size={32} className="mx-auto mb-2" />
                <p className="text-xs font-bold uppercase">Bu xizmatga xomashyo biriktirilmagan</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100">
            <button onClick={() => setIsOverrideModalOpen(false)} className="btn-outline h-14 flex-1 rounded-2xl uppercase font-bold text-xs tracking-widest">Bekor Berish</button>
            <button
              onClick={handleSaveOverrides}
              className="h-14 flex-[2] bg-slate-600 text-white rounded-2xl uppercase font-bold text-xs tracking-widest shadow-xl shadow-slate-500/20 active:scale-95 transition-all"
            >
              SAQLASH VA QO'LLASH
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Topshiriqlar;
