import React, { useState } from 'react';
import {
  Package, Plus, Trash2, Edit3, ArrowUpCircle, ArrowDownCircle,
  CheckCircle2, AlertCircle, TrendingDown, TrendingUp, BarChart2, History, X, Download,
  Search, Layers, Calculator, Save
} from 'lucide-react';
import { inventoryApi } from '../api';
import { useMaterials, useStockMovements, useServices, useInvalidate } from '../hooks/queries';
import Modal from '../components/Modal';
import NumberInput from '../components/NumberInput';
import { SkeletonCardGrid } from '../components/Skeleton';
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

type TabType = 'materials' | 'history';

const Ombor: React.FC<{ currentUser: any; activeBranchId?: string }> = ({ currentUser, activeBranchId }) => {
  const isAdmin    = currentUser?.role?.name?.toLowerCase() === 'admin' || currentUser?.login === 'admin';
  const p          = currentUser?.permissions || {};
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

  const isLoading = matLoading && materials.length === 0;

  // State
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isEditMaterialOpen, setIsEditMaterialOpen] = useState(false);
  const [isStockOpOpen, setIsStockOpOpen] = useState(false);
  const [stockOp, setStockOp] = useState<'kirim' | 'chiqim' | 'brak'>('kirim');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBOMModalOpen, setIsBOMModalOpen] = useState(false);
  const [bomSearchTerm, setBomSearchTerm] = useState('');
  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [unlinkServiceId, setUnlinkServiceId] = useState<string | null>(null);

  // Forms
  const [newMaterialForm, setNewMaterialForm] = useState({ name: '', unit: 'dona', currentStock: '', minStock: '' });
  const [editMaterialForm, setEditMaterialForm] = useState<any>({ name: '', unit: 'dona', minStock: '' });
  const [stockForm, setStockForm] = useState({ quantity: '', note: '' });
  const [calcForm, setCalcForm] = useState({ productQty: '', materialQty: '', result: 0 });

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExport = () => {
    if (activeTab === 'materials') {
      exportToXlsx(
        materials.map(m => ({
          'Nomi': m.name,
          'Birligi': m.unit,
          'Joriy qoldiq': m.currentStock,
          'Band qilingan': m.reservedStock || 0,
          'Mavjud qoldiq': Math.max(0, m.currentStock - (m.reservedStock || 0)),
          'Minimal qoldiq': m.minStock,
          'Holati': m.currentStock <= 0 ? 'Tugagan' : m.currentStock <= m.minStock ? 'Kam qolgan' : 'Yetarli'
        })),
        'Materiallar_Qoldigi'
      );
    } else {
      exportToXlsx(
        movements.map(mv => ({
          'Sana': new Date(mv.createdAt).toLocaleString('uz-UZ'),
          'Material': mv.material?.name || '—',
          'Turi': mv.type === 'kirim' ? 'Kirim' : mv.type === 'chiqim' ? 'Chiqim' : 'Brak',
          'Miqdor': mv.quantity,
          'Birligi': mv.material?.unit || '',
          'Izoh': mv.note || '—'
        })),
        'Ombor_Harakatlar_Tarixi'
      );
    }
  };

  // Add material
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createItem({
        ...newMaterialForm,
        currentStock: Number(newMaterialForm.currentStock) || 0,
        minStock: Number(newMaterialForm.minStock) || 0,
      });
      setIsAddMaterialOpen(false);
      setNewMaterialForm({ name: '', unit: 'dona', currentStock: '', minStock: '' });
      invalidate.materials();
      notify("Material muvaffaqiyatli qo'shildi");
    } catch {
      notify("Material qo'shishda xatolik yuz berdi", 'error');
    }
  };

  // Edit material
  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    try {
      await inventoryApi.updateItem(selectedMaterial.id, {
        name: editMaterialForm.name,
        unit: editMaterialForm.unit,
        minStock: Number(editMaterialForm.minStock) || 0,
      });
      setIsEditMaterialOpen(false);
      invalidate.materials();
      notify("Material o'zgartirildi");
    } catch {
      notify("O'zgartirishda xatolik", 'error');
    }
  };

  // Stock Op
  const openStockOp = (mat: Material, op: 'kirim' | 'chiqim' | 'brak') => {
    setSelectedMaterial(mat);
    setStockOp(op);
    setStockForm({ quantity: '', note: '' });
    setIsStockOpOpen(true);
  };

  const handleStockOp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) return;
    const qty = Number(stockForm.quantity);
    if (!qty || qty <= 0) return notify("Noto'g'ri miqdor kiritildi", 'error');

    try {
      if (stockOp === 'kirim') {
        await inventoryApi.receiveStock({ materialId: selectedMaterial.id, quantity: qty, note: stockForm.note });
      } else if (stockOp === 'chiqim') {
        await inventoryApi.useStock({ materialId: selectedMaterial.id, quantity: qty, note: stockForm.note });
      } else {
        await inventoryApi.writeOffStock({ materialId: selectedMaterial.id, quantity: qty, note: stockForm.note });
      }
      setIsStockOpOpen(false);
      invalidate.materials();
      invalidate.stockMovements();
      notify("Operatsiya muvaffaqiyatli bajarildi");
    } catch (err: any) {
      notify(err.response?.data?.error || "Operatsiyada xatolik", 'error');
    }
  };

  // Delete
  const handleDeleteMaterial = async () => {
    if (!selectedMaterial) return;
    try {
      await inventoryApi.deleteItem(selectedMaterial.id);
      setIsConfirmOpen(false);
      invalidate.materials();
      notify("Material o'chirildi");
    } catch (err: any) {
      notify(err.response?.data?.error || "O'chirishda xatolik", 'error');
    }
  };

  // BOM
  const openBOMModal = (mat: Material) => {
    setSelectedMaterial(mat);
    setCalcForm({ productQty: '', materialQty: '', result: 0 });
    setIsBOMModalOpen(true);
  };

  const handleLinkService = async (serviceId: string, norm: number) => {
    if (!selectedMaterial) return;
    try {
      await inventoryApi.linkBOM({
        materialId: selectedMaterial.id,
        serviceId,
        normPerUnit: norm || 1,
      });
      invalidate.materials();
      notify("Xizmatga biriktirildi");
    } catch {
      notify("Biriktirishda xatolik", 'error');
    }
  };

  const askUnlink = (serviceId: string) => {
    setUnlinkServiceId(serviceId);
    setIsUnlinkConfirmOpen(true);
  };

  const handleUnlinkService = async () => {
    if (!selectedMaterial || !unlinkServiceId) return;
    try {
      await inventoryApi.unlinkBOM(selectedMaterial.id, unlinkServiceId);
      invalidate.materials();
      setIsUnlinkConfirmOpen(false);
      setUnlinkServiceId(null);
      notify("Bog'liqlik o'chirildi");
    } catch {
      notify("O'chirishda xatolik", 'error');
    }
  };

  // Helpers
  const formatStock = (n: number, unit: string) => {
    const val = Number(n);
    const formatted = isNaN(val) ? '0' : (val % 1 === 0 ? val.toString() : val.toFixed(2));
    return `${formatted} ${unit}`;
  };

  const isLow = (m: Material) => m.minStock > 0 && m.currentStock <= m.minStock && m.currentStock > 0;
  const isCritical = (m: Material) => m.currentStock <= 0;
  const lowCount = materials.filter(isLow).length;

  if (isLoading) return <SkeletonCardGrid count={6} />;

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 animate-fade-in">
      {/* Status notification */}
      {statusMessage && (
        <Toast type={statusMessage.type}>{statusMessage.text}</Toast>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-card border border-slate-200">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Package size={20} className="text-[color:var(--primary)]" /> Ombor boshqaruvi
          </h2>
          <p className="t-caption mt-0.5">
            Xomashyo va materiallar nazorati
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(isAdmin || p.canExportInventory) && (
            <button
              onClick={handleExport}
              className="btn-outline h-control"
              title={activeTab === 'materials' ? "Materiallarni Excel'ga eksport qilish" : "Harakatlar tarixini eksport qilish"}
            >
              <Download size={16} /> Eksport
            </button>
          )}
          {canAddItem && (
            <button
              data-tour-id="material-add"
              onClick={() => setIsAddMaterialOpen(true)}
              className="btn-primary h-control"
            >
              <Plus size={16} /> Material qo'shish
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard label="Jami materiallar" value={materials.length} icon={Package} tone="neutral" />
        <StatCard label="Faol (yetarli)" value={materials.filter(m => !isLow(m) && !isCritical(m)).length} icon={TrendingUp} tone="success" />
        <StatCard label="Band (rezerv)" value={materials.reduce((acc, m) => acc + (m.reservedStock > 0 ? 1 : 0), 0)} icon={ArrowDownCircle} tone="info" />
        <StatCard label="Kam qolgan" value={lowCount} icon={TrendingDown} tone={lowCount > 0 ? 'warning' : 'neutral'} />
      </div>

      {/* Tab switcher */}
      <Tabs<TabType>
        tabs={[
          { id: 'materials', label: 'Materiallar', icon: BarChart2, count: materials.length },
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
              action={canAddItem ? { label: "Birinchi materialni qo'shish", onClick: () => setIsAddMaterialOpen(true) } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {materials.map(mat => {
                const isLowStock = isLow(mat);
                const isCrit = isCritical(mat);
                return (
                  <div
                    key={mat.id}
                    className={`bg-white rounded-card border p-4 transition-all hover:border-slate-300 group ${
                      isCrit ? 'border-rose-200 bg-rose-50/20' : isLowStock ? 'border-amber-200 bg-amber-50/15' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-control flex items-center justify-center text-white font-bold text-sm ${
                          isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-slate-700'
                        }`}>
                          {mat.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 leading-snug">{mat.name}</h4>
                          <p className="t-caption">{mat.unit}</p>
                        </div>
                      </div>
                      {canEditItem && (
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openBOMModal(mat)}
                            className="icon-btn-sm"
                            title="Sarf sozlash (B.O.M)"
                          >
                            <Layers size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setEditMaterialForm({ ...mat, currentStock: String(mat.currentStock), minStock: String(mat.minStock) }); setIsEditMaterialOpen(true); }}
                            className="icon-btn-sm"
                            title="Tahrirlash"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setIsConfirmOpen(true); }}
                            className="icon-btn-sm hover:text-rose-600"
                            title="O'chirish"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stock display */}
                    <div className="mb-3.5 space-y-2.5">
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="t-caption">Omborda jami:</span>
                          {isCrit ? (
                            <Badge variant="danger">TUGAGAN</Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning">MIN: {mat.minStock}</Badge>
                          ) : null}
                        </div>
                        <p className={`text-xl font-semibold tabular-nums ${isCrit ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-800'}`}>
                          {formatStock(mat.currentStock, mat.unit)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <p className="t-caption mb-0.5">Band (rezerv):</p>
                          <p className="text-xs font-semibold text-slate-600 tabular-nums">{formatStock(mat.reservedStock || 0, mat.unit)}</p>
                        </div>
                        <div>
                          <p className="t-caption mb-0.5">Sotuvda mavjud:</p>
                          <p className="text-xs font-semibold text-emerald-700 tabular-nums">
                            {formatStock(Math.max(0, mat.currentStock - (mat.reservedStock || 0)), mat.unit)}
                          </p>
                        </div>
                      </div>

                      {mat.minStock > 0 && (
                        <div className="pt-1">
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                             <div
                               className={`h-full rounded-full transition-all ${isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                               style={{ width: `${Math.min(100, (mat.currentStock / (mat.minStock * 2)) * 100)}%` }}
                             />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {(canReceive || canUse || canWriteOff) && (
                      <div className="flex gap-2 pt-2.5 border-t border-slate-100">
                        {canReceive && (
                          <button
                            onClick={() => openStockOp(mat, 'kirim')}
                            className="flex-1 btn-outline h-control-sm text-xs font-medium text-emerald-700 hover:border-emerald-300"
                          >
                            <ArrowUpCircle size={16} className="text-emerald-600" /> Kirim
                          </button>
                        )}
                        {canUse && (
                          <button
                            onClick={() => openStockOp(mat, 'chiqim')}
                            className="flex-1 btn-outline h-control-sm text-xs font-medium text-slate-700 hover:border-slate-300"
                          >
                            <ArrowDownCircle size={16} className="text-slate-500" /> Chiqim
                          </button>
                        )}
                        {canWriteOff && (
                          <button
                            onClick={() => openStockOp(mat, 'brak')}
                            className="flex-1 btn-outline h-control-sm text-xs font-medium text-rose-700 hover:border-rose-300"
                          >
                            <X size={16} className="text-rose-500" /> Brak
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
        <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-minimal">
              <thead>
                <tr>
                  <th>Sana</th>
                  <th>Material</th>
                  <th>Tur</th>
                  <th>Miqdor</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <History size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 font-medium text-xs">Harakatlar tarixi bo'sh</p>
                    </td>
                  </tr>
                ) : (
                  movements.map(mv => (
                    <tr key={mv.id}>
                      <td className="text-slate-500 tabular-nums whitespace-nowrap">
                        {new Date(mv.createdAt).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="font-semibold text-slate-800">
                        {mv.material?.name || '—'}
                      </td>
                      <td>
                        <Badge
                          variant={mv.type === 'kirim' ? 'success' : mv.type === 'chiqim' ? 'neutral' : 'danger'}
                        >
                          {mv.type === 'kirim' ? 'KIRIM' : mv.type === 'chiqim' ? 'CHIQIM' : 'BRAK'}
                        </Badge>
                      </td>
                      <td className="font-semibold text-slate-800 tabular-nums">
                        {mv.type === 'kirim' ? '+' : '-'}{mv.quantity} {mv.material?.unit}
                      </td>
                      <td className="text-slate-500 max-w-[240px] truncate">
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
      <Modal isOpen={isAddMaterialOpen} onClose={() => setIsAddMaterialOpen(false)} title="Yangi material qo'shish">
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div>
            <label className="form-label">Material nomi</label>
            <input type="text" required value={newMaterialForm.name} onChange={e => setNewMaterialForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Masalan: A4 Qog'oz, Ko'k Kraska..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">O'lchov birligi</label>
              <select value={newMaterialForm.unit} onChange={e => setNewMaterialForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Boshlang'ich qoldiq</label>
              <NumberInput 
                value={newMaterialForm.currentStock} 
                onChange={val => setNewMaterialForm(f => ({ ...f, currentStock: val || '' }))} 
                className="input-minimal font-semibold text-slate-800"
                placeholder="0"
                allowDecimal={true}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Minimal qoldiq (ogohlantirish)</label>
            <NumberInput 
              value={newMaterialForm.minStock} 
              onChange={val => setNewMaterialForm(f => ({ ...f, minStock: val || '' }))} 
              className="input-minimal font-semibold text-slate-800" 
              placeholder="0 = ogohlantirish yo'q" 
              allowDecimal={true}
            />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setIsAddMaterialOpen(false)}>Bekor qilish</button>
            <button type="submit" className="btn-primary flex-1">Qo'shish</button>
          </div>
        </form>
      </Modal>

      {/* EDIT MATERIAL MODAL */}
      <Modal isOpen={isEditMaterialOpen} onClose={() => setIsEditMaterialOpen(false)} title="Materialni tahrirlash">
        <form onSubmit={handleEditMaterial} className="space-y-4">
          <div>
            <label className="form-label">Material nomi</label>
            <input type="text" required value={editMaterialForm.name || ''} onChange={e => setEditMaterialForm((f: any) => ({ ...f, name: e.target.value }))} className="input-minimal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Birlik</label>
              <select value={editMaterialForm.unit || 'dona'} onChange={e => setEditMaterialForm((f: any) => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Minimal qoldiq</label>
              <NumberInput 
                value={editMaterialForm.minStock ?? ''} 
                onChange={val => setEditMaterialForm((f: any) => ({ ...f, minStock: val || '' }))} 
                className="input-minimal font-semibold text-slate-800" 
                placeholder="0" 
                allowDecimal={true}
              />
            </div>
          </div>
          <div className="flex gap-2.5 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setIsEditMaterialOpen(false)}>Bekor qilish</button>
            <button type="submit" className="btn-primary flex-1">Saqlash</button>
          </div>
        </form>
      </Modal>

      {/* STOCK OPERATION MODAL */}
      <Modal
        isOpen={isStockOpOpen}
        onClose={() => setIsStockOpOpen(false)}
        title={stockOp === 'kirim' ? 'Kirim qilish' : stockOp === 'chiqim' ? 'Chiqim qilish' : 'Brak deb belgilash'}
        type={stockOp === 'brak' ? 'danger' : stockOp === 'chiqim' ? 'warning' : 'default'}
      >
        <form onSubmit={handleStockOp} className="space-y-4">
          {selectedMaterial && (
            <div className={`p-3.5 rounded-card border flex items-center gap-3 ${
              stockOp === 'kirim' ? 'bg-emerald-50 border-emerald-200' :
              stockOp === 'chiqim' ? 'bg-slate-50 border-slate-200' :
              'bg-rose-50 border-rose-200'
            }`}>
              <Package size={18} className={stockOp === 'kirim' ? 'text-emerald-600' : stockOp === 'chiqim' ? 'text-slate-600' : 'text-rose-600'} />
              <div>
                <p className="t-caption">Material</p>
                <p className="text-sm font-semibold text-slate-800">{selectedMaterial.name}</p>
                <p className="text-xs text-slate-500">Joriy qoldiq: {formatStock(selectedMaterial.currentStock, selectedMaterial.unit)}</p>
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
              className="input-minimal font-semibold text-lg"
              placeholder="0"
              allowDecimal={true}
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Izoh (ixtiyoriy)</label>
            <input type="text" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} className="input-minimal" placeholder={stockOp === 'brak' ? 'Brak sababi...' : 'Qo\'shimcha ma\'lumot...'} />
          </div>
          <div className="flex gap-2.5 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={() => setIsStockOpOpen(false)}>Bekor qilish</button>
            <button type="submit" className={`flex-1 ${stockOp === 'brak' ? 'btn-danger-solid' : 'btn-primary'}`}>
              {stockOp === 'kirim' ? 'Kirim qilish' : stockOp === 'chiqim' ? 'Chiqim qilish' : 'Brak qilish'}
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
        <div className="space-y-4">
          <div className="bg-rose-50 p-4 rounded-card border border-rose-200 flex items-start gap-3">
            <AlertCircle className="text-rose-600 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-rose-900">Diqqat!</p>
              <p className="text-xs text-rose-700 mt-1">
                Siz <strong>{selectedMaterial?.name}</strong> materialini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 pt-2">
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
        title={`${selectedMaterial?.name || 'Material'} — xizmatlarga sarfi (B.O.M)`}
        maxWidth="max-w-4xl"
      >
        <div className="flex flex-col gap-5">
          {/* Smart Calculator Section */}
          <div className="bg-slate-50 p-4 rounded-card border border-slate-200">
             <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-control bg-slate-700 text-white flex items-center justify-center">
                   <Calculator size={16} />
                </div>
                <div>
                   <h4 className="text-xs font-semibold text-slate-800">Oson hisoblash kalkulyatori</h4>
                   <p className="t-caption">Sarf normasini avtomatik hisoblang</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                <div>
                   <label className="form-label">Necha dona mahsulot uchun?</label>
                   <input 
                     type="number" 
                     value={calcForm.productQty} 
                     onChange={e => setCalcForm({...calcForm, productQty: e.target.value})} 
                     className="input-minimal"
                     placeholder="Masalan: 10 ta vizitka"
                   />
                </div>
                <div className="flex items-center justify-center pt-5">
                   <div className="w-8 h-[2px] bg-slate-200"></div>
                </div>
                <div>
                   <label className="form-label">Qancha {selectedMaterial?.unit} ketishi kerak?</label>
                   <input 
                     type="number" 
                     value={calcForm.materialQty} 
                     onChange={e => setCalcForm({...calcForm, materialQty: e.target.value})} 
                     className="input-minimal"
                     placeholder="Masalan: 1 varaq"
                   />
                </div>
             </div>
             
             <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center bg-white p-3 rounded-control border border-slate-100">
                <p className="text-xs font-medium text-slate-600">Hisoblangan norma (1 dona uchun):</p>
                <div className="text-base font-bold text-slate-800 tabular-nums">
                   {calcForm.result} <span className="text-xs font-normal text-slate-500">{selectedMaterial?.unit}</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Services List (To be linked) */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                 <h5 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                   <Layers size={16}/> Mavjud xizmatlar
                 </h5>
                 <div className="relative w-44">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                    <input 
                      type="text" 
                      placeholder="Qidirish..." 
                      value={bomSearchTerm}
                      onChange={e => setBomSearchTerm(e.target.value)}
                      className="input-minimal pl-8 py-1 text-xs"
                    />
                 </div>
              </div>
              <div className="overflow-y-auto max-h-[280px] border border-slate-200 rounded-card bg-slate-50/50 p-2 flex flex-col gap-1.5 custom-scroll">
                {services
                  .filter(s => s.name.toLowerCase().includes(bomSearchTerm.toLowerCase()))
                  .map(svc => {
                    const isLinked = (selectedMaterial?.bom as any[])?.some(b => b.serviceId === svc.id);
                    return (
                      <div key={svc.id} className="bg-white p-2.5 rounded-control border border-slate-200 flex items-center justify-between group hover:border-slate-300 transition-all">
                        <div>
                           <p className="text-xs font-semibold text-slate-800">{svc.name}</p>
                           <p className="t-caption">{svc.unit}</p>
                        </div>
                        <button 
                          disabled={isLinked}
                          onClick={() => handleLinkService(svc.id, calcForm.result)}
                          className={`btn-outline h-control-sm text-xs ${
                            isLinked ? 'opacity-40 pointer-events-none' : ''
                          }`}
                        >
                          {isLinked ? "Bog'langan" : 'Biriktirish'}
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Currently Linked Services */}
            <div className="flex flex-col">
               <h5 className="text-xs font-semibold text-slate-700 mb-2 px-1 flex items-center gap-1.5">
                 <CheckCircle2 size={16} className="text-emerald-600" /> Biriktirilgan xizmatlar
               </h5>
               <div className="overflow-y-auto max-h-[280px] border border-orange-200 rounded-card bg-orange-50/20 p-2 flex flex-col gap-1.5 custom-scroll">
                  {(!selectedMaterial?.bom || (selectedMaterial.bom as any[]).length === 0) ? (
                    <div className="py-16 text-center opacity-40 flex flex-col items-center">
                       <Layers size={28} className="mb-1.5 text-slate-400" />
                       <p className="text-xs text-slate-500 font-medium">Hozircha xizmat biriktirilmagan</p>
                    </div>
                  ) : (
                    (selectedMaterial.bom as any[]).map(b => (
                      <div key={b.id} className="bg-white p-2.5 rounded-control border border-orange-200 flex items-center justify-between group">
                         <div>
                            <p className="text-xs font-semibold text-slate-800">{b.service?.name}</p>
                            <p className="text-xs text-orange-700 font-medium">Norma: {b.normPerUnit} {selectedMaterial?.unit}</p>
                         </div>
                         <button 
                           onClick={() => askUnlink(b.serviceId)}
                           className="icon-btn-sm hover:text-rose-600"
                           title="Ajratish"
                         >
                            <Trash2 size={16} />
                         </button>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-200">
             <button
               onClick={() => setIsBOMModalOpen(false)}
               className="btn-primary w-full"
             >
               Saqlash va tugatish
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
        <div className="space-y-4">
          <div className="bg-rose-50 p-4 rounded-card border border-rose-200 flex items-start gap-3">
            <AlertCircle className="text-rose-600 mt-0.5 shrink-0" size={20} />
            <p className="text-sm text-rose-800">Bu xizmatni materialdan ajratmoqchimisiz? Xizmat sarflanish normasi o'chiriladi.</p>
          </div>
          <div className="flex gap-2.5">
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
