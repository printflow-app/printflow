import React, { useState, useEffect } from 'react';
import {
  Package, Plus, Trash2, Edit3, ArrowUpCircle, ArrowDownCircle,
  CheckCircle2, AlertCircle, TrendingDown, TrendingUp, BarChart2, History, X, Download
} from 'lucide-react';
import { inventoryApi, servicesApi } from '../api';
import { useMaterials, useStockMovements, useServices, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import NumberInput from '../components/NumberInput';
import { SkeletonCardGrid } from '../components/Skeleton';
import { Search, Layers, Calculator, Save } from 'lucide-react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { exportToXlsx } from '../utils/exportToXlsx';

interface Material {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reservedStock: number; 
  minStock: number;
  bom?: any[];
  movements?: any[];
}

interface Movement {
  id: string;
  materialId: string;
  material?: { name: string; unit: string };
  type: 'kirim' | 'chiqim' | 'brak';
  quantity: number;
  note: string | null;
  createdAt: string;
}

const Ombor: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin    = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';
  const p          = currentUser.permissions || {};
  const canAddItem  = isAdmin || p.canAddInventoryItem  || p.canManageInventory;
  const canEditItem = isAdmin || p.canManageInventory;
  const canReceive  = isAdmin || p.canReceiveInventory  || p.canManageInventory;
  const canUse      = isAdmin || p.canUseInventory      || p.canManageInventory;
  const canWriteOff = isAdmin || p.canWriteOffInventory || p.canManageInventory;

  // RQ — cached fetches
  const { data: materialsData = [], isLoading: matLoading } = useMaterials(activeBranchId);
  const materials = materialsData as Material[];
  const { data: movementsData = [], isLoading: movLoading } = useStockMovements();
  const movements = movementsData as Movement[];
  const { data: services = [] } = useServices(activeBranchId);
  const invalidate = useInvalidate();
  const isLoading = matLoading || movLoading;
  const [activeTab, setActiveTab] = useState<'materials' | 'history'>('materials');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isEditMaterialOpen, setIsEditMaterialOpen] = useState(false);
  const [isStockOpOpen, setIsStockOpOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBOMModalOpen, setIsBOMModalOpen] = useState(false);
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [unlinkServiceId, setUnlinkServiceId] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [stockOp, setStockOp] = useState<'kirim' | 'chiqim' | 'brak'>('kirim');
  const [bomSearchTerm, setBomSearchTerm] = useState('');
  
  // Smart Calculator Form
  const [calcForm, setCalcForm] = useState({ productQty: '10', materialQty: '1', result: 0.1 });

  // Forms
  const [newMaterialForm, setNewMaterialForm] = useState<{ name: string; unit: string; currentStock: string | number; minStock: string | number }>({ name: '', unit: 'dona', currentStock: '', minStock: '' });
  const [editMaterialForm, setEditMaterialForm] = useState<any>({});
  const [stockForm, setStockForm] = useState<{ quantity: string | number; note: string }>({ quantity: '', note: '' });

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Keep selectedMaterial in sync with the live materials list (RQ refetches it).
  // Without this, BOM modal would show stale material data after a mutation.
  useEffect(() => {
    if (!selectedMaterial) return;
    const fresh = materials.find(m => m.id === selectedMaterial.id);
    if (fresh && fresh !== selectedMaterial) setSelectedMaterial(fresh);
  }, [materials]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetchData() shim — invalidates relevant RQ caches; second arg ignored (RQ auto re-syncs)
  const fetchData = async (_refreshId?: string) => {
    invalidate.materials();
    invalidate.movements();
    invalidate.services();
  };

  // EXPORT — joriy tab'ga qarab: materiallar yoki harakatlar tarixi
  const handleExport = () => {
    const stamp = new Date().toLocaleDateString('en-CA');
    if (activeTab === 'materials') {
      if (materials.length === 0) { showStatus('error', "Eksport qilish uchun material yo'q"); return; }
      exportToXlsx({
        filename: `ombor_materiallar_${stamp}`,
        sheetName: 'Materiallar',
        rows: materials,
        columns: [
          { header: 'Material', accessor: (m: Material) => m.name },
          { header: 'Birlik', accessor: (m: Material) => m.unit },
          { header: 'Joriy qoldiq', accessor: (m: Material) => Number(m.currentStock || 0) },
          { header: 'Band (bron)', accessor: (m: Material) => Number(m.reservedStock || 0) },
          { header: 'Mavjud', accessor: (m: Material) => Number(m.currentStock || 0) - Number(m.reservedStock || 0) },
          { header: 'Minimum chegara', accessor: (m: Material) => Number(m.minStock || 0) },
          { header: 'Holat', accessor: (m: Material) => {
            const avail = Number(m.currentStock || 0) - Number(m.reservedStock || 0);
            if (avail <= 0) return 'Tugagan';
            if (avail < Number(m.minStock || 0)) return 'Kam qolgan';
            return 'Normal';
          }},
        ],
      });
      showStatus('success', `${materials.length} ta material eksport qilindi`);
    } else {
      if (movements.length === 0) { showStatus('error', "Tarixda yozuv yo'q"); return; }
      const typeLabel: Record<string, string> = { kirim: 'Kirim', chiqim: 'Chiqim', brak: 'Brak' };
      exportToXlsx({
        filename: `ombor_tarix_${stamp}`,
        sheetName: 'Harakatlar tarixi',
        rows: movements,
        columns: [
          { header: 'Sana', accessor: (mv: Movement) => new Date(mv.createdAt).toLocaleString('uz-UZ') },
          { header: 'Material', accessor: (mv: Movement) => mv.material?.name || '' },
          { header: 'Turi', accessor: (mv: Movement) => typeLabel[mv.type] || mv.type },
          { header: 'Miqdor', accessor: (mv: Movement) => Number(mv.quantity || 0) },
          { header: 'Birlik', accessor: (mv: Movement) => mv.material?.unit || '' },
          { header: 'Izoh', accessor: (mv: Movement) => mv.note || '' },
        ],
      });
      showStatus('success', `${movements.length} ta yozuv eksport qilindi`);
    }
  };

  // RQ auto-fetches on hook mount; manual initial fetch removed.

  useAutoRefresh(() => fetchData(selectedMaterial?.id), {
    intervalMs: 20000,
    paused:
      isAddMaterialOpen || isEditMaterialOpen || isStockOpOpen ||
      isConfirmOpen || isBOMModalOpen || isUnlinkConfirmOpen,
  });

  // Recalculate B.O.M norm
  useEffect(() => {
    const p = Number(calcForm.productQty) || 1;
    const m = Number(calcForm.materialQty) || 0;
    setCalcForm(prev => ({ ...prev, result: Number((m / p).toFixed(4)) }));
  }, [calcForm.productQty, calcForm.materialQty]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createMaterial({
        ...newMaterialForm,
        currentStock: Number(newMaterialForm.currentStock),
        minStock: Number(newMaterialForm.minStock),
        branchId: activeBranchId || null,
      });
      showStatus('success', 'Material qo\'shildi!');
      setIsAddMaterialOpen(false);
      setNewMaterialForm({ name: '', unit: 'dona', currentStock: '0', minStock: '0' });
      fetchData();
    } catch {
      showStatus('error', 'Xatolik yuz berdi!');
    }
  };

  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    try {
      await inventoryApi.updateMaterial(selectedMaterial.id, {
        name: editMaterialForm.name,
        unit: editMaterialForm.unit,
        minStock: Number(editMaterialForm.minStock),
      });
      showStatus('success', 'Material yangilandi!');
      setIsEditMaterialOpen(false);
      fetchData();
    } catch {
      showStatus('error', 'Xatolik yuz berdi!');
    }
  };

  const handleDeleteMaterial = async () => {
    if (!selectedMaterial) return;
    try {
      await inventoryApi.deleteMaterial(selectedMaterial.id);
      showStatus('success', 'O\'chirildi!');
      setIsConfirmOpen(false);
      fetchData();
    } catch {
      showStatus('error', 'O\'chirishda xato! (Ombor harakatlari bor bo\'lishi mumkin)');
    }
  };

  const handleStockOp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || !stockForm.quantity) return;
    try {
      const qty = Number(stockForm.quantity);
      if (stockOp === 'kirim') await inventoryApi.stockIn(selectedMaterial.id, { quantity: qty, note: stockForm.note });
      else if (stockOp === 'chiqim') await inventoryApi.stockOut(selectedMaterial.id, { quantity: qty, note: stockForm.note });
      else await inventoryApi.writeOff(selectedMaterial.id, { quantity: qty, note: stockForm.note });

      const opLabels = { kirim: 'Kirim', chiqim: 'Chiqim', brak: 'Brak' };
      showStatus('success', `${opLabels[stockOp]} muvaffaqiyatli qayd etildi!`);
      setIsStockOpOpen(false);
      setStockForm({ quantity: '', note: '' });
      fetchData();
    } catch {
      showStatus('error', 'Xatolik yuz berdi!');
    }
  };

  const openStockOp = (material: Material, op: 'kirim' | 'chiqim' | 'brak') => {
    setSelectedMaterial(material);
    setStockOp(op);
    setStockForm({ quantity: '', note: '' });
    setIsStockOpOpen(true);
  };

  const openBOMModal = (material: Material) => {
    setSelectedMaterial(material);
    setIsBOMModalOpen(true);
  };

  const handleLinkService = async (serviceId: string, norm: number) => {
    if (!selectedMaterial) return;
    if (!activeBranchId) {
      showStatus('error', 'Avval aktiv filialni tanlang');
      return;
    }
    try {
      await servicesApi.addMaterial(serviceId, { materialId: selectedMaterial.id, normPerUnit: norm }, activeBranchId);
      showStatus('success', 'Xizmat biriktirildi!');
      // Pass the id so selectedMaterial gets refreshed immediately
      fetchData(selectedMaterial.id);
    } catch { showStatus('error', 'Biriktirishda xatolik!'); }
  };

  const handleUnlinkService = async () => {
    if (!selectedMaterial || !unlinkServiceId) return;
    if (!activeBranchId) return;
    try {
      await servicesApi.deleteMaterial(unlinkServiceId, selectedMaterial.id, activeBranchId);
      showStatus('success', 'Bog\'liqlik olib tashlandi!');
      setIsUnlinkConfirmOpen(false);
      setUnlinkServiceId(null);
      fetchData(selectedMaterial.id);
    } catch { showStatus('error', 'O\'chirishda xatolik!'); }
  };

  const askUnlink = (serviceId: string) => {
    setUnlinkServiceId(serviceId);
    setIsUnlinkConfirmOpen(true);
  };

  const formatStock = (val: number, unit: string) => `${val.toLocaleString('uz-UZ')} ${unit}`;
  const isLow = (m: Material) => m.currentStock <= m.minStock && m.minStock > 0;
  const isCritical = (m: Material) => m.currentStock === 0;

  const lowCount = materials.filter(isLow).length;

  if (isLoading) return <SkeletonCardGrid count={6} />;

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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Package size={20} className="text-orange-500" /> Ombor Boshqaruvi
          </h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            Xomashyo va materiallar nazorati
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {(isAdmin || p.canExportInventory) && (
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 h-10 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-widest rounded-xl shadow-sm transition-all"
              title={activeTab === 'materials' ? "Materiallarni Excel'ga eksport qilish" : "Harakatlar tarixini eksport qilish"}
            >
              <Download size={13} strokeWidth={2.5}/> EKSPORT
            </button>
          )}
          {canAddItem && (
            <button
              data-tour-id="material-add"
              onClick={() => setIsAddMaterialOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-5 bg-orange-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-700 transition-all"
            >
              <Plus size={16} strokeWidth={3} /> Material Qo'shish
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Jami Materiallar', value: materials.length, icon: Package, color: 'indigo', bg: 'bg-orange-50/50', border: 'border-orange-100', text: 'text-orange-600' },
          { label: 'Faol (yetarli)', value: materials.filter(m => !isLow(m) && !isCritical(m)).length, icon: TrendingUp, color: 'orange', bg: 'bg-orange-50/50', border: 'border-orange-100', text: 'text-orange-600' },
          { label: 'Band (Reserved)', value: materials.reduce((acc, m) => acc + (m.reservedStock > 0 ? 1 : 0), 0), icon: ArrowDownCircle, color: 'sky', bg: 'bg-slate-50/50', border: 'border-slate-100', text: 'text-slate-600' },
          { label: 'Kam qolgan', value: lowCount, icon: TrendingDown, color: 'amber', bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} ${stat.border} border rounded-2xl p-4 flex items-center gap-3 transition-all hover:shadow-md`}>
            <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${stat.text} border ${stat.border}`}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800 leading-none">{stat.value}</p>
              <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${stat.text}`}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'materials' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <BarChart2 size={14} /> Materiallar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <History size={14} /> Harakatlar Tarixi
        </button>
      </div>

      {/* Materials List */}
      {activeTab === 'materials' && (
        <div className="space-y-3">
          {materials.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-16 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-400">
                <Package size={28} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-slate-800 mb-1">Hali material yo'q</p>
                <p className="text-sm text-slate-500 max-w-sm">Bosma uchun ishlatiladigan materiallarni (qog'oz, siyoh, plyonka...) qo'shing va qoldiqlarni avtomatik kuzating.</p>
              </div>
              {canAddItem && (
                <button onClick={() => setIsAddMaterialOpen(true)} className="h-10 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm flex items-center gap-2 mt-2">
                  <Plus size={16} /> Birinchi materialni qo'shish
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {materials.map(mat => {
                const isLowStock = isLow(mat);
                const isCrit = isCritical(mat);
                return (
                  <div
                    key={mat.id}
                    className={`bg-white rounded-3xl border-2 shadow-sm p-5 transition-all hover:shadow-md group ${
                      isCrit ? 'border-rose-200 bg-rose-50/30' : isLowStock ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100 hover:border-orange-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                          isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-orange-500'
                        }`}>
                          {mat.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{mat.name}</h4>
                          <p className="text-xs font-bold text-slate-400 uppercase">{mat.unit}</p>
                        </div>
                      </div>
                      {canEditItem && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openBOMModal(mat)}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-slate-50 transition-all"
                            title="Sarf Sozlash (B.O.M)"
                          >
                            <Layers size={13} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setEditMaterialForm({ ...mat, currentStock: String(mat.currentStock), minStock: String(mat.minStock) }); setIsEditMaterialOpen(true); }}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-slate-50 transition-all"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setIsConfirmOpen(true); }}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stock display */}
                    <div className="mb-4 space-y-3">
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Omborda jami:</span>
                          {isCrit ? (
                            <span className="text-[11px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md animate-pulse">TUGAGAN!</span>
                          ) : isLowStock ? (
                            <span className="text-[11px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">MIN: {mat.minStock}</span>
                          ) : null}
                        </div>
                        <p className={`text-xl font-bold tabular-nums ${isCrit ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-slate-800'}`}>
                          {formatStock(mat.currentStock, mat.unit)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Band (Reserved):</p>
                          <p className="text-sm font-bold text-slate-600 tabular-nums">{formatStock(mat.reservedStock || 0, mat.unit)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Sotuvda mavjud:</p>
                          <p className="text-sm font-bold text-orange-600 tabular-nums">
                            {formatStock(Math.max(0, mat.currentStock - (mat.reservedStock || 0)), mat.unit)}
                          </p>
                        </div>
                      </div>

                      {mat.minStock > 0 && (
                        <div className="pt-1">
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div
                               className={`h-full rounded-full transition-all ${isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-orange-500'}`}
                               style={{ width: `${Math.min(100, (mat.currentStock / (mat.minStock * 2)) * 100)}%` }}
                             />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {(canReceive || canUse || canWriteOff) && (
                      <div className="flex gap-2 pt-3 border-t border-slate-100">
                        {canReceive && (
                          <button
                            onClick={() => openStockOp(mat, 'kirim')}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-orange-50 hover:bg-orange-500 hover:text-white text-orange-600 text-xs font-bold uppercase rounded-xl border border-orange-100 hover:border-orange-500 transition-all"
                          >
                            <ArrowUpCircle size={13} /> Kirim
                          </button>
                        )}
                        {canUse && (
                          <button
                            onClick={() => openStockOp(mat, 'chiqim')}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-slate-50 hover:bg-slate-500 hover:text-white text-slate-600 text-xs font-bold uppercase rounded-xl border border-slate-100 hover:border-slate-500 transition-all"
                          >
                            <ArrowDownCircle size={13} /> Chiqim
                          </button>
                        )}
                        {canWriteOff && (
                          <button
                            onClick={() => openStockOp(mat, 'brak')}
                            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 text-xs font-bold uppercase rounded-xl border border-rose-100 hover:border-rose-500 transition-all"
                          >
                            <X size={13} /> Brak
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Movements History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Sana</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Material</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Tur</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Miqdor</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <History size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">Harakatlar tarixi bo'sh</p>
                    </td>
                  </tr>
                ) : (
                  movements.map(mv => (
                    <tr key={mv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400 tabular-nums whitespace-nowrap">
                        {new Date(mv.createdAt).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">{mv.material?.name || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl uppercase ${
                          mv.type === 'kirim' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          mv.type === 'chiqim' ? 'bg-slate-50 text-slate-600 border border-slate-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {mv.type === 'kirim' ? <ArrowUpCircle size={10} /> : mv.type === 'chiqim' ? <ArrowDownCircle size={10} /> : <X size={10} />}
                          {mv.type.charAt(0).toUpperCase() + mv.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700 tabular-nums">
                        {mv.type === 'kirim' ? '+' : '-'}{mv.quantity} {mv.material?.unit}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500 italic max-w-[200px] truncate">
                        {mv.note || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD MATERIAL MODAL */}
      <Modal isOpen={isAddMaterialOpen} onClose={() => setIsAddMaterialOpen(false)} title="Yangi Material Qo'shish">
        <form onSubmit={handleAddMaterial} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Material Nomi</label>
            <input type="text" required value={newMaterialForm.name} onChange={e => setNewMaterialForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Masalan: A4 Qog'oz, Ko'k Kraska..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">O'lchov Birligi</label>
              <select value={newMaterialForm.unit} onChange={e => setNewMaterialForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Boshlang'ich Qoldiq</label>
              <NumberInput 
                value={newMaterialForm.currentStock} 
                onChange={val => setNewMaterialForm(f => ({ ...f, currentStock: val || '' }))} 
                className="input-minimal font-bold text-orange-600"
                placeholder="0"
                allowDecimal={true}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Minimal Qoldiq (Ogohlantirish)</label>
            <NumberInput 
              value={newMaterialForm.minStock} 
              onChange={val => setNewMaterialForm(f => ({ ...f, minStock: val || '' }))} 
              className="input-minimal font-bold text-amber-600" 
              placeholder="0 = ogohlantirish yo'q" 
              allowDecimal={true}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-xs tracking-widest" onClick={() => setIsAddMaterialOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-8 bg-orange-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg hover:bg-orange-700 transition-all">Qo'shish</button>
          </div>
        </form>
      </Modal>

      {/* EDIT MATERIAL MODAL */}
      <Modal isOpen={isEditMaterialOpen} onClose={() => setIsEditMaterialOpen(false)} title="Materialni Tahrirlash">
        <form onSubmit={handleEditMaterial} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Material Nomi</label>
            <input type="text" required value={editMaterialForm.name || ''} onChange={e => setEditMaterialForm((f: any) => ({ ...f, name: e.target.value }))} className="input-minimal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Birlik</label>
              <select value={editMaterialForm.unit || 'dona'} onChange={e => setEditMaterialForm((f: any) => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Minimal Qoldiq</label>
              <NumberInput 
                value={editMaterialForm.minStock ?? ''} 
                onChange={val => setEditMaterialForm((f: any) => ({ ...f, minStock: val || '' }))} 
                className="input-minimal font-bold text-amber-600" 
                placeholder="0" 
                allowDecimal={true}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-xs tracking-widest" onClick={() => setIsEditMaterialOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-8 bg-slate-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg hover:bg-slate-700 transition-all">Saqlash</button>
          </div>
        </form>
      </Modal>

      {/* STOCK OPERATION MODAL */}
      <Modal
        isOpen={isStockOpOpen}
        onClose={() => setIsStockOpOpen(false)}
        title={stockOp === 'kirim' ? 'Kirim' : stockOp === 'chiqim' ? 'Chiqim' : 'Brak'}
        type={stockOp === 'brak' ? 'danger' : stockOp === 'chiqim' ? 'warning' : 'default'}
      >
        <form onSubmit={handleStockOp} className="space-y-5">
          {selectedMaterial && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              stockOp === 'kirim' ? 'bg-emerald-50 border-emerald-100' :
              stockOp === 'chiqim' ? 'bg-slate-50 border-slate-100' :
              'bg-rose-50 border-rose-100'
            }`}>
              <Package size={20} className={stockOp === 'kirim' ? 'text-emerald-500' : stockOp === 'chiqim' ? 'text-slate-500' : 'text-rose-500'} />
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Material</p>
                <p className="text-sm font-bold text-slate-800">{selectedMaterial.name}</p>
                <p className="text-xs font-bold text-slate-500">Joriy qoldiq: {formatStock(selectedMaterial.currentStock, selectedMaterial.unit)}</p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">
              Miqdor ({selectedMaterial?.unit})
            </label>
            <NumberInput
              value={stockForm.quantity}
              onChange={val => setStockForm(f => ({ ...f, quantity: val || '' }))}
              className={`input-minimal font-bold text-2xl h-16 ${
                stockOp === 'kirim' ? 'focus:border-emerald-500 text-emerald-600' :
                stockOp === 'chiqim' ? 'focus:border-slate-500 text-slate-600' :
                'focus:border-rose-500 text-rose-600'
              }`}
              placeholder="0"
              allowDecimal={true}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">Izoh (ixtiyoriy)</label>
            <input type="text" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} className="input-minimal" placeholder={stockOp === 'brak' ? 'Brak sababi...' : 'Qo\'shimcha ma\'lumot...'} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-xs tracking-widest" onClick={() => setIsStockOpOpen(false)}>Bekor</button>
            <button type="submit" className={`h-12 flex-2 px-8 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg transition-all ${
              stockOp === 'kirim' ? 'bg-emerald-600 hover:bg-emerald-700' :
              stockOp === 'chiqim' ? 'bg-slate-600 hover:bg-slate-700' :
              'bg-rose-600 hover:bg-rose-700'
            }`}>
              {stockOp === 'kirim' ? 'Kirim Qilish' : stockOp === 'chiqim' ? 'Chiqim Qilish' : 'Brak Deb Belgilash'}
            </button>
          </div>
        </form>
      </Modal>
      {/* CONFIRM DELETE MODAL */}
      <Modal 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)} 
        title="Materialni o'chirish"
        type="danger"
      >
        <div className="space-y-6">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1" size={24} />
            <div>
              <p className="text-sm font-bold text-rose-900 uppercase">Diqqat!</p>
              <p className="text-xs font-bold text-rose-700 mt-1">
                Siz <strong>{selectedMaterial?.name}</strong> materialini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-xs tracking-widest" 
              onClick={() => setIsConfirmOpen(false)}
            >
              Bekor qilish
            </button>
            <button 
              type="button" 
              className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all"
              onClick={handleDeleteMaterial}
            >
              Ha, o'chirilsin
            </button>
          </div>
        </div>
      </Modal>

      {/* B.O.M CONFIG MODAL */}
      <Modal 
        isOpen={isBOMModalOpen} 
        onClose={() => setIsBOMModalOpen(false)} 
        title={`${selectedMaterial?.name || 'Material'} — Xizmatlarga Sarfi (B.O.M)`}
        maxWidth="max-w-4xl"
      >
        <div className="flex flex-col gap-6">
          {/* Smart Calculator Section */}
          <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-600 text-white flex items-center justify-center shadow-lg shadow-slate-500/20">
                   <Calculator size={18} />
                </div>
                <div>
                   <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest leading-none">Oson Hisoblash Kalkulyatori</h4>
                   <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sarf normasini avtomatik hisoblang</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2 px-1 tracking-[0.1em]">Necha Dona Mahsulot Uchun?</label>
                   <input 
                     type="number" 
                     value={calcForm.productQty} 
                     onChange={e => setCalcForm({...calcForm, productQty: e.target.value})} 
                     className="input-minimal h-12 bg-white border-2 border-slate-100 focus:border-slate-500 font-bold text-slate-600"
                     placeholder="Masalan: 10 ta vizitka"
                   />
                </div>
                <div className="flex items-center justify-center pt-5">
                   <div className="w-10 h-[2px] bg-slate-200"></div>
                </div>
                <div>
                   <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2 px-1 tracking-[0.1em]">Qancha {selectedMaterial?.unit} Ketishi Kerak?</label>
                   <input 
                     type="number" 
                     value={calcForm.materialQty} 
                     onChange={e => setCalcForm({...calcForm, materialQty: e.target.value})} 
                     className="input-minimal h-12 bg-white border-2 border-slate-100 focus:border-slate-500 font-bold text-slate-600"
                     placeholder="Masalan: 1 varaq"
                   />
                </div>
             </div>
             
             <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center bg-white/50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-500 uppercase">Hisoblangan Norma (1 dona uchun):</p>
                <div className="text-xl font-bold text-slate-700 bg-white px-6 py-2 rounded-xl shadow-inner border border-slate-100">
                   {calcForm.result} <span className="text-xs uppercase">{selectedMaterial?.unit}</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Services List (To be linked) */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4 px-2">
                 <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Layers size={14}/> Mavjud Xizmatlar
                 </h5>
                 <div className="relative w-40">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input 
                      type="text" 
                      placeholder="Qidirish..." 
                      value={bomSearchTerm}
                      onChange={e => setBomSearchTerm(e.target.value)}
                      className="w-full pl-8 h-8 rounded-lg bg-slate-100 border-none outline-none text-xs font-bold"
                    />
                 </div>
              </div>
              <div className="overflow-y-auto max-h-[300px] border border-slate-100 rounded-3xl bg-slate-50/50 p-2 flex flex-col gap-1.5 custom-scroll">
                {services
                  .filter(s => s.name.toLowerCase().includes(bomSearchTerm.toLowerCase()))
                  .map(svc => {
                    const isLinked = (selectedMaterial?.bom as any[])?.some(b => b.serviceId === svc.id);
                    return (
                      <div key={svc.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-all">
                        <div>
                           <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{svc.name}</p>
                           <p className="text-[11px] font-bold text-slate-400 uppercase">{svc.unit}</p>
                        </div>
                        <button 
                          disabled={isLinked}
                          onClick={() => handleLinkService(svc.id, calcForm.result)}
                          className={`h-8 px-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                            isLinked 
                             ? 'bg-slate-100 text-slate-300 pointer-events-none' 
                             : 'bg-slate-600 text-white shadow-lg shadow-slate-500/20 hover:bg-slate-700 hover:scale-105 active:scale-95'
                          }`}
                        >
                          {isLinked ? 'BOG\'LANGAN' : 'BIRIKTIRISH'}
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Currently Linked Services */}
            <div className="flex flex-col">
               <h5 className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                 <CheckCircle2 size={14}/> Biriktirilgan Xizmatlar
               </h5>
               <div className="overflow-y-auto max-h-[300px] border-2 border-orange-50 rounded-3xl bg-orange-50/20 p-2 flex flex-col gap-1.5 custom-scroll">
                  {(!selectedMaterial?.bom || (selectedMaterial.bom as any[]).length === 0) ? (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center">
                       <Layers size={32} className="mb-2" />
                       <p className="text-[11px] font-bold uppercase tracking-widest">Hozircha xizmat biriktirilmagan</p>
                    </div>
                  ) : (
                    (selectedMaterial.bom as any[]).map(b => (
                      <div key={b.id} className="bg-white p-3 rounded-2xl border border-orange-100 shadow-sm flex items-center justify-between group">
                         <div>
                            <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{b.service?.name}</p>
                            <p className="text-xs font-bold text-orange-600">Norma: {b.normPerUnit} {selectedMaterial?.unit}</p>
                         </div>
                         <button 
                           onClick={() => askUnlink(b.serviceId)}
                           className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-50 text-rose-300 hover:bg-rose-500 hover:text-white transition-all shadow-sm shadow-rose-500/5 group"
                         >
                            <Trash2 size={14} />
                         </button>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-100">
             <button
               onClick={() => setIsBOMModalOpen(false)}
               className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
             >
               SAQLASH VA TUGATISH <Save size={18}/>
             </button>
          </div>
        </div>
      </Modal>

      {/* UNLINK CONFIRM MODAL */}
      <Modal
        isOpen={isUnlinkConfirmOpen}
        onClose={() => { setIsUnlinkConfirmOpen(false); setUnlinkServiceId(null); }}
        title="Bog'liqlikni o'chirish"
        type="danger"
      >
        <div className="space-y-6">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-1 shrink-0" size={22} />
            <p className="text-sm font-bold text-rose-800">Bu xizmatni materialdan ajratmoqchimisiz? Xizmat sarflanish normasi o'chiriladi.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-outline h-12 flex-1 rounded-2xl font-bold uppercase text-xs tracking-widest"
              onClick={() => { setIsUnlinkConfirmOpen(false); setUnlinkServiceId(null); }}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all"
              onClick={handleUnlinkService}
            >
              Ha, o'chirilsin
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Ombor;
