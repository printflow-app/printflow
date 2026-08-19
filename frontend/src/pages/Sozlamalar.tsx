import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, CreditCard, Plus, Trash2, Check, X, Save, Edit3, ChevronDown, ChevronUp, AlertCircle, LayoutGrid, ReceiptText, Layers, Package, MapPin, Navigation, Wallet, BarChart2, BarChart3, Users, UserCheck, Clock, Building2, Settings, Tag, ShieldCheck, Receipt, Copy, Handshake, FileText, Image as ImageIcon } from 'lucide-react';
import { Badge, EmptyState, Tabs, Toast } from '../components/ui';
import { PriceListModal } from '../components/PriceListModal';
import { PriceListBrandingSection } from '../components/PriceListBrandingSection';
import { AgentPolicySection } from '../components/AgentPolicySection';
import { CashBoxManagerSection } from '../components/CashBoxManagerSection';
import { ImageUpload } from '../components/ImageUpload';
import { rolesApi, paymentTypesApi, expenseTypesApi, servicesApi, inventoryApi, settingsApi, branchesApi } from '../api';
import { useRoles, usePaymentTypes, useExpenseTypes, useTaskColumns, useServices, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { SkeletonCardGrid } from '../components/Skeleton';
import CurrencyInput from '../components/CurrencyInput';

const Billing = React.lazy(() => import('./Billing'));

const Sozlamalar: React.FC<{ currentUser: any; activeBranchId?: string; catalogOnly?: boolean }> = ({ currentUser, activeBranchId, catalogOnly }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};

  // RQ — cache'lanadi, tabbga qaytsa darhol
  const { data: rawRoles = [], isLoading: rolesLoading } = useRoles(activeBranchId);
  const roles = (rawRoles as any[]).filter((r: any) => r.name?.toLowerCase() !== 'admin');
  const { data: paymentTypes = [] } = usePaymentTypes();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { isLoading: kcLoading } = useTaskColumns(activeBranchId);
  const { data: services = [] } = useServices(activeBranchId);
  const invalidate = useInvalidate();

  const [minPrepaymentPct, setMinPrepaymentPct] = useState(70);
  const [savingPrepayment, setSavingPrepayment] = useState(false);
  // Davomat — GPS Geofencing
  const [officeLat, setOfficeLat] = useState('');
  const [officeLng, setOfficeLng] = useState('');
  const [officeRadius, setOfficeRadius] = useState('50');
  const [savingGeo, setSavingGeo] = useState(false);
  const [geoEditMode, setGeoEditMode] = useState(true);
  const [detectingGps, setDetectingGps] = useState(false);
  const isLoading = rolesLoading || kcLoading;
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'billing'>('general');

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const fetchData = async (_silent = false) => {
    // Shim — RQ caches: invalidate, ular avtomatik refetch qiladi
    invalidate.roles();
    invalidate.paymentTypes();
    invalidate.expenseTypes();
    invalidate.taskColumns();
    invalidate.services();
    invalidate.employees();
    // One-off settings (prepayment threshold + GPS geofencing) — not yet on RQ
    try {
      const pctRes = await settingsApi.get('MIN_PREPAYMENT_PERCENTAGE');
      if (pctRes.data?.value) setMinPrepaymentPct(Number(pctRes.data.value));
    } catch { /* default 70 */ }
    try {
      const [latRes, lngRes, radiusRes] = await Promise.all([
        settingsApi.get('OFFICE_LAT'),
        settingsApi.get('OFFICE_LNG'),
        settingsApi.get('OFFICE_RADIUS'),
      ]);
      const parseGeoVal = (d: any) => d?.value !== undefined ? d.value : d;
      const latVal = parseGeoVal(latRes.data);
      const lngVal = parseGeoVal(lngRes.data);
      const radVal = parseGeoVal(radiusRes.data);
      if (latVal !== null && latVal !== undefined) setOfficeLat(String(latVal));
      if (lngVal !== null && lngVal !== undefined) setOfficeLng(String(lngVal));
      if (radVal !== null && radVal !== undefined) setOfficeRadius(String(radVal));
      if (latVal && lngVal) setGeoEditMode(false);
    } catch { /* GPS sozlanmagan */ }
  };

  // Initial load of one-off settings (RQ data auto-loads via hooks)
  useEffect(() => {
    settingsApi.get('MIN_PREPAYMENT_PERCENTAGE').then(r => {
      if (r.data?.value) setMinPrepaymentPct(Number(r.data.value));
    }).catch(() => { });
    Promise.all([
      settingsApi.get('OFFICE_LAT'),
      settingsApi.get('OFFICE_LNG'),
      settingsApi.get('OFFICE_RADIUS'),
    ]).then(([latRes, lngRes, radiusRes]) => {
      const parseGeoVal = (d: any) => d?.value !== undefined ? d.value : d;
      const latVal = parseGeoVal(latRes.data);
      const lngVal = parseGeoVal(lngRes.data);
      const radVal = parseGeoVal(radiusRes.data);
      if (latVal !== null && latVal !== undefined) setOfficeLat(String(latVal));
      if (lngVal !== null && lngVal !== undefined) setOfficeLng(String(lngVal));
      if (radVal !== null && radVal !== undefined) setOfficeRadius(String(radVal));
      if (latVal && lngVal) setGeoEditMode(false);
    }).catch(() => { });
  }, []);

  const savePrepaymentPct = async () => {
    setSavingPrepayment(true);
    try {
      await settingsApi.set('MIN_PREPAYMENT_PERCENTAGE', { value: minPrepaymentPct });
      showStatus('success', 'Minimal zakolat foizi saqlandi!');
    } catch {
      showStatus('error', 'Saqlashda xatolik!');
    } finally {
      setSavingPrepayment(false);
    }
  };

  // GPS Geofencing sozlamalarini saqlash
  const saveGeoSettings = async () => {
    const lat = parseFloat(officeLat);
    const lng = parseFloat(officeLng);
    const radius = parseInt(officeRadius, 10);
    if (isNaN(lat) || isNaN(lng)) {
      showStatus('error', 'Kenglik va uzunlik to\'g\'ri formatda kiriting');
      return;
    }
    if (isNaN(radius) || radius < 10) {
      showStatus('error', 'Radius kamida 10 metr bo\'lishi kerak');
      return;
    }
    setSavingGeo(true);
    try {
      await Promise.all([
        settingsApi.set('OFFICE_LAT', { value: lat }),
        settingsApi.set('OFFICE_LNG', { value: lng }),
        settingsApi.set('OFFICE_RADIUS', { value: radius }),
      ]);
      setGeoEditMode(false);
      showStatus('success', 'GPS geofencing sozlamalari saqlandi');
    } catch {
      showStatus('error', 'Saqlashda xatolik');
    } finally {
      setSavingGeo(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showStatus('error', 'Brauzeringiz geolokatsiyani qo\'llab-quvvatlamaydi');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeLat(String(pos.coords.latitude));
        setOfficeLng(String(pos.coords.longitude));
        setDetectingGps(false);
      },
      (err) => {
        if (err.code === 1) showStatus('error', 'Iltimos, brauzerdan lokatsiyaga ruxsat bering');
        else showStatus('error', 'Joylashuv aniqlanmadi. Qayta urinib ko\'ring');
        setDetectingGps(false);
      },
      { timeout: 10000, maximumAge: 0 },
    );
  };




  // RQ auto-fetches on branch change via hook deps; manual useEffect removed.

  // Role Form
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const initialRoleForm = {
    name: '',
    canViewFinance: false, canAddIncome: false, canAddExpense: false, canViewTotalBalance: false, canViewOwnCashOnly: false, canManagePaymentTypes: false,
    canManageCashBoxes: false, canViewAllCashBoxes: false, canTransferCash: false, canSetTransactionDate: false,
    canViewBreakEven: false,
    canViewTeamTasks: false, canManageTeamTasks: false,
    canViewTasks: false, canViewAllTasks: false, canViewOwnTasks: false, canCreateTask: false, canEditTask: false, canDeleteTask: false, canMoveTask: false, canManageColumns: false,
    canViewCustomers: false, canManageCustomers: false,
    canViewEmployees: false, canManageEmployees: false, canManageRoles: false, canViewSalary: false, canManageAdmins: false,
    canViewPayroll: false, canManagePayroll: false,
    canManageBranches: false, canViewKpi: false, canViewExpenseCharts: false, canViewSettings: false, canAssignToOtherBranches: false,
    canManageBilling: false, canManageNotifications: false,
    canViewVendors: false, canViewInventory: false, canManageInventory: false, canViewAttendance: false, canViewAllAttendance: false, canManageAttendance: false,
    canViewServices: false, canManageServices: false, canShowPriceList: false,
    canViewStatistics: false, canViewFinanceReports: false, canViewServiceReports: false,
    canViewRoles: false, canManageExpenseTypes: false, canManageKanbanColumns: false, canManageGeneralSettings: false,
    canViewGrowthCards: false, canViewIncomeByType: false, canViewExpenseByType: false, canViewCostCalculator: false,
    canAddCustomer: false, canEditCustomer: false, canDeleteCustomer: false,
    canAddEmployee: false, canEditEmployee: false, canDeleteEmployee: false, canResetEmployeePassword: false,
    canAddInventoryItem: false, canReceiveInventory: false, canUseInventory: false, canWriteOffInventory: false,
    canManageVendors: false, canViewBranches: false, canViewBillingStatus: false,
    // Excel eksport ruxsatlari — sahifa-bo'yicha
    canExportFinance: false, canExportTasks: false, canExportCustomers: false, canExportInventory: false,
    canExportEmployees: false, canExportAttendance: false, canExportVendors: false, canExportReports: false,
    canUseAi: false,
  };
  const [newRole, setNewRole] = useState(initialRoleForm);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const branchScope = activeBranchId || null;
      await rolesApi.create({ ...newRole, branchId: branchScope });
      setIsRoleModalOpen(false);
      setNewRole(initialRoleForm);
      fetchData(true);
    } catch (err) {
      showStatus('error', "Lavozim yaratishda xato!");
    }
  };

  // Edit Role Inline
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editRoleData, setEditRoleData] = useState<any>(null);

  const startEditRole = (role: any) => {
    setEditingRoleId(role.id);
    setEditRoleData({ ...role });
  };

  const cancelEditRole = () => {
    setEditingRoleId(null);
    setEditRoleData(null);
  };

  const saveEditRole = async () => {
    if (!editRoleData || !editingRoleId) return;
    try {
      const { id, employees, ...data } = editRoleData;
      await rolesApi.update(editingRoleId, data, activeBranchId);
      setEditingRoleId(null);
      setEditRoleData(null);
      fetchData(true);
    } catch (err) {
      showStatus('error', "O'zgarishlarni saqlashda xato!");
    }
  };

  const handleDeleteRole = (id: string) => {
    const role = roles.find(r => r.id === id);
    setConfirmModal({
      isOpen: true,
      title: "Lavozimni o'chirish",
      message: `"${role?.name}" lavozimini o'chirmoqchimisiz? Unga biriktirilgan xodimlar bilan muammo chiqishi mumkin!`,
      onConfirm: async () => {
        try {
          await rolesApi.delete(id, activeBranchId);
          fetchData(true);
          showStatus('success', "Lavozim o'chirildi.");
        } catch (err) {
          showStatus('error', "O'chirishda xato! Avval shu lavozim xodimlarini boshqa lavozimga o'tkazing.");
        }
        setConfirmModal(null);
      }
    });
  };

  const [newPT, setNewPT] = useState('');
  const [editingPTId, setEditingPTId] = useState<string | null>(null);
  const [editPTName, setEditPTName] = useState('');

  const handleAddPT = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPT) return;
    try {
      await paymentTypesApi.create({ name: newPT });
      setNewPT('');
      fetchData(true);
    } catch (err) {
      showStatus('error', "To'lov turini qo'shishda xato!");
    }
  };

  const handleUpdatePT = async (id: string) => {
    if (!editPTName) return;
    try {
      await paymentTypesApi.update(id, { name: editPTName });
      setEditingPTId(null);
      fetchData(true);
    } catch (err) {
      showStatus('error', "Tahrirlashda xato!");
    }
  };

  // Expense Type Logic
  const [newET, setNewET] = useState('');
  const [editingETId, setEditingETId] = useState<string | null>(null);
  const [editETName, setEditETName] = useState('');

  const handleAddET = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newET) return;
    try {
      await expenseTypesApi.create({ name: newET });
      setNewET('');
      fetchData(true);
    } catch (err) {
      showStatus('error', "Xarajat turini qo'shishda xato!");
    }
  };

  const handleUpdateET = async (id: string) => {
    if (!editETName) return;
    try {
      await expenseTypesApi.update(id, { name: editETName });
      setEditingETId(null);
      fetchData(true);
    } catch (err) {
      showStatus('error', "Tahrirlashda xato!");
    }
  };


  // Permissions grouped by page — har bo'lim uchun alohida ruxsat + Lucide icon
  const permissionGroups: {
    title: string; color: string; icon: React.ReactNode;
    permissions: Record<string, { label: string; detail: string }>;
  }[] = [
      // ============================================================
      // SAHIFA TARTIBIDA — sidebar order'iga aniq mos.
      // Operatsiya: Kassa → Kanban → Xizmatlar katalogi → Mijozlar → Ombor → Davomat
      // Tahlil:     Statistika → Hisobotlar
      // Boshqaruv:  Xodimlar → Ma'muriyat → Hamkorlar → Filiallar → Sozlamalar
      // Boshqa:     Obuna va to'lov, Cross-branch
      // ============================================================

      // === OPERATSIYA ===
      {
        title: '1. Kassa (Tranzaksiyalar)',
        color: 'emerald',
        icon: <Wallet size={16} />,
        permissions: {
          canViewFinance: { label: "Sahifaga kirish — tranzaksiyalar ro'yxati", detail: "Menyu'da 'Kassa' bo'limi ko'rinadi. Kirim va chiqim tranzaksiyalari sanasi, summasi, turi bilan ro'yxati ko'rsatiladi. Sana bo'yicha filtrlash va qidirish ishlaydi." },
          canViewTotalBalance: { label: "Umumiy kassa balansini ko'rish", detail: "Sahifa yuqorisidagi 'Jami Balans' kartochkasi ko'rinadi. Ruxsat yo'q bo'lsa summa '•••••' bilan yashiriladi va faqat o'z tranzaksiyalarini ko'rish mumkin bo'ladi." },
          canViewOwnCashOnly: { label: "Faqat o'zi kiritgan kirim/chiqimni ko'rish", detail: "Yoqilsa — xodim Kassada faqat O'ZI kiritgan kirim va chiqimlarni, hamda shulardan kelib chiqqan balansni ko'radi. Boshqalar kiritgan raqamlar va umumiy balans ko'rinmaydi. (Administrator uchun amal qilmaydi.)" },
          canAddIncome: { label: "Kirim (tushum) qo'shish", detail: "'+ Kirim' tugmasi faol bo'ladi. Mijozdan to'lov qabul qilish, buyurtma bilan bog'lash, to'lov turini tanlash — bularning barchasi kiritiladi." },
          canAddExpense: { label: "Chiqim (xarajat) qo'shish", detail: "'+ Chiqim' tugmasi faol bo'ladi. Xarajat turi, summa, izoh va to'lov usuli bilan chiqim kiritish. Xodim maoshi uchun esa alohida 'Maosh' turi mavjud." },
          canExportFinance: { label: "Excel'ga eksport qilish", detail: "Kassa sahifasida 'Eksport' tugmasi ko'rinadi. Joriy filtr (sana oralig'i, qidiruv) bo'yicha barcha tranzaksiyalarni .xlsx faylga yuklab olish imkoni." },
          canViewAllCashBoxes: { label: "Boshqa kassalarni ko'rish", detail: "Yoqilsa — barcha kassalar (kassir, moliyachi, asosiy) va ularning balanslari ko'rinadi. Yo'q bo'lsa — xodim faqat o'ziga biriktirilgan kassa(lar)ni ko'radi. (Administrator uchun har doim ochiq.)" },
          canManageCashBoxes: { label: "Kassa ochish va boshqarish", detail: "'Yangi kassa' tugmasi faol bo'ladi. Yangi kassa yaratish, nomini o'zgartirish, xodimga biriktirish va o'chirish. Bundan tashqari — kassaga topshirilgan pulni qabul qilish/rad etish huquqini ham beradi." },
          canTransferCash: { label: "Pulni boshqa kassaga topshirish", detail: "Kassada 'Topshirish' tugmasi faol bo'ladi. Kassir kunlik/haftalik pulni moliyachi kassasiga topshiradi — pul uning kassasidan chiqim bo'lib, qabul qilinishi kutiladi." },
          canSetTransactionDate: { label: "Kirim/chiqim sanasini o'zgartirish (orqa sana)", detail: "Kirim yoki chiqim qo'shish/tahrirlash oynasida 'Sana' maydoni ko'rinadi — xodim tranzaksiyani boshqa (o'tgan) kunga yozishi mumkin. Ruxsat yo'q bo'lsa sana har doim joriy vaqt bo'ladi va maydon umuman ko'rinmaydi." },
        }
      },
      {
        title: '2. Xizmatlar (Kanban) — buyurtmalar',
        color: 'amber',
        icon: <LayoutGrid size={16} />,
        permissions: {
          canViewBreakEven: { label: "Zararsizlik nuqtasini ko'rish", detail: "Hisobotlarda 'Zararsizlik nuqtasi' kartasi ko'rinadi — oylik doimiy xarajat, bo'limlar kesimidagi taqsimot va foydaga chiqish darajasi. Eng nozik moliyaviy ma'lumot, shuning uchun alohida ruxsat." },
          canViewTeamTasks: { label: "Jamoa vazifalari doskasiga kirish", detail: "Menyu'da 'Jamoa vazifalari' bo'limi ko'rinadi. Bu doska buyurtma kanbanidan farq qiladi: u yerda fokus buyurtmada, bu yerda qaysi xodim nima bilan band ekanida. Buyurtmalar ham, operatsion vazifalar ham birga ko'rinadi." },
          canManageTeamTasks: { label: "Jamoa vazifasini yaratish va ko'chirish", detail: "'+ Vazifa' tugmasi ko'rinadi; vazifani bosqichdan bosqichga sudrab o'tkazish mumkin. Mas'ul tanlansa unga Telegram orqali xabar boradi. Buyurtmalarni bu doskada ko'chirib bo'lmaydi — ular Kanbanda boshqariladi." },
          canViewTasks: { label: "Kanban sahifasiga kirish", detail: "Menyu'da 'Xizmatlar' bo'limi ko'rinadi. Buyurtmalar kanban doskasiniga umumiy kirish imkoni." },
          canViewAllTasks: { label: "Barcha buyurtmalarni ko'rish", detail: "Barcha xodimga biriktirilgan buyurtmalar ko'rinadi. Bu ruxsat yo'q bo'lsa xodim faqat o'ziga biriktirilgan buyurtmalarni ko'ra oladi." },
          canViewOwnTasks: { label: "Faqat o'ziga biriktirilgan buyurtmalarni ko'rish", detail: "Boshqa xodimlarning buyurtmalari yashiriladi. Faqat o'z ismiga biriktirilgan kartochkalar ko'rinadi." },
          canCreateTask: { label: "Yangi buyurtma yaratish", detail: "'+ Yangi Buyurtma' tugmasi ko'rinadi va ishlaydi. Ruxsat yo'q bo'lsa bu tugma umuman ko'rinmaydi." },
          canEditTask: { label: "Buyurtma ma'lumotlarini tahrirlash", detail: "Buyurtma kartochkasida 'Tahrirlash' tugmasi ko'rinadi. Mijoz, xizmat, narx, izoh, deadline va boshqa maydonlarni o'zgartirish mumkin." },
          canDeleteTask: { label: "Buyurtmani o'chirish yoki arxivlash", detail: "'O'chirish' va 'Arxivlash' tugmalari ko'rinadi. Ruxsat yo'q bo'lsa bu tugmalar umuman ko'rinmaydi." },
          canMoveTask: { label: "Buyurtmani bosqichdan bosqichga ko'chirish", detail: "'Bosqichni o'zgartirish' tugmasi faol bo'ladi. Buyurtmani keyingi yoki oldingi kanban ustuniga ko'chirish va izoh qoldirish mumkin." },
          canManageColumns: { label: "Kanban ustunlarini (bosqichlarni) boshqarish", detail: "Yangi bosqich (ustun) qo'shish, mavjudini nomini o'zgartirish va tartibini belgilash imkoni." },
          canExportTasks: { label: "Excel'ga eksport qilish", detail: "Kanban sahifasida 'Eksport' tugmasi ko'rinadi. Barcha buyurtmalarni bosqich, mijoz, summa va deadline ma'lumotlari bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '3. Xizmatlar katalogi (Pricing Engine)',
        color: 'slate',
        icon: <Layers size={16} />,
        permissions: {
          canViewServices: { label: "Xizmatlar katalogini ko'rish", detail: "'Xizmatlar katalogi' alohida sidebar tab ko'rinadi (Operatsiya guruhida). Bosma xizmatlar: nomi, birlik, asosiy narx, opsiyalar va material normasi (BOM) ko'rsatiladi." },
          canManageServices: { label: "Xizmat va opsiyalarni qo'shish, tahrirlash, o'chirish", detail: "Yangi xizmat qo'shish va narxini belgilash. Opsiyalar (qo'shimcha parametrlar) yaratish. Material normalarini bog'lash va o'zgartirish. Xizmatni o'chirish." },
          canShowPriceList: { label: "Mijozga narxnoma (Price list) ko'rsatish", detail: "Xizmatlar katalogida 'Price list' tugmasi va Ctrl+Shift+P tezkor tugmasi faol bo'ladi. Xodim brendlangan narxlar ro'yxatini ochib mijozga ko'rsatishi yoki eksport qilishi mumkin. Ruxsat yo'q bo'lsa tugma umuman ko'rinmaydi." },
        }
      },
      {
        title: '4. Mijozlar Bazasi',
        color: 'violet',
        icon: <Users size={16} />,
        permissions: {
          canViewCustomers: { label: "Mijozlar ro'yxatini ko'rish", detail: "Menyu'da 'Mijozlar' bo'limi ko'rinadi. Mijozlar jadvali: ism, telefon, jami buyurtmalar, qarz holati va oxirgi aloqa ko'rsatiladi." },
          canAddCustomer: { label: "Yangi mijoz qo'shish", detail: "'+ Yangi Mijoz' tugmasi ko'rinadi. Ism, telefon, manzil va qo'shimcha kontaktlar bilan yangi mijoz kartochkasi yaratish imkoni." },
          canEditCustomer: { label: "Mijoz ma'lumotlarini tahrirlash", detail: "Har bir mijoz qatorida 'Tahrirlash' tugmasi ko'rinadi. Ism, telefon, manzil, telegram va boshqa ma'lumotlarni o'zgartirish mumkin." },
          canDeleteCustomer: { label: "Mijozni tizimdan o'chirish", detail: "Mijoz qatorida 'O'chirish' tugmasi ko'rinadi. Mijozni tizimdan butunlay o'chirish — bu amalni ortga qaytarish mumkin emas." },
          canManageCustomers: { label: "Kontaktlar, buyurtmalar va to'lovlar tarixi", detail: "Mijoz detali modalida: barcha buyurtmalar ro'yxati, to'lov tarixi, qarz holati va kontakt raqamlarini ko'rish va boshqarish imkoni." },
          canExportCustomers: { label: "Excel'ga eksport qilish", detail: "Mijozlar sahifasida 'Eksport' tugmasi ko'rinadi. Barcha mijozlarni ism, telefon, qarz, jami to'lov va buyurtmalar soni bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '5. Ombor',
        color: 'amber',
        icon: <Package size={16} />,
        permissions: {
          canViewInventory: { label: "Ombor sahifasiga kirish — materiallar ro'yxati", detail: "Menyu'da 'Ombor' ko'rinadi. Materiallar/xom ashyo nomlari, joriy zaxira miqdori, minimum chegara va holat (yetarli/kam/kritik) ko'rsatiladi." },
          canAddInventoryItem: { label: "Yangi material nomi qo'shish", detail: "'+ Material Qo'shish' tugmasi ko'rinadi. Yangi xom ashyo yoki material nomini, o'lchov birligini va minimum zaxira chegarasini kiritish." },
          canReceiveInventory: { label: "Kirim — yangi zaxira qabul qilish", detail: "Har bir material kartasida 'Kirim' tugmasi ko'rinadi. Yangi kelgan material miqdorini kiritish, narx va izoh bilan yozib qo'yish." },
          canUseInventory: { label: "Chiqim — sarflanish kiritish", detail: "Material kartasida 'Chiqim' tugmasi ko'rinadi. Ishlab chiqarishga sarflangan material miqdorini kiritish va xarajat sifatida qayd etish." },
          canWriteOffInventory: { label: "Brak — yaroqsiz materiallarni hisobdan chiqarish", detail: "Material kartasida 'Brak' tugmasi ko'rinadi. Yaroqsiz yoki yo'qolgan materiallarni hisobdan o'chirish. Sabab va miqdor ko'rsatiladi." },
          canManageInventory: { label: "Material ma'lumotlarini tahrirlash va o'chirish", detail: "Material nomini, o'lchov birligini va minimum zaxira miqdorini o'zgartirish. Keraksiz materialni ro'yxatdan o'chirish imkoni." },
          canExportInventory: { label: "Excel'ga eksport qilish", detail: "Ombor sahifasida 'Eksport' tugmasi ko'rinadi. Barcha materiallarni nomi, birligi, joriy zaxira va minimum chegara bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '6. Davomat',
        color: 'teal',
        icon: <Clock size={16} />,
        permissions: {
          canViewAttendance: { label: "Sahifaga kirish — o'z davomatini ko'rish va belgilash", detail: "Menyu'da 'Davomat' ko'rinadi. Xodim o'z keldi/ketti vaqtini QR kod yoki 'Keldim' tugmasi bilan belgilaydi. Faqat o'z tarixi ko'rinadi." },
          canViewAllAttendance: { label: "Barcha xodimlar davomatini ko'rish", detail: "Barcha xodimlarning kunlik davomat jadvali, oylik matritsa ko'rinishi, kech qolish daqiqalari statistikasi va xodim bo'yicha filtrlash." },
          canManageAttendance: { label: "Qo'lda davomat kiritish va tizim sozlamalari", detail: "Qurilmasiz xodimlar uchun admin keldi/ketti vaqtini qo'lda kiritadi. Ofis Wi-Fi IP manzillar allowlist (ruxsat etilgan tarmoqlar) sozlamasi." },
          canExportAttendance: { label: "Excel'ga eksport qilish", detail: "Davomat sahifasida 'Eksport' tugmasi ko'rinadi. Oylik davomat matritsasini xodimlar bo'yicha kun-kun .xlsx faylga yuklab olish." },
        }
      },

      // === TAHLIL ===
      {
        title: '7. Statistika',
        color: 'sky',
        icon: <BarChart2 size={16} />,
        permissions: {
          canViewStatistics: { label: "Statistika sahifasiga kirish — dashboard", detail: "Menyu'da 'Statistika' ko'rinadi. Jami kirim summasi, bajarilgan buyurtmalar soni, kutilayotgan buyurtmalar (muddati o'tganlar bilan) va davr filtri — bularning barchasi ko'rsatiladi." },
          canViewKpi: { label: "Xodimlar samaradorligi liderboard (KPI)", detail: "Xodimlar liderboard jadvali: bajarilgan buyurtmalar, muddatga rioya foizi, o'rtacha bajarish soati, daromad ulushi va samaradorlik reytingi ko'rsatiladi. Ruxsat yo'q bo'lsa faqat o'z KPI kartochkasi ko'rinadi." },
        }
      },
      {
        title: '8. Hisobotlar',
        color: 'orange',
        icon: <BarChart3 size={16} />,
        permissions: {
          canViewGrowthCards: { label: "O'sish ko'rsatkichlari kartochkalari", detail: "Bu oy daromad, yangi mijozlar soni, bajarilgan buyurtmalar — har biri o'tgan oy bilan foizli taqqoslab ko'rsatiladi. Sof foyda jami kartochkasi ham shu bo'limda." },
          canViewFinanceReports: { label: "Moliyaviy Dinamika grafigi", detail: "Kunlik (qisqa davr) yoki oylik (uzun davr) kirim / chiqim / hamkor xarajati / sof foyda trend chiziqlari. Davr filtri orqali '1 oy' — '1 yil' oralig'ini ko'rish mumkin." },
          canViewIncomeByType: { label: "Kirim Turlari diagrammasi", detail: "Naqd, Karta, Click, Payme, Bank o'tkazmasi kabi to'lov usullari bo'yicha tushum foizi va summasi — doira (pie) diagramma va yonma-yon ro'yxat." },
          canViewExpenseByType: { label: "Chiqim Turlari diagrammasi", detail: "Har xil xarajat kategoriyalari bo'yicha chiqimlar ulushi — doira diagramma. Qaysi turdagi xarajat ko'p ekanligi vizual ko'rinadi." },
          canViewExpenseCharts: { label: "Chiqim Tahlili (kategoriyalar bo'yicha)", detail: "Har bir xarajat kategoriyasi bo'yicha aniq summa va umumiy chiqimdagi ulushi. Eng ko'p sarflangan yo'nalishlarni tezda aniqlash." },
          canViewServiceReports: { label: "Xizmat Hajmi & O'rtacha Chek", detail: "Xizmat tanlash orqali: buyurtmalar soni, jami daromad, o'rtacha chek va barcha daromaddagi ulushi ko'rsatiladi. Xizmatlar daromad bo'yicha reytingi ham ko'rinadi." },
          canViewCostCalculator: { label: "Tannarx Kalkulyatori", detail: "Buyurtma ID yoki nomi bo'yicha qidirish. Xarajat qatorlarini qo'shish, 1 donaga tannarx va sof foyda/marja foizini real vaqtda hisoblash." },
          canExportReports: { label: "Excel'ga eksport qilish", detail: "Hisobotlar sahifasida 'Eksport' tugmasi ko'rinadi. Joriy hisobot ma'lumotlari (xizmatlar, hamkorlar, dinamika va h.k.) .xlsx faylga yuklab olinadi." },
        }
      },

      // === BOSHQARUV ===
      {
        title: '9. Xodimlar',
        color: 'indigo',
        icon: <UserCheck size={16} />,
        permissions: {
          canViewEmployees: { label: "Xodimlar ro'yxatini ko'rish", detail: "Menyu'da 'Xodimlar' bo'limi ko'rinadi. Xodimlar jadvali: ism, lavozim, telefon, filial, login va holat ma'lumotlari." },
          canAddEmployee: { label: "Yangi xodim qo'shish", detail: "'+ Yangi Xodim' tugmasi ko'rinadi. Ism, telefon, lavozim, filial va boshlang'ich maosh kiritib yangi xodim yaratish. Tizim avtomatik login va parol generatsiya qiladi." },
          canEditEmployee: { label: "Xodim ma'lumotlarini tahrirlash", detail: "Xodim qatorida 'Tahrirlash' tugmasi ko'rinadi. Ism, telefon, lavozim, filial va boshqa ma'lumotlarni o'zgartirish mumkin." },
          canDeleteEmployee: { label: "Xodim hisobini o'chirish", detail: "Xodim qatorida 'O'chirish' tugmasi ko'rinadi. Xodim tizimdan chiqariladi va uning hisobiga kirish bloklanadi." },
          canResetEmployeePassword: { label: "Login va parol yangilash", detail: "'Yangi parol' tugmasi ko'rinadi. Xodim parolini qayta generatsiya qilish va yangi login ma'lumotlarini ko'rish imkoni." },
          canViewSalary: { label: "Xodim maosh summalarini ko'rish", detail: "Xodimlar jadvalida va profilida boshlang'ich maosh, berilgan avans va qarz summasi ko'rinadi. Ruxsat yo'q bo'lsa bu raqamlar yashiriladi." },
          canViewPayroll: { label: "Maosh bo'limini (oylik hisob-kitob) ko'rish", detail: "Xodimlar sahifasida 'Maosh' tabi ko'rinadi — oy bo'yicha har xodimning fiksa, bonus, jarima, avans va berish kerak summasi jadvali. Faqat ko'rish (o'zgartirmasdan)." },
          canManagePayroll: { label: "Maosh hisoblash, saqlash va to'lash", detail: "Maosh bo'limida bonus/jarima kiritish, maosh varaqasini saqlash va 'To'lash' (Kassadan chiqim) qilish imkoni. Ortiqcha avans keyingi oyga qarz bo'lib ko'chadi." },
          canExportEmployees: { label: "Excel'ga eksport qilish", detail: "Xodimlar sahifasida 'Eksport' tugmasi ko'rinadi. Barcha xodimlarni ism, lavozim, telefon, login va filial ma'lumotlari bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: "10. Ma'muriyat (Adminlar)",
        color: 'rose',
        icon: <ShieldCheck size={16} />,
        permissions: {
          canManageAdmins: { label: "Workspace admin hisoblarini boshqarish", detail: "Menyu'da 'Ma'muriyat' bo'limi ko'rinadi. Admin hisobi yaratish, login/parolni ko'rish, yangi parol generatsiya qilish va admin hisobini o'chirish imkoni. Bu sahifa juda yuqori darajali ruxsat." },
        }
      },
      {
        title: '11. Hamkorlar',
        color: 'cyan',
        icon: <Handshake size={16} />,
        permissions: {
          canViewVendors: { label: "Hamkorlar ro'yxatini ko'rish", detail: "Menyu'da 'Hamkorlar' bo'limi ko'rinadi. Hamkorlar (subpudratchilar) kartochkalari: ism, mutaxassislik, telefon, joriy qarz holati va jami buyurtmalar soni. Hamkor detalini ochish mumkin." },
          canManageVendors: { label: "Hamkorlarni qo'shish, tahrirlash, o'chirish va to'lov", detail: "'+ Hamkor' tugmasi ko'rinadi. Yangi hamkor yaratish. Mavjud hamkor ma'lumotlarini o'zgartirish. Hamkorga to'lov kiritish (qarzni kamaytirish). Hamkorni o'chirish." },
          canExportVendors: { label: "Excel'ga eksport qilish", detail: "Hamkorlar sahifasida 'Eksport' tugmasi ko'rinadi. Barcha hamkorlarni ism, mutaxassislik, telefon va qarz holati bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '12. Filiallar',
        color: 'cyan',
        icon: <Building2 size={16} />,
        permissions: {
          canViewBranches: { label: "Filiallar ro'yxatini ko'rish", detail: "Menyu'da 'Filiallar' bo'limi ko'rinadi. Barcha filiallar ro'yxati: nomi, manzili, telefon raqami va mas'ul menejer ismi. Har filialning bo'limlari ham ko'rinadi." },
          canManageBranches: { label: "Filiallarni qo'shish va boshqarish", detail: "'+ Yangi Filial' tugmasi ko'rinadi. Filial yaratish, manzil va mas'ul menejerini belgilash. Bo'lim (Department) qo'shish, tahrirlash, o'chirish. Mavjud filialni tahrirlash va o'chirish." },
        }
      },
      {
        title: '13. Tizim Sozlamalari',
        color: 'gray',
        icon: <Settings size={16} />,
        permissions: {
          canViewSettings: { label: "Sozlamalar sahifasiga kirish", detail: "Menyu'da 'Sozlamalar' bo'limi ko'rinadi. Lavozimlar, to'lov turlari, xarajat kategoriyalari, kanban bosqichlari va boshqa tizim sozlamalariga umumiy kirish." },
          canViewRoles: { label: "Lavozimlar va ruxsatlarni ko'rish (faqat o'qish)", detail: "Barcha lavozimlar va ularga biriktirilgan ruxsatlarni ko'rish mumkin. Tahrirlash tugmalari ko'rinmaydi — faqat ma'lumotni o'qish." },
          canManageRoles: { label: "Lavozim yaratish, ruxsatlarni tahrirlash, o'chirish", detail: "'Yangi Lavozim' tugmasi faol. Har bir ruxsatni alohida yoqish/o'chirish. Lavozimni o'chirish (bog'liq xodimlar bo'lmasa)." },
          canManagePaymentTypes: { label: "To'lov turlarini qo'shish va o'chirish", detail: "Sozlamalar > To'lov Turlari bo'limida Click, Uzcard, Humo, Naqd va boshqalarni qo'shish, nomini o'zgartirish va o'chirish." },
          canManageExpenseTypes: { label: "Xarajat kategoriyalarini qo'shish va o'chirish", detail: "Sozlamalar > Xarajat Turlari bo'limida Xom ashyo, Ijara, Kommunal, Transport va boshqa xarajat turlarini boshqarish." },
          canManageKanbanColumns: { label: "Kanban bosqichlarini tahrirlash", detail: "Sozlamalar > Bosqichlar bo'limida buyurtma jarayoni bosqichlari (Yangi → Tayyor) nomini o'zgartirish va tartibini belgilash." },
          canManageGeneralSettings: { label: "Umumiy tizim parametrlarini o'zgartirish", detail: "Minimal zakolat foizi, ish boshlanish vaqti va kun tartibiga oid sozlamalar. Bu parametrlar barcha filiallar uchun amal qiladi." },
          canManageNotifications: { label: "Telegram bot bildirishnomalarini sozlash", detail: "Yangi buyurtma, kechikish, hisob-kitob kabi hodisalar uchun Telegram bot orqali kim xabar olishini yoqish/o'chirish." },
        }
      },

      // === BOSHQA ===
      {
        title: "14. Obuna va To'lov",
        color: 'purple',
        icon: <Receipt size={16} />,
        permissions: {
          canViewBillingStatus: { label: "Obuna holati va muddatini ko'rish", detail: "Menyu'da 'Obuna' ko'rinadi. Joriy tarif nomi, obuna muddati, qolgan kunlar va holat (faol/sinov/muddati o'tgan) kartochkasi ko'rsatiladi." },
          canManageBilling: { label: "To'lov yuborish va obuna yangilash", detail: "Tarif tanlash, to'lov cheki yuborish, promo kod kiritish va cashback balansini qo'llash. To'lov tasdiqlanib obuna yangilanadi." },
        }
      },
      {
        title: '15. Kross-filial ruxsatlar',
        color: 'fuchsia',
        icon: <Building2 size={16} />,
        permissions: {
          canAssignToOtherBranches: { label: "Boshqa filial xodimlariga buyurtma berish", detail: "Buyurtma yaratish yoki tahrirlashda o'z filialidan tashqaridagi xodimlarni mas'ul qilib tayinlash imkoni paydo bo'ladi. Multi-filial kompaniyalarda outsourcing uchun ishlatiladi." },
        }
      },
      // "AI Yordamchi" ruxsat guruhi ATAYLAB olib tashlangan: AI'ni endi
      // faqat super admin boshqaradi (global kalit + tarifdagi ai_chat
      // moduli). Lavozim darajasida ham tekshirish uch qavatli shart hosil
      // qilardi va "super admin yoqib qo'ygan-ku, nega chat yo'q?" degan
      // chalkashlikka olib kelardi.
    ];

  const allPermissionKeys = permissionGroups.flatMap(g => Object.keys(g.permissions));
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  if (isLoading) return <SkeletonCardGrid count={6} />;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 animate-fade-in">
      {/* Tabs Switcher — catalog-only ko'rinishda (Xizmatlar Katalogi tab) yashiriladi */}
      {!catalogOnly && (
        <div className="overflow-x-auto no-scrollbar">
          <Tabs
            tabs={[
              { id: 'general', label: 'Asosiy Sozlamalar', icon: Settings },
              { id: 'billing', label: "Obuna va To'lovlar", icon: CreditCard },
            ]}
            activeTab={activeSettingsTab}
            onChange={(id) => setActiveSettingsTab(id as any)}
          />
        </div>
      )}

      {!catalogOnly && activeSettingsTab === 'billing' && (
        <div className="animate-fade-in">
          <React.Suspense fallback={<LoadingSpinner />}>
            <Billing />
          </React.Suspense>
        </div>
      )}

      {activeSettingsTab === 'general' && (
        <div className="space-y-6 sm:space-y-8 animate-fade-in">
          {statusMessage && createPortal(
            <Toast type={statusMessage.type}>{statusMessage.text}</Toast>,
            document.body,
          )}

          {/* Roles Section */}
          {!catalogOnly && (isAdmin || p.canViewRoles || p.canManageRoles) && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-card border border-slate-200">
                <div>
                  <h3 className="t-h2 flex items-center gap-2">
                    <Shield className="text-[color:var(--primary)]" size={20} /> Lavozimlar & Ruxsatlar
                  </h3>
                  <p className="t-caption mt-1">Sahifalar va funksiyalarga dostupni sozlash</p>
                </div>
                {(isAdmin || p.canManageRoles) && (
                  <button data-tour-id="lavozim-add" className="btn-primary w-full sm:w-auto" onClick={() => setIsRoleModalOpen(true)}>
                    <Plus size={16} /> Yangi Lavozim
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {roles.map(role => {
                  const isEditing = editingRoleId === role.id;
                  const isExpanded = expandedRoleId === role.id;
                  const dataSource = isEditing ? editRoleData : role;

                  return (
                    <div key={role.id} className={`bg-white rounded-card border overflow-hidden transition-colors duration-180 ${isEditing ? 'border-primary-300' : 'border-slate-200 hover:border-slate-300'}`}>

                      {/* Role header */}
                      <div className={`flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`} onClick={() => !isEditing && setExpandedRoleId(isExpanded ? null : role.id)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-primary-50 text-primary-700 rounded-control flex items-center justify-center font-semibold text-base border border-primary-200 flex-shrink-0">
                            {role.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="t-h2 truncate">{role.name}</h4>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant={allPermissionKeys.filter(k => role[k]).length > 0 ? 'success' : 'neutral'} showDot={false}>
                                {allPermissionKeys.filter(k => role[k]).length} Ruxsat
                              </Badge>
                              <span className="label-caps">Aktiv</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEditRole} className="btn-primary h-sm">
                                <Save size={16} /> SAQLASH
                              </button>
                              <button onClick={cancelEditRole} className="btn-outline h-sm">
                                BEKOR
                              </button>
                            </>
                          ) : (
                            <>
                              {(isAdmin || p.canManageRoles) && (
                                <>
                                  <button onClick={() => startEditRole(role)} className="icon-btn hover:text-[color:var(--primary)] hover:bg-primary-50">
                                    <Edit3 size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteRole(role.id)} className="icon-btn hover:text-rose-600 hover:bg-rose-50">
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                              <button onClick={() => setExpandedRoleId(isExpanded ? null : role.id)} className={`icon-btn ${isExpanded ? 'bg-primary-50 text-[color:var(--primary)]' : ''}`}>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Permissions grid (expanded or editing) */}
                      {(isExpanded || isEditing) && (
                        <div className="px-4 sm:px-6 pb-6 border-t border-slate-100 pt-6 animate-slide-up">
                          <div className="space-y-6">
                            {permissionGroups.map(group => (
                              <div key={group.title}>
                                <div className="flex items-center gap-2.5 mb-3">
                                  <span className="text-slate-500 flex-shrink-0">{group.icon}</span>
                                  <h5 className="t-h3">
                                    {group.title}
                                  </h5>
                                  <div className="flex-1 h-px bg-slate-100" />
                                  <span className="label-caps tabular-nums">
                                    {Object.keys(group.permissions).filter(k => dataSource[k]).length}/{Object.keys(group.permissions).length}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {Object.entries(group.permissions).map(([key, perm]) => {
                                    const isOn = isEditing ? !!editRoleData[key] : !!dataSource[key];
                                    return (
                                      <div
                                        key={key}
                                        className={`flex items-start gap-3 p-3 rounded-card border transition-colors duration-120 ${isEditing
                                            ? `cursor-pointer ${isOn ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-primary-300'}`
                                            : isOn ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'
                                          }`}
                                        onClick={() => isEditing && setEditRoleData({ ...editRoleData, [key]: !editRoleData[key] })}
                                      >
                                        {/* Toggle or status indicator */}
                                        <div className="shrink-0 mt-0.5">
                                          {isEditing ? (
                                            <div className={`w-10 h-6 rounded-full relative transition-colors duration-120 ${isOn ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-120 ${isOn ? 'left-5' : 'left-1'}`} />
                                            </div>
                                          ) : isOn ? (
                                            <div className="w-6 h-6 bg-emerald-500 text-white rounded-control flex items-center justify-center">
                                              <Check size={16} />
                                            </div>
                                          ) : (
                                            <div className="w-6 h-6 bg-slate-200 text-slate-400 rounded-control flex items-center justify-center">
                                              <X size={16} />
                                            </div>
                                          )}
                                        </div>
                                        {/* Label + detail */}
                                        <div className="min-w-0 flex-1">
                                          <p className={`text-xs font-semibold leading-tight ${isOn ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {perm.label}
                                          </p>
                                          <p className="t-caption mt-1 leading-snug">
                                            {perm.detail}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>

                          {isEditing && (
                            <div className="mt-6 p-4 bg-primary-50 rounded-card border border-primary-200 flex items-start gap-3">
                              <AlertCircle className="text-[color:var(--primary)] mt-0.5 shrink-0" size={18} />
                              <div className="space-y-1">
                                <p className="t-h3 text-primary-900">Ruxsatlarni tahrirlash</p>
                                <p className="text-xs text-primary-800 leading-relaxed">Tugmalarni bosish orqali ruxsatlarni yoqishingiz yoki o'chirishingiz mumkin. Saqlash tugmasini bosishni unutmang.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}



          {/* Payment Types Section */}
          {!catalogOnly && (isAdmin || p.canManagePaymentTypes) && (
            <section className="space-y-4">
              <div className="bg-white rounded-card border border-slate-200 p-4 sm:p-6">
                <form data-tour-id="payment-type-form" onSubmit={handleAddPT} className="flex flex-col md:flex-row flex-wrap gap-2 mb-5 pb-5 border-b border-slate-100">
                  <input
                    type="text"
                    required
                    value={newPT}
                    onChange={(e) => setNewPT(e.target.value)}
                    className="input-minimal flex-1 md:min-w-[220px]"
                    placeholder="Yangi usul nomi (Click, Uzcard...)"
                  />
                  <button type="submit" className="btn-primary">
                    <Plus size={16} /> QO'SHISH
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {paymentTypes.map(pt => {
                    const isEditingPT = editingPTId === pt.id;
                    return (
                      <div key={pt.id} className={`group p-4 rounded-card border transition-colors duration-120 ${isEditingPT ? 'bg-primary-50 border-primary-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        {isEditingPT ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={editPTName}
                              onChange={(e) => setEditPTName(e.target.value)}
                              className="input-minimal"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdatePT(pt.id)} className="btn-primary h-sm flex-1">Saqlash</button>
                              <button onClick={() => setEditingPTId(null)} className="btn-outline h-sm flex-1">Bekor</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center gap-2">
                            <span className="t-h3 truncate">{pt.name}</span>
                            <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-120">
                              <button onClick={() => { setEditingPTId(pt.id); setEditPTName(pt.name); }} className="icon-btn-sm">
                                <Edit3 size={16} />
                              </button>
                              <button onClick={() => { setConfirmModal({ isOpen: true, title: "O'chirish", message: "${pt.name} o'chirilsinmi?", onConfirm: () => { paymentTypesApi.delete(pt.id).then(() => fetchData(true)); setConfirmModal(null); } }); }} className="icon-btn-sm hover:text-rose-600 hover:bg-rose-50">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {paymentTypes.length === 0 && (
                    <div className="col-span-full">
                      <EmptyState icon={CreditCard} title="Hozircha to'lov turlari mavjud emas" />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Kassalar (Cashboxes) Section */}
          {!catalogOnly && (isAdmin || p.canManageCashBoxes) && (
            <CashBoxManagerSection
              activeBranchId={activeBranchId}
              onStatus={showStatus}
              onConfirm={(opts) => setConfirmModal({
                isOpen: true,
                title: opts.title,
                message: opts.message,
                onConfirm: async () => { await opts.onConfirm(); setConfirmModal(null); },
              })}
            />
          )}

          {/* Expense Types Section */}
          {!catalogOnly && (isAdmin || p.canManageExpenseTypes) && (
            <section className="space-y-4">
              <div className="bg-white p-4 rounded-card border border-slate-200">
                <div>
                  <h3 className="t-h2 flex items-center gap-2">
                    <ReceiptText className="text-rose-600" size={20} /> Xarajat Turlari
                  </h3>
                  <p className="t-caption mt-1">Chiqimlar uchun maxsus kategoriyalar</p>
                </div>
              </div>

              <div className="bg-white rounded-card border border-slate-200 p-4 sm:p-6">
                <form onSubmit={handleAddET} className="flex flex-col md:flex-row flex-wrap gap-2 mb-5 pb-5 border-b border-slate-100">
                  <input
                    type="text"
                    required
                    value={newET}
                    onChange={(e) => setNewET(e.target.value)}
                    className="input-minimal flex-1 md:min-w-[220px]"
                    placeholder="Xarajat turi nomi (Material, Kommunal...)"
                  />
                  <button type="submit" className="btn-primary">
                    <Plus size={16} /> QO'SHISH
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {expenseTypes.map(et => {
                    const isEditingET = editingETId === et.id;
                    return (
                      <div key={et.id} className={`group p-4 rounded-card border transition-colors duration-120 ${isEditingET ? 'bg-primary-50 border-primary-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                        {isEditingET ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={editETName}
                              onChange={(e) => setEditETName(e.target.value)}
                              className="input-minimal"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateET(et.id)} className="btn-primary h-sm flex-1">Saqlash</button>
                              <button onClick={() => setEditingETId(null)} className="btn-outline h-sm flex-1">Bekor</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center gap-2">
                            <span className="t-h3 truncate">{et.name}</span>
                            <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-120">
                              <button onClick={() => { setEditingETId(et.id); setEditETName(et.name); }} className="icon-btn-sm">
                                <Edit3 size={16} />
                              </button>
                              <button onClick={() => { setConfirmModal({ isOpen: true, title: "O'chirish", message: "${et.name} o'chirilsinmi?", onConfirm: () => { expenseTypesApi.delete(et.id).then(() => fetchData(true)); setConfirmModal(null); } }); }} className="icon-btn-sm hover:text-rose-600 hover:bg-rose-50">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* General Settings Section */}
          {!catalogOnly && (isAdmin || p.canManageGeneralSettings) && (
            <section className="space-y-4">
              <div className="bg-white p-4 sm:p-6 rounded-card border border-slate-200 space-y-4">
                <div>
                  <h3 className="t-h2 flex items-center gap-2">
                    <Save className="text-[color:var(--primary)]" size={20} /> Umumiy Sozlamalar
                  </h3>
                  <p className="t-caption mt-1">Tizim darajasidagi qoidalar va chegaralar</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-card p-4 flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="form-label">
                      Minimal zakolat foizi (%)
                    </label>
                    <p className="t-caption mb-3">
                      Yangi buyurtma qo'shishda zakolat shu foizdan kam bo'lsa ogohlantirish chiqadi
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min="0" max="100" step="5"
                        value={minPrepaymentPct}
                        onChange={e => setMinPrepaymentPct(Number(e.target.value))}
                        className="flex-1 accent-[color:var(--primary)]"
                      />
                      <span className="t-display text-[color:var(--primary)] w-14 text-right">{minPrepaymentPct}%</span>
                    </div>
                  </div>
                  <button
                    onClick={savePrepaymentPct}
                    disabled={savingPrepayment}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {savingPrepayment ? 'SAQLANMOQDA...' : 'SAQLASH'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Davomat — GPS Geofencing */}
          {!catalogOnly && (isAdmin || p.canManageAttendance) && (
            <section className="space-y-4">
              <div className="bg-white p-4 sm:p-6 rounded-card border border-slate-200 space-y-4">
                <div>
                  <h3 className="t-h2 flex items-center gap-2">
                    <MapPin className="text-emerald-600" size={20} /> Davomat va Geofencing
                  </h3>
                  <p className="t-caption mt-1">
                    Xodimlar faqat ofis hududi (radius)da davomat belgilashi mumkin
                  </p>
                </div>

                {/* Auto-detect helper — faqat edit modeda ko'rinadi */}
                {geoEditMode && <div className="bg-emerald-50 border border-emerald-100 rounded-card p-4 flex items-start gap-3">
                  <Navigation className="text-emerald-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Ofisda turganda "Hozirgi joylashuvimni aniqlash" tugmasini bosing — koordinatalar avtomatik to'ldiriladi.
                    </p>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={detectingGps}
                      className="btn-success h-sm"
                    >
                      <Navigation size={16} className={detectingGps ? 'animate-pulse' : ''} />
                      {detectingGps ? 'Aniqlanmoqda...' : 'Hozirgi joylashuvimni aniqlash'}
                    </button>
                  </div>
                </div>}

                {/* Coordinate display / edit */}
                {!geoEditMode ? (
                  /* ── View mode: read-only ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'Kenglik (Latitude)', value: officeLat },
                        { label: 'Uzunlik (Longitude)', value: officeLng },
                        { label: 'Radius (metr)', value: officeRadius },
                      ].map(f => (
                        <div key={f.label} className="bg-slate-50 border border-slate-200 rounded-card px-4 py-3">
                          <p className="label-caps mb-1">{f.label}</p>
                          <p className="font-mono text-sm text-slate-900 tabular-nums">{f.value || '—'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setGeoEditMode(true)}
                        className="btn-outline"
                      >
                        <MapPin size={16} /> Tahrirlash
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Edit mode: inputs ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="form-label">
                          Kenglik (Latitude)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={officeLat}
                          onChange={e => setOfficeLat(e.target.value)}
                          placeholder="41.299496"
                          className="input-minimal font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="form-label">
                          Uzunlik (Longitude)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={officeLng}
                          onChange={e => setOfficeLng(e.target.value)}
                          placeholder="69.240073"
                          className="input-minimal font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="form-label">
                          Radius (metr)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="5000"
                          value={officeRadius}
                          onChange={e => setOfficeRadius(e.target.value)}
                          placeholder="50"
                          className="input-minimal font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    {(!officeLat || !officeLng) && (
                      <div className="bg-rose-50 border border-rose-100 rounded-card p-4">
                        <p className="t-h3 text-rose-700 mb-1 flex items-center gap-1.5">
                          <AlertCircle size={16} /> GPS sozlanmagan
                        </p>
                        <p className="text-xs text-rose-700">
                          Koordinatalar kiritilmasa xodimlar davomat belgilolmaydi.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                      {officeLat && officeLng && (
                        <button
                          type="button"
                          onClick={() => setGeoEditMode(false)}
                          className="btn-outline"
                        >
                          Bekor qilish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={saveGeoSettings}
                        disabled={savingGeo}
                        className="btn-primary"
                      >
                        <Save size={16} /> {savingGeo ? 'Saqlanmoqda...' : 'Saqlash'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Services Catalog Section */}
          {(isAdmin || p.canViewServices || p.canManageServices || p.canShowPriceList || p.canAddService || p.canEditService || p.canDeleteService) && (
            <ServicesCatalogSection services={services} onRefresh={() => fetchData(true)} showStatus={showStatus} currentUser={currentUser} activeBranchId={activeBranchId} />
          )}

          {/* Narx Ro'yxati Brandingi */}
          {(isAdmin || p.canManageServices) && (
            <PriceListBrandingSection tenantSlug={currentUser?.tenant?.slug} activeBranchId={activeBranchId} />
          )}

          {/* Girgitton Agent — avtonom ishlar policy'si (faqat admin) */}
          {isAdmin && <AgentPolicySection />}

          {/* Role Modal */}
          <Modal
            isOpen={isRoleModalOpen}
            onClose={() => setIsRoleModalOpen(false)}
            title="Yangi Lavozim Qo'shish"
            maxWidth="max-w-3xl"
          >
            <form onSubmit={handleAddRole} className="space-y-6">
              <div>
                <label className="form-label">Lavozim Nomi (Masalan: Admin, Katta Hodim, Manager...)</label>
                <input type="text" required value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className="input-minimal h-control-lg text-base" placeholder="Manager..." />
              </div>

              <div className="space-y-6">
                {permissionGroups.map(group => (
                  <div key={group.title} className="space-y-2">
                    <h4 className="t-h3 flex items-center gap-2 border-b border-slate-200 pb-3">
                      <span className="text-slate-500">{group.icon}</span>{group.title}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(group.permissions).map(([key, perm]) => (
                        <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-card border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-colors duration-120">
                          <input
                            type="checkbox"
                            checked={!!(newRole as any)[key]}
                            onChange={(e) => setNewRole({ ...newRole, [key]: e.target.checked })}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[color:var(--primary)] shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-900">{perm.label}</span>
                            <span className="t-caption leading-snug">{perm.detail}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" className="btn-outline h-lg" onClick={() => setIsRoleModalOpen(false)}>Bekor qilish</button>
                <button type="submit" className="btn-primary h-lg">Yaratish va saqlash</button>
              </div>
            </form>
          </Modal>

          {/* Unified Confirm Modal */}
          {confirmModal && (
            <Modal
              isOpen={confirmModal.isOpen}
              onClose={() => setConfirmModal(null)}
              title={confirmModal.title}
            >
              <div className="space-y-5">
                <p className="t-body">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmModal(null)} className="btn-outline h-lg flex-1">Bekor qilish</button>
                  <button onClick={confirmModal.onConfirm} className="btn-danger-solid h-lg flex-1">
                    TASDIQLASH
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================
// XIZMATLAR KATALOGI KOMPONENTI
// =============================================
const ServicesCatalogSection: React.FC<{ services: any[]; onRefresh: () => void; showStatus: (type: 'success' | 'error', text: string) => void; currentUser: any; activeBranchId?: string }> = ({ services, onRefresh, showStatus, currentUser, activeBranchId }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const p = currentUser.permissions || {};
  const canAdd = isAdmin || p.canManageServices;
  const canEdit = isAdmin || p.canManageServices;
  const canDelete = isAdmin || p.canManageServices;
  const canManageOptions = isAdmin || p.canManageServices;
  const canShowPriceList = isAdmin || p.canShowPriceList;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOptionOpen, setIsOptionOpen] = useState(false);
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);

  // Dashboard global Ctrl+P listener'i 'pf:open-price-list' eventini yuboradi —
  // shu joyda ushlab Price List modalni ochamiz.
  useEffect(() => {
    if (!canShowPriceList) return;
    const onOpen = () => setIsPriceListOpen(true);
    window.addEventListener('pf:open-price-list', onOpen);
    return () => window.removeEventListener('pf:open-price-list', onOpen);
  }, [canShowPriceList]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const [newSvcForm, setNewSvcForm] = useState<{ name: string; description: string; basePrice: string; unit: string; imageUrl: string | null; variantAxes: string }>({ name: '', description: '', basePrice: '', unit: 'dona', imageUrl: null, variantAxes: '' });
  // Image edit modal — mavjud xizmat rasmini almashtirish uchun
  const [imageEditSvc, setImageEditSvc] = useState<{ id: string; name: string; imageUrl?: string | null } | null>(null);
  const [editSvcId, setEditSvcId] = useState<string | null>(null);
  const [editSvcForm, setEditSvcForm] = useState<any>({});
  const [newOptionForm, setNewOptionForm] = useState({ name: '', value: '', percentageMarkup: '' });

  // BOM State
  const [materials, setMaterials] = useState<any[]>([]);
  const [isBOMOpen, setIsBOMOpen] = useState(false);
  const [newMaterialForm, setNewMaterialForm] = useState({ materialId: '', normPerUnit: '' });

  // Clone-to-branch state
  const [branches, setBranches] = useState<any[]>([]);
  const [cloneModal, setCloneModal] = useState<{ isOpen: boolean; service: any | null }>({ isOpen: false, service: null });
  const [cloneTargetBranchId, setCloneTargetBranchId] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    inventoryApi.getMaterials().then(res => setMaterials(res.data || []));
    branchesApi.findAll().then(r => setBranches(r.data || [])).catch(() => { });
  }, []);

  // Branches we can clone TO (exclude the caller's current active branch — cloning
  // to yourself is a no-op and the backend would reject it as a duplicate name anyway).
  const cloneTargets = branches.filter(b => b.id !== activeBranchId);

  const openCloneModal = (svc: any) => {
    // Pre-select the first available target so the user can hit "Nusxalash" immediately.
    setCloneTargetBranchId(cloneTargets[0]?.id ?? '');
    setCloneModal({ isOpen: true, service: svc });
  };

  const requireActiveBranch = (): string | null => {
    if (!activeBranchId) {
      showStatus('error', 'Avval aktiv filialni tanlang');
      return null;
    }
    return activeBranchId;
  };

  const handleClone = async () => {
    if (!cloneModal.service) return;
    const bId = requireActiveBranch();
    if (!bId) return;
    if (!cloneTargetBranchId) {
      showStatus('error', 'Maqsadli filialni tanlang');
      return;
    }
    setIsCloning(true);
    try {
      await servicesApi.clone(cloneModal.service.id, bId, cloneTargetBranchId);
      setCloneModal({ isOpen: false, service: null });
      showStatus('success', 'Xizmat muvaffaqiyatli nusxalandi!');
    } catch {
      showStatus('error', 'Nusxalashda xatolik yuz berdi!');
    } finally {
      setIsCloning(false);
    }
  };


  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    const bId = requireActiveBranch();
    if (!bId) return;
    try {
      const axes = (newSvcForm.variantAxes || '').split(',').map(s => s.trim()).filter(Boolean);
      await servicesApi.create({ ...newSvcForm, basePrice: Number(newSvcForm.basePrice), variantAxes: axes, branchId: bId });
      showStatus('success', 'Xizmat qo\'shildi!');
      setIsAddOpen(false);
      setNewSvcForm({ name: '', description: '', basePrice: '', unit: 'dona', imageUrl: null, variantAxes: '' });
      onRefresh();
    } catch { showStatus('error', 'Xizmat qo\'shishda xatolik!'); }
  };

  // Rasmni saqlash — image edit modaldan chaqiriladi
  const handleSaveServiceImage = async (imageUrl: string | null) => {
    if (!imageEditSvc) return;
    const bId = requireActiveBranch();
    if (!bId) return;
    try {
      await servicesApi.update(imageEditSvc.id, { imageUrl }, bId);
      showStatus('success', 'Rasm yangilandi');
      setImageEditSvc(null);
      onRefresh();
    } catch { showStatus('error', 'Rasmni saqlashda xatolik'); }
  };

  const handleDeleteService = async (id: string) => {
    const bId = requireActiveBranch();
    if (!bId) return;
    setConfirmModal({
      isOpen: true,
      title: "Xizmatni o'chirish",
      message: "Bu xizmatni o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await servicesApi.delete(id, bId);
          onRefresh();
          showStatus("success", "Xizmat o'chirildi.");
        } catch {
          showStatus("error", "Xatolik yuz berdi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    const bId = requireActiveBranch();
    if (!bId) return;
    try {
      await servicesApi.addOption(selectedService.id, {
        name: newOptionForm.name,
        value: newOptionForm.value,
        percentageMarkup: Number(newOptionForm.percentageMarkup)
      }, bId);
      showStatus('success', 'Optsiya qo\'shildi!');
      setIsOptionOpen(false);
      setNewOptionForm({ name: '', value: '', percentageMarkup: '' });
      onRefresh();
    } catch (err: any) {
      console.error('addOption failed:', err?.response?.status, err?.response?.data, err);
      const msg = err?.response?.data?.message || err?.message || 'Optsiya qo\'shishda xatolik!';
      showStatus('error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const handleDeleteOption = async (id: string) => {
    const bId = requireActiveBranch();
    if (!bId) return;
    setConfirmModal({
      isOpen: true,
      title: "Opsiyani o'chirish",
      message: "Tanlangan optsiyani o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await servicesApi.deleteOption(id, bId);
          const updated = await servicesApi.findAll(bId);
          const newSvc = updated.data.find((s: any) => s.id === selectedService.id);
          setSelectedService(newSvc);
          onRefresh();
          showStatus("success", "Opsiya o'chirildi.");
        } catch {
          showStatus("error", "Xatolik yuz berdi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    const bId = requireActiveBranch();
    if (!bId) return;
    try {
      await servicesApi.addMaterial(selectedService.id, {
        materialId: newMaterialForm.materialId,
        normPerUnit: Number(newMaterialForm.normPerUnit)
      }, bId);
      showStatus('success', 'Material biriktirildi!');
      setIsBOMOpen(false);
      setNewMaterialForm({ materialId: '', normPerUnit: '' });
      onRefresh();
    } catch { showStatus('error', 'Material biriktirishda xatolik!'); }
  };

  const handleRemoveMaterial = async (materialId: string) => {
    if (!selectedService) return;
    const bId = requireActiveBranch();
    if (!bId) return;
    setConfirmModal({
      isOpen: true,
      title: "BOM o'chirish",
      message: "Ushbu material sarfini o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await servicesApi.deleteMaterial(selectedService.id, materialId, bId);
          const updated = await servicesApi.findAll(bId);
          const newSvc = updated.data.find((s: any) => s.id === selectedService.id);
          setSelectedService(newSvc);
          onRefresh();
          showStatus("success", "Material sarfi o'chirildi.");
        } catch {
          showStatus("error", "Xatolik yuz berdi.");
        }
        setConfirmModal(null);
      }
    });
  };

  const handleUpdateService = async (id: string) => {
    const bId = requireActiveBranch();
    if (!bId) return;
    try {
      const axes = typeof editSvcForm.variantAxes === 'string'
        ? editSvcForm.variantAxes.split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(editSvcForm.variantAxes) ? editSvcForm.variantAxes : []);
      await servicesApi.update(id, { ...editSvcForm, basePrice: Number(editSvcForm.basePrice), variantAxes: axes }, bId);
      setEditSvcId(null);
      showStatus('success', 'Yangilandi!');
      onRefresh();
    } catch { showStatus('error', 'Yangilashda xatolik!'); }
  };

  return (
    <section className="space-y-4">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-card border border-slate-200">
        <div>
          <h3 className="t-h2 flex items-center gap-2">
            <Layers className="text-[color:var(--primary)]" size={20} /> Xizmatlar Katalogi
          </h3>
          <p className="t-caption mt-1">Pricing Engine — xizmat va opsiyalar narxlari</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {canShowPriceList && services.length > 0 && (
            <button
              className="btn-outline flex-1 sm:flex-none"
              onClick={() => setIsPriceListOpen(true)}
              title="Mijozga jo'natish uchun price list"
            >
              <FileText size={16} /> Price list
            </button>
          )}
          {canAdd && (
            <button
              data-tour-id="xizmat-add"
              className="btn-primary flex-1 sm:flex-none"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus size={16} /> Yangi Xizmat
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {services.length === 0 && (
          // Catalog is strictly branch-scoped: with no active branch (multi-branch
          // tenant on "Barcha filiallar") the list is empty even though services
          // exist. Guide the user to pick a branch instead of implying none exist.
          !activeBranchId && branches.length > 1 ? (
            <EmptyState
              icon={Layers}
              title="Avval yuqoridan filialni tanlang"
              description="Xizmatlar katalogi har bir filialga alohida bog'langan"
            />
          ) : (
            <EmptyState icon={Tag} title="Hozircha xizmatlar yo'q" />
          )
        )}
        {services.map(svc => {
          const isExpanded = expandedId === svc.id;
          const isEditing = editSvcId === svc.id;
          return (
            <div key={svc.id} className={`bg-white rounded-card border overflow-hidden transition-colors duration-180 ${isEditing ? 'border-primary-300' : 'border-slate-200 hover:border-slate-300'}`}>
              {/* Service header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 cursor-pointer" onClick={() => !isEditing && setExpandedId(isExpanded ? null : svc.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  {svc.imageUrl ? (
                    <img
                      src={svc.imageUrl}
                      alt=""
                      className="w-10 h-10 rounded-control object-cover border border-primary-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-primary-50 text-primary-700 rounded-control flex items-center justify-center font-semibold text-base border border-primary-200 shrink-0">
                      {svc.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input type="text" value={editSvcForm.name} onChange={e => setEditSvcForm({ ...editSvcForm, name: e.target.value })} className="input-minimal min-w-0 w-32" />
                        <CurrencyInput
                          value={editSvcForm.basePrice}
                          onChange={(uzs) => setEditSvcForm({ ...editSvcForm, basePrice: uzs ? String(uzs) : '' })}
                          colorClass="text-slate-600"
                          className="input-minimal text-right font-semibold tabular-nums w-36"
                        />
                        <select value={editSvcForm.unit} onChange={e => setEditSvcForm({ ...editSvcForm, unit: e.target.value })} className="select-minimal w-28">
                          {['dona', 'metr', 'sm', 'm2', 'kg', 'litr', 'soat', 'rulon', 'varaq'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input
                          type="text"
                          value={editSvcForm.variantAxes ?? ''}
                          onChange={e => setEditSvcForm({ ...editSvcForm, variantAxes: e.target.value })}
                          className="input-minimal min-w-0 w-44"
                          placeholder="Variant o'qlari: Rang, O'lcham"
                          title="Vergul bilan ajratib yozing (masalan: Rang, O'lcham). Bo'sh qoldirilsa variant yo'q."
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="t-h2 truncate">{svc.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">{Number(svc.basePrice).toLocaleString('uz-UZ')} UZS</span>
                          <Badge variant="neutral" showDot={false}>/ {svc.unit}</Badge>
                          <Badge variant="neutral" showDot={false}>{svc.options?.length || 0} optsiya</Badge>
                          {Array.isArray((svc as any).variantAxes) && (svc as any).variantAxes.length > 0 && (
                            <Badge variant="warning" showDot={false}>
                              {(svc as any).variantAxes.join(' · ')}
                            </Badge>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button onClick={() => handleUpdateService(svc.id)} className="btn-primary h-sm"><Save size={16} /> SAQLASH</button>
                      <button onClick={() => setEditSvcId(null)} className="btn-outline h-sm">Bekor</button>
                    </>
                  ) : (
                    <>
                      {canManageOptions && (
                        <button onClick={() => { setSelectedService(svc); setNewOptionForm(f => ({ ...f, percentageMarkup: '0' })); setIsOptionOpen(true); }} className="btn-outline h-sm"><Plus size={16} /> <span className="hidden sm:inline">Optsiya</span></button>
                      )}
                      {canEdit && (
                        <button onClick={() => setImageEditSvc({ id: svc.id, name: svc.name, imageUrl: svc.imageUrl })} title="Rasm" className="icon-btn hover:text-[color:var(--primary)] hover:bg-primary-50">
                          <ImageIcon size={16} />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setEditSvcId(svc.id); setEditSvcForm({ name: svc.name, basePrice: String(svc.basePrice), unit: svc.unit, variantAxes: Array.isArray(svc.variantAxes) ? svc.variantAxes.join(', ') : '' }); }} className="icon-btn"><Edit3 size={16} /></button>
                      )}
                      {canEdit && cloneTargets.length > 0 && (
                        <button onClick={() => openCloneModal(svc)} title="Filialga nusxalash" className="icon-btn"><Copy size={16} /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDeleteService(svc.id)} className="icon-btn hover:text-rose-600 hover:bg-rose-50"><Trash2 size={16} /></button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : svc.id)} className={`icon-btn ${isExpanded ? 'bg-primary-50 text-[color:var(--primary)]' : ''}`}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Options & BOM expanded */}
              {isExpanded && !isEditing && (
                <div className="px-4 sm:px-6 pb-5 border-t border-slate-100 pt-5 animate-slide-up space-y-5">
                  {/* Options List */}
                  <div>
                    <h5 className="t-h3 mb-3 flex items-center gap-2">
                      <Tag size={16} /> Opsiyalar (Ustama Narxlar)
                    </h5>
                    {svc.options?.length === 0 ? (
                      <p className="t-caption">Opsiyalar yo'q</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {svc.options.map((opt: any) => (
                          <div key={opt.id} className="group flex items-center gap-2.5 bg-white border border-slate-200 rounded-card px-3 py-2 hover:border-primary-300 transition-colors duration-120">
                            <div className="min-w-0">
                              <p className="label-caps leading-none mb-1">{opt.name}</p>
                              <p className="t-h3">{opt.value}</p>
                            </div>
                            <span className={Number(opt.percentageMarkup) >= 0 ? 'badge-success' : 'badge-danger'}>
                              {opt.percentageMarkup > 0 ? '+' : ''}{opt.percentageMarkup}% ({Number(opt.priceAdd).toLocaleString()} UZS)
                            </span>
                            {canManageOptions && (
                              <button onClick={() => handleDeleteOption(opt.id)} className="icon-btn-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 transition-opacity duration-120">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materials List (BOM) */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                      <h5 className="t-h3 flex items-center gap-2">
                        <Package size={16} /> Xomashyo Sarfi (BOM)
                      </h5>
                      {canManageOptions && (
                        <button onClick={() => { setSelectedService(svc); setIsBOMOpen(true); }} className="btn-success h-sm">
                          <Plus size={16} /> BIRIKTIRISH
                        </button>
                      )}
                    </div>
                    {svc.materials?.length === 0 ? (
                      <p className="t-caption">Materiallar biriktirilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {svc.materials.map((sm: any) => (
                          <div key={sm.id} className="group flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-card p-3 hover:border-emerald-200 transition-colors duration-120">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-control bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-semibold text-xs flex-shrink-0">
                                {sm.material?.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="t-h3 truncate">{sm.material?.name}</p>
                                <p className="t-caption">Sarfi: <span className="text-emerald-600 font-medium tabular-nums">{sm.normPerUnit} {sm.material?.unit}</span> / {svc.unit}</p>
                              </div>
                            </div>
                            {canManageOptions && (
                              <button onClick={() => handleRemoveMaterial(sm.materialId)} className="icon-btn-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 transition-opacity duration-120">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Service Modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Yangi Xizmat Qo'shish">
        <form onSubmit={handleAddService} className="space-y-5">
          <ImageUpload
            value={newSvcForm.imageUrl}
            onChange={(url) => setNewSvcForm(f => ({ ...f, imageUrl: url }))}
            size="lg"
            label="Rasm (ixtiyoriy — price list'da ko'rinadi)"
          />
          <div>
            <label className="form-label">Xizmat Nomi</label>
            <input type="text" required value={newSvcForm.name} onChange={e => setNewSvcForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Masalan: Banner Bosish, Vizitka..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Asosiy Narx</label>
              <CurrencyInput
                value={newSvcForm.basePrice}
                onChange={(uzs) => setNewSvcForm(f => ({ ...f, basePrice: uzs ? String(uzs) : '' }))}
                colorClass="text-slate-600"
              />
            </div>
            <div>
              <label className="form-label">O'lchov Birligi</label>
              <select value={newSvcForm.unit} onChange={e => setNewSvcForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'metr', 'sm', 'm2', 'kg', 'litr', 'soat', 'rulon', 'varaq'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Variant o'qlari (ixtiyoriy)</label>
            <input
              type="text"
              value={newSvcForm.variantAxes}
              onChange={e => setNewSvcForm(f => ({ ...f, variantAxes: e.target.value }))}
              className="input-minimal"
              placeholder="Rang, O'lcham"
            />
            <p className="t-caption mt-1.5">Buyurtmada rang/o'lcham bo'yicha ajratma kerak bo'lsa, vergul bilan ajratib yozing. Masalan: <strong className="font-semibold">Rang, O'lcham</strong> — futbolka uchun.</p>
          </div>
          <div>
            <label className="form-label">Tavsif (ixtiyoriy)</label>
            <textarea value={newSvcForm.description} onChange={e => setNewSvcForm(f => ({ ...f, description: e.target.value }))} className="textarea-minimal" placeholder="Qo'shimcha ma'lumot..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-lg flex-1" onClick={() => setIsAddOpen(false)}>Bekor</button>
            <button type="submit" className="btn-primary h-lg flex-1">Yaratish</button>
          </div>
        </form>
      </Modal>

      {/* Add Option Modal */}
      <Modal isOpen={isOptionOpen} onClose={() => setIsOptionOpen(false)} title={`Optsiya: ${selectedService?.name || ''}`}>
        <form onSubmit={handleAddOption} className="space-y-5">
          <div className="bg-primary-50 border border-primary-200 p-4 rounded-card text-xs text-primary-800">
            Asosiy narx: <strong className="font-semibold tabular-nums">{Number(selectedService?.basePrice || 0).toLocaleString()} UZS</strong> / {selectedService?.unit}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Parametr Nomi</label>
              <input type="text" required value={newOptionForm.name} onChange={e => setNewOptionForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Qog'oz turi, Rang..." />
            </div>
            <div>
              <label className="form-label">Qiymat</label>
              <input type="text" required value={newOptionForm.value} onChange={e => setNewOptionForm(f => ({ ...f, value: e.target.value }))} className="input-minimal" placeholder="A4, To'q ko'k, Ha..." />
            </div>
          </div>
          <div>
            <label className="form-label">Yakuniy Narx</label>
            <CurrencyInput
              value={newOptionForm.percentageMarkup === '' ? '' : String(Number(selectedService?.basePrice || 0) + Math.round(Number(selectedService?.basePrice || 0) * (Number(newOptionForm.percentageMarkup) / 100)))}
              onChange={(uzs) => {
                const base = Number(selectedService?.basePrice || 0);
                if (base > 0 && uzs !== undefined) {
                  const markup = ((uzs / base) - 1) * 100;
                  setNewOptionForm(f => ({ ...f, percentageMarkup: String(markup) }));
                }
              }}
              colorClass="text-[color:var(--primary)]"
              className="input-minimal text-right font-semibold tabular-nums h-control-lg text-lg"
            />

            <div className="mt-4 p-4 bg-slate-50 rounded-card border border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div className="space-y-1">
                <p className="label-caps">Ustama Foizi:</p>
                <p className={`text-base font-semibold tabular-nums ${Number(newOptionForm.percentageMarkup) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(newOptionForm.percentageMarkup) > 0 ? '+' : ''}{Math.round(Number(newOptionForm.percentageMarkup) * 100) / 100}%
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="label-caps">Narx Farqi:</p>
                <p className={`text-base font-semibold tabular-nums ${Number(newOptionForm.percentageMarkup) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(newOptionForm.percentageMarkup) >= 0 ? '+' : ''}{Math.round(Number(selectedService?.basePrice || 0) * (Number(newOptionForm.percentageMarkup) / 100))} UZS
                </p>
              </div>
            </div>

            <p className="t-caption mt-3">
              * Yakuniy narxni yozing, tizim foizni avtomatik hisoblab oladi. Keyinchalik asosiy narx o'zgarganda, bu optsiya foizga qarab moslashadi.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-lg flex-1" onClick={() => setIsOptionOpen(false)}>Bekor</button>
            <button type="submit" className="btn-primary h-lg flex-1">Qo'shish</button>
          </div>
        </form>
      </Modal>
      {/* BOM Modal */}
      <Modal isOpen={isBOMOpen} onClose={() => setIsBOMOpen(false)} title={`Xomashyo Biriktirish: ${selectedService?.name || ''}`}>
        <form onSubmit={handleAddMaterial} className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-card text-xs text-emerald-800">
            Xizmat: <strong className="font-semibold">{selectedService?.name}</strong> uchun 1 <strong className="font-semibold">{selectedService?.unit}</strong> sarfini belgilang.
          </div>
          <div className="space-y-4">
            <div>
              <label className="form-label">Materialni tanlang</label>
              <select
                required
                value={newMaterialForm.materialId}
                onChange={e => setNewMaterialForm(f => ({ ...f, materialId: e.target.value }))}
                className="select-minimal h-control-lg"
              >
                <option value="">Tanlang...</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sarflash miqdori (Norma)</label>
              <input
                type="number"
                step="0.0001"
                required
                min="0"
                value={newMaterialForm.normPerUnit}
                onChange={e => setNewMaterialForm(f => ({ ...f, normPerUnit: e.target.value }))}
                className="input-minimal h-control-lg text-right tabular-nums"
                placeholder="Masalan: 0.1"
              />
              <p className="t-caption mt-2">
                Masalan: 1ta qog'ozdan 10ta vizitka chiqsa, 0.1 deb yozing.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" className="btn-outline h-lg flex-1" onClick={() => setIsBOMOpen(false)}>Bekor</button>
            <button type="submit" className="btn-primary h-lg flex-1">Biriktirish</button>
          </div>
        </form>
      </Modal>

      {/* Sub-component Confirm Modal */}
      {confirmModal && (
        <Modal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
        >
          <div className="space-y-5">
            <p className="t-body">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="btn-outline h-lg flex-1">Bekor</button>
              <button onClick={confirmModal.onConfirm} className="btn-danger-solid h-lg flex-1">
                TASDIQLASH
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clone-to-Branch Modal */}
      <Modal
        isOpen={cloneModal.isOpen}
        onClose={() => setCloneModal({ isOpen: false, service: null })}
        title="Qaysi filialga nusxalansin?"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-card p-4">
            <div className="w-10 h-10 bg-primary-50 text-primary-700 border border-primary-200 rounded-control flex items-center justify-center font-semibold text-sm shrink-0">
              {cloneModal.service?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="t-h3 truncate">{cloneModal.service?.name}</p>
              <p className="t-caption tabular-nums">{Number(cloneModal.service?.basePrice || 0).toLocaleString('uz-UZ')} UZS / {cloneModal.service?.unit}</p>
            </div>
          </div>

          {cloneTargets.length === 0 ? (
            <div className="py-4 text-center">
              <p className="t-body-md">Nusxalash mumkin bo'lgan boshqa filial yo'q.</p>
              <p className="t-caption mt-1">Avval yangi filial qo'shing.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="form-label">Maqsad filial</label>
                <select
                  value={cloneTargetBranchId}
                  onChange={e => setCloneTargetBranchId(e.target.value)}
                  className="select-minimal"
                >
                  {cloneTargets.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <p className="t-caption">Opsiyalar ham ko'chiriladi. Narxni keyinchalik o'sha filialda tahrirlashingiz mumkin.</p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  className="btn-outline h-lg flex-1"
                  onClick={() => setCloneModal({ isOpen: false, service: null })}
                >
                  Bekor
                </button>
                <button
                  type="button"
                  disabled={isCloning}
                  onClick={handleClone}
                  className="btn-primary h-lg flex-1"
                >
                  <Copy size={16} /> {isCloning ? 'Nusxalanmoqda...' : 'Nusxalash'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Price list — mijozga ulashish uchun preview + eksport */}
      <PriceListModal
        isOpen={isPriceListOpen}
        onClose={() => setIsPriceListOpen(false)}
        tenantSlug={currentUser?.workspaceSlug || ''}
        defaultBranchId={activeBranchId}
      />

      {/* Service image edit modal */}
      <Modal
        isOpen={!!imageEditSvc}
        onClose={() => setImageEditSvc(null)}
        title={`Rasm: ${imageEditSvc?.name || ''}`}
        maxWidth="max-w-sm"
      >
        <div className="space-y-5">
          <ImageUpload
            value={imageEditSvc?.imageUrl}
            onChange={(url) => setImageEditSvc(prev => prev ? { ...prev, imageUrl: url } : prev)}
            size="lg"
          />
          <p className="t-caption">
            Bu rasm xizmatlar ro'yxatida va Price List'da ko'rinadi. Mijozga jo'natiladigan formatlarda ham chiqadi.
          </p>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              className="btn-outline h-lg flex-1"
              onClick={() => setImageEditSvc(null)}
            >
              Bekor
            </button>
            <button
              type="button"
              onClick={() => handleSaveServiceImage(imageEditSvc?.imageUrl ?? null)}
              className="btn-primary h-lg flex-1"
            >
              Saqlash
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

export default Sozlamalar;

