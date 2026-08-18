import { useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { toast } from 'react-toastify';
import {
  Plus, Minus, Trash2, ShoppingCart, Download, Loader2, FileText,
  Package, Sparkles, Search, X,
} from 'lucide-react';
import { PriceListData, PriceOption, PriceService } from './PriceListView';
import { QuoteView, QuoteLine, QuoteData } from './QuoteView';
import ConfirmModal from './ConfirmModal';
import { EmptyState } from './ui';

// =============================================
// QuoteBuilder — mijoz mahsulot tanlab, sonini kiritib, narxni live ko'radi.
// Chap: mahsulotlar kataloga (har xizmat — opsiya + miqdor + "qo'shish")
// O'ng: savat (tanlangan qatorlar, JAMI summa, PNG/PDF yuklab olish)
// =============================================

interface Props {
  data: PriceListData;  // tenant + branch + services + branding
}

// Bir savat qator (cart line) — bir nechta opsiya turini saqlaydi
interface CartLine {
  id: string;                       // unique line id
  service: PriceService;
  selectedOptions: PriceOption[];   // har "name" guruhdan max 1 ta
  quantity: number;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatPrice(n: number): string {
  return Number(n || 0).toLocaleString('uz-UZ');
}

/** Opsiyalarni name bo'yicha guruhlash. Tartib — birinchi uchragan name birinchi keladi. */
function groupOptionsByName(options?: PriceOption[]): Array<{ name: string; items: PriceOption[] }> {
  if (!options || options.length === 0) return [];
  const order: string[] = [];
  const map = new Map<string, PriceOption[]>();
  for (const opt of options) {
    const key = opt.name || '—';
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(opt);
  }
  return order.map(name => ({ name, items: map.get(name)! }));
}

/** Bir qator uchun dona narxi (basePrice + barcha tanlangan opsiyalarning priceAdd'i) va jami summa */
function calcLine(line: CartLine): { unitPrice: number; total: number; optionLabel?: string } {
  const sumAdd = line.selectedOptions.reduce((s, o) => s + (o.priceAdd || 0), 0);
  const unitPrice = line.service.basePrice + sumAdd;
  const total = unitPrice * (line.quantity || 0);
  const optionLabel = line.selectedOptions.length
    ? line.selectedOptions.map(o => `${o.name}: ${o.value}`).join(', ')
    : undefined;
  return { unitPrice, total, optionLabel };
}

export const QuoteBuilder: React.FC<Props> = ({ data }) => {
  const { tenant, branch, services, branding } = data;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf'>('pdf');
  const [search, setSearch] = useState('');

  // Har xizmat uchun lokal "tanlangan opsiyalar + miqdor" holati (savatga qo'shilmagan).
  // quantity — STRING, bo'sh ham bo'lishi mumkin (user yozayotgan paytda). Validatsiya
  // faqat "Qo'shish"da bo'ladi — aks holda Math.max(1, ...) "0" ni darhol 1 ga snap qilib,
  // foydalanuvchiga inputni tozalashga imkon bermaydi.
  interface ServiceDraft {
    optionIds: Record<string, string>;
    quantity: string;
  }
  const [drafts, setDrafts] = useState<Record<string, ServiceDraft>>({});

  // Off-screen render uchun ref (eksport vaqtida ishlatiladi)
  const quoteRef = useRef<HTMLDivElement>(null);

  const getDraft = (serviceId: string): ServiceDraft =>
    drafts[serviceId] ?? { optionIds: {}, quantity: '' };

  /** Inputga raqamlardan tashqari hech narsa o'tmaydi, bo'sh ham qabul qilinadi. */
  const setDraftQuantity = (serviceId: string, raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    setDrafts(prev => {
      const current = prev[serviceId] ?? { optionIds: {}, quantity: '' };
      return { ...prev, [serviceId]: { ...current, quantity: cleaned } };
    });
  };

  /** Draft quantity'ni son sifatida olish — bo'sh bo'lsa 0. */
  const draftQtyNum = (d: ServiceDraft) => Number(d.quantity) || 0;

  /** Bir guruhdan opsiya tanlash. Agar shu opsiya allaqachon tanlangan bo'lsa — bekor qilinadi (toggle). */
  const toggleDraftOption = (serviceId: string, groupName: string, optionId: string) => {
    setDrafts(prev => {
      const current = prev[serviceId] ?? { optionIds: {}, quantity: '' };
      const nextIds = { ...current.optionIds };
      if (nextIds[groupName] === optionId) {
        delete nextIds[groupName];
      } else {
        nextIds[groupName] = optionId;
      }
      return { ...prev, [serviceId]: { ...current, optionIds: nextIds } };
    });
  };

  const addToCart = (service: PriceService) => {
    const d = getDraft(service.id);
    const qty = draftQtyNum(d);
    if (qty < 1) {
      toast.warning('Avval soni kiriting (1 yoki undan ko\'p)');
      return;
    }
    // Tanlangan opsiyalar (har guruhdan max 1 ta)
    const selectedOptions: PriceOption[] = [];
    for (const groupName of Object.keys(d.optionIds)) {
      const opt = service.options?.find(o => o.id === d.optionIds[groupName]);
      if (opt) selectedOptions.push(opt);
    }
    setCart(prev => [
      ...prev,
      { id: uid(), service, selectedOptions, quantity: qty },
    ]);
    toast.success(`${service.name} buyurtmaga qo'shildi`);
  };

  const updateLineQty = (lineId: string, delta: number) => {
    setCart(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const next = Math.max(0, l.quantity + delta);
      return { ...l, quantity: next };
    }));
  };

  // Faqat raqamlardan iborat string'ni qabul qiladi (bo'sh ham bo'lishi mumkin).
  // Bo'sh / NaN — 0 deb saqlaymiz, lekin 0 ga snap qilib kursorni ushlamaymiz.
  const setLineQty = (lineId: string, raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    const next = cleaned === '' ? 0 : Number(cleaned);
    setCart(prev => prev.map(l => (l.id === lineId ? { ...l, quantity: next } : l)));
  };

  const removeLine = (lineId: string) => {
    setCart(prev => prev.filter(l => l.id !== lineId));
  };

  // Savatni tozalash — tasdiqlash bilan. Brauzer `confirm()` i emas:
  // u mobil brauzerlarda bloklangan bo'lsa jimgina `false` qaytaradi va
  // tugma ishlamayotgandek ko'rinadi.
  const [tozalashSoraldi, setTozalashSoraldi] = useState(false);
  const clearCart = () => {
    if (!cart.length) return;
    setTozalashSoraldi(true);
  };

  // Qidiruv — xizmat nomi, o'lchov birligi va opsiya nomlari/qiymatlari bo'yicha.
  // Bo'sh so'rov — barcha xizmatlar (filtrlash umuman ishlamaydi).
  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter(svc => {
      const haystack = [
        svc.name,
        svc.unit,
        ...(svc.options || []).flatMap(o => [o.name, o.value]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [services, search]);

  // Eksport uchun QuoteData
  const quoteData = useMemo<QuoteData>(() => {
    const lines: QuoteLine[] = cart.map(l => {
      const { unitPrice, total, optionLabel } = calcLine(l);
      return {
        id: l.id,
        serviceName: l.service.name,
        optionLabel,
        quantity: l.quantity,
        unit: l.service.unit || 'dona',
        unitPrice,
        total,
      };
    });
    return { tenant, branch, lines, branding };
  }, [cart, tenant, branch, branding]);

  const grandTotal = quoteData.lines.reduce((s, l) => s + l.total, 0);

  const handleDownload = async () => {
    if (!cart.length) {
      toast.warning('Buyurtmaga kamida 1 ta mahsulot qo\'shing');
      return;
    }
    if (!quoteRef.current) return;
    setExporting(true);
    const date = new Date().toISOString().split('T')[0];
    const tenantSlug = (tenant as any).slug || tenant.name.toLowerCase().replace(/\s+/g, '-');
    try {
      const dataUrl = await toPng(quoteRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      });

      if (exportFormat === 'png') {
        const link = document.createElement('a');
        link.download = `buyurtma-${tenantSlug}-${date}.png`;
        link.href = dataUrl;
        link.click();
        toast.success('PNG yuklab olindi');
        return;
      }

      // PDF
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const imgWidthMm = pageWidthMm;
      const imgHeightMm = (img.height * imgWidthMm) / img.width;

      if (imgHeightMm <= pageHeightMm) {
        pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidthMm, imgHeightMm);
      } else {
        let yOffsetMm = 0;
        while (yOffsetMm < imgHeightMm) {
          pdf.addImage(dataUrl, 'PNG', 0, -yOffsetMm, imgWidthMm, imgHeightMm);
          yOffsetMm += pageHeightMm;
          if (yOffsetMm < imgHeightMm) pdf.addPage();
        }
      }
      pdf.save(`buyurtma-${tenantSlug}-${date}.pdf`);
      toast.success('PDF yuklab olindi');
    } catch (err) {
      console.error('Eksport xatosi:', err);
      toast.error(exportFormat === 'pdf' ? 'PDF yaratishda xatolik' : 'Rasm yaratishda xatolik');
    } finally {
      setExporting(false);
    }
  };

  if (services.length === 0) {
    return (
      <EmptyState icon={Package} title="Hozircha xizmatlar yo'q" />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-4">
      {/* CHAP: Mahsulotlar */}
      <div className="space-y-3">
        <div className="bg-primary-50 border border-primary-200 rounded-card p-3 flex items-start gap-3">
          <Sparkles size={18} className="text-[color:var(--primary)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-900">Buyurtma tuzish</p>
            <p className="text-xs text-orange-800 mt-0.5">
              Kerakli mahsulotni tanlang, sonini kiriting va "Qo'shish" bosing. Pastda jami summa avtomatik hisoblanadi.
            </p>
          </div>
        </div>

        {/* Qidiruv */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Mahsulot yoki xizmat qidirish..."
            className="input-minimal pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              title="Tozalash"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-control text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {search.trim() && (
          <p className="label-caps px-1">
            {visibleServices.length} ta natija topildi
          </p>
        )}

        {visibleServices.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Hech narsa topilmadi"
            description="Boshqa so'z bilan qidirib ko'ring"
          />
        ) : visibleServices.map(svc => {
          const draft = getDraft(svc.id);
          const groups = groupOptionsByName(svc.options);
          // Tanlangan opsiyalar yig'indisi (priceAdd)
          let sumAdd = 0;
          for (const g of groups) {
            const selId = draft.optionIds[g.name];
            if (selId) {
              const opt = g.items.find(o => o.id === selId);
              sumAdd += opt?.priceAdd || 0;
            }
          }
          const draftQty = draftQtyNum(draft);
          const unitPrice = svc.basePrice + sumAdd;
          const lineTotal = unitPrice * draftQty;

          return (
            <div key={svc.id} className="bg-white rounded-card border border-slate-200 hover:border-slate-300 transition-colors p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                {svc.imageUrl && (
                  <img
                    src={svc.imageUrl}
                    alt={svc.name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-card object-cover border border-slate-200 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <h3 className="card-title truncate">{svc.name}</h3>
                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-semibold text-[color:var(--primary)] tabular-nums">{formatPrice(unitPrice)}</span>
                      <span className="text-xs font-medium text-slate-500 ml-1">so'm</span>
                      <p className="label-caps">/ {svc.unit}</p>
                    </div>
                  </div>

                  {/* Opsiyalar — har guruhi alohida qator */}
                  {groups.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {groups.map(group => (
                        <div key={group.name} className="flex items-start gap-2 sm:gap-3 flex-wrap">
                          <p className="label-caps pt-1.5 min-w-[80px]">
                            {group.name}:
                          </p>
                          <div className="flex flex-wrap gap-1.5 flex-1">
                            {group.items.map(opt => {
                              const active = draft.optionIds[group.name] === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => toggleDraftOption(svc.id, group.name, opt.id)}
                                  className={`px-3 h-8 text-xs font-semibold rounded-control border transition-all duration-120 ${
                                    active
                                      ? 'bg-primary-50 text-primary-700 border-[color:var(--primary)]'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-primary-300 hover:bg-primary-50'
                                  }`}
                                >
                                  {opt.value}
                                  {opt.priceAdd ? (
                                    <span className={`ml-1 ${active ? 'text-primary-500' : 'text-slate-400'}`}>
                                      ({opt.priceAdd > 0 ? '+' : ''}{formatPrice(opt.priceAdd)})
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Miqdor + Live narx + Qo'shish */}
                  <div className="mt-4 flex flex-wrap items-end gap-2 sm:gap-3">
                    <div>
                      <p className="label-caps mb-1">Soni</p>
                      <div className="flex items-center gap-1 bg-white rounded-control border border-slate-200 p-1">
                        <button
                          onClick={() => setDraftQuantity(svc.id, String(Math.max(0, draftQty - 1)))}
                          className="w-7 h-7 rounded-control hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={draft.quantity}
                          onChange={e => setDraftQuantity(svc.id, e.target.value)}
                          placeholder="0"
                          className="w-14 h-7 text-center text-sm font-semibold tabular-nums bg-transparent focus:outline-none placeholder:text-slate-300"
                        />
                        <button
                          onClick={() => setDraftQuantity(svc.id, String(draftQty + 1))}
                          className="w-7 h-7 rounded-control hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-w-[120px]">
                      <p className="label-caps mb-1">Hisob</p>
                      <p className="text-sm font-semibold text-slate-700 tabular-nums">
                        {formatPrice(unitPrice)} × {draftQty} =
                        <span className="text-[color:var(--primary)] ml-1">{formatPrice(lineTotal)} so'm</span>
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(svc)}
                      className="btn-outline"
                    >
                      <Plus size={16} /> Qo'shish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* O'NG: Savat */}
      <div className="lg:sticky lg:top-20 self-start">
        <div className="bg-white rounded-card border border-slate-200 flex flex-col max-h-[calc(100vh-7rem)]">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart size={16} className="text-[color:var(--primary)] flex-shrink-0" />
              <p className="t-h3 truncate">
                Sizning buyurtmangiz ({cart.length})
              </p>
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors flex-shrink-0"
              >
                Tozalash
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ShoppingCart size={20} className="mb-2" />
                <p className="text-xs font-semibold text-center">Savat bo'sh.<br/>Mahsulot qo'shing</p>
              </div>
            ) : (
              cart.map(line => {
                const { unitPrice, total, optionLabel } = calcLine(line);
                return (
                  <div key={line.id} className="bg-slate-50 rounded-control p-3 border border-slate-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{line.service.name}</p>
                        {optionLabel && (
                          <p className="text-xs text-slate-500 truncate">{optionLabel}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeLine(line.id)}
                        className="w-6 h-6 rounded-control hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center transition-colors flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 bg-white rounded-control border border-slate-200 p-0.5">
                        <button
                          onClick={() => updateLineQty(line.id, -1)}
                          className="w-6 h-6 rounded-control text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={line.quantity === 0 ? '' : String(line.quantity)}
                          onChange={e => setLineQty(line.id, e.target.value)}
                          placeholder="0"
                          className="w-12 h-6 text-center text-xs font-semibold tabular-nums bg-transparent focus:outline-none placeholder:text-slate-300"
                        />
                        <button
                          onClick={() => updateLineQty(line.id, 1)}
                          className="w-6 h-6 rounded-control text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 tabular-nums">{formatPrice(unitPrice)} × {line.quantity}</p>
                        <p className="text-sm font-semibold text-[color:var(--primary)] whitespace-nowrap tabular-nums">{formatPrice(total)} so'm</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Jami + yuklab olish */}
          <div className="border-t border-slate-100 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="label-caps">Jami:</span>
              <span className="text-xl font-semibold text-[color:var(--primary)] tabular-nums">
                {formatPrice(grandTotal)} <span className="text-sm">so'm</span>
              </span>
            </div>
            <div className="flex gap-2">
              <select
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value as 'png' | 'pdf')}
                disabled={exporting}
                className="select-minimal w-24 disabled:opacity-60"
              >
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
              </select>
              <button
                onClick={handleDownload}
                disabled={exporting || !cart.length}
                className="btn-primary flex-1"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Yuklab olish
              </button>
            </div>
            <p className="t-caption text-center flex items-center justify-center gap-1">
              <FileText size={12} /> Quote chiroyli ko'rinishda yuklanadi
            </p>
          </div>
        </div>
      </div>

      {/* Off-screen render — eksport uchun */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0, pointerEvents: 'none' }}>
        <QuoteView ref={quoteRef} data={quoteData} />
      </div>

      <ConfirmModal
        isOpen={tozalashSoraldi}
        title="Savatni tozalash"
        message={`Savatdagi ${cart.length} ta qator o'chiriladi.`}
        confirmText="Tozalash"
        danger
        onConfirm={() => { setCart([]); setTozalashSoraldi(false); }}
        onClose={() => setTozalashSoraldi(false)}
      />
    </div>
  );
};
