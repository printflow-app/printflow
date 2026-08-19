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
import { Badge, EmptyState, StatCard, Tabs, Toast } from '../components/ui';

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
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fade-in">
      {/* Status notification */}
      {statusMessage && <Toast type={statusMessage.type}>{statusMessage.text}</Toast>}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-card border border-slate-200">
        <p className="t-caption">Xomashyo va materiallar nazorati</p>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(isAdmin || p.canExportInventory) && (
            <button
              onClick={handleExport}
              className="btn-outline flex-1 sm:flex-none"
              title={activeTab === 'materials' ? "Materiallarni Excel'ga eksport qilish" : "Harakatlar tarixini eksport qilish"}
            >
              <Download size={16} /> Eksport
            </button>
          )}
          {canAddItem && (
            <button
              data-tour-id="material-add"
              onClick={() => setIsAddMaterialOpen(true)}
              className="btn-primary flex-1 sm:flex-none"
            >
              <Plus size={16} /> Material Qo'shish
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard label="Jami Materiallar" value={materials.length} icon={Package} tone="brand" />
        <StatCard label="Faol (yetarli)" value={materials.filter(m => !isLow(m) && !isCritical(m)).length} icon={TrendingUp} tone="success" />
        <StatCard label="Band (Reserved)" value={materials.reduce((acc, m) => acc + (m.reservedStock > 0 ? 1 : 0), 0)} icon={ArrowDownCircle} tone="neutral" />
        <StatCard label="Kam qolgan" value={lowCount} icon={TrendingDown} tone="warning" />
      </div>

      {/* Tab switcher */}
      <Tabs<'materials' | 'history'>
        tabs={[
          { id: 'materials', label: 'Materiallar', icon: BarChart2 },
          { id: 'history', label: 'Harakatlar tarixi', icon: History },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Materials List */}
      {activeTab === 'materials' && (
        <div className="space-y-3">
          {materials.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Hali material yo'q"
              description="Bosma uchun ishlatiladigan materiallarni (qog'oz, siyoh, plyonka...) qo'shing va qoldiqlarni avtomatik kuzating."
              action={canAddItem ? {
                label: "Birinchi materialni qo'shish",
                onClick: () => setIsAddMaterialOpen(true),
                icon: Plus,
                primary: false,
              } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {materials.map(mat => {
                const isLowStock = isLow(mat);
                const isCrit = isCritical(mat);
                return (
                  <div
                    key={mat.id}
                    className={`bg-white rounded-card border p-4 transition-colors duration-120 group ${
                      isCrit ? 'border-rose-200' : isLowStock ? 'border-amber-200' : 'border-slate-200 hover:border-primary-200'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-control flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
                          isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-[color:var(--primary)]'
                        }`}>
                          {mat.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="t-h3 truncate">{mat.name}</h4>
                          <p className="t-caption">{mat.unit}</p>
                        </div>
                      </div>
                      {canEditItem && (
                        <div className="flex gap-0.5 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openBOMModal(mat)}
                            className="icon-btn-sm"
                            title="Sarf Sozlash (B.O.M)"
                          >
                            <Layers size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setEditMaterialForm({ ...mat, currentStock: String(mat.currentStock), minStock: String(mat.minStock) }); setIsEditMaterialOpen(true); }}
                            className="icon-btn-sm"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setIsConfirmOpen(true); }}
                            className="icon-btn-sm hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stock display */}
                    <div className="mb-4 space-y-3">
                      <div>
                        <div className="flex justify-between items-end gap-2 mb-1">
                          <span className="label-caps">Omborda jami:</span>
                          {isCrit ? (
                            <Badge variant="danger">Tugagan!</Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning">Min: {mat.minStock}</Badge>
                          ) : null}
                        </div>
                        <p className={`text-xl font-semibold tabular-nums ${isCrit ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}`}>
                          {formatStock(mat.currentStock, mat.unit)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <p className="label-caps mb-0.5">Band (Reserved):</p>
                          <p className="text-sm font-semibold text-slate-700 tabular-nums">{formatStock(mat.reservedStock || 0, mat.unit)}</p>
                        </div>
                        <div>
                          <p className="label-caps mb-0.5">Sotuvda mavjud:</p>
                          <p className="text-sm font-semibold text-primary-700 tabular-nums">
                            {formatStock(Math.max(0, mat.currentStock - (mat.reservedStock || 0)), mat.unit)}
                          </p>
                        </div>
                      </div>

                      {mat.minStock > 0 && (
                        <div className="pt-1">
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div
                               className={`h-full rounded-full transition-all ${isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-[color:var(--primary)]'}`}
                               style={{ width: `${Math.min(100, (mat.currentStock / (mat.minStock * 2)) * 100)}%` }}
                             />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {(canReceive || canUse || canWriteOff) && (
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                        {canReceive && (
                          <button
                            onClick={() => openStockOp(mat, 'kirim')}
                            className="btn-success h-sm flex-1"
                          >
                            <ArrowUpCircle size={16} /> Kirim
                          </button>
                        )}
                        {canUse && (
                          <button
                            onClick={() => openStockOp(mat, 'chiqim')}
                            className="btn-outline h-sm flex-1"
                          >
                            <ArrowDownCircle size={16} /> Chiqim
                          </button>
                        )}
                        {canWriteOff && (
                          <button
                            onClick={() => openStockOp(mat, 'brak')}
                            className="btn-danger h-sm flex-1"
                          >
                            <X size={16} /> Brak
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
        movements.length === 0 ? (
          <EmptyState icon={History} title="Harakatlar tarixi bo'sh" />
        ) : (
          <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-minimal">
                <thead>
                  <tr>
                    <th className="hidden md:table-cell">Sana</th>
                    <th>Material</th>
                    <th>Tur</th>
                    <th className="text-right">Miqdor</th>
                    <th className="hidden md:table-cell">Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(mv => (
                    <tr key={mv.id}>
                      <td className="hidden md:table-cell text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(mv.createdAt).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="font-medium text-slate-900">{mv.material?.name || '—'}</td>
                      <td>
                        <Badge variant={mv.type === 'kirim' ? 'success' : mv.type === 'chiqim' ? 'neutral' : 'danger'}>
                          {mv.type.charAt(0).toUpperCase() + mv.type.slice(1)}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums font-medium text-slate-800 whitespace-nowrap">
                        {mv.type === 'kirim' ? '+' : '-'}{mv.quantity} {mv.material?.unit}
                      </td>
                      <td className="hidden md:table-cell text-slate-500 max-w-[200px] truncate">
                        {mv.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ADD MATERIAL MODAL */}
      <Modal isOpen={isAddMaterialOpen} onClose={() => setIsAddMaterialOpen(false)} title="Yangi Material Qo'shish">
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div>
            <label className="form-label">Material Nomi</label>
            <input type="text" required value={newMaterialForm.name} onChange={e => setNewMaterialForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Masalan: A4 Qog'oz, Ko'k Kraska..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">O'lchov Birligi</label>
              <select value={newMaterialForm.unit} onChange={e => setNewMaterialForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Boshlang'ich Qoldiq</label>
              <NumberInput
                value={newMaterialForm.currentStock}
                onChange={val => setNewMaterialForm(f => ({ ...f, currentStock: val || '' }))}
                className="input-minimal text-right tabular-nums"
                placeholder="0"
                allowDecimal={true}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Minimal Qoldiq (Ogohlantirish)</label>
            <NumberInput
              value={newMaterialForm.minStock}
              onChange={val => setNewMaterialForm(f => ({ ...f, minStock: val || '' }))}
              className="input-minimal text-right tabular-nums"
              placeholder="0 = ogohlantirish yo'q"
              allowDecimal={true}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setIsAddMaterialOpen(false)}>Bekor</button>
            <button type="submit" className="btn-primary flex-1">Qo'shish</button>
          </div>
        </form>
      </Modal>

      {/* EDIT MATERIAL MODAL */}
      <Modal isOpen={isEditMaterialOpen} onClose={() => setIsEditMaterialOpen(false)} title="Materialni Tahrirlash">
        <form onSubmit={handleEditMaterial} className="space-y-4">
          <div>
            <label className="form-label">Material Nomi</label>
            <input type="text" required value={editMaterialForm.name || ''} onChange={e => setEditMaterialForm((f: any) => ({ ...f, name: e.target.value }))} className="input-minimal" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Birlik</label>
              <select value={editMaterialForm.unit || 'dona'} onChange={e => setEditMaterialForm((f: any) => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Minimal Qoldiq</label>
              <NumberInput
                value={editMaterialForm.minStock ?? ''}
                onChange={val => setEditMaterialForm((f: any) => ({ ...f, minStock: val || '' }))}
                className="input-minimal text-right tabular-nums"
                placeholder="0"
                allowDecimal={true}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setIsEditMaterialOpen(false)}>Bekor</button>
            <button type="submit" className="btn-primary flex-1">Saqlash</button>
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
        <form onSubmit={handleStockOp} className="space-y-4">
          {selectedMaterial && (
            <div className={`p-4 rounded-card border flex items-center gap-3 ${
              stockOp === 'kirim' ? 'bg-emerald-50 border-emerald-200' :
              stockOp === 'chiqim' ? 'bg-slate-50 border-slate-200' :
              'bg-rose-50 border-rose-200'
            }`}>
              <Package size={20} className={stockOp === 'kirim' ? 'text-emerald-600' : stockOp === 'chiqim' ? 'text-slate-500' : 'text-rose-600'} />
              <div className="min-w-0">
                <p className="label-caps">Material</p>
                <p className="t-h3 truncate">{selectedMaterial.name}</p>
                <p className="t-caption">Joriy qoldiq: {formatStock(selectedMaterial.currentStock, selectedMaterial.unit)}</p>
              </div>
            </div>
          )}
          <div>
            <label className="form-label">
              Miqdor ({selectedMaterial?.unit})
            </label>
            <NumberInput
              value={stockForm.quantity}
              onChange={val => setStockForm(f => ({ ...f, quantity: val || '' }))}
              className="input-minimal h-control-lg text-lg font-semibold text-right tabular-nums"
              placeholder="0"
              allowDecimal={true}
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Izoh (ixtiyoriy)</label>
            <input type="text" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} className="input-minimal" placeholder={stockOp === 'brak' ? 'Brak sababi...' : 'Qo\'shimcha ma\'lumot...'} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setIsStockOpOpen(false)}>Bekor</button>
            <button type="submit" className={`flex-1 ${stockOp === 'brak' ? 'btn-danger-solid' : 'btn-primary'}`}>
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
        <div className="space-y-5">
          <div className="bg-rose-50 p-4 rounded-card border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="t-h3 text-rose-900">Diqqat!</p>
              <p className="text-xs font-medium text-rose-700 mt-1 leading-relaxed">
                Siz <strong>{selectedMaterial?.name}</strong> materialini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-outline flex-1"
              onClick={() => setIsConfirmOpen(false)}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn-danger-solid flex-1"
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
          <div className="bg-slate-50 p-4 rounded-card border border-slate-200">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-control bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                   <Calculator size={18} />
                </div>
                <div>
                   <h4 className="t-h3">Oson Hisoblash Kalkulyatori</h4>
                   <p className="t-caption">Sarf normasini avtomatik hisoblang</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div>
                   <label className="form-label">Necha Dona Mahsulot Uchun?</label>
                   <input
                     type="number"
                     value={calcForm.productQty}
                     onChange={e => setCalcForm({...calcForm, productQty: e.target.value})}
                     className="input-minimal text-right tabular-nums"
                     placeholder="Masalan: 10 ta vizitka"
                   />
                </div>
                <div className="hidden md:flex items-center justify-center pt-5">
                   <div className="w-10 h-px bg-slate-200"></div>
                </div>
                <div>
                   <label className="form-label">Qancha {selectedMaterial?.unit} Ketishi Kerak?</label>
                   <input
                     type="number"
                     value={calcForm.materialQty}
                     onChange={e => setCalcForm({...calcForm, materialQty: e.target.value})}
                     className="input-minimal text-right tabular-nums"
                     placeholder="Masalan: 1 varaq"
                   />
                </div>
             </div>

             <div className="mt-4 flex flex-wrap justify-between items-center gap-2 bg-white p-4 rounded-card border border-slate-200">
                <p className="t-caption">Hisoblangan Norma (1 dona uchun):</p>
                <div className="text-xl font-semibold text-slate-900 tabular-nums">
                   {calcForm.result} <span className="t-caption">{selectedMaterial?.unit}</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Services List (To be linked) */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3 px-1">
                 <h5 className="label-caps flex items-center gap-2">
                   <Layers size={16}/> Mavjud Xizmatlar
                 </h5>
                 <div className="relative w-40">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Qidirish..."
                      value={bomSearchTerm}
                      onChange={e => setBomSearchTerm(e.target.value)}
                      className="input-minimal h-control-sm pl-8 text-xs"
                    />
                 </div>
              </div>
              <div className="overflow-y-auto max-h-[300px] border border-slate-200 rounded-card bg-slate-50/50 p-2 flex flex-col gap-1.5 custom-scroll">
                {services
                  .filter(s => s.name.toLowerCase().includes(bomSearchTerm.toLowerCase()))
                  .map(svc => {
                    const isLinked = (selectedMaterial?.bom as any[])?.some(b => b.serviceId === svc.id);
                    return (
                      <div key={svc.id} className="bg-white p-3 rounded-control border border-slate-200 flex items-center justify-between gap-2 hover:border-slate-300 transition-colors duration-120">
                        <div className="min-w-0">
                           <p className="t-h3 truncate">{svc.name}</p>
                           <p className="t-caption">{svc.unit}</p>
                        </div>
                        <button
                          disabled={isLinked}
                          onClick={() => handleLinkService(svc.id, calcForm.result)}
                          className="btn-outline h-sm flex-shrink-0"
                        >
                          {isLinked ? 'Bog\'langan' : 'Biriktirish'}
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Currently Linked Services */}
            <div className="flex flex-col">
               <h5 className="label-caps text-primary-700 mb-3 px-1 flex items-center gap-2">
                 <CheckCircle2 size={16}/> Biriktirilgan Xizmatlar
               </h5>
               <div className="overflow-y-auto max-h-[300px] border border-primary-200 rounded-card bg-primary-50/30 p-2 flex flex-col gap-1.5 custom-scroll">
                  {(!selectedMaterial?.bom || (selectedMaterial.bom as any[]).length === 0) ? (
                    <EmptyState
                      icon={Layers}
                      title="Hozircha xizmat biriktirilmagan"
                      className="border-0 bg-transparent p-6 sm:p-8"
                    />
                  ) : (
                    (selectedMaterial.bom as any[]).map(b => (
                      <div key={b.id} className="bg-white p-3 rounded-control border border-primary-100 flex items-center justify-between gap-2">
                         <div className="min-w-0">
                            <p className="t-h3 truncate">{b.service?.name}</p>
                            <p className="text-xs font-medium text-primary-700 tabular-nums">Norma: {b.normPerUnit} {selectedMaterial?.unit}</p>
                         </div>
                         <button
                           onClick={() => askUnlink(b.serviceId)}
                           className="icon-btn-sm text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                         >
                            <Trash2 size={16} />
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
               className="btn-primary h-lg w-full"
             >
               Saqlash va tugatish <Save size={18}/>
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
        <div className="space-y-5">
          <div className="bg-rose-50 p-4 rounded-card border border-rose-100 flex items-start gap-4">
            <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={20} />
            <p className="text-sm font-medium text-rose-800 leading-relaxed">Bu xizmatni materialdan ajratmoqchimisiz? Xizmat sarflanish normasi o'chiriladi.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-outline flex-1"
              onClick={() => { setIsUnlinkConfirmOpen(false); setUnlinkServiceId(null); }}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn-danger-solid flex-1"
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
