import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'react-toastify';
import {
  X, Printer, Download, Loader2, Building2, CheckSquare, Square,
} from 'lucide-react';
import { PriceListView, PriceListData, PriceService } from './PriceListView';
import axios from 'axios';

// Public endpoint — mijoz ham aynan shu data'ni ko'radi.
const PUBLIC_API = (() => {
  const raw = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
  return raw ? (raw.endsWith('/api') ? raw : raw + '/api') : '/api';
})();

// =============================================
// PriceListModal — admin tomonidan ochiladigan preview + eksport.
// - Chap panel: xizmatlar checkbox'i (kerakli xizmatlarni tanlash)
// - Markazda: PriceListView preview (tanlangan xizmatlar bo'yicha)
// - Pastda: Print | PNG yuklab olish
// =============================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  defaultBranchId?: string;
}

export const PriceListModal: React.FC<Props> = ({
  isOpen, onClose, tenantSlug, defaultBranchId,
}) => {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId || '');
  const [allServices, setAllServices] = useState<PriceService[]>([]);
  const [tenant, setTenant] = useState<{ name: string; slug?: string } | null>(null);
  const [branchInfo, setBranchInfo] = useState<PriceListData['branch'] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const printableRef = useRef<HTMLDivElement>(null);

  // Public endpoint — admin preview = mijoz ko'rinishi.
  useEffect(() => {
    if (!isOpen || !tenantSlug) return;
    setLoading(true);
    const url = `${PUBLIC_API}/services/public/${encodeURIComponent(tenantSlug)}` +
                (selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : '');
    axios.get(url)
      .then(r => {
        const services = (r.data.services || []) as PriceService[];
        setTenant(r.data.tenant);
        setBranchInfo(r.data.branch);
        setAllServices(services);
        setBranches(r.data.branches || []);
        // Default: barcha xizmatlar tanlangan
        setSelectedIds(new Set(services.map(s => s.id)));
        if (!selectedBranchId && r.data.branch?.id) {
          setSelectedBranchId(r.data.branch.id);
        }
      })
      .catch(() => toast.error('Price list yuklanmadi'))
      .finally(() => setLoading(false));
  }, [isOpen, tenantSlug, selectedBranchId]);

  // Filtrlangan xizmatlar — preview va eksport shularni ko'rsatadi
  const filteredData = useMemo<PriceListData | null>(() => {
    if (!tenant || !branchInfo) return null;
    return {
      tenant,
      branch: branchInfo,
      services: allServices.filter(s => selectedIds.has(s.id)),
    };
  }, [tenant, branchInfo, allServices, selectedIds]);

  if (!isOpen) return null;

  const toggleService = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === allServices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allServices.map(s => s.id)));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async () => {
    if (!printableRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(printableRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      link.download = `narxlar-${tenantSlug}-${date}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Rasm yuklab olindi');
    } catch {
      toast.error('Rasm yaratishda xatolik');
    } finally {
      setExporting(false);
    }
  };

  const allChecked = allServices.length > 0 && selectedIds.size === allServices.length;
  const hasSelection = filteredData?.services.length;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-100 w-full max-w-6xl rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-screen sm:max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight truncate">
              Price list — mijoz uchun
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Xizmatlarni tanlang, eksport qiling
            </p>
          </div>
          <div className="flex items-center gap-2">
            {branches.length > 1 && (
              <div className="relative">
                <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-400"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body: chap panel (checkboxes) + preview */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">

          {/* Xizmat tanlash paneli */}
          <aside className="w-full lg:w-72 flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col max-h-60 lg:max-h-none">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Xizmatlar ({selectedIds.size}/{allServices.length})
              </p>
              <button
                onClick={toggleAll}
                className="text-[10px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-wider"
              >
                {allChecked ? 'Bekor' : 'Hammasi'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll p-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="text-slate-300 animate-spin" />
                </div>
              ) : allServices.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Xizmat yo'q</p>
              ) : (
                allServices.map(svc => {
                  const checked = selectedIds.has(svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggleService(svc.id)}
                      className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        checked ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      {checked
                        ? <CheckSquare size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                        : <Square size={16} className="text-slate-300 mt-0.5 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-bold truncate ${checked ? 'text-slate-900' : 'text-slate-600'}`}>
                          {svc.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {Number(svc.basePrice).toLocaleString('uz-UZ')} so'm / {svc.unit}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Preview area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center custom-scroll min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 size={32} className="text-orange-500 animate-spin" />
              </div>
            ) : filteredData ? (
              filteredData.services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                  <Square size={32} className="mb-3 text-slate-200" />
                  <p className="text-sm font-bold">Hech qaysi xizmat tanlanmagan</p>
                  <p className="text-xs mt-1">Chap paneldan kerakli xizmatlarni belgilang</p>
                </div>
              ) : (
                <div className="shadow-2xl shadow-slate-300/40 origin-top">
                  <PriceListView ref={printableRef} data={filteredData} />
                </div>
              )
            ) : (
              <div className="text-center py-32 text-slate-400">
                <p className="text-sm font-bold">Yuklanmoqda...</p>
              </div>
            )}
          </div>
        </div>

        {/* Action bar — faqat Print va PNG */}
        <div className="bg-white border-t border-slate-200 px-5 sm:px-6 py-3 flex items-center justify-end gap-2">
          <button
            onClick={handlePrint}
            disabled={!hasSelection}
            className="h-10 px-4 rounded-lg border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 text-xs font-bold text-slate-700 uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={13} /> Print
          </button>
          <button
            onClick={handleDownloadPng}
            disabled={exporting || !hasSelection}
            className="h-10 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exporting
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />} PNG yuklab olish
          </button>
        </div>
      </div>
    </div>
  );
};
