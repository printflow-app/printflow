import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Trash2, Edit3, ArrowUpCircle, ArrowDownCircle,
  CheckCircle2, AlertCircle, TrendingDown, TrendingUp, BarChart2, History, X
} from 'lucide-react';
import { inventoryApi, servicesApi } from '../api';
import Modal from '../components/Modal';
import NumberInput from '../components/NumberInput';
import { Search, Layers, Calculator, Save } from 'lucide-react';

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

const Ombor: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const isAdmin = currentUser.role?.name?.toLowerCase() === 'admin' || currentUser.login === 'admin';

  const [materials, setMaterials] = useState<Material[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [services, setServices] = useState<any[]>([]);
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

  const fetchData = useCallback(async (refreshSelectedId?: string) => {
    try {
      const [matRes, movRes, svcRes] = await Promise.all([
        inventoryApi.getMaterials(),
        inventoryApi.getMovements(),
        servicesApi.findAll(),
      ]);
      const freshMaterials = matRes.data || [];
      setMaterials(freshMaterials);
      setMovements(movRes.data || []);
      setServices(svcRes.data || []);
      // Re-sync selectedMaterial so BOM list updates immediately inside the modal
      if (refreshSelectedId) {
        const refreshed = freshMaterials.find((m: Material) => m.id === refreshSelectedId);
        if (refreshed) setSelectedMaterial(refreshed);
      }
    } catch {
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        ...editMaterialForm,
        currentStock: Number(editMaterialForm.currentStock),
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
    try {
      await servicesApi.addMaterial(serviceId, { materialId: selectedMaterial.id, normPerUnit: norm });
      showStatus('success', 'Xizmat biriktirildi!');
      // Pass the id so selectedMaterial gets refreshed immediately
      fetchData(selectedMaterial.id);
    } catch { showStatus('error', 'Biriktirishda xatolik!'); }
  };

  const handleUnlinkService = async () => {
    if (!selectedMaterial || !unlinkServiceId) return;
    try {
      await servicesApi.deleteMaterial(unlinkServiceId, selectedMaterial.id);
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-full p-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
    </div>
  );

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
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Package size={22} className="text-emerald-500" /> Ombor Boshqaruvi
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
            Xomashyo va materiallar nazorati (Reserva & BOM)
          </p>
        </div>
        { (isAdmin || currentUser.permissions?.canManageInventory) && (
          <button
            onClick={() => setIsAddMaterialOpen(true)}
            className="flex items-center gap-2 h-10 px-8 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all hover:-translate-y-0.5"
          >
            <Plus size={16} strokeWidth={3} /> Material Qo'shish
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Jami Materiallar', value: materials.length, icon: Package, color: 'indigo', bg: 'bg-indigo-50/50', border: 'border-indigo-100', text: 'text-indigo-600' },
          { label: 'Faol (yetarli)', value: materials.filter(m => !isLow(m) && !isCritical(m)).length, icon: TrendingUp, color: 'emerald', bg: 'bg-emerald-50/50', border: 'border-emerald-100', text: 'text-emerald-600' },
          { label: 'Band (Reserved)', value: materials.reduce((acc, m) => acc + (m.reservedStock > 0 ? 1 : 0), 0), icon: ArrowDownCircle, color: 'sky', bg: 'bg-sky-50/50', border: 'border-sky-100', text: 'text-sky-600' },
          { label: 'Kam qolgan', value: lowCount, icon: TrendingDown, color: 'amber', bg: 'bg-amber-50/50', border: 'border-amber-100', text: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} ${stat.border} border rounded-2xl p-4 flex items-center gap-3 transition-all hover:shadow-md`}>
            <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${stat.text} border ${stat.border}`}>
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-black text-slate-800 leading-none">{stat.value}</p>
              <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${stat.text}`}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'materials' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <BarChart2 size={14} /> Materiallar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <History size={14} /> Harakatlar Tarixi
        </button>
      </div>

      {/* Materials List */}
      {activeTab === 'materials' && (
        <div className="space-y-3">
          {materials.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 py-24 flex flex-col items-center justify-center gap-4">
              <Package size={48} className="text-slate-200" />
              <p className="text-slate-300 font-black uppercase tracking-widest text-xs">Hozircha materiallar yo'q</p>
              {isAdmin && (
                <button onClick={() => setIsAddMaterialOpen(true)} className="text-xs font-black text-emerald-500 border-b-2 border-emerald-200 pb-0.5 hover:border-emerald-500 transition-colors">
                  + Birinchi materialni qo'shing
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {materials.map(mat => {
                const isLowStock = isLow(mat);
                const isCrit = isCritical(mat);
                return (
                  <div
                    key={mat.id}
                    className={`bg-white rounded-3xl border-2 shadow-sm p-5 transition-all hover:shadow-md group ${
                      isCrit ? 'border-rose-200 bg-rose-50/30' : isLowStock ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm ${
                          isCrit ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}>
                          {mat.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{mat.name}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{mat.unit}</p>
                        </div>
                      </div>
                      { (isAdmin || currentUser.permissions?.canManageInventory) && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openBOMModal(mat)}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-violet-500 hover:bg-violet-50 transition-all"
                            title="Sarf Sozlash (B.O.M)"
                          >
                            <Layers size={13} />
                          </button>
                          <button
                            onClick={() => { setSelectedMaterial(mat); setEditMaterialForm({ ...mat, currentStock: String(mat.currentStock), minStock: String(mat.minStock) }); setIsEditMaterialOpen(true); }}
                            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-all"
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
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Omborda jami:</span>
                          {isCrit ? (
                            <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md animate-pulse">TUGAGAN!</span>
                          ) : isLowStock ? (
                            <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">MIN: {mat.minStock}</span>
                          ) : null}
                        </div>
                        <p className={`text-xl font-black tabular-nums ${isCrit ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-slate-800'}`}>
                          {formatStock(mat.currentStock, mat.unit)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Band (Reserved):</p>
                          <p className="text-sm font-black text-sky-600 tabular-nums">{formatStock(mat.reservedStock || 0, mat.unit)}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">Sotuvda mavjud:</p>
                          <p className="text-sm font-black text-emerald-600 tabular-nums">
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
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => openStockOp(mat, 'kirim')}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-600 text-[10px] font-black uppercase rounded-xl border border-emerald-100 hover:border-emerald-500 transition-all"
                      >
                        <ArrowUpCircle size={13} /> Kirim
                      </button>
                      <button
                        onClick={() => openStockOp(mat, 'chiqim')}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-sky-50 hover:bg-sky-500 hover:text-white text-sky-600 text-[10px] font-black uppercase rounded-xl border border-sky-100 hover:border-sky-500 transition-all"
                      >
                        <ArrowDownCircle size={13} /> Chiqim
                      </button>
                      <button
                        onClick={() => openStockOp(mat, 'brak')}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600 text-[10px] font-black uppercase rounded-xl border border-rose-100 hover:border-rose-500 transition-all"
                      >
                        <X size={13} /> Brak
                      </button>
                    </div>
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
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Sana</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Material</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Tur</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Miqdor</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Izoh</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <History size={40} className="mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-300 font-black uppercase tracking-widest text-xs">Harakatlar tarixi bo'sh</p>
                    </td>
                  </tr>
                ) : (
                  movements.map(mv => (
                    <tr key={mv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-[11px] font-black text-slate-400 tabular-nums whitespace-nowrap">
                        {new Date(mv.createdAt).toLocaleString('uz-UZ', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{mv.material?.name || '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-xl uppercase ${
                          mv.type === 'kirim' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          mv.type === 'chiqim' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                          'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                          {mv.type === 'kirim' ? <ArrowUpCircle size={10} /> : mv.type === 'chiqim' ? <ArrowDownCircle size={10} /> : <X size={10} />}
                          {mv.type.charAt(0).toUpperCase() + mv.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-black text-slate-700 tabular-nums">
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
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Material Nomi</label>
            <input type="text" required value={newMaterialForm.name} onChange={e => setNewMaterialForm(f => ({ ...f, name: e.target.value }))} className="input-minimal" placeholder="Masalan: A4 Qog'oz, Ko'k Kraska..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">O'lchov Birligi</label>
              <select value={newMaterialForm.unit} onChange={e => setNewMaterialForm(f => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Boshlang'ich Qoldiq</label>
              <NumberInput 
                value={newMaterialForm.currentStock} 
                onChange={val => setNewMaterialForm(f => ({ ...f, currentStock: val || '' }))} 
                className="input-minimal font-black text-emerald-600" 
                placeholder="0" 
                allowDecimal={true}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Minimal Qoldiq (Ogohlantirish)</label>
            <NumberInput 
              value={newMaterialForm.minStock} 
              onChange={val => setNewMaterialForm(f => ({ ...f, minStock: val || '' }))} 
              className="input-minimal font-black text-amber-600" 
              placeholder="0 = ogohlantirish yo'q" 
              allowDecimal={true}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setIsAddMaterialOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-8 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 transition-all">Qo'shish</button>
          </div>
        </form>
      </Modal>

      {/* EDIT MATERIAL MODAL */}
      <Modal isOpen={isEditMaterialOpen} onClose={() => setIsEditMaterialOpen(false)} title="Materialni Tahrirlash">
        <form onSubmit={handleEditMaterial} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Material Nomi</label>
            <input type="text" required value={editMaterialForm.name || ''} onChange={e => setEditMaterialForm((f: any) => ({ ...f, name: e.target.value }))} className="input-minimal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Birlik</label>
              <select value={editMaterialForm.unit || 'dona'} onChange={e => setEditMaterialForm((f: any) => ({ ...f, unit: e.target.value }))} className="select-minimal">
                {['dona', 'kg', 'g', 'litr', 'ml', 'sm', 'metr', 'm2', 'varaq', 'quti', 'rulon'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Minimal Qoldiq</label>
              <NumberInput 
                value={editMaterialForm.minStock ?? ''} 
                onChange={val => setEditMaterialForm((f: any) => ({ ...f, minStock: val || '' }))} 
                className="input-minimal font-black text-amber-600" 
                placeholder="0" 
                allowDecimal={true}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setIsEditMaterialOpen(false)}>Bekor</button>
            <button type="submit" className="h-12 flex-2 px-8 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-sky-700 transition-all">Saqlash</button>
          </div>
        </form>
      </Modal>

      {/* STOCK OPERATION MODAL */}
      <Modal
        isOpen={isStockOpOpen}
        onClose={() => setIsStockOpOpen(false)}
        title={stockOp === 'kirim' ? '📦 Kirim' : stockOp === 'chiqim' ? '📤 Chiqim' : '🚫 Brak'}
        type={stockOp === 'brak' ? 'danger' : stockOp === 'chiqim' ? 'warning' : 'default'}
      >
        <form onSubmit={handleStockOp} className="space-y-5">
          {selectedMaterial && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
              stockOp === 'kirim' ? 'bg-emerald-50 border-emerald-100' :
              stockOp === 'chiqim' ? 'bg-sky-50 border-sky-100' :
              'bg-rose-50 border-rose-100'
            }`}>
              <Package size={20} className={stockOp === 'kirim' ? 'text-emerald-500' : stockOp === 'chiqim' ? 'text-sky-500' : 'text-rose-500'} />
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Material</p>
                <p className="text-sm font-black text-slate-800">{selectedMaterial.name}</p>
                <p className="text-[10px] font-bold text-slate-500">Joriy qoldiq: {formatStock(selectedMaterial.currentStock, selectedMaterial.unit)}</p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">
              Miqdor ({selectedMaterial?.unit})
            </label>
            <NumberInput
              value={stockForm.quantity}
              onChange={val => setStockForm(f => ({ ...f, quantity: val || '' }))}
              className={`input-minimal font-black text-2xl h-16 ${
                stockOp === 'kirim' ? 'focus:border-emerald-500 text-emerald-600' :
                stockOp === 'chiqim' ? 'focus:border-sky-500 text-sky-600' :
                'focus:border-rose-500 text-rose-600'
              }`}
              placeholder="0"
              allowDecimal={true}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Izoh (ixtiyoriy)</label>
            <input type="text" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} className="input-minimal" placeholder={stockOp === 'brak' ? 'Brak sababi...' : 'Qo\'shimcha ma\'lumot...'} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" onClick={() => setIsStockOpOpen(false)}>Bekor</button>
            <button type="submit" className={`h-12 flex-2 px-8 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all ${
              stockOp === 'kirim' ? 'bg-emerald-600 hover:bg-emerald-700' :
              stockOp === 'chiqim' ? 'bg-sky-600 hover:bg-sky-700' :
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
              <p className="text-sm font-black text-rose-900 uppercase">Diqqat!</p>
              <p className="text-xs font-bold text-rose-700 mt-1">
                Siz <strong>{selectedMaterial?.name}</strong> materialini o'chirmoqchisiz. Bu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest" 
              onClick={() => setIsConfirmOpen(false)}
            >
              Bekor qilish
            </button>
            <button 
              type="button" 
              className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all"
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
          <div className="bg-violet-50 p-5 rounded-3xl border-2 border-violet-100 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                   <Calculator size={18} />
                </div>
                <div>
                   <h4 className="text-[11px] font-black text-violet-900 uppercase tracking-widest leading-none">Oson Hisoblash Kalkulyatori</h4>
                   <p className="text-[9px] font-black text-violet-400 uppercase tracking-widest mt-1">Sarf normasini avtomatik hisoblang</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <div>
                   <label className="block text-[8px] font-black text-violet-400 uppercase mb-2 px-1 tracking-[0.1em]">Necha Dona Mahsulot Uchun?</label>
                   <input 
                     type="number" 
                     value={calcForm.productQty} 
                     onChange={e => setCalcForm({...calcForm, productQty: e.target.value})} 
                     className="input-minimal h-12 bg-white border-2 border-violet-100 focus:border-violet-500 font-black text-violet-600"
                     placeholder="Masalan: 10 ta vizitka"
                   />
                </div>
                <div className="flex items-center justify-center pt-5">
                   <div className="w-10 h-[2px] bg-violet-200"></div>
                </div>
                <div>
                   <label className="block text-[8px] font-black text-violet-400 uppercase mb-2 px-1 tracking-[0.1em]">Qancha {selectedMaterial?.unit} Ketishi Kerak?</label>
                   <input 
                     type="number" 
                     value={calcForm.materialQty} 
                     onChange={e => setCalcForm({...calcForm, materialQty: e.target.value})} 
                     className="input-minimal h-12 bg-white border-2 border-violet-100 focus:border-violet-500 font-black text-violet-600"
                     placeholder="Masalan: 1 varaq"
                   />
                </div>
             </div>
             
             <div className="mt-4 pt-4 border-t border-violet-100 flex justify-between items-center bg-white/50 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-slate-500 uppercase">Hisoblangan Norma (1 dona uchun):</p>
                <div className="text-xl font-black text-violet-700 bg-white px-6 py-2 rounded-xl shadow-inner border border-violet-100">
                   {calcForm.result} <span className="text-[10px] uppercase">{selectedMaterial?.unit}</span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Services List (To be linked) */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4 px-2">
                 <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Layers size={14}/> Mavjud Xizmatlar
                 </h5>
                 <div className="relative w-40">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input 
                      type="text" 
                      placeholder="Qidirish..." 
                      value={bomSearchTerm}
                      onChange={e => setBomSearchTerm(e.target.value)}
                      className="w-full pl-8 h-8 rounded-lg bg-slate-100 border-none outline-none text-[10px] font-bold"
                    />
                 </div>
              </div>
              <div className="overflow-y-auto max-h-[300px] border border-slate-100 rounded-3xl bg-slate-50/50 p-2 flex flex-col gap-1.5 custom-scroll">
                {services
                  .filter(s => s.name.toLowerCase().includes(bomSearchTerm.toLowerCase()))
                  .map(svc => {
                    const isLinked = (selectedMaterial?.bom as any[])?.some(b => b.serviceId === svc.id);
                    return (
                      <div key={svc.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-violet-300 transition-all">
                        <div>
                           <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{svc.name}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{svc.unit}</p>
                        </div>
                        <button 
                          disabled={isLinked}
                          onClick={() => handleLinkService(svc.id, calcForm.result)}
                          className={`h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                            isLinked 
                             ? 'bg-slate-100 text-slate-300 pointer-events-none' 
                             : 'bg-violet-600 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-700 hover:scale-105 active:scale-95'
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
               <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                 <CheckCircle2 size={14}/> Biriktirilgan Xizmatlar
               </h5>
               <div className="overflow-y-auto max-h-[300px] border-2 border-emerald-50 rounded-3xl bg-emerald-50/20 p-2 flex flex-col gap-1.5 custom-scroll">
                  {(!selectedMaterial?.bom || (selectedMaterial.bom as any[]).length === 0) ? (
                    <div className="py-20 text-center opacity-30 flex flex-col items-center">
                       <Layers size={32} className="mb-2" />
                       <p className="text-[9px] font-black uppercase tracking-widest">Hozircha xizmat biriktirilmagan</p>
                    </div>
                  ) : (
                    (selectedMaterial.bom as any[]).map(b => (
                      <div key={b.id} className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between group">
                         <div>
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{b.service?.name}</p>
                            <p className="text-[10px] font-black text-emerald-600">Norma: {b.normPerUnit} {selectedMaterial?.unit}</p>
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
               className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
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
              className="btn-outline h-12 flex-1 rounded-2xl font-black uppercase text-[10px] tracking-widest"
              onClick={() => { setIsUnlinkConfirmOpen(false); setUnlinkServiceId(null); }}
            >
              Bekor qilish
            </button>
            <button
              type="button"
              className="h-12 flex-1 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-700 transition-all"
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
