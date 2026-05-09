import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, UserPlus, CheckCircle2, Clock,
  Wallet, Layers, Trash2, ArrowRight, ClipboardList, AlertCircle,
  Users, AlertTriangle, ExternalLink, Package, Building2,
  Archive, ArchiveRestore, Handshake, AlertOctagon
} from 'lucide-react';
import { tasksApi, taskExpensesApi, employeesApi, paymentTypesApi, customersApi, servicesApi, branchesApi, settingsApi, vendorsApi } from '../api';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import CurrencyInput from '../components/CurrencyInput';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

interface Task {
  id: string;
  orderName?: string;
  title: string;
  description: string;
  columnId: string;
  attachments: string; // JSON string in DB

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
}

const Topshiriqlar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const p = currentUser.permissions || {};

  const [employees, setEmployees] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'task' | 'column', id: string, title: string }>({ isOpen: false, type: 'task', id: '', title: '' });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Sprint 2: Prepayment rule
  const [minPrepaymentPct, setMinPrepaymentPct] = useState(70);
  const [prepaymentWarningAccepted, setPrepaymentWarningAccepted] = useState(false);

  // Sprint 2: Vendor costs per task
  const [vendorCosts, setVendorCosts] = useState<any[]>([]);
  const [vendorCostForm, setVendorCostForm] = useState({ vendorId: '', amount: '', description: '' });
  const [isAddingVendorCost, setIsAddingVendorCost] = useState(false);

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

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [colRes, empRes, ptRes, custRes, taskRes, svcRes, branchRes, vendorRes] = await Promise.all([
        tasksApi.getColumns(),
        employeesApi.findAll(),
        paymentTypesApi.findAll(),
        customersApi.findAll(),
        tasksApi.findAll(activeBranchId).catch(() => ({ data: [] })),
        (p.canViewServices || currentUser.role?.name?.toLowerCase() === 'admin') ? servicesApi.findAll().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        branchesApi.findAll().catch(() => ({ data: [] })),
        (p.canViewVendors || currentUser.role?.name?.toLowerCase() === 'admin') ? vendorsApi.findAll().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setColumns(colRes.data || []);
      const filteredEmployees = (empRes.data || []).filter((emp: any) => {
        const roleName = emp.role?.name?.toLowerCase() || '';
        return emp.login !== 'admin' &&
          roleName !== 'admin' &&
          roleName !== 'superadmin' &&
          roleName !== 'rahbar' &&
          roleName !== 'owner';
      });
      setEmployees(filteredEmployees);
      setPaymentTypes(ptRes.data || []);
      setCustomers(custRes.data || []);
      setTasks(taskRes.data || []);
      setServices(svcRes.data || []);
      setBranches(branchRes.data || []);
      setVendors(vendorRes.data || []);

      // Fetch min prepayment threshold from system settings
      settingsApi.get('MIN_PREPAYMENT_PERCENTAGE')
        .then(r => { if (r.data?.value) setMinPrepaymentPct(Number(r.data.value)); })
        .catch(() => setMinPrepaymentPct(70));
    } catch (err) {
      showStatus('error', "Ma'lumotlarni yuklashda xatolik yuz berdi!");
      console.error("Ma'lumotlarni yuklashda xato:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

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
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'vendors' | 'costing'>('details');

  // Real-time refresh — pause while user has any modal open to avoid clobbering input
  const isAnyModalOpen =
    isNewTaskModalOpen || isDetailModalOpen || isMoveTaskModalOpen ||
    isOverrideModalOpen || isNewColumnModalOpen || isArxivModalOpen ||
    confirmModal.isOpen || isNewOptionModalOpen;
  useAutoRefresh(() => fetchData(true), {
    intervalMs: 12000,
    paused: isAnyModalOpen,
  });

  useEffect(() => {
    if (activeTab === 'vendors' && selectedTask) {
      loadVendorCosts(selectedTask.id);
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
    targetBranchId: ''
  });
  const [currentOrderService, setCurrentOrderService] = useState({
    serviceId: '', selectedOptionIds: [] as string[], quantity: '', coefficient: '', totalAmount: 0
  });
  const [selectedServiceOptions, setSelectedServiceOptions] = useState<any[]>([]);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);
  const [moveForm, setMoveForm] = useState({ columnId: '', assigneeIds: [] as string[], note: '', newFiles: [] as { name: string; url: string }[] });
  const moveFileInputRef = useRef<HTMLInputElement>(null);
  const [empSearchTerm, setEmpSearchTerm] = useState('');
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
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

  const getCardUrgencyClass = (task: Task) => {
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
    if (!draggedTaskId) return;

    try {
      await tasksApi.update(draggedTaskId, { columnId: targetColumnId }, currentUser.id);
      fetchData(true);
    } catch (err) {
      showStatus('error', "Bosqichni o'zgartirishda xatolik!");
      console.error(err);
    } finally {
      setDraggedTaskId(null);
    }
  };

  const openNewTaskModal = (initialColId?: string) => {
    setNewTaskForm({
      orderName: '', title: '', description: '', assigneeIds: [],
      columnId: initialColId || (columns[0]?.id || ''),
      customerId: '', customerName: '', customerPhone: '',
      totalAmount: '', depositAmount: '', paymentTypeId: paymentTypes[0]?.id || '',
      items: [], manualTotal: '', justification: '', deadlineAt: '',
      targetBranchId: activeBranchId || (branches.length > 0 ? branches[0].id : '')
    });
    setCurrentOrderService({ serviceId: '', selectedOptionIds: [], quantity: '', coefficient: '', totalAmount: 0 });
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
    if (svc) recalculatePrice({ serviceId, selectedOptionIds: [] });
  };

  // Narx hisoblash — client-side (API calllarsiz, tez)
  const recalculatePrice = (overrides?: any) => {
    const form = { ...currentOrderService, ...overrides };
    if (!form.serviceId) return;
    const svc = services.find((s: any) => s.id === form.serviceId);
    if (!svc) return;
    const qty = Number(form.quantity) || 1;
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

  const addItemToOrder = () => {
    if (!currentOrderService.serviceId) return;
    const svc = services.find(s => s.id === currentOrderService.serviceId);
    const newItem = {
      ...currentOrderService,
      title: svc?.name || 'Xizmat',
      description: `${svc?.name} (${currentOrderService.quantity} ${svc?.unit || 'dona'})`,
      optionsSummary: selectedServiceOptions.filter(o => currentOrderService.selectedOptionIds.includes(o.id)).map(o => `${o.name}: ${o.value}`).join(', ')
    };

    setNewTaskForm(f => {
      const newItems = [...f.items, newItem];
      const newTotal = newItems.reduce((sum, it) => sum + it.totalAmount, 0);
      return { ...f, items: newItems, totalAmount: String(newTotal) };
    });

    // Reset current item form
    setCurrentOrderService({ serviceId: '', selectedOptionIds: [], quantity: '', coefficient: '', totalAmount: 0 });
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

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskForm.items.length === 0) {
      showStatus('error', "Kamida bitta xizmat qo'shing!");
      return;
    }
    if (newTaskForm.assigneeIds.length === 0) {
      showStatus('error', "Kamida bitta mas'ulni tanlang!");
      return;
    }

    // Check if justification is needed for price override
    const calculatedTotal = Number(newTaskForm.totalAmount);
    const finalTotal = newTaskForm.manualTotal ? Number(newTaskForm.manualTotal) : calculatedTotal;

    if (finalTotal !== calculatedTotal && calculatedTotal !== 0 && !newTaskForm.justification) {
      showStatus('error', "Narx o'zgartirilgan bo'lsa, izoh (sabab) yozish shart!");
      return;
    }

    try {
      // Use createBulk API
      const payload = {
        orderName: newTaskForm.orderName,
        customerId: newTaskForm.customerId,
        customerName: newTaskForm.customerName,
        customerPhone: newTaskForm.customerPhone,
        totalDeposit: Number(newTaskForm.depositAmount) || 0,
        paymentTypeId: newTaskForm.paymentTypeId,
        columnId: newTaskForm.columnId,
        justification: newTaskForm.justification,
        assigneeIds: newTaskForm.assigneeIds,
        deadlineAt: newTaskForm.deadlineAt || null,
        branchId: newTaskForm.targetBranchId || activeBranchId || undefined,
        items: newTaskForm.items.map(it => {
          let adjustedTotal = it.totalAmount;
          if (finalTotal !== calculatedTotal) {
            if (calculatedTotal === 0) {
              adjustedTotal = finalTotal / newTaskForm.items.length;
            } else {
              adjustedTotal = it.totalAmount * (finalTotal / calculatedTotal);
            }
          }
          return {
            ...it,
            totalAmount: adjustedTotal
          };
        })
      };

      await tasksApi.createBulk(payload, currentUser.id);

      setIsNewTaskModalOpen(false);
      showStatus('success', "Buyurtma yaratildi (Guruhli)!");
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const currentAttachments = parseJson(selectedTask.attachments);
        const updatedAttachments = [...currentAttachments, base64String];
        await tasksApi.update(selectedTask.id, { attachments: JSON.stringify(updatedAttachments) }, currentUser.id);
        setSelectedTask({ ...selectedTask, attachments: JSON.stringify(updatedAttachments) });
        showStatus('success', "Rasm yuklandi!");
        fetchData(true);
      } catch (err) {
        showStatus('error', "Yuklashda xato!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Normalizes old (plain base64 string) and new ({name,url} object) attachment formats
  const parseAttachmentItem = (item: any): { name: string; url: string; isImage: boolean } => {
    if (typeof item === 'string') {
      const isImage = item.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item);
      return { name: 'Rasm', url: item, isImage };
    }
    const name = item.name || 'Fayl';
    const url = item.url || '';
    const isImage = url.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
    return { name, url, isImage };
  };

  const handleMoveFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMoveForm(f => ({ ...f, newFiles: [...f.newFiles, { name: file.name, url: reader.result as string }] }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newColumnTitle) {
      try {
        await tasksApi.createColumn({ title: newColumnTitle, orderIdx: columns.length });
        setNewColumnTitle('');
        setIsNewColumnModalOpen(false);
        fetchData(true);
      } catch (err) {
        showStatus('error', "Bosqich qo'shishda xatolik!");
        console.error(err);
      }
    }
  };

  const handleRemoveColumn = async () => {
    if (!confirmModal.id) return;
    try {
      await tasksApi.deleteColumn(confirmModal.id);
      setConfirmModal({ ...confirmModal, isOpen: false });
      showStatus('success', "Bosqich o'chirildi.");
      fetchData(true);
    } catch (err) {
      showStatus('error', "O'chirishda xato!");
    }
  };

  const openDetailModal = async (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
    setActiveTab('details');
    // Load overrides from task if exists, or initialize from some base logic
    // Backend likely stores it in a field we can use. Assuming 'overrides' field.
    try {
      const taskOverrides = (task as any).overrides;
      if (taskOverrides) {
        setOverrides(parseJson(taskOverrides));
      } else {
        setOverrides([]);
      }
      await tasksApi.logView(task.id, currentUser.id);
    } catch (err) {
      console.warn("View log fail", err);
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
      const currentAttachments = parseJson(selectedTask.attachments);
      const updatedAttachments = moveForm.newFiles.length > 0
        ? [...currentAttachments, ...moveForm.newFiles]
        : currentAttachments;

      await tasksApi.update(selectedTask.id, {
        columnId: moveForm.columnId,
        assignees: JSON.stringify(moveForm.assigneeIds),
        historyNote: moveForm.note,
        ...(moveForm.newFiles.length > 0 && { attachments: JSON.stringify(updatedAttachments) }),
      }, currentUser.id);
      setIsMoveTaskModalOpen(false);
      showStatus('success', "Buyurtma ko'chirildi.");
      fetchData(true);
    } catch (err) {
      showStatus('error', "Ko'chirishda xatolik!");
    }
  };

  const toggleAssigneeForNewTask = (id: string) => {
    setNewTaskForm(prev => {
      const ids = [...prev.assigneeIds];
      if (ids.includes(id)) {
        return { ...prev, assigneeIds: ids.filter(x => x !== id) };
      } else {
        return { ...prev, assigneeIds: [...ids, id] };
      }
    });
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

  const loadVendorCosts = async (taskId: string) => {
    try {
      const res = await vendorsApi.getOrderCosts(taskId);
      setVendorCosts(res.data || []);
    } catch {
      setVendorCosts([]);
    }
  };

  const handleAddVendorCost = async () => {
    if (!selectedTask || !vendorCostForm.vendorId || !vendorCostForm.amount) return;
    setIsAddingVendorCost(true);
    try {
      await vendorsApi.addOrderCost(selectedTask.id, {
        vendorId: vendorCostForm.vendorId,
        amount: Number(vendorCostForm.amount),
        description: vendorCostForm.description,
      });
      setVendorCostForm({ vendorId: '', amount: '', description: '' });
      await loadVendorCosts(selectedTask.id);
      showStatus('success', "Hamkor xarajati qo'shildi!");
    } catch {
      showStatus('error', "Xarajat qo'shishda xato!");
    } finally {
      setIsAddingVendorCost(false);
    }
  };

  const handleRemoveVendorCost = async (costId: string) => {
    if (!selectedTask) return;
    try {
      await vendorsApi.removeOrderCost(costId);
      await loadVendorCosts(selectedTask.id);
      showStatus('success', "Xarajat o'chirildi.");
    } catch {
      showStatus('error', "O'chirishda xato!");
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
    setIsSavingOption(true);
    try {
      await servicesApi.addOption(currentOrderService.serviceId, {
        name: newOptionForm.name,
        value: newOptionForm.value,
        priceAdd: Number(newOptionForm.priceAdd) || 0,
      });
      const svcRes = await servicesApi.findAll();
      setServices(svcRes.data || []);
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

  // Client-side search: filter by displayId, title, orderName, or customerName
  const filteredTasks = searchTerm.trim()
    ? tasks.filter(t => {
        const q = searchTerm.toLowerCase();
        return (
          t.displayId?.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.orderName?.toLowerCase().includes(q) ||
          t.customerName?.toLowerCase().includes(q)
        );
      })
    : tasks;

  return (
    <div className="space-y-4 sm:space-y-6 flex flex-col h-full animate-fade-in">

      {/* Global Status Notification */}
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[200] p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="font-bold text-sm tracking-tight">{statusMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 z-10 mx-1 sm:mx-0">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2 px-1">Xizmatlar & Kanban</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 px-1 font-sans">Ish jarayonini boshqarish</p>
        </div>

        {/* Search input */}
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ID, nomi yoki mijoz..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400 focus:bg-white transition-all placeholder:text-slate-300"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors text-xs font-black"
            >✕</button>
          )}
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          <button onClick={openArxivModal} className="border-2 border-slate-200 h-9 px-3 text-[10px] font-black uppercase text-slate-500 rounded-xl hover:border-violet-400 hover:text-violet-500 transition-all flex items-center gap-1.5 whitespace-nowrap">
            <Archive size={12} /> ARXIV
          </button>
          {p.canManageColumns && (
            <button onClick={() => setIsNewColumnModalOpen(true)} className="border-2 border-dashed border-slate-200 h-9 px-3 text-[10px] font-black uppercase text-slate-500 rounded-xl hover:border-orange-400 hover:text-orange-500 transition-all whitespace-nowrap">
              + BOSQICH
            </button>
          )}
          <button onClick={() => openNewTaskModal()} className="flex items-center gap-1.5 h-9 px-4 bg-[#FF6B00] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-[#E65A00] transition-all whitespace-nowrap">
            <Plus size={13} strokeWidth={3} /> BUYURTMA
          </button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 flex gap-4 sm:gap-6 overflow-x-auto pb-8 items-start snap-x custom-scroll px-1 sm:px-0" style={{ minHeight: '65vh' }}>
        {isLoading ? (
          <div className="w-full flex items-center justify-center" style={{ minHeight: '60vh' }}>
            <LoadingSpinner size="lg" />
          </div>
        ) : columns.length === 0 ? (
          <div className="w-full h-96 flex flex-col items-center justify-center text-slate-400/50">
            <ClipboardList size={48} className="mb-4" />
            <p className="font-black uppercase tracking-widest text-xs italic">Bosqichlar mavjud emas</p>
          </div>
        ) : (
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
                <div className="flex justify-between items-center px-3 mb-3 mt-1 group">
                  <div className="flex items-center gap-1.5 flex-1 pr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                    <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest truncate">{col.title}</h3>
                    <span className="bg-white text-slate-500 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-slate-200/50 shadow-sm">{colTasks.length}</span>
                  </div>
                  {p.canManageColumns && (
                    <button onClick={() => setConfirmModal({ isOpen: true, type: 'column', id: col.id, title: col.title })} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                  )}
                </div>

                {/* Column Tasks Scrollable Area */}
                <div className="flex flex-col gap-3 sm:gap-4 flex-1 overflow-y-auto px-1 pb-4 custom-scroll max-h-[70vh]">
                  {colTasks.map(task => {
                    const isMyTask = myId ? parseJson(task.assignees).includes(myId) : false;
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => onTaskDragStart(e, task.id)}
                        onDragEnd={() => { setDraggedTaskId(null); setDragOverColId(null); }}
                        onClick={() => openDetailModal(task)}
                        className={`p-3.5 rounded-xl shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-300 group animate-fade-in flex flex-col ${draggedTaskId === task.id
                            ? 'opacity-40 scale-95 ring-2 ring-orange-500 shadow-xl border-orange-500 bg-white'
                            : isMyTask
                              ? 'bg-sky-50/60 border-sky-300 ring-1 ring-sky-200 hover:border-sky-400 hover:shadow-sky-500/10'
                              : `bg-white ${getCardUrgencyClass(task)} hover:shadow-orange-500/10`
                          }`}
                      >
                        {/* displayId badge + "my task" badge row — always shown */}
                        <div className="flex items-center gap-1.5 mb-2 -mt-0.5 flex-wrap">
                          {task.displayId ? (
                            <span className="text-[8px] font-black font-mono bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-md tracking-widest uppercase">
                              {task.displayId}
                            </span>
                          ) : (
                            <span className="text-[8px] font-black font-mono bg-slate-50 text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md tracking-widest">
                              #{task.id.slice(-6).toUpperCase()}
                            </span>
                          )}
                          {isMyTask && (
                            <span className="text-[8px] font-black bg-sky-500 text-white px-2 py-0.5 rounded-md uppercase tracking-widest flex items-center gap-1">
                              <Users size={7} /> Mening taskım
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-slate-800 text-xs mb-1.5 leading-snug group-hover:text-orange-700 transition-colors uppercase tracking-tight line-clamp-2">
                          {task.orderName && <span className="text-orange-600">{task.orderName} — </span>}
                          {task.title}
                        </h4>
                        <p className="text-[10px] font-medium text-slate-500 mb-3 line-clamp-2 leading-normal italic">{task.description}</p>

                        {/* Deadline / Age badges */}
                        {(() => {
                          const now = new Date();
                          const created = task.createdAt ? new Date(task.createdAt) : null;
                          const deadline = task.deadlineAt ? new Date(task.deadlineAt) : null;
                          const ageHours = created ? (now.getTime() - created.getTime()) / 3600000 : 0;
                          const isPastDeadline = deadline && now > deadline;
                          const isDeadlineSoon = deadline && !isPastDeadline && (deadline.getTime() - now.getTime()) < 86400000;
                          const isOld = !deadline && ageHours > 10;
                          return (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {isPastDeadline && (
                                <span className="text-[8px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200 uppercase flex items-center gap-1 animate-pulse">
                                  <AlertTriangle size={8} /> MUDDAT O'TDI
                                </span>
                              )}
                              {isDeadlineSoon && (
                                <span className="text-[8px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-md border border-orange-200 uppercase flex items-center gap-1">
                                  <Clock size={8} /> {deadline!.toLocaleDateString('uz-UZ')} {deadline!.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {!isPastDeadline && !isDeadlineSoon && deadline && (
                                <span className="text-[8px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md border border-amber-100 uppercase flex items-center gap-1">
                                  <Clock size={8} /> {deadline.toLocaleDateString('uz-UZ')} {deadline.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {isOld && (
                                <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200 uppercase flex items-center gap-1 animate-pulse">
                                  <AlertTriangle size={8} /> {Math.floor(ageHours)}S KUTMOQDA
                                </span>
                              )}
                              {!activeBranchId && task.branchId && (() => {
                                const br = branches.find((b: any) => b.id === task.branchId);
                                return br ? (
                                  <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-200 uppercase flex items-center gap-1">
                                    <Building2 size={8} /> {br.name}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          );
                        })()}

                        <div className="flex flex-wrap gap-1 mb-3">
                          {task.totalAmount > 0 && (
                            <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md border border-emerald-100 uppercase tracking-tighter flex items-center gap-1">
                              <Wallet size={9} /> {new Intl.NumberFormat('uz-UZ').format(task.totalAmount)}
                            </span>
                          )}
                          {task.remainingAmount > 0 && (
                            <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-2 py-1 rounded-md border border-rose-100 uppercase tracking-tighter flex items-center gap-1">
                              <AlertCircle size={9} /> {new Intl.NumberFormat('uz-UZ').format(task.remainingAmount)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-50 mt-auto">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {parseJson(task.assignees).map((id: string) => {
                              const emp = employees.find(e => e.id === id);
                              return (
                                <div key={id} title={emp?.fullName} className="w-5 h-5 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[9px] font-black text-orange-500 shadow-sm">
                                  {emp?.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>
                              );
                            })}
                            {parseJson(task.assignees).length === 0 && (
                              <span className="text-[9px] font-bold text-slate-300 italic">—</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            <Users size={10} className="text-slate-300" />
                            <span className="text-[9px] font-black text-slate-400">{parseJson(task.assignees).length}</span>
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
          <button onClick={() => setIsNewColumnModalOpen(true)} className="min-w-[280px] h-20 border-2 border-dashed border-slate-200 rounded-2xl sm:rounded-3xl flex items-center justify-center gap-3 text-slate-400 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50/30 transition-all group shrink-0">
            <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-black text-[11px] uppercase tracking-widest">Yangi Bosqich</span>
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
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Buyurtma Nomi (Masalan: Mega Meva)</label>
              <input
                type="text"
                placeholder="Buyurtma nomini kiriting..."
                value={newTaskForm.orderName}
                onChange={e => setNewTaskForm(f => ({ ...f, orderName: e.target.value }))}
                className="input-minimal font-black text-slate-700 h-12 border-2"
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
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
                  <input type="text" placeholder="Yangi mijoz ismi..." value={newTaskForm.customerName} onChange={e => setNewTaskForm(f => ({ ...f, customerName: e.target.value }))} className="input-minimal bg-white border-2" />
                  <input type="text" placeholder="Telefon raqami..." value={newTaskForm.customerPhone} onChange={e => setNewTaskForm(f => ({ ...f, customerPhone: e.target.value }))} className="input-minimal bg-white border-2" />
                </div>
              )}
            </div>
          </div>

          {/* Service Items List */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <Layers size={13} /> Buyurtma Tarkibi ({newTaskForm.items.length})
            </h4>

            {newTaskForm.items.length > 0 && (
              <div className="space-y-2">
                {newTaskForm.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white border-2 border-slate-100 p-3 rounded-2xl animate-slide-up group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{it.title}</span>
                        <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded uppercase">x {it.quantity}</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 italic">{it.optionsSummary}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-slate-800">{it.totalAmount.toLocaleString()} UZS</span>
                      <button type="button" onClick={() => removeItemFromOrder(idx)} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Item Form */}
            <div className="bg-orange-50/50 border border-orange-100 rounded-3xl p-5 space-y-4">
              <h4 className="text-[9px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-2 mb-2">
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
                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">
                      Opsiyalar: {selectedServiceOptions.length === 0 && <span className="text-slate-300 font-bold normal-case">(mavjud emas)</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setNewOptionForm({ name: '', value: '', priceAdd: '' }); setIsNewOptionModalOpen(true); }}
                      className="text-[8px] font-black bg-orange-100 text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-200 transition-all flex items-center gap-1"
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
                              className={`px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 border-2 transition-all ${active ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-500/20' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                                }`}
                            >
                              {active && <CheckCircle2 size={12} />}
                              <span>{opt.name}: {opt.value}</span>
                              <span className={`font-black ${active ? 'text-orange-200' : 'text-orange-500'}`}>{Number(opt.priceAdd).toLocaleString()} UZS</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1.5">Miqdor <span className="text-slate-400 capitalize font-medium">({services.find(s => s.id === currentOrderService.serviceId)?.unit})</span></label>
                      <input
                        type="number" min="0.1" step="0.1"
                        value={currentOrderService.quantity}
                        onChange={e => recalculatePrice({ quantity: e.target.value })}
                        className="input-minimal font-black text-orange-700 h-11 bg-white border-2 border-orange-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1.5">Koeffitsiyent</label>
                      <input
                        type="number" min="0.1" step="0.1"
                        value={currentOrderService.coefficient}
                        onChange={e => recalculatePrice({ coefficient: e.target.value })}
                        className="input-minimal font-black text-orange-700 h-11 bg-white border-2 border-orange-100"
                      />
                    </div>
                  </div>

                  {priceBreakdown && (
                    <div className="bg-white border-2 border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Xizmat summasi</p>
                        <span className="text-lg font-black text-orange-700">{priceBreakdown.total.toLocaleString()} UZS</span>
                      </div>
                      <button
                        type="button"
                        onClick={addItemToOrder}
                        className="w-full sm:w-auto h-11 px-6 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
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
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Hisoblangan jami narx</p>
                  <span className="text-2xl font-black text-slate-800">{Number(newTaskForm.totalAmount).toLocaleString()} UZS</span>
                </div>
                <div className="w-full sm:w-64">
                  <label className="block text-[10px] font-black text-emerald-600 uppercase mb-2">Manual o'zgartirish</label>
                  <CurrencyInput
                    value={newTaskForm.manualTotal}
                    onChange={(uzs) => setNewTaskForm(f => ({ ...f, manualTotal: uzs ? String(uzs) : "" }))}
                    colorClass="text-emerald-600"
                    className="input-minimal font-black border-2 border-emerald-100 bg-white"
                  />
                </div>
              </div>

              {newTaskForm.manualTotal && Number(newTaskForm.manualTotal) !== Number(newTaskForm.totalAmount) && Number(newTaskForm.totalAmount) !== 0 && (
                <div className="animate-fade-in space-y-2">
                  <label className="block text-[10px] font-black text-rose-500 uppercase px-1">Narx o'zgargani uchun izoh (sabab) yozing *</label>
                  <textarea
                    required
                    value={newTaskForm.justification}
                    onChange={e => setNewTaskForm(f => ({ ...f, justification: e.target.value }))}
                    className="input-minimal min-h-[60px] border-2 border-rose-100 bg-white"
                    placeholder="Chegirma qilindi / Mijoz bilan kelishilgan..."
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Sizga berilgan zakolat</label>
              <CurrencyInput
                value={newTaskForm.depositAmount}
                onChange={(uzs) => setNewTaskForm(f => ({ ...f, depositAmount: String(uzs) }))}
                colorClass="text-sky-600"
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
                        <p className="text-xs font-black text-amber-800 uppercase tracking-tight">Zakolat kam!</p>
                        <p className="text-[11px] font-bold text-amber-700 mt-0.5">
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
                      <span className="text-[11px] font-black text-amber-700 uppercase">Men bu holat haqida xabardorman va davom etishga ruxsatim bor</span>
                    </label>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">To'lov Turi (Zakolat uchun)</label>
              <select value={newTaskForm.paymentTypeId} onChange={(e) => setNewTaskForm({ ...newTaskForm, paymentTypeId: e.target.value })} className="select-minimal h-12 font-black">
                <option value="">Tanlang...</option>
                {paymentTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1 px-1 flex justify-between">
                Mas'ul Jamoani Tanlang
                <span className="text-sky-500">{newTaskForm.assigneeIds.length} ta tanlandi</span>
              </label>

              {(currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin' || p.canAssignToOtherBranches) && (
                <div className="mb-3">
                  <select
                    value={newTaskForm.targetBranchId}
                    onChange={(e) => setNewTaskForm(f => ({ ...f, targetBranchId: e.target.value, assigneeIds: [] }))}
                    className="select-minimal h-10 font-black text-orange-600 border-orange-200"
                  >
                    <option value="">Barcha filiallar / Filialsiz</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div className="relative">
                <div
                  onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                  className="w-full min-h-[50px] p-3 rounded-2xl bg-slate-50 border-2 border-slate-100 flex flex-wrap gap-2 cursor-pointer hover:border-p-sky-300 transition-all mb-2"
                >
                  {newTaskForm.assigneeIds.length === 0 ? (
                    <span className="text-sm font-bold text-slate-400 flex items-center gap-2 px-1"><UserPlus size={16} /> Mas'ullarni tanlash...</span>
                  ) : (
                    newTaskForm.assigneeIds.map(id => {
                      const emp = employees.find(e => e.id === id);
                      return (
                        <span key={id} className="bg-white px-3 py-1 rounded-xl border border-sky-100 text-[10px] font-black text-sky-700 shadow-sm flex items-center gap-1.5 animate-fade-in">
                          {emp?.fullName}
                          <button type="button" onClick={(e) => { e.stopPropagation(); toggleAssigneeForNewTask(id); }} className="hover:text-rose-500">×</button>
                        </span>
                      )
                    })
                  )}
                </div>

                {isAssigneeDropdownOpen && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 animate-slide-up max-h-[300px] flex flex-col">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Qidirish..."
                        value={empSearchTerm}
                        onChange={(e) => setEmpSearchTerm(e.target.value)}
                        className="w-full pl-9 h-10 text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-sky-500 transition-all"
                      />
                    </div>
                    <div className="overflow-y-auto custom-scroll space-y-1">
                      {employees
                        .filter(e => e.fullName.toLowerCase().includes(empSearchTerm.toLowerCase()))
                        .filter(e => !newTaskForm.targetBranchId || e.branchId === newTaskForm.targetBranchId)
                        .map(emp => {
                          const active = newTaskForm.assigneeIds.includes(emp.id);
                          const busy = isEmployeeBusy(emp.id);
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => toggleAssigneeForNewTask(emp.id)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${active ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-50 text-slate-600'}`}
                            >
                              <div className="text-left">
                                <p className="text-xs font-black uppercase tracking-tight">{emp.fullName}</p>
                                <p className="text-[10px] font-bold opacity-60">{emp.role?.name || 'Xodim'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {busy && <span className="text-[8px] font-black bg-amber-100/50 text-amber-600 px-2 py-0.5 rounded border border-amber-200 uppercase">band</span>}
                                {active && <CheckCircle2 size={16} className="text-sky-500" />}
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-6 border-t border-slate-100 space-y-4">
            {/* Deadline field */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                <Clock size={11} className="text-amber-500" /> Topshiriq muddati (ixtiyoriy)
              </label>
              <input
                type="datetime-local"
                value={newTaskForm.deadlineAt}
                onChange={e => setNewTaskForm(f => ({ ...f, deadlineAt: e.target.value }))}
                className="input-minimal font-black text-amber-700 border-2 border-amber-100 bg-amber-50/30 h-12"
              />
            </div>
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-outline h-12 flex-1 rounded-2xl uppercase tracking-widest font-black text-[10px]"
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
                    className={`h-12 flex-[2] rounded-2xl uppercase tracking-widest font-black shadow-xl active:scale-95 transition-all text-[10px] ${blocked ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-orange-600 text-white shadow-orange-500/20'}`}
                  >
                    Buyurtma Qo'shish
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
                <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5 px-0.5">Qolgan qarz</p>
                <span className="text-sm font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-xl border border-rose-100">{formatCurrency(selectedTask.remainingAmount)}</span>
              </div>
              <button
                onClick={() => { setIsDetailModalOpen(false); openMoveModal(selectedTask); }}
                className="btn-primary flex items-center gap-3 h-14 px-8 sm:px-12 text-[10px] sm:text-[12px] font-black uppercase tracking-widest bg-gradient-to-r from-orange-500 to-orange-700 border-none shadow-xl shadow-orange-500/20 active:scale-95"
              >
                BOSQICHNI O'ZGARTIRISH <ArrowRight size={18} />
              </button>
            </div>
          }
        >
          <div className="flex flex-col h-full">
            <div className="flex bg-slate-100/50 p-1 rounded-2xl mb-6">
              <button onClick={() => setActiveTab('details')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'details' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>TAFSILOTLAR</button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}>TARIXI</button>
            </div>

            {activeTab === 'details' ? (
              <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-sky-200 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mijoz</p>
                    <p className="font-black text-slate-800 text-sm">{selectedTask.customerName || "Noma'lum"}</p>
                    <p className="text-[11px] font-bold text-sky-500 mt-1.5">{selectedTask.customerPhone || 'Tel kiritilmagan'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mas'ul Jamoa</p>
                      <button onClick={() => { setIsDetailModalOpen(false); openMoveModal(selectedTask); }} className="text-[10px] font-black text-sky-600 hover:text-sky-700 transition-colors uppercase">Tahrirlash</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parseJson(selectedTask.assignees).map((id: string) => (
                        <span key={id} className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-600 shadow-sm">{employees.find(e => e.id === id)?.fullName || 'Xodim'}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14} /> BATAFSIL IZOH</h4>
                    <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-sky-500 uppercase hover:text-sky-700 transition-colors flex items-center gap-1">
                      <Plus size={11} /> Fayl yuklash
                    </button>
                    <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed mb-4">{selectedTask.description || "Izox kiritilmagan..."}</p>

                  {/* Attached files */}
                  {parseJson(selectedTask.attachments).length > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Yuklangan fayllar ({parseJson(selectedTask.attachments).length})</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {parseJson(selectedTask.attachments).map((raw: any, i: number) => {
                          const att = parseAttachmentItem(raw);
                          return att.isImage ? (
                            <a key={i} href={att.url} target="_blank" rel="noreferrer" download={att.name}
                              className="aspect-video rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-sky-300 transition-all group relative">
                              <img src={att.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={att.name} />
                              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <ExternalLink size={16} className="text-white" />
                              </div>
                            </a>
                          ) : (
                            <a key={i} href={att.url} download={att.name}
                              className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-orange-300 hover:shadow-sm transition-all group">
                              <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black text-slate-700 truncate">{att.name}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase">Yuklab olish</p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 font-sans"><Package size={14} /> XLMASHYO SARFI (TAXMINIY)</h4>
                    <button onClick={() => setIsOverrideModalOpen(true)} className="text-[10px] font-black text-violet-600 hover:text-violet-700 transition-colors uppercase">Sarfni tahrirlash</button>
                  </div>
                  {overrides.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-300 italic">Xomashyo sarfi belgilanmagan</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {overrides.map(ov => (
                        <div key={ov.materialId} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-500 flex items-center justify-center border border-violet-100">
                            <Package size={14} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 line-clamp-1">{ov.name}</p>
                            <p className="text-xs font-black text-slate-800">{ov.quantity} {ov.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'task', id: selectedTask.id, title: selectedTask.title })} className="text-[10px] font-black text-amber-400 hover:text-amber-600 transition-colors flex items-center gap-2 uppercase tracking-widest"><Archive size={14} /> Buyurtmani arxivlash</button>
                </div>
              </div>
            ) : activeTab === 'history' ? (
              <div className="space-y-4 animate-fade-in custom-scroll max-h-[50vh]">
                {(!selectedTask.histories || selectedTask.histories.length === 0) ? (
                  <div className="py-20 flex flex-col items-center justify-center opacity-20">
                    <ClipboardList size={40} className="mb-4" />
                    <p className="font-black uppercase text-xs">Tarixiy ma'lumotlar mavjud emas</p>
                  </div>
                ) : (
                  selectedTask.histories.map((h: any, i: number) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 items-start hover:bg-white hover:shadow-sm transition-all">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm font-black text-slate-400 text-xs">
                        {h.employee?.fullName?.charAt(0) || 'T'}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{h.employee?.fullName || 'Tizim'}</p>
                          <p className="text-[9px] font-black text-slate-300">
                            {new Date(h.createdAt).toLocaleDateString('uz-UZ')} {new Date(h.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <p className="text-[9px] font-black text-sky-500 mb-2 uppercase tracking-widest">{h.action}</p>
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
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                    <Handshake size={13} /> Hamkor xarajati qo'shish
                  </h4>
                  <select
                    value={vendorCostForm.vendorId}
                    onChange={e => setVendorCostForm(f => ({ ...f, vendorId: e.target.value }))}
                    className="select-minimal font-black text-slate-700"
                  >
                    <option value="">Hamkorni tanlang...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}{v.specialty ? ` (${v.specialty})` : ''}</option>
                    ))}
                  </select>
                  <div className="space-y-2">
                    <CurrencyInput
                      value={vendorCostForm.amount}
                      onChange={(uzs) => setVendorCostForm(f => ({ ...f, amount: uzs ? String(uzs) : '' }))}
                      colorClass="text-emerald-600"
                      placeholder="Summa"
                    />
                    <input
                      type="text"
                      placeholder="Izoh (ixtiyoriy)"
                      value={vendorCostForm.description}
                      onChange={e => setVendorCostForm(f => ({ ...f, description: e.target.value }))}
                      className="input-minimal"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVendorCost}
                    disabled={isAddingVendorCost || !vendorCostForm.vendorId || !vendorCostForm.amount}
                    className="w-full h-10 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {isAddingVendorCost ? 'QOSHILMOQDA...' : "QO'SHISH"}
                  </button>
                </div>

                {vendorCosts.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center opacity-20">
                    <Handshake size={36} className="mb-3" />
                    <p className="text-[10px] font-black uppercase">Hamkor xarajati yo'q</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      Jami: {formatCurrency(vendorCosts.reduce((s: number, c: any) => s + c.amount, 0))}
                    </p>
                    {vendorCosts.map((cost: any) => (
                      <div key={cost.id} className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100">
                            <Handshake size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase">{cost.vendor?.name || 'Hamkor'}</p>
                            {cost.description && <p className="text-[10px] font-bold text-slate-400 italic">{cost.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-emerald-600">{Number(cost.amount).toLocaleString()} UZS</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVendorCost(cost.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
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
                          <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Umumiy Daromad</p>
                          <p className="text-sm font-black text-stone-800 font-mono">{revenue.toLocaleString()} UZS</p>
                        </div>
                        <div className="p-4">
                          <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Jami Xarajat</p>
                          <p className="text-sm font-black text-stone-700 font-mono">{totalCost.toLocaleString()} UZS</p>
                        </div>
                      </div>
                      {/* Net Profit hero */}
                      <div className="p-4 border-b border-stone-200">
                        <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1.5">Sof Foyda</p>
                        <div className="flex items-baseline gap-3">
                          <p className={`text-2xl font-black font-mono tracking-tight ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {netProfit.toLocaleString()} UZS
                          </p>
                          {revenue > 0 && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-500 border border-rose-200'}`}>
                              {netProfit >= 0 ? '+' : ''}{margin.toFixed(1)}% marja
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Unit metrics */}
                      <div className="grid grid-cols-2 divide-x divide-stone-200">
                        <div className="p-4">
                          <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1.5">1 dona — Tannarx</p>
                          <p className="text-[13px] font-black text-stone-700 font-mono">{unitCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} UZS</p>
                          <p className="text-[8px] text-stone-400 font-bold mt-0.5">{qty} dona asosida</p>
                        </div>
                        <div className="p-4">
                          <p className="text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1.5">1 donadan Foyda</p>
                          <p className={`text-[13px] font-black font-mono ${unitProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {unitProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} UZS
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Add Expense Form ── */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
                  <p className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Xarajat Qo'shish</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Xarajat turi (Yo'l kira...)"
                      value={expenseForm.expenseName}
                      onChange={e => setExpenseForm(f => ({ ...f, expenseName: e.target.value }))}
                      className="input-minimal bg-white border border-stone-200 text-[11px] h-10 rounded-xl px-3 focus:border-stone-400 focus:outline-none"
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
                    className="w-full h-10 bg-stone-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-900 transition-all active:scale-95"
                  >
                    {isAddingExpense ? 'QOSHILMOQDA...' : "+ XARAJAT QO'SHISH"}
                  </button>
                </div>

                {/* ── Expense List ── */}
                {taskExpenses.length === 0 ? (
                  <div className="py-10 flex items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-stone-300 tracking-widest">Hali xarajat qo'shilmagan</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {taskExpenses.map((exp: any) => (
                      <div key={exp.id} className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-4 py-3 hover:border-stone-300 transition-colors">
                        <div>
                          <p className="text-[11px] font-black text-stone-800 uppercase tracking-tight">{exp.expenseName}</p>
                          <p className="text-[9px] text-stone-400 font-bold mt-0.5">{new Date(exp.createdAt).toLocaleDateString('uz-UZ')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-black text-stone-700 font-mono">{Number(exp.amount).toLocaleString()} UZS</span>
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
                      <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">Jami xarajat</span>
                      <span className="text-sm font-black text-stone-800 font-mono">
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
          <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-sky-500 shadow-sm shadow-sky-500/10"><Users size={20} /></div>
            <div>
              <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest mb-0.5">Tanlangan task</p>
              <p className="text-sm font-black text-sky-900 truncate max-w-[200px]">{selectedTask?.title}</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Yangi holat (Varonka)</label>
            <select value={moveForm.columnId} onChange={(e) => setMoveForm({ ...moveForm, columnId: e.target.value })} className="select-minimal font-black text-orange-600">
              {columns.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 px-1 border-b border-slate-100 pb-2 flex justify-between">
              Mas'ul Jamoani Yangilash
              <span className="text-sky-500">{moveForm.assigneeIds.length} ta tanlandi</span>
            </label>

            <div
              onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
              className="w-full min-h-[50px] p-3 rounded-2xl bg-slate-50 border-2 border-slate-100 flex flex-wrap gap-2 cursor-pointer hover:border-sky-300 transition-all mb-2"
            >
              {moveForm.assigneeIds.length === 0 ? (
                <span className="text-sm font-bold text-slate-400 flex items-center gap-2 px-1"><UserPlus size={16} /> Mas'ullarni tanlash...</span>
              ) : (
                moveForm.assigneeIds.map(id => {
                  const emp = employees.find(e => e.id === id);
                  return (
                    <span key={id} className="bg-white px-3 py-1 rounded-xl border border-sky-100 text-[10px] font-black text-sky-700 shadow-sm flex items-center gap-1.5 animate-fade-in">
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
                    className="w-full pl-9 h-10 text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-sky-500 transition-all"
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
                          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${active ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-tight">{emp.fullName}</p>
                            <p className="text-[10px] font-bold opacity-60">{emp.role?.name || 'Xodim'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {busy && <span className="text-[8px] font-black bg-amber-100/50 text-amber-600 px-2 py-0.5 rounded border border-amber-200 uppercase">band</span>}
                            {active && <CheckCircle2 size={16} className="text-sky-500" />}
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">O'zgarish Haqida Izoh (History)</label>
            <textarea required value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} className="input-minimal" placeholder="Nima ish qilindi? Masalan: Dizayn tasdiqlandi..." />
          </div>

          {/* Design file upload */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black text-slate-400 uppercase px-1">Design Fayllar (ixtiyoriy)</label>
              {moveForm.newFiles.length > 0 && (
                <span className="text-[9px] font-black text-orange-500">{moveForm.newFiles.length} ta fayl tanlandi</span>
              )}
            </div>
            <div
              onClick={() => moveFileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all min-h-[80px]"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fayl yuklash uchun bosing</p>
              <p className="text-[9px] text-slate-300 font-bold">PDF, AI, PSD, PNG, JPG va boshqalar</p>
            </div>
            <input type="file" hidden multiple ref={moveFileInputRef} onChange={handleMoveFileSelect} />

            {moveForm.newFiles.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {moveForm.newFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span className="text-[10px] font-black text-slate-700 truncate">{f.name}</span>
                    </div>
                    <button type="button" onClick={() => setMoveForm(fm => ({ ...fm, newFiles: fm.newFiles.filter((_, j) => j !== i) }))} className="text-slate-300 hover:text-rose-500 transition-colors ml-2 shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100 items-end justify-end">
            <button type="button" className="btn-outline h-14 flex-1 rounded-2xl font-black uppercase tracking-widest text-[10px] px-8" onClick={() => setIsMoveTaskModalOpen(false)}>BEKOR</button>
            <button type="submit" className="btn-primary h-14 flex-[2] rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sky-500/20 px-10">O'ZGARTIRISHNI SAQLASH</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: NEW COLUMN */}
      <Modal
        isOpen={isNewColumnModalOpen}
        onClose={() => setIsNewColumnModalOpen(false)}
        title="Yangi Bosqich Qoshish"
        type="warning"
      >
        <form onSubmit={handleAddColumn} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Ustun Nomi</label>
            <input
              type="text"
              required
              autoFocus
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              className="input-minimal h-12 text-sm font-black uppercase tracking-wider"
              placeholder="Masalan: PECHATDA..."
            />
          </div>
          <div className="flex gap-3 pt-2 items-end justify-end">
            <button type="button" className="btn-outline h-14 flex-1 rounded-xl uppercase font-black text-[10px] tracking-widest px-8" onClick={() => setIsNewColumnModalOpen(false)}>BEKOR</button>
            <button type="submit" className="btn-primary h-14 flex-1 rounded-xl uppercase font-black text-[10px] tracking-widest shadow-amber-500/10 bg-amber-500 hover:bg-amber-600 px-10">YARATISH</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: CONFIRM DELETE */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.type === 'task' ? "Buyurtmani arxivlash" : "Bosqichni o'chirish"}
        type="danger"
      >
        <div className="space-y-6">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1" size={24} />
            <div>
              <p className="text-sm font-black text-rose-900 uppercase">Diqqat!</p>
              <p className="text-xs font-bold text-rose-700 mt-1">
                {confirmModal.type === 'task'
                  ? <>Siz <strong>{confirmModal.title}</strong> buyurtmasini arxivlamoqchisiz. Buyurtma arxivga ko'chiriladi.</>
                  : <>Siz <strong>{confirmModal.title}</strong> bosqichini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!</>
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2 items-end justify-end">
            <button
              type="button"
              className="btn-outline h-14 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest px-8"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="h-14 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all px-10"
              onClick={confirmModal.type === 'task' ? handleArchiveTask : handleRemoveColumn}
            >
              {confirmModal.type === 'task' ? 'Ha, arxivlash' : "Ha, o'chirilsin"}
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
              <p className="text-[10px] font-black uppercase">Yuklanmoqda...</p>
            </div>
          ) : arxivTasks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center opacity-20">
              <ArchiveRestore size={40} className="mb-4" />
              <p className="text-[10px] font-black uppercase">Arxivlangan buyurtmalar yo'q</p>
            </div>
          ) : (() => {
            const totalPages = Math.ceil(arxivTasks.length / ARXIV_PAGE_SIZE);
            const paginated = arxivTasks.slice((arxivPage - 1) * ARXIV_PAGE_SIZE, arxivPage * ARXIV_PAGE_SIZE);
            return (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Jami: <span className="text-slate-600">{arxivTasks.length}</span> ta
                  </p>
                  <p className="text-[10px] font-black text-slate-400">
                    {arxivPage}/{totalPages} sahifa
                  </p>
                </div>
                <div className="space-y-2 mb-4">
                  {paginated.map((task: any) => (
                    <div key={task.id} className="flex items-start justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex-1 pr-3 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {task.orderName && <span className="text-orange-600 font-black text-xs shrink-0">{task.orderName} —</span>}
                          <span className="text-xs font-black text-slate-800 uppercase truncate">{task.title}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 italic line-clamp-1">{task.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {task.totalAmount > 0 && (
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{Number(task.totalAmount).toLocaleString()} UZS</span>
                          )}
                          {task.customerName && (
                            <span className="text-[9px] font-black text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{task.customerName}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-slate-300 uppercase shrink-0 mt-0.5">
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
                      className="h-8 px-4 rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ← OLDINGI
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                        <button
                          key={pg}
                          onClick={() => setArxivPage(pg)}
                          className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${pg === arxivPage
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
                      className="h-8 px-4 rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
            <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest">
              Xizmat: {services.find(s => s.id === currentOrderService.serviceId)?.name || '—'}
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Opsiya Nomi *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Masalan: Rangi, O'lchami..."
              value={newOptionForm.name}
              onChange={e => setNewOptionForm(f => ({ ...f, name: e.target.value }))}
              className="input-minimal h-11 font-black border-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Qiymat *</label>
            <input
              type="text"
              required
              placeholder="Masalan: Qizil, A4, Laminate..."
              value={newOptionForm.value}
              onChange={e => setNewOptionForm(f => ({ ...f, value: e.target.value }))}
              className="input-minimal h-11 font-black border-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Qo'shimcha narx (asosiy narxga qo'shiladi, UZS)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={newOptionForm.priceAdd}
              onChange={e => setNewOptionForm(f => ({ ...f, priceAdd: e.target.value }))}
              className="input-minimal h-11 font-black border-2 text-orange-600"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsNewOptionModalOpen(false)} className="btn-outline h-11 flex-1 rounded-xl uppercase font-black text-[10px] tracking-widest">BEKOR</button>
            <button
              type="submit"
              disabled={isSavingOption}
              className="h-11 flex-[2] bg-orange-500 text-white rounded-xl uppercase font-black text-[10px] tracking-widest shadow-lg shadow-orange-500/20 disabled:opacity-50 active:scale-95 transition-all"
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
          <div className="bg-violet-50 p-4 rounded-2xl border border-violet-100 mb-4">
            <p className="text-[11px] font-black text-violet-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
              <AlertTriangle size={14} /> Diqqat!
            </p>
            <p className="text-[10px] font-bold text-violet-700 leading-relaxed uppercase">
              Bu yerda kiritgan o'zgarishlaringiz faqat ushbu buyurtma uchun amal qiladi.
              Siz bu yerda bo'yoq yoki qog'oz miqdorini buyurtma dizayniga qarab ko'paytirishingiz yoki kamaytirishingiz mumkin.
            </p>
          </div>

          <div className="space-y-4">
            {overrides.map((ov, idx) => (
              <div key={ov.materialId} className="flex flex-col gap-2 p-4 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                <div className="flex justify-between items-center px-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ov.name}</p>
                  <p className="text-[9px] font-black text-slate-300 uppercase">{ov.unit}</p>
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
                    className="input-minimal h-14 bg-slate-50 border-2 border-slate-100 focus:border-violet-500 font-black text-violet-600 text-xl"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">MIQDOR</div>
                </div>
              </div>
            ))}

            {overrides.length === 0 && (
              <div className="py-10 text-center opacity-30">
                <Package size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase">Bu xizmatga xomashyo biriktirilmagan</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100">
            <button onClick={() => setIsOverrideModalOpen(false)} className="btn-outline h-14 flex-1 rounded-2xl uppercase font-black text-[10px] tracking-widest">Bekor Berish</button>
            <button
              onClick={handleSaveOverrides}
              className="h-14 flex-[2] bg-violet-600 text-white rounded-2xl uppercase font-black text-[10px] tracking-widest shadow-xl shadow-violet-500/20 active:scale-95 transition-all"
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
