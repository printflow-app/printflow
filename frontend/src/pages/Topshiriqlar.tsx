import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, UserPlus, CheckCircle2, Clock, X,
  Wallet, Layers, Trash2, ArrowRight, ClipboardList, AlertCircle,
  Users, AlertTriangle, Package, Building2, User,
  Archive, ArchiveRestore, Handshake, AlertOctagon, Download, Pencil,
  Upload, FileText
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
import { EmptyState, Tabs, Toast } from '../components/ui';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { TaskIdentityBadges, TaskDeadlineBadges } from './Topshiriqlar/TaskBadges';
import MasulTanlash from './Topshiriqlar/MasulTanlash';
import MijozTanlash from './Topshiriqlar/MijozTanlash';

// Panel tugmalari forma tegidan tashqarida turadi (footer slotida), shuning
// uchun ular `form` atributi orqali bog'lanadi — id ikkala joyda bir xil.
const YANGI_BUYURTMA_FORM_ID = 'yangi-buyurtma-forma';

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

  // Buyurtma oynasidagi xato — TOAST BILAN BIRGA oynaning ichida ham qoladi.
  //
  // Toast 3 soniyada o'chadi. Prodda foydalanuvchi shu sababli "Buyurtma
  // qo'shish"ni 12 marta bosgan: server har safar aniq sabab bilan 400
  // qaytargan, lekin xabar ko'zga tashlanmay yo'qolgan va tashqaridan
  // "tugma ishlamayapti"dek ko'ringan.
  const [formError, setFormError] = useState<string | null>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setFormError(type === 'error' ? text : null);
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
    title: '', description: '', assigneeIds: [] as string[], columnId: '',
    customerId: '', customerName: '', customerPhone: '',
    // Vakil = tashkilotdagi aloqa shaxsi. Mijoz endi tashkilot bo'lgani uchun
    // "kim buyurtma berdi" degan ma'lumot alohida saqlanadi.
    contactId: '', contactName: '', contactPhone: '', contactRole: '',
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

  // Boshqa filialga yuborish faqat ikkinchi filial bo'lganda mumkin —
  // o'z filialiga "yuborish" ma'nosiz.
  const boshqaFilialBor = branches.length > 1;
  const bajaruvchiVariantlari = [
    { key: 'self', label: "O'zimiz", icon: <Building2 size={16} /> },
    ...(boshqaFilialBor ? [{ key: 'branch', label: 'Filialga', icon: <ArrowRight size={16} /> }] : []),
    ...(vendors.length > 0 ? [{ key: 'vendor', label: 'Hamkorga', icon: <Handshake size={16} /> }] : []),
  ];
  // Sotuvni kim oldi — KPI shu xodimga yoziladi (kiritgan odamdan farq qilishi mumkin).
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
    if (bajarilgan) return 'border-slate-200 hover:border-primary-300';
    const now = new Date();
    const dl = task.deadlineAt ? new Date(task.deadlineAt) : null;
    const cr = task.createdAt ? new Date(task.createdAt) : null;
    const ageH = cr ? (now.getTime() - cr.getTime()) / 3600000 : 0;
    if (dl && now > dl) return 'border-rose-300 bg-rose-50/60 hover:border-rose-400';
    if (dl && (dl.getTime() - now.getTime()) < 7200000) return 'border-primary-300 bg-primary-50 hover:border-primary-400';
    if (!dl && ageH > 10) return 'border-amber-300 bg-amber-50/60 hover:border-amber-400';
    return 'border-slate-200 hover:border-primary-300';
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
    setFormError(null);
    setNewTaskForm({
      title: '', description: '', assigneeIds: [],
      columnId: initialColId || (columns[0]?.id || ''),
      customerId: '', customerName: '', customerPhone: '',
      contactId: '', contactName: '', contactPhone: '', contactRole: '',
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
    setFormError(null);

    // BOSQICH (kanban ustuni) — oynada tanlagichi yo'q, u oyna OCHILGANDA
    // `columns[0]` dan bir marta olinadi. Ustunlar hali yuklanmagan (yoki
    // filial endi almashgan) paytda oyna ochilsa qiymat bo'sh qoladi va
    // BUTUN oyna davomida bo'sh qolib ketadi: har bosishda server 400
    // "Buyurtma bosqichi tanlanmagan" qaytaradi. Shu sabab uni yuborishdan
    // oldin joyida tiklaymiz.
    const bosqichId = newTaskForm.columnId || columns[0]?.id || '';
    if (!bosqichId) {
      showStatus('error', 'Kanban ustunlari hali yuklanmadi — sahifani yangilang');
      return;
    }

    // Foydalanuvchi xizmatni tanlab, lekin "RO'YXATGA QO'SHISH"ni bosmagan bo'lsa —
    // tanlovini yo'qotmaslik uchun shu xizmatni avtomatik buyurtmaga qo'shamiz.
    const pendingItem = buildOrderItem();
    const effectiveItems = pendingItem ? [...newTaskForm.items, pendingItem] : newTaskForm.items;

    if (effectiveItems.length === 0) {
      showStatus('error', "Kamida bitta xizmat qo'shing!");
      return;
    }

    // MIJOZ MAJBURIY.
    //
    // Tanlagich bo'sh qoldirilsa buyurtma kanbanda paydo bo'lardi-yu, hech
    // qaysi mijozga bog'lanmasdi: Mijozlar sahifasida ko'rinmas, summasi
    // qarz hisobiga tushmas edi. Amalda mijoz nomi "Buyurtma nomi" maydoniga
    // yozilib, tanlagich umuman ochilmay qolgan (45.5 mln so'mlik buyurtma
    // shunday egasiz qolgan). Vakil ismi yozilgan bo'lsa yetarli — o'sha
    // odamning o'zi mijoz bo'ladi.
    if (!newTaskForm.customerId
        && !newTaskForm.customerName.trim()
        && !newTaskForm.contactName.trim()) {
      showStatus('error', 'Mijozni tanlang — buyurtma mijozsiz saqlanmaydi!');
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

    // Zakolat kiritilgan bo'lsa to'lov turi shart — aks holda kirim
    // tranzaksiyasi qaysi kassaga tushgani noma'lum bo'lib qoladi va
    // Kassa hisobida bo'shliq paydo bo'ladi. Zakolatsiz buyurtmada
    // to'lov turi kerak emas.
    if (Number(newTaskForm.depositAmount) > 0 && !newTaskForm.paymentTypeId) {
      showStatus('error', "Zakolat kiritilgan — to'lov turini tanlang");
      return;
    }

    try {
      const payload = {
        customerId: newTaskForm.customerId,
        customerName: newTaskForm.customerName,
        customerPhone: newTaskForm.customerPhone,
        // Vakil: mavjud bo'lsa contactId, yangi bo'lsa ism+telefon —
        // serverda buyurtma bilan bitta tranzaksiyada yaratiladi.
        contactId: newTaskForm.contactId || undefined,
        contactName: newTaskForm.contactName || undefined,
        contactPhone: newTaskForm.contactPhone || undefined,
        contactRole: newTaskForm.contactRole || undefined,
        totalDeposit: Number(newTaskForm.depositAmount) || 0,
        paymentTypeId: newTaskForm.paymentTypeId,
        columnId: bosqichId,
        justification: newTaskForm.justification,
        assigneeIds: executorType !== 'branch' ? newTaskForm.assigneeIds : [],
        deadlineAt: newTaskForm.deadlineAt || null,
        branchId: activeBranchId || undefined,
        executorBranchId: executorType === 'branch' ? executorBranchId : null,
        departmentId: selectedDepartmentId || null,
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
      // Buyurtma bilan birga yangi mijoz/vakil yaratilgan bo'lishi mumkin —
      // ro'yxatni yangilamasak, keyingi buyurtmada o'sha mijoz tanlagichda
      // topilmay, foydalanuvchi uni yana "yangi" qilib yozib yuboradi.
      invalidate.customers();
    } catch (err: any) {
      // Serverning haqiqiy sababini ko'rsatamiz. Ilgari bu yer har qanday
      // xatoni "Xatolik yuz berdi!" ga aylantirardi — omborda material
      // yetishmasligi ham, ruxsat yo'qligi ham, tarmoq uzilishi ham bir xil
      // ko'rinardi va foydalanuvchi nima qilishni bilmasdi.
      const sabab = err?.response?.data?.message;
      showStatus('error', Array.isArray(sabab) ? sabab.join(', ') : (sabab || "Xatolik yuz berdi!"));
      console.error('Buyurtma yaratishda xato:', err?.response?.status, err?.response?.data || err);
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
      {/* Portal + z-toast: Modal (z-overlay, backdrop-blur) ochiq bo'lganda
          toast modal ortida ko'rinmay qolmasligi uchun. Buyurtma qo'shishdagi
          validatsiya xatolari shu toast orqali ko'rsatiladi. */}
      {statusMessage && createPortal(
        <Toast type={statusMessage.type}>{statusMessage.text}</Toast>,
        document.body,
      )}

      {/* Toolbar — sahifa sarlavhasi shell headerda; bu yerda faqat amallar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-white p-3 rounded-card border border-slate-200 z-sticky mx-1 sm:mx-0">
        {/* Search input */}
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-120 flex items-center"
              title="Tozalash"
            ><X size={16} /></button>
          )}
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          <button onClick={openArxivModal} className="btn-outline h-sm">
            <Archive size={16} /> Arxiv
          </button>
          {(isAdmin || p.canExportTasks) && (
            <button onClick={handleExport} className="btn-outline h-sm" title="Topshiriqlarni Excel'ga eksport qilish">
              <Download size={16} /> Eksport
            </button>
          )}
          {p.canManageColumns && (
            <button data-tour-id="kanban-add-column" onClick={openAddColumn} className="btn-outline h-sm border-dashed">
              <Plus size={16} /> Bosqich
            </button>
          )}
          {canCreateTask && (
            <button data-tour-id="buyurtma-add" onClick={() => openNewTaskModal()} className="btn-primary h-sm">
              <Plus size={16} /> Buyurtma
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 flex gap-4 sm:gap-6 overflow-x-auto pb-8 items-start snap-x custom-scroll px-1 sm:px-0" style={{ minHeight: '65vh' }}>
        {isLoading ? (
          <div className="w-full"><SkeletonKanban columns={4} /></div>
        ) : columns.length === 0 ? (
          <div className="w-full">
            <EmptyState
              icon={ClipboardList}
              title="Kanban bosqichlari yo'q"
              description="Birinchi navbatda Kanban ustunlarini yarating (Yangi → Jarayonda → Tayyor kabi). Sozlamalar bo'limidan qo'shing."
            />
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
                className={`min-w-[88vw] sm:min-w-[320px] w-[88vw] sm:w-[320px] max-h-full flex flex-col rounded-card p-2.5 border flex-shrink-0 snap-center transition-all duration-180 ${dragOverColId === col.id
                  ? 'bg-primary-50 border-primary-300 ring-2 ring-primary-300 scale-[1.02]'
                  : 'bg-slate-50 border-slate-200'
                  }`}
              >
                {/* Column Header */}
                <div className="flex justify-between items-center gap-1 px-2 mb-2 mt-1 group">
                  <div className="flex items-center gap-1.5 flex-1 pr-1 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.isDone ? 'bg-emerald-500' : 'bg-[color:var(--primary)]'}`}></div>
                    <h3 className="label-caps text-slate-700 truncate">{col.title}</h3>
                    <span className="t-caption tabular-nums flex-shrink-0">{colTasks.length}</span>
                    {col.isDone && (
                      <span title="Bu bosqich bajarilgan deb sanaladi" className="badge-success flex-shrink-0"><CheckCircle2 size={12} /> Bajarilgan</span>
                    )}
                  </div>
                  {p.canManageColumns && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-120">
                      <button onClick={() => openEditColumn(col)} title="Nomini tahrirlash" className="icon-btn-sm"><Pencil size={16} /></button>
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'column', id: col.id, title: col.title })} title="O'chirish" className="icon-btn-sm hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>

                {/* Column Tasks Scrollable Area */}
                <div className="flex flex-col gap-3 sm:gap-4 flex-1 overflow-y-auto px-1 pb-4 custom-scroll max-h-[70vh]">
                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 px-3 text-center border border-dashed border-slate-300 rounded-card">
                      <ClipboardList size={20} className="text-slate-400 mb-2" />
                      <p className="t-caption">Bo'sh</p>
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
                        className={`p-3.5 rounded-card border min-w-0 ${canMoveTask ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-all duration-180 group animate-fade-in flex flex-col ${draggedTaskId === task.id
                          ? 'opacity-40 scale-95 ring-2 ring-primary-300 shadow-lg border-primary-300 bg-white'
                          : isMyTask
                            ? 'bg-slate-50 border-slate-300 hover:border-slate-400'
                            : `bg-white ${getCardUrgencyClass(task, !!col.isDone)}`
                          }`}
                      >
                        <TaskIdentityBadges task={task as any} vendor={(task as any).vendor} isMyTask={isMyTask} />
                        <h4 className="t-h3 mb-1 leading-snug line-clamp-2 break-words">
                          {task.orderName ? `${task.orderName} — ` : ''}{task.title}
                        </h4>
                        {task.description && (
                          <p className="t-caption mb-2.5 line-clamp-2 leading-normal break-words">{task.description}</p>
                        )}

                        <TaskDeadlineBadges task={task as any} activeBranchId={activeBranchId} branches={branches} bajarilgan={!!col.isDone} />

                        <div className="flex flex-wrap gap-1 mb-2.5">
                          {/* Summa va qarz.
                              Ilgari ikkala badge ham raqamdan iborat edi va hech
                              narsa to'lanmagan buyurtmada bir xil son ikki marta
                              chiqardi ("1 100 000" yashil, "1 100 000" qizil) —
                              qaysi biri narx, qaysi biri qarz ekani bilinmasdi.
                              Endi holat bittada ko'rinadi. */}
                          {task.totalAmount > 0 && (() => {
                            const jami = Number(task.totalAmount) || 0;
                            const qoldiq = Number(task.remainingAmount) || 0;
                            const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);
                            if (qoldiq <= 0) {
                              return (
                                <span className="badge-success tabular-nums" title={`Summa ${fmt(jami)} — to'liq to'langan`}>
                                  <Wallet size={12} /> {fmt(jami)} · to'langan
                                </span>
                              );
                            }
                            if (qoldiq >= jami) {
                              return (
                                <span className="badge-danger tabular-nums" title={`Summa ${fmt(jami)} — to'lov yo'q`}>
                                  <Wallet size={12} /> {fmt(jami)} · to'lanmagan
                                </span>
                              );
                            }
                            return (
                              <>
                                <span className="badge-success tabular-nums" title="Buyurtma summasi">
                                  <Wallet size={12} /> {fmt(jami)}
                                </span>
                                <span className="badge-danger tabular-nums" title={`Qoldiq qarz (${fmt(jami - qoldiq)} to'langan)`}>
                                  <AlertCircle size={12} /> qarz {fmt(qoldiq)}
                                </span>
                              </>
                            );
                          })()}
                          {(task as any).executorBranch && (
                            <span className="badge-neutral">
                              <ArrowRight size={12} /> {(task as any).executorBranch.name}
                            </span>
                          )}
                          {(task as any).vendor && (
                            <span className="badge-neutral">
                              <Handshake size={12} /> {(task as any).vendor.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {parseJson(task.assignees).map((id: string) => {
                              const emp = employees.find(e => e.id === id);
                              return (
                                <div key={id} title={emp?.fullName} className="w-5 h-5 rounded-full bg-primary-50 border border-white flex items-center justify-center text-xs font-semibold text-primary-700">
                                  {emp?.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>
                              );
                            })}
                            {parseJson(task.assignees).length === 0 && (
                              <span className="t-caption">—</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={12} className="text-slate-400" />
                            <span className="t-caption tabular-nums">{parseJson(task.assignees).length}</span>
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
          <button onClick={openAddColumn} className="min-w-[240px] h-16 border border-dashed border-slate-300 rounded-card flex items-center justify-center gap-2 text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all duration-120 shrink-0">
            <Plus size={18} />
            <span className="text-sm font-medium">Yangi bosqich</span>
          </button>
        )}
      </div>

      {/* PANEL: NEW TASK.
          Forma uzun, shuning uchun o'rtadagi oyna emas — o'ngdan suriladigan
          panel. Tugmalar `footer` slotida: u skroll maydonidan tashqarida,
          ya'ni panel ichi qanchalik aylansa ham ko'rinib turadi. */}
      <Modal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        title="Yangi Buyurtma"
        maxWidth="max-w-2xl"
        variant="drawer"
        footer={
          <div className="w-full space-y-2.5">
            {/* XATO SABABI — tugma yonida va yo'qolmaydi. */}
            {formError && (
              <div className="flex items-start gap-2.5 p-3 rounded-card border border-rose-200 bg-rose-50">
                <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-rose-700 leading-snug">{formError}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
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
                  // Tugma forma tegidan tashqarida — `form` atributi orqali
                  // bog'lanadi, shunda submit avvalgidek ishlaydi.
                  <button
                    type="submit"
                    form={YANGI_BUYURTMA_FORM_ID}
                    disabled={blocked}
                    className="btn-primary flex-[1.5]"
                  >
                    Buyurtma qo'shish
                  </button>
                );
              })()}
            </div>
          </div>
        }
      >
        <form id={YANGI_BUYURTMA_FORM_ID} onSubmit={handleAddTask} className="flex flex-col gap-6">
          {/* BUYURTMA NOMI MAYDONI YO'Q.
              Nom serverda o'zi yasaladi: "<Mijoz> — <xizmat>". Har xizmat
              alohida task bo'lgani uchun har biri o'z nomini oladi. Qo'lda
              yozilganda bu maydonga ko'pincha mijoz nomi tushib qolardi. */}
          {/* Customer Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-card border border-slate-200">
            <div className="md:col-span-2">
              <MijozTanlash
                mijozlar={customers as any}
                qiymat={{
                  customerId: newTaskForm.customerId,
                  customerName: newTaskForm.customerName,
                  customerPhone: newTaskForm.customerPhone,
                  contactId: newTaskForm.contactId,
                  contactName: newTaskForm.contactName,
                  contactPhone: newTaskForm.contactPhone,
                  contactRole: newTaskForm.contactRole,
                }}
                onChange={v => setNewTaskForm(f => ({ ...f, ...v }))}
              />
              {/* Dublikat aniqlash — yangi tashkilotga yozilgan telefon bazadagi
                  mijozga mos kelsa, ikkinchi nusxa yaratish o'rniga o'shani
                  tanlashni taklif qilamiz. */}
              {!newTaskForm.customerId && (() => {
                const digits = (newTaskForm.customerPhone || '').replace(/\D/g, '');
                if (digits.length < 7) return null;
                const dup = customers.find(c => (c.phone || '').replace(/\D/g, '') === digits);
                if (!dup) return null;
                return (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-card px-3 py-2 animate-fade-in">
                    <p className="text-xs font-medium text-amber-800">
                      Bu raqam bazada bor: <span className="font-semibold text-amber-900">{dup.name}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setNewTaskForm(f => ({ ...f, customerId: dup.id, customerName: dup.name, customerPhone: dup.phone || f.customerPhone }))}
                      className="btn-outline h-sm flex-shrink-0"
                    >
                      Tanlash
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Service Items List */}
          <div className="space-y-4">
            <h4 className="t-h3 px-1 flex items-center gap-2">
              <Layers size={16} /> Buyurtma Tarkibi ({newTaskForm.items.length})
            </h4>

            {newTaskForm.items.length > 0 && (
              <div className="space-y-2">
                {newTaskForm.items.map((it: any, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-200 p-3 rounded-card animate-slide-up group">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="t-body-md">{it.title}</span>
                          <span className="badge-primary tabular-nums">x {it.quantity}</span>
                        </div>
                        <p className="t-caption mt-0.5">{it.optionsSummary}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 sm:w-40">
                          <CurrencyInput
                            value={String(it.totalAmount || '')}
                            onChange={(uzs) => updateItemPrice(idx, uzs || 0)}
                            colorClass="text-slate-800"
                            className="input-minimal text-right tabular-nums h-control-sm text-sm"
                          />
                        </div>
                        <button type="button" onClick={() => removeItemFromOrder(idx)} title="Olib tashlash" className="icon-btn-sm hover:text-rose-600 shrink-0">
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
                          className="select-minimal h-control-sm text-xs"
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
                          className={`border border-dashed rounded-card px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-all duration-120 ${
                            dragOverItemIdx === idx
                              ? 'border-primary-400 bg-primary-50'
                              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <Upload size={16} className={`shrink-0 ${dragOverItemIdx === idx ? 'text-[color:var(--primary)]' : 'text-slate-400'}`} />
                          <span className="text-xs font-medium text-slate-500">
                            Shu xizmat uchun rasm / dizayn — <span className="text-[color:var(--primary)] underline">tanlang</span>
                          </span>
                          {(it.attachments || []).length > 0 && (
                            <span className="ml-auto text-xs font-medium text-[color:var(--primary)] shrink-0">
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
                              <span key={fi} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-control pl-2 pr-1 py-0.5 text-xs font-medium text-slate-600 max-w-full">
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
            {/* Sarlavha olib tashlandi: u tugmaga o'xshab ko'rinar, lekin
                bosilmasdi — bitta ish uchun ikkita boshqaruv taassuroti
                berardi. Endi faqat selekt: bosasan, qidirasan, tanlaysan. */}
            <div className="bg-white border border-slate-200 rounded-card p-4 space-y-4">
              <SearchableSelect
                placeholder="Xizmatni tanlang..."
                options={services.map(s => ({ id: s.id, label: s.name, subLabel: `${Number(s.basePrice).toLocaleString()} UZS/${s.unit}`, value: s }))}
                value={currentOrderService.serviceId}
                onChange={(id) => handleServiceChange(id)}
              />

              {currentOrderService.serviceId && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="t-label">
                      Opsiyalar: {selectedServiceOptions.length === 0 && <span className="font-normal text-slate-400">(mavjud emas)</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setNewOptionForm({ name: '', value: '', priceAdd: '' }); setIsNewOptionModalOpen(true); }}
                      className="btn-outline h-sm"
                    >
                      <Plus size={16} /> YANGI OPSIYA
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
                              className={`px-3 py-2 rounded-control text-xs font-medium flex items-center gap-2 border transition-all duration-120 ${active ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                              {active && <CheckCircle2 size={16} />}
                              <span>{opt.name}: {opt.value}</span>
                              <span className="font-semibold text-[color:var(--primary)] tabular-nums">{Number(opt.priceAdd).toLocaleString()} UZS</span>
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
                          <div className="bg-white border border-slate-200 rounded-card p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="label-caps">
                                Variant qatorlari
                              </p>
                              <span className="t-caption tabular-nums">
                                Jami: <strong className="font-semibold text-slate-800">{variantQtySum}</strong> {selSvc?.unit || 'dona'}
                              </span>
                            </div>

                            {/* Ustun sarlavhalari — har qator ustida bir marta */}
                            {(currentOrderService.variants || []).length > 0 && (
                              <div className="flex items-center gap-2 px-0.5">
                                {axes.map((axis) => (
                                  <div key={axis} className="flex-1 min-w-0 label-caps truncate">
                                    {axis}
                                  </div>
                                ))}
                                <div className="w-20 label-caps text-right">
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
                                      className="input-minimal flex-1 min-w-0 h-control-sm px-2.5 text-xs"
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
                                    className="input-minimal w-20 h-control-sm px-2.5 text-xs text-right tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (currentOrderService.variants || []).filter((_, i) => i !== idx);
                                      recalculatePrice({ variants: next });
                                    }}
                                    className="icon-btn-sm hover:text-rose-600"
                                    title="Qatorni o'chirish"
                                  >
                                    <X size={16} />
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
                              className="btn-outline h-sm w-full border-dashed"
                            >
                              <Plus size={16} /> Qator qo'shish
                            </button>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="form-label">
                              Miqdor <span className="text-slate-400 capitalize font-normal">({selSvc?.unit})</span>
                              {hasVariants && variantQtySum > 0 && <span className="ml-1 font-normal text-slate-500">— variantlardan</span>}
                            </label>
                            <input
                              type="number" min="0.1" step="0.1"
                              value={hasVariants && variantQtySum > 0 ? variantQtySum : currentOrderService.quantity}
                              onChange={e => recalculatePrice({ quantity: e.target.value })}
                              disabled={hasVariants && variantQtySum > 0}
                              className="input-minimal text-right tabular-nums disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="form-label">Koeffitsiyent</label>
                            <input
                              type="number" min="0.1" step="0.1"
                              value={currentOrderService.coefficient}
                              onChange={e => recalculatePrice({ coefficient: e.target.value })}
                              className="input-minimal text-right tabular-nums"
                            />
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {priceBreakdown && (
                    <div className="bg-white border border-slate-200 rounded-card p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div>
                        <p className="t-caption mb-0.5">Xizmat summasi</p>
                        <span className="text-lg font-semibold text-slate-900 tabular-nums">{priceBreakdown.total.toLocaleString()} UZS</span>
                      </div>
                      <button
                        type="button"
                        onClick={addItemToOrder}
                        className="btn-outline w-full sm:w-auto"
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
            <div className="md:col-span-2 p-4 bg-white border border-slate-200 rounded-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <p className="label-caps mb-1">Jami narx</p>
                  <span className="t-display">{Number(newTaskForm.totalAmount).toLocaleString()} UZS</span>
                </div>
                <p className="t-caption sm:text-right max-w-xs">
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
                  <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <AlertOctagon className="text-amber-500 mt-0.5 shrink-0" size={18} />
                      <div>
                        <p className="t-h3 text-amber-800">Zakolat kam!</p>
                        <p className="text-xs font-medium text-amber-700 mt-0.5">
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
                      <span className="text-xs font-medium text-amber-700">Men bu holat haqida xabardorman va davom etishga ruxsatim bor</span>
                    </label>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="form-label">To'lov Turi (Zakolat uchun)</label>
              <select value={newTaskForm.paymentTypeId} onChange={(e) => setNewTaskForm({ ...newTaskForm, paymentTypeId: e.target.value })} className="select-minimal">
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
              {/* BAJARUVCHI TANLOVI — faqat tanlaydigan narsa bo'lsa.
                  Ilgari sharti `branches.length > 0` edi, lekin har tenantda
                  kamida bitta (o'z) filiali bor — shuning uchun "Filialga"
                  tugmasi DOIM chiqib turardi va bosilganda yuboradigan
                  filial yo'q edi. Boshqa filialga berish uchun kamida
                  ikkitasi, hamkorga berish uchun esa hamkor bo'lishi kerak.
                  Ikkalasi ham yo'q bo'lsa butun blok ko'rsatilmaydi —
                  bitta "O'zimiz" tugmasi tanlov emas. */}
              {(boshqaFilialBor || vendors.length > 0) && (isAdmin || p.canAssignToOtherBranches) && (
                <div className="mb-3 mt-5 space-y-2 animate-fade-in">
                  <p className="form-label px-1">Bajaruvchi</p>
                  <div className={`grid gap-2 ${bajaruvchiVariantlari.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {bajaruvchiVariantlari.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => { setExecutorType(opt.key as any); setExecutorBranchId(''); }}
                        className={`flex items-center justify-center gap-1.5 h-control rounded-control text-xs font-medium border transition-all duration-120 ${executorType === opt.key
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
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
                      className="select-minimal w-full"
                    >
                      <option value="">— Bajaruvchi filialni tanlang —</option>
                      {branches.filter(b => b.id !== activeBranchId).map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                  {executorType === 'vendor' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={vendorAssign.vendorId}
                        onChange={e => setVendorAssign(v => ({ ...v, vendorId: e.target.value }))}
                        className="select-minimal"
                      >
                        <option value="">— Hamkorni tanlang —</option>
                        {vendors.map((v: any) => (
                          <option key={v.id} value={v.id}>{v.name}{Array.isArray(v.roles) && v.roles.length ? ` (${v.roles.join(', ')})` : ''}</option>
                        ))}
                      </select>
                      <CurrencyInput
                        value={vendorAssign.amount}
                        onChange={v => setVendorAssign(f => ({ ...f, amount: v ? String(v) : '' }))}
                        colorClass="text-slate-700"
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
                  <label className="form-label flex items-center gap-1.5">
                    <Layers size={16} /> Bo'lim <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedDepartmentId}
                    onChange={e => setSelectedDepartmentId(e.target.value)}
                    className={`select-minimal w-full ${!selectedDepartmentId ? 'border-rose-300' : ''}`}
                  >
                    <option value="">— Bo'limni tanlang —</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  {!selectedDepartmentId && (
                    <p className="text-xs font-medium text-rose-600">Buyurtma uchun bo'lim tanlash majburiy</p>
                  )}
                </div>
              )}

              {/* "BUYURTMANI KIM OLDI (KPI)" TANLAGICHI OLIB TASHLANDI.
                  Sotuv KPI'si endi buyurtmani KIRITGAN xodimga yoziladi
                  (server `salesEmployeeId` kelmasa shunday qiladi). */}


              {/* BUYURTMA DARAJASIDAGI MAS'UL TANLAGICH OLIB TASHLANDI.
                  Mas'ul endi HAR XIZMATDA alohida tanlanadi (yuqoridagi
                  xizmatlar ro'yxatida). Ikkalasi turganda bir odam ikki
                  joyda tanlanardi va qaysi biri kuchda ekani noaniq edi. */}
            </div>

            {/* Deadline field */}
            <div className="md:col-span-2">
              <label className="form-label flex items-center gap-1.5">
                <Clock size={16} className="text-slate-400" /> Topshiriq muddati (ixtiyoriy)
              </label>
              <input
                type="datetime-local"
                value={newTaskForm.deadlineAt}
                onChange={e => setNewTaskForm(f => ({ ...f, deadlineAt: e.target.value }))}
                className="input-minimal"
              />
            </div>

            {/* Tugmalar bu yerdan panelning `footer` slotiga ko'chirildi —
                skroll bilan ketmasin, doim ko'rinib tursin. */}
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
            <div className="flex flex-wrap justify-between items-center gap-3 w-full">
              <div className="flex flex-col">
                <p className="label-caps mb-0.5 px-0.5">Qolgan qarz</p>
                <span className="text-sm font-semibold text-rose-700 bg-rose-50 px-3 py-1 rounded-control border border-rose-200 tabular-nums">{formatCurrency(selectedTask.remainingAmount)}</span>
              </div>
              {canMoveTask && (
                <button
                  onClick={() => { setIsDetailModalOpen(false); openMoveModal(selectedTask); }}
                  className="btn-primary h-lg"
                >
                  BOSQICHNI O'ZGARTIRISH <ArrowRight size={18} />
                </button>
              )}
            </div>
          }
        >
          <div className="flex flex-col h-full">
            <Tabs<'details' | 'history' | 'vendors' | 'costing'>
              tabs={[
                { id: 'details', label: 'TAFSILOTLAR' },
                { id: 'history', label: 'TARIXI' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-6"
            />

            {activeTab === 'details' ? (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-card border border-slate-200 group hover:border-slate-300 transition-colors duration-120">
                    <p className="label-caps mb-1">Mijoz</p>
                    <p className="t-body-md">{selectedTask.customerName || "Noma'lum"}</p>
                    <p className="t-caption mt-1.5">{selectedTask.customerPhone || 'Tel kiritilmagan'}</p>
                    {/* Vakil — tashkilotdan kim buyurtma bergani. Tashkilot
                        telefoni bilan vakil telefoni ko'pincha boshqa bo'ladi,
                        shuning uchun ikkalasi ham ko'rsatiladi. */}
                    {(selectedTask as any).customerContact && (
                      <p className="text-xs font-medium text-slate-600 mt-2 pt-2 border-t border-slate-200 flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        {(selectedTask as any).customerContact.name}
                        {(selectedTask as any).customerContact.phone
                          ? <span className="text-slate-400 font-medium">· {(selectedTask as any).customerContact.phone}</span>
                          : null}
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-white rounded-card border border-slate-200">
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <p className="label-caps">Mas'ul Jamoa</p>
                      {canEditTask && (
                        <button onClick={() => { setIsDetailModalOpen(false); openMoveModal(selectedTask); }} className="btn-ghost h-sm">Tahrirlash</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parseJson(selectedTask.assignees).map((id: string) => (
                        <span key={id} className="badge-neutral">{employees.find(e => e.id === id)?.fullName || 'Xodim'}</span>
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
                    <div className="bg-white p-4 rounded-card border border-slate-200">
                      <div className="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                        <h4 className="t-h3 flex items-center gap-2">
                          <Package size={16} /> Variant qatorlari
                        </h4>
                        <span className="t-caption tabular-nums">
                          Jami: {totalSum} {unit}
                        </span>
                      </div>

                      {/* Jadval ko'rinishi: har ustun atribut + soni */}
                      <div className="overflow-x-auto">
                        <table className="table-minimal">
                          <thead>
                            <tr>
                              {allAxes.map((axis) => (
                                <th key={axis}>
                                  {axis}
                                </th>
                              ))}
                              <th className="text-right">
                                Soni
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {variants.map((v, i) => (
                              <tr key={i}>
                                {allAxes.map((axis) => (
                                  <td key={axis}>
                                    {v.atributlar?.[axis] || '—'}
                                  </td>
                                ))}
                                <td className="text-right tabular-nums font-medium text-slate-900">
                                  {v.soni}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={allAxes.length} className="label-caps text-right border-none pt-3">
                                Jami:
                              </td>
                              <td className="text-right tabular-nums font-semibold text-slate-900 border-none pt-3">
                                {totalSum} {unit}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-white p-4 rounded-card border border-slate-200">
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <h4 className="t-h3 flex items-center gap-2"><ClipboardList size={16} /> BATAFSIL IZOH</h4>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadProgress !== null}
                      className="btn-ghost h-sm"
                      title="Rasm (PNG/JPG) yoki dizayn (TIF/CDR)"
                    >
                      {uploadProgress !== null
                        ? <><Clock size={16} className="animate-spin" /> Yuklanmoqda... {uploadProgress}%</>
                        : <><Plus size={16} /> Fayl yuklash (rasm yoki dizayn)</>
                      }
                    </button>
                    <input type="file" hidden ref={fileInputRef} accept={ALLOWED_ATTACHMENT_ACCEPT} onChange={handleFileUpload} />
                  </div>
                  <p className="t-body whitespace-pre-wrap leading-relaxed mb-4">
                    {selectedTask.description
                      ? <LinkliMatn matn={selectedTask.description} />
                      : "Izox kiritilmagan..."}
                  </p>

                  {/* Attached files — endi alohida TaskAttachment row'lardan. parseJson
                      o'rniga to'g'ridan-to'g'ri array ishlatamiz, har re-render'da 30MB
                      JSON parse qilish yo'q. */}
                  {(selectedTask.attachmentRecords?.length ?? 0) > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
                      <p className="t-caption mb-2">Yuklangan fayllar ({selectedTask.attachmentRecords!.length})</p>
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
                              className="aspect-video rounded-card border border-slate-200 overflow-hidden hover:border-slate-300 transition-all duration-180 group relative cursor-zoom-in block"
                              title="Yangi oynada kattalashtirib ochish"
                            >
                              <img src={att.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={att.name} />
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadAttachment(att); }}
                                title="Yuklab olish"
                                className="absolute top-2 right-2 p-2 rounded-control bg-white/90 hover:bg-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-120"
                              >
                                <Download size={16} className="text-slate-700" />
                              </button>
                            </a>
                          ) : (
                            <div key={att.id} className="flex items-center gap-3 p-3 bg-white rounded-card border border-slate-200 hover:border-slate-300 transition-all duration-120 group">
                              <div className="w-9 h-9 rounded-control bg-primary-50 border border-primary-200 flex items-center justify-center shrink-0 text-[color:var(--primary)]">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="t-body-md truncate" title={att.name}>{att.name}</p>
                                <p className="t-caption">{/\.cdr$/i.test(att.name) ? 'CorelDRAW' : /\.tiff?$/i.test(att.name) ? 'TIFF rasm' : 'Fayl'}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => downloadAttachment(att)}
                                title="Yuklab olish"
                                className="icon-btn-sm"
                              >
                                <Download size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-card border border-slate-200">
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <h4 className="t-h3 flex items-center gap-2"><Package size={16} /> XLMASHYO SARFI (TAXMINIY)</h4>
                    <button onClick={() => setIsOverrideModalOpen(true)} className="btn-ghost h-sm">Sarfni tahrirlash</button>
                  </div>
                  {overrides.length === 0 ? (
                    <p className="t-caption">Xomashyo sarfi belgilanmagan</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {overrides.map(ov => (
                        <div key={ov.materialId} className="bg-white p-2.5 rounded-card border border-slate-200 flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-control bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-200 shrink-0">
                            <Package size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="t-caption mb-0.5 line-clamp-1">{ov.name}</p>
                            <p className="t-body-md tabular-nums">{ov.quantity} {ov.unit}</p>
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
                    <div className="bg-white p-4 rounded-card border border-slate-200">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                        <h4 className="t-h3 flex items-center gap-2">
                          <ClipboardList size={16} /> IZOHLAR ({notes.length})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scroll pr-1">
                        {notes.map((h: any, i: number) => (
                          <div key={i} className="bg-white p-3 rounded-card border border-slate-200">
                            <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                              <span className="t-body-md">
                                {h.employee?.fullName || 'Tizim'}
                              </span>
                              <span className="t-caption tabular-nums">
                                {new Date(h.createdAt).toLocaleDateString('uz-UZ')} {new Date(h.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="t-body">"<LinkliMatn matn={h.note} />"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {(canDeleteTask || isAdmin) && (
                  <div className="flex flex-wrap justify-end items-center gap-2 pt-2">
                    {canDeleteTask && (
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'task', id: selectedTask.id, title: selectedTask.title })} className="btn-outline h-sm"><Archive size={16} /> Buyurtmani arxivlash</button>
                    )}
                    {isAdmin && (
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'task-delete', id: selectedTask.id, title: selectedTask.title })} className="btn-danger h-sm"><Trash2 size={16} /> Butunlay o'chirish</button>
                    )}
                  </div>
                )}
              </div>
            ) : activeTab === 'history' ? (
              <div className="space-y-4 animate-fade-in custom-scroll max-h-[50vh]">
                {(!selectedTask.histories || selectedTask.histories.length === 0) ? (
                  <EmptyState icon={ClipboardList} title="Tarixiy ma'lumotlar mavjud emas" />
                ) : (
                  selectedTask.histories.map((h: any, i: number) => (
                    <div key={i} className="flex gap-4 p-4 bg-white rounded-card border border-slate-200 items-start hover:border-slate-300 transition-colors duration-120">
                      <div className="w-10 h-10 rounded-card bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 font-semibold text-slate-500 text-xs">
                        {h.employee?.fullName?.charAt(0) || 'T'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                          <p className="t-body-md">{h.employee?.fullName || 'Tizim'}</p>
                          <p className="t-caption tabular-nums">
                            {new Date(h.createdAt).toLocaleDateString('uz-UZ')} {new Date(h.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <p className="label-caps mb-2">{h.action}</p>
                        <p className="t-caption leading-relaxed">{h.details}</p>
                        {h.note && (
                          <div className="mt-3 p-3 bg-slate-50 rounded-card border border-slate-200">
                            <p className="t-caption">"{h.note}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : activeTab === 'vendors' ? (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-white p-4 rounded-card border border-slate-200 space-y-4">
                  <h4 className="t-h3 flex items-center gap-2 mb-1">
                    <Handshake size={16} className="text-[color:var(--primary)]" /> Hamkorga biriktirish
                  </h4>
                  <div>
                    <label className="form-label">Hamkorni tanlang</label>
                    <select
                      value={vendorCostForm.vendorId}
                      onChange={e => setVendorCostForm(f => ({ ...f, vendorId: e.target.value }))}
                      className="select-minimal"
                    >
                      <option value="">— Biriktirilmagan —</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}{Array.isArray(v.roles) && v.roles.length ? ` (${v.roles.join(', ')})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Xizmat narxi (Hamkorga to'lanadigan summa)</label>
                    <CurrencyInput
                      value={vendorCostForm.amount}
                      onChange={(uzs) => setVendorCostForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
                      colorClass="text-slate-700"
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
                    className="btn-outline w-full"
                  >
                    {isUpdatingVendor ? 'SAQLANMOQDA...' : "SAQLASH"}
                  </button>
                </div>

                {(selectedTask as any).vendor && (
                  <div className="bg-amber-50 p-4 rounded-card border border-amber-200 flex items-start gap-3">
                    <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs font-medium text-amber-800">
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
                    <div className="bg-white border border-slate-200 rounded-card overflow-hidden">
                      {/* Revenue + Cost */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-200 border-b border-slate-200">
                        <div className="p-4">
                          <p className="label-caps mb-1.5">Umumiy Daromad</p>
                          <p className="t-body-md tabular-nums">{revenue.toLocaleString()} UZS</p>
                        </div>
                        <div className="p-4 border-t sm:border-t-0 border-slate-200">
                          <p className="label-caps mb-1.5">Jami Xarajat</p>
                          <p className="t-body-md tabular-nums">{totalCost.toLocaleString()} UZS</p>
                        </div>
                      </div>
                      {/* Net Profit hero */}
                      <div className="p-4 border-b border-slate-200">
                        <p className="label-caps mb-1.5">Sof Foyda</p>
                        <div className="flex flex-wrap items-baseline gap-3">
                          <p className={`t-display ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {netProfit.toLocaleString()} UZS
                          </p>
                          {revenue > 0 && (
                            <span className={netProfit >= 0 ? 'badge-success tabular-nums' : 'badge-danger tabular-nums'}>
                              {netProfit >= 0 ? '+' : ''}{margin.toFixed(1)}% marja
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Unit metrics */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-slate-200">
                        <div className="p-4">
                          <p className="label-caps mb-1.5">1 dona — Tannarx</p>
                          <p className="t-body-md tabular-nums">{unitCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} UZS</p>
                          <p className="t-caption mt-0.5">{qty} dona asosida</p>
                        </div>
                        <div className="p-4 border-t sm:border-t-0 border-slate-200">
                          <p className="label-caps mb-1.5">1 donadan Foyda</p>
                          <p className={`t-body-md tabular-nums ${unitProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {unitProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} UZS
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Add Expense Form ── */}
                <div className="bg-white border border-slate-200 rounded-card p-4 space-y-3">
                  <p className="label-caps">Xarajat Qo'shish</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Xarajat turi (Yo'l kira...)"
                      value={expenseForm.expenseName}
                      onChange={e => setExpenseForm(f => ({ ...f, expenseName: e.target.value }))}
                      className="input-minimal text-xs"
                    />
                    <CurrencyInput
                      value={expenseForm.amount}
                      onChange={(uzs) => setExpenseForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
                      colorClass="text-slate-700"
                      placeholder="Summa"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExpense}
                    disabled={isAddingExpense || !expenseForm.expenseName.trim() || !expenseForm.amount}
                    className="btn-outline w-full"
                  >
                    {isAddingExpense ? 'QOSHILMOQDA...' : "+ XARAJAT QO'SHISH"}
                  </button>
                </div>

                {/* ── Expense List ── */}
                {taskExpenses.length === 0 ? (
                  <div className="py-10 flex items-center justify-center">
                    <p className="t-caption">Hali xarajat qo'shilmagan</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {taskExpenses.map((exp: any) => (
                      <div key={exp.id} className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-card px-4 py-3 hover:border-slate-300 transition-colors duration-120">
                        <div className="min-w-0">
                          <p className="t-body-md truncate">{exp.expenseName}</p>
                          <p className="t-caption tabular-nums mt-0.5">{new Date(exp.createdAt).toLocaleDateString('uz-UZ')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="t-body-md tabular-nums">{Number(exp.amount).toLocaleString()} UZS</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="O'chirish"
                            className="icon-btn-sm hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-3 px-1 border-t border-slate-200 mt-2">
                      <span className="label-caps">Jami xarajat</span>
                      <span className="t-body-md tabular-nums">
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
          <div className="bg-white p-4 rounded-card border border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-card bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0"><Users size={20} /></div>
            <div className="min-w-0">
              <p className="label-caps mb-0.5">Tanlangan task</p>
              <p className="t-body-md truncate">{selectedTask?.title}</p>
            </div>
          </div>

          <div>
            <label className="form-label">Yangi holat (Varonka)</label>
            <select value={moveForm.columnId} onChange={(e) => setMoveForm({ ...moveForm, columnId: e.target.value })} className="select-minimal">
              {columns.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
            </select>
          </div>

          <div className="relative" data-assignee-dropdown>
            <label className="form-label flex justify-between items-center gap-2 border-b border-slate-100 pb-2 mb-3">
              Mas'ul Jamoani Yangilash
              <span className="t-caption tabular-nums">{moveForm.assigneeIds.length} ta tanlandi</span>
            </label>

            <div
              onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
              className="w-full min-h-[50px] p-3 rounded-card bg-white border border-slate-200 flex flex-wrap gap-2 cursor-pointer hover:border-slate-300 transition-all duration-120 mb-2"
            >
              {moveForm.assigneeIds.length === 0 ? (
                <span className="text-sm text-slate-400 flex items-center gap-2 px-1"><UserPlus size={16} /> Mas'ullarni tanlash...</span>
              ) : (
                moveForm.assigneeIds.map(id => {
                  const emp = employees.find(e => e.id === id);
                  return (
                    <span key={id} className="badge-neutral animate-fade-in">
                      {emp?.fullName}
                      <button type="button" onClick={(e) => { e.stopPropagation(); toggleAssigneeForMove(id); }} className="hover:text-rose-600">×</button>
                    </span>
                  )
                })
              )}
            </div>

            {isAssigneeDropdownOpen && (
              <div className="absolute z-dropdown bottom-full left-0 right-0 mb-2 bg-white rounded-overlay border border-slate-200 shadow-lg p-4 animate-slide-up max-h-[250px] flex flex-col">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Qidirish..."
                    value={empSearchTerm}
                    onChange={(e) => setEmpSearchTerm(e.target.value)}
                    className="input-minimal pl-9 text-xs"
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
                          className={`w-full flex items-center justify-between gap-2 p-3 rounded-control transition-all duration-120 ${active ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <div className="text-left min-w-0">
                            <p className="text-xs font-medium truncate">{emp.fullName}</p>
                            <p className="text-xs opacity-60 truncate">{emp.role?.name || 'Xodim'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {busy && <span className="badge-warning">band</span>}
                            {active && <CheckCircle2 size={16} className="text-[color:var(--primary)]" />}
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
            <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
              <label className="form-label mb-0">Rasm yoki dizayn fayl (ixtiyoriy)</label>
              {moveForm.newFiles.length > 0 && (
                <span className="text-xs font-medium text-[color:var(--primary)]">{moveForm.newFiles.length} ta fayl tanlandi</span>
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
              className={`border border-dashed rounded-card px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-all duration-120 ${
                isMoveDragOver
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <Upload size={18} className={`shrink-0 transition-colors ${isMoveDragOver ? 'text-[color:var(--primary)]' : 'text-slate-400'}`} />
              <span className="text-xs font-medium text-slate-500">
                Rasm yoki dizayn faylni tashlang yoki <span className="text-[color:var(--primary)] underline">tanlang</span>
              </span>
            </div>
            <input type="file" hidden multiple accept={ALLOWED_ATTACHMENT_ACCEPT} ref={moveFileInputRef} onChange={handleMoveFileSelect} />

            {moveForm.newFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {moveForm.newFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-card px-3 py-2 border border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-[color:var(--primary)] shrink-0" />
                      <span className="t-body-md truncate">{f.name}</span>
                    </div>
                    <button type="button" onClick={() => setMoveForm(fm => ({ ...fm, newFiles: fm.newFiles.filter((_, j) => j !== i) }))} title="Olib tashlash" className="icon-btn-sm hover:text-rose-600 ml-2 shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2.5 pt-4 border-t border-slate-100 items-center justify-end">
            <button
              type="button"
              disabled={uploadProgress !== null}
              className="btn-outline flex-1"
              onClick={() => setIsMoveTaskModalOpen(false)}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={uploadProgress !== null}
              className="btn-primary flex-[2]"
            >
              {uploadProgress !== null
                ? `Yuklanmoqda... ${uploadProgress}%`
                : "O'zgarishni saqlash"}
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
              className="input-minimal"
              placeholder="Masalan: PECHATDA..."
            />
          </div>

          {/* "Bajarilgan" bosqichi — hisobotlar shu ustundagi buyurtmalarni sanaydi */}
          <button
            type="button"
            onClick={() => setNewColumnIsDone(v => !v)}
            className={`w-full flex items-center gap-3 p-3 rounded-card border text-left transition-all duration-120 ${newColumnIsDone ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <span className={`w-6 h-6 rounded-control flex items-center justify-center shrink-0 transition-colors ${newColumnIsDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-transparent'}`}>
              <CheckCircle2 size={16} />
            </span>
            <span className="min-w-0">
              <span className={`block t-h3 ${newColumnIsDone ? 'text-emerald-700' : 'text-slate-800'}`}>"Bajarilgan" bosqichi</span>
              <span className="block t-caption mt-0.5">Buyurtma shu ustunga yetganda — hisobotlarda "bajarilgan" deb sanaladi.</span>
            </span>
          </button>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-end">
            <button type="button" className="btn-outline flex-1" onClick={() => { setIsNewColumnModalOpen(false); setEditingColumnId(null); }}>Bekor</button>
            <button type="submit" disabled={isSavingColumn} className="btn-primary flex-1">{isSavingColumn ? '...' : (editingColumnId ? 'YANGILASH' : 'YARATISH')}</button>
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
          <div className="bg-rose-50 p-4 rounded-card border border-rose-200 flex items-start gap-3">
            <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="t-h3 text-rose-900">Diqqat!</p>
              <p className="text-xs font-medium text-rose-700 mt-1">
                {confirmModal.type === 'task'
                  ? <>Siz <strong>{confirmModal.title}</strong> buyurtmasini arxivlamoqchisiz. Buyurtma arxivga ko'chiriladi.</>
                  : confirmModal.type === 'task-delete'
                  ? <>Siz <strong>{confirmModal.title}</strong> buyurtmasini <strong>butunlay</strong> o'chirmoqchisiz. Barcha bog'liq yozuvlar (tarix, xarajatlar, fayllar) ham o'chadi. Bu amalni ortga qaytarib bo'lmaydi!</>
                  : <>Siz <strong>{confirmModal.title}</strong> bosqichini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!</>
                }
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-end">
            <button
              type="button"
              className="btn-outline flex-1"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn-danger-solid flex-1"
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
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="animate-spin w-8 h-8 border-2 border-[color:var(--primary)] rounded-full border-t-transparent mb-3" />
              <p className="t-caption">Yuklanmoqda...</p>
            </div>
          ) : arxivTasks.length === 0 ? (
            <EmptyState icon={ArchiveRestore} title="Arxivlangan buyurtmalar yo'q" />
          ) : (() => {
            const totalPages = Math.ceil(arxivTasks.length / ARXIV_PAGE_SIZE);
            const paginated = arxivTasks.slice((arxivPage - 1) * ARXIV_PAGE_SIZE, arxivPage * ARXIV_PAGE_SIZE);
            return (
              <div>
                <div className="flex items-center justify-between gap-2 mb-3 px-1">
                  <p className="t-caption">
                    Jami: <span className="font-semibold text-slate-700 tabular-nums">{arxivTasks.length}</span> ta
                  </p>
                  <p className="t-caption tabular-nums">
                    {arxivPage}/{totalPages} sahifa
                  </p>
                </div>
                <div className="space-y-2 mb-4">
                  {paginated.map((task: any) => (
                    <div key={task.id} className="flex items-start justify-between bg-white p-3.5 rounded-card border border-slate-200 hover:border-slate-300 transition-colors duration-120">
                      <div className="flex-1 pr-3 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {task.orderName && <span className="text-[color:var(--primary)] font-semibold text-xs shrink-0">{task.orderName} —</span>}
                          <span className="t-body-md truncate">{task.title}</span>
                        </div>
                        <p className="t-caption line-clamp-1">{task.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {task.totalAmount > 0 && (
                            <span className="badge-success tabular-nums">{Number(task.totalAmount).toLocaleString()} UZS</span>
                          )}
                          {task.customerName && (
                            <span className="badge-neutral">
                              {task.customerName}
                              {task.customerContact?.name && (
                                <span className="font-medium text-slate-400"> · {task.customerContact.name}</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="t-caption tabular-nums shrink-0 mt-0.5">
                        {task.createdAt ? new Date(task.createdAt).toLocaleDateString('uz-UZ') : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setArxivPage(p => Math.max(1, p - 1))}
                      disabled={arxivPage === 1}
                      className="btn-outline h-sm"
                    >
                      ← OLDINGI
                    </button>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                        <button
                          key={pg}
                          onClick={() => setArxivPage(pg)}
                          className={`w-8 h-8 rounded-control text-xs font-medium tabular-nums transition-all duration-120 border ${pg === arxivPage
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                          {pg}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setArxivPage(p => Math.min(totalPages, p + 1))}
                      disabled={arxivPage === totalPages}
                      className="btn-outline h-sm"
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
          <div className="bg-slate-50 p-3 rounded-card border border-slate-200">
            <p className="label-caps">
              Xizmat: {services.find(s => s.id === currentOrderService.serviceId)?.name || '—'}
            </p>
          </div>
          <div>
            <label className="form-label">Opsiya Nomi *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Masalan: Rangi, O'lchami..."
              value={newOptionForm.name}
              onChange={e => setNewOptionForm(f => ({ ...f, name: e.target.value }))}
              className="input-minimal"
            />
          </div>
          <div>
            <label className="form-label">Qiymat *</label>
            <input
              type="text"
              required
              placeholder="Masalan: Qizil, A4, Laminate..."
              value={newOptionForm.value}
              onChange={e => setNewOptionForm(f => ({ ...f, value: e.target.value }))}
              className="input-minimal"
            />
          </div>
          <div>
            <label className="form-label">Qo'shimcha narx (asosiy narxga qo'shiladi, UZS)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={newOptionForm.priceAdd}
              onChange={e => setNewOptionForm(f => ({ ...f, priceAdd: e.target.value }))}
              className="input-minimal text-right tabular-nums"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button type="button" onClick={() => setIsNewOptionModalOpen(false)} className="btn-outline flex-1">Bekor</button>
            <button
              type="submit"
              disabled={isSavingOption}
              className="btn-primary flex-[2]"
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
          <div className="bg-white p-4 rounded-card border border-slate-200 mb-4">
            <p className="t-h3 mb-1.5 flex items-center gap-2">
              <AlertTriangle size={16} /> Diqqat!
            </p>
            <p className="t-body leading-relaxed">
              Bu yerda kiritgan o'zgarishlaringiz faqat ushbu buyurtma uchun amal qiladi.
              Siz bu yerda bo'yoq yoki qog'oz miqdorini buyurtma dizayniga qarab ko'paytirishingiz yoki kamaytirishingiz mumkin.
            </p>
          </div>

          <div className="space-y-4">
            {overrides.map((ov, idx) => (
              <div key={ov.materialId} className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-card">
                <div className="flex justify-between items-center gap-2 px-1">
                  <p className="t-label truncate">{ov.name}</p>
                  <p className="t-caption shrink-0">{ov.unit}</p>
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
                    className="input-minimal h-control-lg pl-24 text-right tabular-nums"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 label-caps pointer-events-none">Miqdor</div>
                </div>
              </div>
            ))}

            {overrides.length === 0 && (
              <EmptyState icon={Package} title="Bu xizmatga xomashyo biriktirilmagan" />
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-6 border-t border-slate-100">
            <button onClick={() => setIsOverrideModalOpen(false)} className="btn-outline flex-1">Bekor Berish</button>
            <button
              onClick={handleSaveOverrides}
              className="btn-primary flex-[2]"
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
