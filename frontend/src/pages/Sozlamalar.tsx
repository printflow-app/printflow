import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, CreditCard, Plus, Trash2, Check, X, Save, Edit3, ChevronDown, ChevronUp, AlertCircle, LayoutGrid, ReceiptText, Layers, Package, MapPin, Navigation, Wallet, BarChart2, BarChart3, Users, UserCheck, Clock, Building2, Settings, Tag, ShieldCheck, Receipt, Copy, Handshake, FileText, Image as ImageIcon } from 'lucide-react';
import { PriceListModal } from '../components/PriceListModal';
import { PriceListBrandingSection } from '../components/PriceListBrandingSection';
import { ImageUpload } from '../components/ImageUpload';
import { rolesApi, paymentTypesApi, expenseTypesApi, servicesApi, inventoryApi, settingsApi, branchesApi } from '../api';
import { useRoles, usePaymentTypes, useExpenseTypes, useTaskColumns, useServices, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { SkeletonCardGrid } from '../components/Skeleton';
import CurrencyInput from '../components/CurrencyInput';

const Billing = React.lazy(() => import('./Billing'));

const Sozlamalar: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
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
    canViewFinance: false, canAddIncome: false, canAddExpense: false, canViewTotalBalance: false, canManagePaymentTypes: false,
    canViewTasks: false, canViewAllTasks: false, canViewOwnTasks: false, canCreateTask: false, canEditTask: false, canDeleteTask: false, canMoveTask: false, canManageColumns: false,
    canViewCustomers: false, canManageCustomers: false,
    canViewEmployees: false, canManageEmployees: false, canManageRoles: false, canViewSalary: false, canManageAdmins: false,
    canManageBranches: false, canViewKpi: false, canViewExpenseCharts: false, canViewSettings: false, canAssignToOtherBranches: false,
    canManageBilling: false, canManageNotifications: false,
    canViewVendors: false, canViewInventory: false, canManageInventory: false, canViewAttendance: false, canViewAllAttendance: false, canManageAttendance: false,
    canViewServices: false, canManageServices: false,
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
        icon: <Wallet size={15} />,
        permissions: {
          canViewFinance: { label: "Sahifaga kirish — tranzaksiyalar ro'yxati", detail: "Menyu'da 'Kassa' bo'limi ko'rinadi. Kirim va chiqim tranzaksiyalari sanasi, summasi, turi bilan ro'yxati ko'rsatiladi. Sana bo'yicha filtrlash va qidirish ishlaydi." },
          canViewTotalBalance: { label: "Umumiy kassa balansini ko'rish", detail: "Sahifa yuqorisidagi 'Jami Balans' kartochkasi ko'rinadi. Ruxsat yo'q bo'lsa summa '•••••' bilan yashiriladi va faqat o'z tranzaksiyalarini ko'rish mumkin bo'ladi." },
          canAddIncome: { label: "Kirim (tushum) qo'shish", detail: "'+ Kirim' tugmasi faol bo'ladi. Mijozdan to'lov qabul qilish, buyurtma bilan bog'lash, to'lov turini tanlash — bularning barchasi kiritiladi." },
          canAddExpense: { label: "Chiqim (xarajat) qo'shish", detail: "'+ Chiqim' tugmasi faol bo'ladi. Xarajat turi, summa, izoh va to'lov usuli bilan chiqim kiritish. Xodim maoshi uchun esa alohida 'Maosh' turi mavjud." },
          canExportFinance: { label: "Excel'ga eksport qilish", detail: "Kassa sahifasida 'EKSPORT' tugmasi ko'rinadi. Joriy filtr (sana oralig'i, qidiruv) bo'yicha barcha tranzaksiyalarni .xlsx faylga yuklab olish imkoni." },
        }
      },
      {
        title: '2. Xizmatlar (Kanban) — buyurtmalar',
        color: 'amber',
        icon: <LayoutGrid size={15} />,
        permissions: {
          canViewTasks: { label: "Kanban sahifasiga kirish", detail: "Menyu'da 'Xizmatlar' bo'limi ko'rinadi. Buyurtmalar kanban doskasiniga umumiy kirish imkoni." },
          canViewAllTasks: { label: "Barcha buyurtmalarni ko'rish", detail: "Barcha xodimga biriktirilgan buyurtmalar ko'rinadi. Bu ruxsat yo'q bo'lsa xodim faqat o'ziga biriktirilgan buyurtmalarni ko'ra oladi." },
          canViewOwnTasks: { label: "Faqat o'ziga biriktirilgan buyurtmalarni ko'rish", detail: "Boshqa xodimlarning buyurtmalari yashiriladi. Faqat o'z ismiga biriktirilgan kartochkalar ko'rinadi." },
          canCreateTask: { label: "Yangi buyurtma yaratish", detail: "'+ Yangi Buyurtma' tugmasi ko'rinadi va ishlaydi. Ruxsat yo'q bo'lsa bu tugma umuman ko'rinmaydi." },
          canEditTask: { label: "Buyurtma ma'lumotlarini tahrirlash", detail: "Buyurtma kartochkasida 'Tahrirlash' tugmasi ko'rinadi. Mijoz, xizmat, narx, izoh, deadline va boshqa maydonlarni o'zgartirish mumkin." },
          canDeleteTask: { label: "Buyurtmani o'chirish yoki arxivlash", detail: "'O'chirish' va 'Arxivlash' tugmalari ko'rinadi. Ruxsat yo'q bo'lsa bu tugmalar umuman ko'rinmaydi." },
          canMoveTask: { label: "Buyurtmani bosqichdan bosqichga ko'chirish", detail: "'Bosqichni o'zgartirish' tugmasi faol bo'ladi. Buyurtmani keyingi yoki oldingi kanban ustuniga ko'chirish va izoh qoldirish mumkin." },
          canManageColumns: { label: "Kanban ustunlarini (bosqichlarni) boshqarish", detail: "Yangi bosqich (ustun) qo'shish, mavjudini nomini o'zgartirish va tartibini belgilash imkoni." },
          canExportTasks: { label: "Excel'ga eksport qilish", detail: "Kanban sahifasida 'EKSPORT' tugmasi ko'rinadi. Barcha buyurtmalarni bosqich, mijoz, summa va deadline ma'lumotlari bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '3. Xizmatlar katalogi (Pricing Engine)',
        color: 'slate',
        icon: <Layers size={15} />,
        permissions: {
          canViewServices: { label: "Xizmatlar katalogini ko'rish", detail: "'Xizmatlar katalogi' alohida sidebar tab ko'rinadi (Operatsiya guruhida). Bosma xizmatlar: nomi, birlik, asosiy narx, opsiyalar va material normasi (BOM) ko'rsatiladi." },
          canManageServices: { label: "Xizmat va opsiyalarni qo'shish, tahrirlash, o'chirish", detail: "Yangi xizmat qo'shish va narxini belgilash. Opsiyalar (qo'shimcha parametrlar) yaratish. Material normalarini bog'lash va o'zgartirish. Xizmatni o'chirish." },
        }
      },
      {
        title: '4. Mijozlar Bazasi',
        color: 'violet',
        icon: <Users size={15} />,
        permissions: {
          canViewCustomers: { label: "Mijozlar ro'yxatini ko'rish", detail: "Menyu'da 'Mijozlar' bo'limi ko'rinadi. Mijozlar jadvali: ism, telefon, jami buyurtmalar, qarz holati va oxirgi aloqa ko'rsatiladi." },
          canAddCustomer: { label: "Yangi mijoz qo'shish", detail: "'+ Yangi Mijoz' tugmasi ko'rinadi. Ism, telefon, manzil va qo'shimcha kontaktlar bilan yangi mijoz kartochkasi yaratish imkoni." },
          canEditCustomer: { label: "Mijoz ma'lumotlarini tahrirlash", detail: "Har bir mijoz qatorida 'Tahrirlash' tugmasi ko'rinadi. Ism, telefon, manzil, telegram va boshqa ma'lumotlarni o'zgartirish mumkin." },
          canDeleteCustomer: { label: "Mijozni tizimdan o'chirish", detail: "Mijoz qatorida 'O'chirish' tugmasi ko'rinadi. Mijozni tizimdan butunlay o'chirish — bu amalni ortga qaytarish mumkin emas." },
          canManageCustomers: { label: "Kontaktlar, buyurtmalar va to'lovlar tarixi", detail: "Mijoz detali modalida: barcha buyurtmalar ro'yxati, to'lov tarixi, qarz holati va kontakt raqamlarini ko'rish va boshqarish imkoni." },
          canExportCustomers: { label: "Excel'ga eksport qilish", detail: "Mijozlar sahifasida 'EKSPORT' tugmasi ko'rinadi. Barcha mijozlarni ism, telefon, qarz, jami to'lov va buyurtmalar soni bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '5. Ombor',
        color: 'amber',
        icon: <Package size={15} />,
        permissions: {
          canViewInventory: { label: "Ombor sahifasiga kirish — materiallar ro'yxati", detail: "Menyu'da 'Ombor' ko'rinadi. Materiallar/xom ashyo nomlari, joriy zaxira miqdori, minimum chegara va holat (yetarli/kam/kritik) ko'rsatiladi." },
          canAddInventoryItem: { label: "Yangi material nomi qo'shish", detail: "'+ Material Qo'shish' tugmasi ko'rinadi. Yangi xom ashyo yoki material nomini, o'lchov birligini va minimum zaxira chegarasini kiritish." },
          canReceiveInventory: { label: "Kirim — yangi zaxira qabul qilish", detail: "Har bir material kartasida 'Kirim' tugmasi ko'rinadi. Yangi kelgan material miqdorini kiritish, narx va izoh bilan yozib qo'yish." },
          canUseInventory: { label: "Chiqim — sarflanish kiritish", detail: "Material kartasida 'Chiqim' tugmasi ko'rinadi. Ishlab chiqarishga sarflangan material miqdorini kiritish va xarajat sifatida qayd etish." },
          canWriteOffInventory: { label: "Brak — yaroqsiz materiallarni hisobdan chiqarish", detail: "Material kartasida 'Brak' tugmasi ko'rinadi. Yaroqsiz yoki yo'qolgan materiallarni hisobdan o'chirish. Sabab va miqdor ko'rsatiladi." },
          canManageInventory: { label: "Material ma'lumotlarini tahrirlash va o'chirish", detail: "Material nomini, o'lchov birligini va minimum zaxira miqdorini o'zgartirish. Keraksiz materialni ro'yxatdan o'chirish imkoni." },
          canExportInventory: { label: "Excel'ga eksport qilish", detail: "Ombor sahifasida 'EKSPORT' tugmasi ko'rinadi. Barcha materiallarni nomi, birligi, joriy zaxira va minimum chegara bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '6. Davomat',
        color: 'teal',
        icon: <Clock size={15} />,
        permissions: {
          canViewAttendance: { label: "Sahifaga kirish — o'z davomatini ko'rish va belgilash", detail: "Menyu'da 'Davomat' ko'rinadi. Xodim o'z keldi/ketti vaqtini QR kod yoki 'Keldim' tugmasi bilan belgilaydi. Faqat o'z tarixi ko'rinadi." },
          canViewAllAttendance: { label: "Barcha xodimlar davomatini ko'rish", detail: "Barcha xodimlarning kunlik davomat jadvali, oylik matritsa ko'rinishi, kech qolish daqiqalari statistikasi va xodim bo'yicha filtrlash." },
          canManageAttendance: { label: "Qo'lda davomat kiritish va tizim sozlamalari", detail: "Qurilmasiz xodimlar uchun admin keldi/ketti vaqtini qo'lda kiritadi. Ofis Wi-Fi IP manzillar allowlist (ruxsat etilgan tarmoqlar) sozlamasi." },
          canExportAttendance: { label: "Excel'ga eksport qilish", detail: "Davomat sahifasida 'EKSPORT' tugmasi ko'rinadi. Oylik davomat matritsasini xodimlar bo'yicha kun-kun .xlsx faylga yuklab olish." },
        }
      },

      // === TAHLIL ===
      {
        title: '7. Statistika',
        color: 'sky',
        icon: <BarChart2 size={15} />,
        permissions: {
          canViewStatistics: { label: "Statistika sahifasiga kirish — dashboard", detail: "Menyu'da 'Statistika' ko'rinadi. Jami kirim summasi, bajarilgan buyurtmalar soni, kutilayotgan buyurtmalar (muddati o'tganlar bilan) va davr filtri — bularning barchasi ko'rsatiladi." },
          canViewKpi: { label: "Xodimlar samaradorligi liderboard (KPI)", detail: "Xodimlar liderboard jadvali: bajarilgan buyurtmalar, muddatga rioya foizi, o'rtacha bajarish soati, daromad ulushi va samaradorlik reytingi ko'rsatiladi. Ruxsat yo'q bo'lsa faqat o'z KPI kartochkasi ko'rinadi." },
        }
      },
      {
        title: '8. Hisobotlar',
        color: 'orange',
        icon: <BarChart3 size={15} />,
        permissions: {
          canViewGrowthCards: { label: "O'sish ko'rsatkichlari kartochkalari", detail: "Bu oy daromad, yangi mijozlar soni, bajarilgan buyurtmalar — har biri o'tgan oy bilan foizli taqqoslab ko'rsatiladi. Sof foyda jami kartochkasi ham shu bo'limda." },
          canViewFinanceReports: { label: "Moliyaviy Dinamika grafigi", detail: "Kunlik (qisqa davr) yoki oylik (uzun davr) kirim / chiqim / hamkor xarajati / sof foyda trend chiziqlari. Davr filtri orqali '1 oy' — '1 yil' oralig'ini ko'rish mumkin." },
          canViewIncomeByType: { label: "Kirim Turlari diagrammasi", detail: "Naqd, Karta, Click, Payme, Bank o'tkazmasi kabi to'lov usullari bo'yicha tushum foizi va summasi — doira (pie) diagramma va yonma-yon ro'yxat." },
          canViewExpenseByType: { label: "Chiqim Turlari diagrammasi", detail: "Har xil xarajat kategoriyalari bo'yicha chiqimlar ulushi — doira diagramma. Qaysi turdagi xarajat ko'p ekanligi vizual ko'rinadi." },
          canViewExpenseCharts: { label: "Chiqim Tahlili (kategoriyalar bo'yicha)", detail: "Har bir xarajat kategoriyasi bo'yicha aniq summa va umumiy chiqimdagi ulushi. Eng ko'p sarflangan yo'nalishlarni tezda aniqlash." },
          canViewServiceReports: { label: "Xizmat Hajmi & O'rtacha Chek", detail: "Xizmat tanlash orqali: buyurtmalar soni, jami daromad, o'rtacha chek va barcha daromaddagi ulushi ko'rsatiladi. Xizmatlar daromad bo'yicha reytingi ham ko'rinadi." },
          canViewCostCalculator: { label: "Tannarx Kalkulyatori", detail: "Buyurtma ID yoki nomi bo'yicha qidirish. Xarajat qatorlarini qo'shish, 1 donaga tannarx va sof foyda/marja foizini real vaqtda hisoblash." },
          canExportReports: { label: "Excel'ga eksport qilish", detail: "Hisobotlar sahifasida 'EKSPORT' tugmasi ko'rinadi. Joriy hisobot ma'lumotlari (xizmatlar, hamkorlar, dinamika va h.k.) .xlsx faylga yuklab olinadi." },
        }
      },

      // === BOSHQARUV ===
      {
        title: '9. Xodimlar',
        color: 'indigo',
        icon: <UserCheck size={15} />,
        permissions: {
          canViewEmployees: { label: "Xodimlar ro'yxatini ko'rish", detail: "Menyu'da 'Xodimlar' bo'limi ko'rinadi. Xodimlar jadvali: ism, lavozim, telefon, filial, login va holat ma'lumotlari." },
          canAddEmployee: { label: "Yangi xodim qo'shish", detail: "'+ Yangi Xodim' tugmasi ko'rinadi. Ism, telefon, lavozim, filial va boshlang'ich maosh kiritib yangi xodim yaratish. Tizim avtomatik login va parol generatsiya qiladi." },
          canEditEmployee: { label: "Xodim ma'lumotlarini tahrirlash", detail: "Xodim qatorida 'Tahrirlash' tugmasi ko'rinadi. Ism, telefon, lavozim, filial va boshqa ma'lumotlarni o'zgartirish mumkin." },
          canDeleteEmployee: { label: "Xodim hisobini o'chirish", detail: "Xodim qatorida 'O'chirish' tugmasi ko'rinadi. Xodim tizimdan chiqariladi va uning hisobiga kirish bloklanadi." },
          canResetEmployeePassword: { label: "Login va parol yangilash", detail: "'Yangi parol' tugmasi ko'rinadi. Xodim parolini qayta generatsiya qilish va yangi login ma'lumotlarini ko'rish imkoni." },
          canViewSalary: { label: "Xodim maosh summalarini ko'rish", detail: "Xodimlar jadvalida va profilida boshlang'ich maosh, berilgan avans va qarz summasi ko'rinadi. Ruxsat yo'q bo'lsa bu raqamlar yashiriladi." },
          canExportEmployees: { label: "Excel'ga eksport qilish", detail: "Xodimlar sahifasida 'EKSPORT' tugmasi ko'rinadi. Barcha xodimlarni ism, lavozim, telefon, login va filial ma'lumotlari bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: "10. Ma'muriyat (Adminlar)",
        color: 'rose',
        icon: <ShieldCheck size={15} />,
        permissions: {
          canManageAdmins: { label: "Workspace admin hisoblarini boshqarish", detail: "Menyu'da 'Ma'muriyat' bo'limi ko'rinadi. Admin hisobi yaratish, login/parolni ko'rish, yangi parol generatsiya qilish va admin hisobini o'chirish imkoni. Bu sahifa juda yuqori darajali ruxsat." },
        }
      },
      {
        title: '11. Hamkorlar',
        color: 'cyan',
        icon: <Handshake size={15} />,
        permissions: {
          canViewVendors: { label: "Hamkorlar ro'yxatini ko'rish", detail: "Menyu'da 'Hamkorlar' bo'limi ko'rinadi. Hamkorlar (subpudratchilar) kartochkalari: ism, mutaxassislik, telefon, joriy qarz holati va jami buyurtmalar soni. Hamkor detalini ochish mumkin." },
          canManageVendors: { label: "Hamkorlarni qo'shish, tahrirlash, o'chirish va to'lov", detail: "'+ Hamkor' tugmasi ko'rinadi. Yangi hamkor yaratish. Mavjud hamkor ma'lumotlarini o'zgartirish. Hamkorga to'lov kiritish (qarzni kamaytirish). Hamkorni o'chirish." },
          canExportVendors: { label: "Excel'ga eksport qilish", detail: "Hamkorlar sahifasida 'EKSPORT' tugmasi ko'rinadi. Barcha hamkorlarni ism, mutaxassislik, telefon va qarz holati bilan .xlsx faylga yuklab olish." },
        }
      },
      {
        title: '12. Filiallar',
        color: 'cyan',
        icon: <Building2 size={15} />,
        permissions: {
          canViewBranches: { label: "Filiallar ro'yxatini ko'rish", detail: "Menyu'da 'Filiallar' bo'limi ko'rinadi. Barcha filiallar ro'yxati: nomi, manzili, telefon raqami va mas'ul menejer ismi. Har filialning bo'limlari ham ko'rinadi." },
          canManageBranches: { label: "Filiallarni qo'shish va boshqarish", detail: "'+ Yangi Filial' tugmasi ko'rinadi. Filial yaratish, manzil va mas'ul menejerini belgilash. Bo'lim (Department) qo'shish, tahrirlash, o'chirish. Mavjud filialni tahrirlash va o'chirish." },
        }
      },
      {
        title: '13. Tizim Sozlamalari',
        color: 'gray',
        icon: <Settings size={15} />,
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
        icon: <Receipt size={15} />,
        permissions: {
          canViewBillingStatus: { label: "Obuna holati va muddatini ko'rish", detail: "Menyu'da 'Obuna' ko'rinadi. Joriy tarif nomi, obuna muddati, qolgan kunlar va holat (faol/sinov/muddati o'tgan) kartochkasi ko'rsatiladi." },
          canManageBilling: { label: "To'lov yuborish va obuna yangilash", detail: "Tarif tanlash, to'lov cheki yuborish, promo kod kiritish va cashback balansini qo'llash. To'lov tasdiqlanib obuna yangilanadi." },
        }
      },
      {
        title: '15. Kross-filial ruxsatlar',
        color: 'fuchsia',
        icon: <Building2 size={15} />,
        permissions: {
          canAssignToOtherBranches: { label: "Boshqa filial xodimlariga buyurtma berish", detail: "Buyurtma yaratish yoki tahrirlashda o'z filialidan tashqaridagi xodimlarni mas'ul qilib tayinlash imkoni paydo bo'ladi. Multi-filial kompaniyalarda outsourcing uchun ishlatiladi." },
        }
      },
    ];

  const allPermissionKeys = permissionGroups.flatMap(g => Object.keys(g.permissions));
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  if (isLoading) return <SkeletonCardGrid count={6} />;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Tabs Switcher */}
      <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
        {[
          { id: 'general', label: 'Asosiy Sozlamalar', icon: Settings, activeClass: 'bg-orange-600 text-white shadow-orange-500/20' },
          { id: 'billing', label: 'Obuna va To\'lovlar', icon: CreditCard, activeClass: 'bg-orange-600 text-white shadow-orange-500/20' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSettingsTab(tab.id as any)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border-2 ${activeSettingsTab === tab.id
                ? `${tab.activeClass} border-transparent shadow-lg`
                : 'bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSettingsTab === 'billing' && (
        <div className="animate-fade-in">
          <React.Suspense fallback={<LoadingSpinner />}>
            <Billing />
          </React.Suspense>
        </div>
      )}

      {activeSettingsTab === 'general' && (
        <div className="space-y-10 animate-fade-in">
          {statusMessage && createPortal(
            <div className={`fixed top-4 right-4 z-[2000] p-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up ${statusMessage.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
              {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span className="font-bold text-xs tracking-tight">{statusMessage.text}</span>
            </div>,
            document.body,
          )}

          {/* Roles Section */}
          {(isAdmin || p.canViewRoles || p.canManageRoles) && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                <div>
                  <h3 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <Shield className="text-orange-600" size={22} /> Lavozimlar & Ruxsatlar
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sahifalar va funksiyalarga dostupni sozlash</p>
                </div>
                {(isAdmin || p.canManageRoles) && (
                  <button data-tour-id="lavozim-add" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white h-10 px-6 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 transition-all" onClick={() => setIsRoleModalOpen(true)}>
                    <Plus size={16} strokeWidth={3} /> Yangi Lavozim
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {roles.map(role => {
                  const isEditing = editingRoleId === role.id;
                  const isExpanded = expandedRoleId === role.id;
                  const dataSource = isEditing ? editRoleData : role;

                  return (
                    <div key={role.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 ${isEditing ? 'border-orange-400 ring-4 ring-orange-50' : 'border-slate-200 hover:border-slate-300 hover:shadow-lg'}`}>

                      {/* Role header */}
                      <div className={`flex items-center justify-between p-5 cursor-pointer ${isExpanded ? 'bg-slate-50/50' : ''}`} onClick={() => !isEditing && setExpandedRoleId(isExpanded ? null : role.id)}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center font-bold text-base border border-orange-200 shadow-inner">
                            {role.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-base text-slate-800 uppercase tracking-tight">{role.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${allPermissionKeys.filter(k => role[k]).length > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                {allPermissionKeys.filter(k => role[k]).length} Ruxsat
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">Aktiv</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <>
                              <button onClick={saveEditRole} className="h-9 px-5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-95">
                                <Save size={14} /> SAQLASH
                              </button>
                              <button onClick={cancelEditRole} className="h-9 px-5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-all">
                                BEKOR
                              </button>
                            </>
                          ) : (
                            <>
                              {(isAdmin || p.canManageRoles) && (
                                <>
                                  <button onClick={() => startEditRole(role)} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-orange-500 hover:text-white hover:shadow-md transition-all active:scale-90">
                                    <Edit3 size={14} />
                                  </button>
                                  <button onClick={() => handleDeleteRole(role.id)} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white hover:shadow-md transition-all active:scale-90">
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                              <button onClick={() => setExpandedRoleId(isExpanded ? null : role.id)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-orange-600 text-white shadow-md shadow-orange-500/30' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                {isExpanded ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Permissions grid (expanded or editing) */}
                      {(isExpanded || isEditing) && (
                        <div className="px-8 pb-8 border-t border-slate-100 pt-8 animate-slide-up">
                          <div className="space-y-8">
                            {permissionGroups.map(group => (
                              <div key={group.title}>
                                <div className="flex items-center gap-2.5 mb-4">
                                  <span className={`text-${group.color}-600 flex-shrink-0`}>{group.icon}</span>
                                  <h5 className={`text-[11px] font-bold uppercase tracking-[0.25em] text-${group.color}-700`}>
                                    {group.title}
                                  </h5>
                                  <div className="flex-1 h-px bg-slate-100" />
                                  <span className="text-[9px] font-bold text-slate-300 uppercase">
                                    {Object.keys(group.permissions).filter(k => dataSource[k]).length}/{Object.keys(group.permissions).length}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {Object.entries(group.permissions).map(([key, perm]) => {
                                    const isOn = isEditing ? !!editRoleData[key] : !!dataSource[key];
                                    return (
                                      <div
                                        key={key}
                                        className={`flex items-start gap-3 p-4 rounded-2xl border transition-all duration-200 ${isEditing
                                            ? `cursor-pointer ${isOn ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' : 'bg-white border-slate-200 hover:border-orange-300 hover:shadow-sm'}`
                                            : isOn ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50/50 border-slate-100 opacity-60'
                                          }`}
                                        onClick={() => isEditing && setEditRoleData({ ...editRoleData, [key]: !editRoleData[key] })}
                                      >
                                        {/* Toggle or status indicator */}
                                        <div className="shrink-0 mt-0.5">
                                          {isEditing ? (
                                            <div className={`w-10 h-6 rounded-full relative transition-all ${isOn ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isOn ? 'left-5' : 'left-1'}`} />
                                            </div>
                                          ) : isOn ? (
                                            <div className="w-6 h-6 bg-emerald-500 text-white rounded-lg flex items-center justify-center shadow-sm shadow-emerald-500/30">
                                              <Check size={13} strokeWidth={3} />
                                            </div>
                                          ) : (
                                            <div className="w-6 h-6 bg-slate-200/60 text-slate-300 rounded-lg flex items-center justify-center">
                                              <X size={12} strokeWidth={3} />
                                            </div>
                                          )}
                                        </div>
                                        {/* Label + detail */}
                                        <div className="min-w-0 flex-1">
                                          <p className={`text-[11px] font-bold uppercase tracking-tight leading-tight ${isOn ? 'text-slate-800' : 'text-slate-500'}`}>
                                            {perm.label}
                                          </p>
                                          <p className="text-[10px] font-medium text-slate-400 mt-1 leading-snug normal-case tracking-normal">
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
                            <div className="mt-10 p-5 bg-orange-50 rounded-2xl border border-orange-100 flex items-start gap-4">
                              <AlertCircle className="text-orange-500 mt-1" size={20} />
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-orange-900 uppercase">Ruxsatlarni tahrirlash</p>
                                <p className="text-[11px] font-bold text-orange-700">Tugmalarni bosish orqali ruxsatlarni yoqishingiz yoki o'chirishingiz mumkin. Saqlash tugmasini bosishni unutmang.</p>
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
          {(isAdmin || p.canManagePaymentTypes) && (
            <section className="space-y-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm transition-all hover:shadow-md">
                <form data-tour-id="payment-type-form" onSubmit={handleAddPT} className="flex flex-col md:flex-row gap-3 mb-6 pb-6 border-b border-slate-100">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      required
                      value={newPT}
                      onChange={(e) => setNewPT(e.target.value)}
                      className="w-full h-12 text-base font-bold bg-slate-50 border-2 border-slate-50 rounded-xl px-5 outline-none focus:bg-white focus:border-sky-500 transition-all placeholder:text-slate-300 shadow-inner"
                      placeholder="Yangi usul nomi (Click, Uzcard...)"
                    />
                  </div>
                  <button type="submit" className="h-12 px-10 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs uppercase tracking-[0.1em] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 active:scale-95">
                    <Plus size={18} strokeWidth={3} /> QO'SHISH
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {paymentTypes.map(pt => {
                    const isEditingPT = editingPTId === pt.id;
                    return (
                      <div key={pt.id} className={`group p-5 rounded-2xl border-2 transition-all duration-300 ${isEditingPT ? 'bg-white border-sky-500 shadow-lg' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-sky-200 hover:shadow-md'}`}>
                        {isEditingPT ? (
                          <div className="flex flex-col gap-3">
                            <input
                              type="text"
                              autoFocus
                              value={editPTName}
                              onChange={(e) => setEditPTName(e.target.value)}
                              className="w-full h-10 text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-sky-500"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdatePT(pt.id)} className="flex-1 h-8 bg-sky-500 text-white text-[10px] font-bold rounded-md hover:bg-sky-600 transition-colors">SAQLASH</button>
                              <button onClick={() => setEditingPTId(null)} className="flex-1 h-8 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md hover:bg-slate-200">BEKOR</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-800 uppercase tracking-tighter truncate pr-4">{pt.name}</span>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingPTId(pt.id); setEditPTName(pt.name); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-sky-500 hover:bg-sky-50 border border-slate-100 flex items-center justify-center transition-all">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => { setConfirmModal({ isOpen: true, title: "O'chirish", message: "${pt.name} o'chirilsinmi?", onConfirm: () => { paymentTypesApi.delete(pt.id).then(() => fetchData(true)); setConfirmModal(null); } }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {paymentTypes.length === 0 && (
                    <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[2rem]">
                      <CreditCard size={40} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">Hozircha to'lov turlari mavjud emas</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Expense Types Section */}
          {(isAdmin || p.canManageExpenseTypes) && (
            <section className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <ReceiptText className="text-rose-500" size={24} /> Xarajat Turlari
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Chiqimlar uchun maxsus kategoriyalar</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm transition-all hover:shadow-md">
                <form onSubmit={handleAddET} className="flex flex-col md:flex-row gap-3 mb-6 pb-6 border-b border-slate-100">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      required
                      value={newET}
                      onChange={(e) => setNewET(e.target.value)}
                      className="w-full h-12 text-base font-bold bg-slate-50 border-2 border-slate-50 rounded-xl px-5 outline-none focus:bg-white focus:border-rose-500 transition-all placeholder:text-slate-300 shadow-inner"
                      placeholder="Xarajat turi nomi (Material, Kommunal...)"
                    />
                  </div>
                  <button type="submit" className="h-12 px-10 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-[0.1em] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all hover:-translate-y-0.5 active:scale-95">
                    <Plus size={18} strokeWidth={3} /> QO'SHISH
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {expenseTypes.map(et => {
                    const isEditingET = editingETId === et.id;
                    return (
                      <div key={et.id} className={`group p-5 rounded-2xl border-2 transition-all duration-300 ${isEditingET ? 'bg-white border-rose-500 shadow-lg' : 'bg-slate-50/50 border-transparent hover:bg-white hover:border-rose-200 hover:shadow-md'}`}>
                        {isEditingET ? (
                          <div className="flex flex-col gap-3">
                            <input
                              type="text"
                              autoFocus
                              value={editETName}
                              onChange={(e) => setEditETName(e.target.value)}
                              className="w-full h-10 text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 outline-none focus:border-rose-500"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateET(et.id)} className="flex-1 h-8 bg-rose-500 text-white text-[10px] font-bold rounded-md hover:bg-rose-600 transition-colors">SAQLASH</button>
                              <button onClick={() => setEditingETId(null)} className="flex-1 h-8 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md hover:bg-slate-200">BEKOR</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-800 uppercase tracking-tighter truncate pr-4">{et.name}</span>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingETId(et.id); setEditETName(et.name); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center transition-all">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => { setConfirmModal({ isOpen: true, title: "O'chirish", message: "${et.name} o'chirilsinmi?", onConfirm: () => { expenseTypesApi.delete(et.id).then(() => fetchData(true)); setConfirmModal(null); } }); }} className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 flex items-center justify-center transition-all">
                                <Trash2 size={14} />
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
          {(isAdmin || p.canManageGeneralSettings) && (
            <section className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                    <Save className="text-orange-500" size={28} /> Umumiy Sozlamalar
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tizim darajasidagi qoidalar va chegaralar</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">
                      Minimal zakolat foizi (%)
                    </label>
                    <p className="text-[10px] font-bold text-amber-600 mb-3">
                      Yangi buyurtma qo'shishda zakolat shu foizdan kam bo'lsa ogohlantirish chiqadi
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min="0" max="100" step="5"
                        value={minPrepaymentPct}
                        onChange={e => setMinPrepaymentPct(Number(e.target.value))}
                        className="flex-1 accent-orange-500"
                      />
                      <span className="text-2xl font-bold text-orange-600 w-14 text-right">{minPrepaymentPct}%</span>
                    </div>
                  </div>
                  <button
                    onClick={savePrepaymentPct}
                    disabled={savingPrepayment}
                    className="h-11 px-6 bg-orange-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {savingPrepayment ? 'SAQLANMOQDA...' : 'SAQLASH'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Davomat — GPS Geofencing */}
          {(isAdmin || p.canManageAttendance) && (
            <section className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                    <MapPin className="text-emerald-500" size={28} /> Davomat va Geofencing
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Xodimlar faqat ofis hududi (radius)da davomat belgilashi mumkin
                  </p>
                </div>

                {/* Auto-detect helper — faqat edit modeda ko'rinadi */}
                {geoEditMode && <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                  <Navigation className="text-emerald-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="flex-1 space-y-2">
                    <p className="text-[11px] font-bold text-emerald-700">
                      Ofisda turganda "Hozirgi joylashuvimni aniqlash" tugmasini bosing — koordinatalar avtomatik to'ldiriladi.
                    </p>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={detectingGps}
                      className="h-9 px-4 bg-white border border-emerald-200 hover:border-emerald-400 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Navigation size={12} className={detectingGps ? 'animate-pulse' : ''} />
                      {detectingGps ? 'Aniqlanmoqda...' : 'Hozirgi joylashuvimni aniqlash'}
                    </button>
                  </div>
                </div>}

                {/* Coordinate display / edit */}
                {!geoEditMode ? (
                  /* ── View mode: read-only ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Kenglik (Latitude)', value: officeLat },
                        { label: 'Uzunlik (Longitude)', value: officeLng },
                        { label: 'Radius (metr)', value: officeRadius },
                      ].map(f => (
                        <div key={f.label} className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{f.label}</p>
                          <p className="font-mono font-bold text-slate-800 text-sm">{f.value || '—'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setGeoEditMode(true)}
                        className="h-10 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all flex items-center gap-2"
                      >
                        <MapPin size={13} /> Tahrirlash
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Edit mode: inputs ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          Kenglik (Latitude)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={officeLat}
                          onChange={e => setOfficeLat(e.target.value)}
                          placeholder="41.299496"
                          className="input-minimal font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          Uzunlik (Longitude)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={officeLng}
                          onChange={e => setOfficeLng(e.target.value)}
                          placeholder="69.240073"
                          className="input-minimal font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          Radius (metr)
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="5000"
                          value={officeRadius}
                          onChange={e => setOfficeRadius(e.target.value)}
                          placeholder="50"
                          className="input-minimal font-mono text-sm"
                        />
                      </div>
                    </div>

                    {(!officeLat || !officeLng) && (
                      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                        <p className="text-[11px] font-bold text-rose-700 mb-1 flex items-center gap-1.5">
                          <AlertCircle size={13} /> GPS sozlanmagan
                        </p>
                        <p className="text-[10px] font-bold text-rose-600">
                          Koordinatalar kiritilmasa xodimlar davomat belgilolmaydi.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      {officeLat && officeLng && (
                        <button
                          type="button"
                          onClick={() => setGeoEditMode(false)}
                          className="h-11 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all"
                        >
                          Bekor qilish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={saveGeoSettings}
                        disabled={savingGeo}
                        className="h-11 px-6 bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-60"
                      >
                        <Save size={14} /> {savingGeo ? 'Saqlanmoqda...' : 'Saqlash'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Services Catalog Section */}
          {(isAdmin || p.canViewServices || p.canAddService || p.canEditService || p.canDeleteService) && (
            <ServicesCatalogSection services={services} onRefresh={() => fetchData(true)} showStatus={showStatus} currentUser={currentUser} activeBranchId={activeBranchId} />
          )}

          {/* Narx Ro'yxati Brandingi */}
          {(isAdmin || p.canManageServices) && (
            <PriceListBrandingSection tenantSlug={currentUser?.tenant?.slug} activeBranchId={activeBranchId} />
          )}

          {/* Role Modal */}
          <Modal
            isOpen={isRoleModalOpen}
            onClose={() => setIsRoleModalOpen(false)}
            title="Yangi Lavozim Qo'shish"
            maxWidth="max-w-3xl"
          >
            <form onSubmit={handleAddRole} className="space-y-10">
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Lavozim Nomi (Masalan: Admin, Katta Hodim, Manager...)</label>
                <input type="text" required value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className="w-full h-16 text-2xl font-bold bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 outline-none focus:bg-white focus:border-orange-500 transition-all shadow-inner placeholder:text-slate-200" placeholder="Manager..." />
              </div>

              <div className="space-y-8">
                {permissionGroups.map(group => (
                  <div key={group.title} className="space-y-3">
                    <h4 className={`text-[11px] font-bold uppercase tracking-[0.3em] flex items-center gap-2 border-b pb-3 text-${group.color}-700 border-${group.color}-100`}>
                      <span>{group.icon}</span>{group.title}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(group.permissions).map(([key, perm]) => (
                        <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                          <input
                            type="checkbox"
                            checked={!!(newRole as any)[key]}
                            onChange={(e) => setNewRole({ ...newRole, [key]: e.target.checked })}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 shrink-0"
                          />
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-800 block">{perm.label}</span>
                            <span className="text-[10px] font-medium text-slate-400 leading-snug normal-case">{perm.detail}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-4 pt-10 border-t border-slate-100 mt-10">
                <button type="button" className="h-14 px-10 text-xs font-bold uppercase tracking-widest bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all font-bold" onClick={() => setIsRoleModalOpen(false)}>BEKOR QILISH</button>
                <button type="submit" className="h-14 px-16 text-sm font-bold tracking-[0.1em] bg-gradient-to-r from-orange-500 to-orange-700 text-white rounded-2xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-1 transition-all active:translate-y-0 uppercase">YARATISH VA SAQLASH</button>
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
              <div className="space-y-6">
                <p className="text-sm font-bold text-slate-600">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmModal(null)} className="flex-1 btn-outline h-12">BEKOR QILISH</button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className="flex-1 btn-primary bg-orange-600 text-white h-12 rounded-xl font-bold uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20"
                  >
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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOptionOpen, setIsOptionOpen] = useState(false);
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);

  // Dashboard global Ctrl+P listener'i 'pf:open-price-list' eventini yuboradi —
  // shu joyda ushlab Price List modalni ochamiz.
  useEffect(() => {
    const onOpen = () => setIsPriceListOpen(true);
    window.addEventListener('pf:open-price-list', onOpen);
    return () => window.removeEventListener('pf:open-price-list', onOpen);
  }, []);
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
        <div>
          <h3 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Layers className="text-orange-600" size={20} /> Xizmatlar Katalogi
          </h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Pricing Engine — xizmat va opsiyalar narxlari</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {services.length > 0 && (
            <button
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 h-10 px-4 text-xs font-bold uppercase tracking-widest rounded-xl border-2 border-slate-200 hover:border-orange-300 transition-all"
              onClick={() => setIsPriceListOpen(true)}
              title="Mijozga jo'natish uchun price list"
            >
              <FileText size={14} strokeWidth={2.5} /> Price list
            </button>
          )}
          {canAdd && (
            <button
              data-tour-id="xizmat-add"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white h-10 px-5 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 transition-all"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus size={16} strokeWidth={3} /> Yangi Xizmat
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {services.length === 0 && (
          // Catalog is strictly branch-scoped: with no active branch (multi-branch
          // tenant on "Barcha filiallar") the list is empty even though services
          // exist. Guide the user to pick a branch instead of implying none exist.
          !activeBranchId && branches.length > 1 ? (
            <div className="bg-white rounded-3xl border border-dashed border-orange-200 py-20 flex flex-col items-center gap-3 text-orange-300">
              <Layers size={40} />
              <p className="font-bold uppercase tracking-widest text-xs text-orange-400">Avval yuqoridan filialni tanlang</p>
              <p className="text-[11px] text-slate-400 normal-case tracking-normal font-medium">Xizmatlar katalogi har bir filialga alohida bog'langan</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 py-20 flex flex-col items-center gap-3 text-slate-300">
              <Tag size={40} />
              <p className="font-bold uppercase tracking-widest text-xs">Hozircha xizmatlar yo'q</p>
            </div>
          )
        )}
        {services.map(svc => {
          const isExpanded = expandedId === svc.id;
          const isEditing = editSvcId === svc.id;
          return (
            <div key={svc.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${isEditing ? 'border-orange-400 ring-4 ring-orange-50' : 'border-slate-200 hover:shadow-md hover:border-slate-300'}`}>
              {/* Service header */}
              <div className="flex items-center justify-between p-3 sm:p-5 cursor-pointer" onClick={() => !isEditing && setExpandedId(isExpanded ? null : svc.id)}>
                <div className="flex items-center gap-3">
                  {svc.imageUrl ? (
                    <img
                      src={svc.imageUrl}
                      alt=""
                      className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border border-orange-200 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 sm:w-11 sm:h-11 bg-orange-100 text-orange-700 rounded-xl flex items-center justify-center font-bold text-sm sm:text-base border border-orange-200 shrink-0">
                      {svc.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input type="text" value={editSvcForm.name} onChange={e => setEditSvcForm({ ...editSvcForm, name: e.target.value })} className="h-9 px-3 text-sm font-bold border-2 border-violet-200 rounded-xl outline-none focus:border-violet-500 bg-white min-w-0 w-32" />
                        <CurrencyInput
                          value={editSvcForm.basePrice}
                          onChange={(uzs) => setEditSvcForm({ ...editSvcForm, basePrice: uzs ? String(uzs) : '' })}
                          colorClass="text-violet-600"
                          className="h-9 px-3 w-36 text-sm font-bold border-2 border-violet-200 rounded-xl outline-none focus:border-violet-500 bg-white"
                        />
                        <select value={editSvcForm.unit} onChange={e => setEditSvcForm({ ...editSvcForm, unit: e.target.value })} className="select-minimal h-9 font-bold">
                          {['dona', 'metr', 'sm', 'm2', 'kg', 'litr', 'soat', 'rulon', 'varaq'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input
                          type="text"
                          value={editSvcForm.variantAxes ?? ''}
                          onChange={e => setEditSvcForm({ ...editSvcForm, variantAxes: e.target.value })}
                          className="h-9 px-3 text-sm font-bold border-2 border-violet-200 rounded-xl outline-none focus:border-violet-500 bg-white min-w-0 w-44"
                          placeholder="Variant o'qlari: Rang, O'lcham"
                          title="Vergul bilan ajratib yozing (masalan: Rang, O'lcham). Bo'sh qoldirilsa variant yo'q."
                        />
                      </div>
                    ) : (
                      <>
                        <h4 className="font-bold text-sm sm:text-base text-slate-800 uppercase tracking-tight">{svc.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-sm font-bold text-violet-600">{Number(svc.basePrice).toLocaleString('uz-UZ')} UZS</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">/ {svc.unit}</span>
                          <span className="text-[9px] font-bold text-sky-500 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full uppercase">{svc.options?.length || 0} optsiya</span>
                          {Array.isArray((svc as any).variantAxes) && (svc as any).variantAxes.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase">
                              {(svc as any).variantAxes.join(' · ')}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button onClick={() => handleUpdateService(svc.id)} className="h-8 px-3 bg-emerald-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-emerald-600 shadow-md shadow-emerald-500/20"><Save size={12} /> SAQLASH</button>
                      <button onClick={() => setEditSvcId(null)} className="h-8 px-3 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-200">BEKOR</button>
                    </>
                  ) : (
                    <>
                      {canManageOptions && (
                        <button onClick={() => { setSelectedService(svc); setNewOptionForm(f => ({ ...f, percentageMarkup: '0' })); setIsOptionOpen(true); }} className="h-8 px-2 sm:px-3 text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-lg hover:bg-violet-100 transition-all flex items-center gap-1"><Plus size={11} /> <span className="hidden sm:inline">Optsiya</span></button>
                      )}
                      {canEdit && (
                        <button onClick={() => setImageEditSvc({ id: svc.id, name: svc.name, imageUrl: svc.imageUrl })} title="Rasm" className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-orange-500 hover:text-white transition-all">
                          <ImageIcon size={15} />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setEditSvcId(svc.id); setEditSvcForm({ name: svc.name, basePrice: String(svc.basePrice), unit: svc.unit, variantAxes: Array.isArray(svc.variantAxes) ? svc.variantAxes.join(', ') : '' }); }} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-sky-500 hover:text-white transition-all"><Edit3 size={15} /></button>
                      )}
                      {canEdit && cloneTargets.length > 0 && (
                        <button onClick={() => openCloneModal(svc)} title="Filialga nusxalash" className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-violet-500 hover:text-white transition-all"><Copy size={15} /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDeleteService(svc.id)} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={15} /></button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : svc.id)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {isExpanded ? <ChevronUp size={16} strokeWidth={3} /> : <ChevronDown size={16} strokeWidth={3} />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Options & BOM expanded */}
              {isExpanded && !isEditing && (
                <div className="px-6 pb-6 border-t border-slate-50 pt-5 animate-slide-up space-y-6">
                  {/* Options List */}
                  <div>
                    <h5 className="text-[10px] font-bold text-violet-600 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                      <Tag size={12} /> Opsiyalar (Ustama Narxlar)
                    </h5>
                    {svc.options?.length === 0 ? (
                      <p className="text-slate-300 text-[10px] font-bold uppercase italic">Opsiyalar yo'q</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {svc.options.map((opt: any) => (
                          <div key={opt.id} className="group flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 hover:border-orange-200 hover:bg-orange-50 transition-all">
                            <div>
                              <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">{opt.name}</p>
                              <p className="text-xs font-bold text-slate-800">{opt.value}</p>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${Number(opt.percentageMarkup) >= 0 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
                              {opt.percentageMarkup > 0 ? '+' : ''}{opt.percentageMarkup}% ({Number(opt.priceAdd).toLocaleString()} UZS)
                            </span>
                            {canManageOptions && (
                              <button onClick={() => handleDeleteOption(opt.id)} className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-rose-100 text-rose-500 flex items-center justify-center transition-all">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materials List (BOM) */}
                  <div className="pt-4 border-t border-slate-50">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Package size={12} /> Xomashyo Sarfi (BOM)
                      </h5>
                      {canManageOptions && (
                        <button onClick={() => { setSelectedService(svc); setIsBOMOpen(true); }} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1">
                          <Plus size={12} /> BIRIKTIRISH
                        </button>
                      )}
                    </div>
                    {svc.materials?.length === 0 ? (
                      <p className="text-slate-300 text-[10px] font-bold uppercase italic">Materiallar biriktirilmagan</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {svc.materials.map((sm: any) => (
                          <div key={sm.id} className="group flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3 hover:border-emerald-200 hover:bg-emerald-50 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-emerald-500 font-bold text-xs">
                                {sm.material?.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{sm.material?.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Sarfi: <span className="text-emerald-600 font-bold">{sm.normPerUnit} {sm.material?.unit}</span> / {svc.unit}</p>
                              </div>
                            </div>
                            {canManageOptions && (
                              <button onClick={() => handleRemoveMaterial(sm.materialId)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center transition-all">
                                <Trash2 size={12} />
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
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Xizmat Nomi</label>
            <input type="text" required value={newSvcForm.name} onChange={e => setNewSvcForm(f => ({ ...f, name: e.target.value }))} className="input-minimal text-lg font-bold" placeholder="Masalan: Banner Bosish, Vizitka..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Asosiy Narx</label>
              <CurrencyInput
                value={newSvcForm.basePrice}
                onChange={(uzs) => setNewSvcForm(f => ({ ...f, basePrice: uzs ? String(uzs) : '' }))}
                colorClass="text-violet-600"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">O'lchov Birligi</label>
              <select value={newSvcForm.unit} onChange={e => setNewSvcForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal font-bold">
                {['dona', 'metr', 'sm', 'm2', 'kg', 'litr', 'soat', 'rulon', 'varaq'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Variant o'qlari (ixtiyoriy)</label>
            <input
              type="text"
              value={newSvcForm.variantAxes}
              onChange={e => setNewSvcForm(f => ({ ...f, variantAxes: e.target.value }))}
              className="input-minimal"
              placeholder="Rang, O'lcham"
            />
            <p className="text-[10px] text-slate-500 mt-1.5 px-1">Buyurtmada rang/o'lcham bo'yicha ajratma kerak bo'lsa, vergul bilan ajratib yozing. Masalan: <strong>Rang, O'lcham</strong> — futbolka uchun.</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Tavsif (ixtiyoriy)</label>
            <textarea value={newSvcForm.description} onChange={e => setNewSvcForm(f => ({ ...f, description: e.target.value }))} className="input-minimal min-h-[60px]" placeholder="Qo'shimcha ma'lumot..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setIsAddOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-10 bg-violet-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg hover:bg-violet-700 transition-all">Yaratish</button>
          </div>
        </form>
      </Modal>

      {/* Add Option Modal */}
      <Modal isOpen={isOptionOpen} onClose={() => setIsOptionOpen(false)} title={`Optsiya: ${selectedService?.name || ''}`}>
        <form onSubmit={handleAddOption} className="space-y-5">
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-[11px] font-bold text-orange-700">
            Asosiy narx: <strong>{Number(selectedService?.basePrice || 0).toLocaleString()} UZS</strong> / {selectedService?.unit}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Parametr Nomi</label>
              <input type="text" required value={newOptionForm.name} onChange={e => setNewOptionForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Qog'oz turi, Rang..." />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Qiymat</label>
              <input type="text" required value={newOptionForm.value} onChange={e => setNewOptionForm(f => ({ ...f, value: e.target.value }))} className="input-minimal" placeholder="A4, To'q ko'k, Ha..." />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Yakuniy Narx</label>
            <CurrencyInput
              value={newOptionForm.percentageMarkup === '' ? '' : String(Number(selectedService?.basePrice || 0) + Math.round(Number(selectedService?.basePrice || 0) * (Number(newOptionForm.percentageMarkup) / 100)))}
              onChange={(uzs) => {
                const base = Number(selectedService?.basePrice || 0);
                if (base > 0 && uzs !== undefined) {
                  const markup = ((uzs / base) - 1) * 100;
                  setNewOptionForm(f => ({ ...f, percentageMarkup: String(markup) }));
                }
              }}
              colorClass="text-orange-600"
              className="input-minimal font-bold text-2xl h-14"
            />

            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">Ustama Foizi:</p>
                <p className={`text-lg font-bold ${Number(newOptionForm.percentageMarkup) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(newOptionForm.percentageMarkup) > 0 ? '+' : ''}{Math.round(Number(newOptionForm.percentageMarkup) * 100) / 100}%
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">Narx Farqi:</p>
                <p className={`text-lg font-bold ${Number(newOptionForm.percentageMarkup) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(newOptionForm.percentageMarkup) >= 0 ? '+' : ''}{Math.round(Number(selectedService?.basePrice || 0) * (Number(newOptionForm.percentageMarkup) / 100))} UZS
                </p>
              </div>
            </div>

            <p className="text-[10px] font-bold text-slate-400 mt-3 px-1 italic">
              * Yakuniy narxni yozing, tizim foizni avtomatik hisoblab oladi. Keyinchalik asosiy narx o'zgarganda, bu optsiya foizga qarab moslashadi.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setIsOptionOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-10 bg-orange-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg hover:bg-orange-700 transition-all">Qo'shish</button>
          </div>
        </form>
      </Modal>
      {/* BOM Modal */}
      <Modal isOpen={isBOMOpen} onClose={() => setIsBOMOpen(false)} title={`Xomashyo Biriktirish: ${selectedService?.name || ''}`}>
        <form onSubmit={handleAddMaterial} className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-[11px] font-bold text-emerald-700">
            Xizmat: <strong>{selectedService?.name}</strong> uchun 1 <strong>{selectedService?.unit}</strong> sarfini belgilang.
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Materialni tanlang</label>
              <select
                required
                value={newMaterialForm.materialId}
                onChange={e => setNewMaterialForm(f => ({ ...f, materialId: e.target.value }))}
                className="select-minimal font-bold h-12"
              >
                <option value="">Tanlang...</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Sarflash miqdori (Norma)</label>
              <input
                type="number"
                step="0.0001"
                required
                min="0"
                value={newMaterialForm.normPerUnit}
                onChange={e => setNewMaterialForm(f => ({ ...f, normPerUnit: e.target.value }))}
                className="input-minimal font-bold h-12 border-emerald-100 focus:border-emerald-500"
                placeholder="Masalan: 0.1"
              />
              <p className="text-[10px] font-bold text-slate-400 mt-2 px-1 italic">
                Masalan: 1ta qog'ozdan 10ta vizitka chiqsa, 0.1 deb yozing.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest" onClick={() => setIsBOMOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-10 bg-emerald-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 transition-all">Biriktirish</button>
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
          <div className="space-y-6">
            <p className="text-sm font-bold text-slate-600">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 btn-outline h-12">BEKOR</button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 btn-primary bg-orange-600 text-white h-12 rounded-xl font-bold uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20"
              >
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
          <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-2xl p-4">
            <div className="w-9 h-9 bg-violet-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
              {cloneModal.service?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{cloneModal.service?.name}</p>
              <p className="text-[10px] font-bold text-violet-600">{Number(cloneModal.service?.basePrice || 0).toLocaleString('uz-UZ')} UZS / {cloneModal.service?.unit}</p>
            </div>
          </div>

          {cloneTargets.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm font-bold text-slate-400">Nusxalash mumkin bo'lgan boshqa filial yo'q.</p>
              <p className="text-xs text-slate-300 mt-1">Avval yangi filial qo'shing.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 px-1">Maqsad filial</label>
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
              <p className="text-[10px] text-slate-400 px-1">Opsiyalar ham ko'chiriladi. Narxni keyinchalik o'sha filialda tahrirlashingiz mumkin.</p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest"
                  onClick={() => setCloneModal({ isOpen: false, service: null })}
                >
                  Bekor
                </button>
                <button
                  type="button"
                  disabled={isCloning}
                  onClick={handleClone}
                  className="h-12 flex-1 bg-violet-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-violet-500/20 hover:bg-violet-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Copy size={13} /> {isCloning ? 'Nusxalanmoqda...' : 'Nusxalash'}
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
          <p className="text-[10px] text-slate-400 px-1">
            Bu rasm xizmatlar ro'yxatida va Price List'da ko'rinadi. Mijozga jo'natiladigan formatlarda ham chiqadi.
          </p>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-[10px] tracking-widest"
              onClick={() => setImageEditSvc(null)}
            >
              Bekor
            </button>
            <button
              type="button"
              onClick={() => handleSaveServiceImage(imageEditSvc?.imageUrl ?? null)}
              className="h-12 flex-1 bg-orange-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all"
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

