import { forwardRef } from 'react';
import { Phone, MapPin, Building2 } from 'lucide-react';

// =============================================
// PriceListView — mijozga jo'natiladigan brendlangan narxlar ro'yxati.
// Toza, minimalist va odatiy professional ko'rinish (Chop etish va PNG uchun qulay)
// Branding (ranglar, logo, matnlar) admin Sozlamalar > Narx Ro'yxati'da sozlanadi.
// =============================================

export interface PriceOption {
  id: string;
  name: string;
  value: string;
  priceAdd?: number;
}

export interface PriceService {
  id: string;
  name: string;
  basePrice: number;
  unit: string;
  imageUrl?: string | null;
  options?: PriceOption[];
}

export interface PriceBranchInfo {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
}

export interface PriceListBranding {
  // Ranglar (HEX kod, mijoz tanlaydi)
  headerBg?: string;         // Yuqori panel foni
  headerText?: string;       // Yuqori paneldagi matn (sana, telefon va h.k.)
  companyNameColor?: string; // Kompaniya nomi (H1) rangi — alohida sozlanishi mumkin
  accent?: string;           // Asosiy narx rangi
  tableHeaderBg?: string;    // Jadval sarlavhasi foni
  tableHeaderText?: string;  // Jadval sarlavhasi matni
  cardBorder?: string;       // Xizmat kartochkasi chegarasi
  totalSum?: string;         // Yakuniy summa rangi (jadvaldagi)

  // Logo va matnlar
  logoBase64?: string;       // Logotip (data URL yoki HTTPS URL)
  companyName?: string;      // Kompaniya nomi override (default: tenant.name)
  headerTitle?: string;      // Default: "Narxlar ro'yxati"
  tagline?: string;          // Sarlavha ostidagi qo'shimcha matn
  phone?: string;            // Override branch.phone
  address?: string;          // Override branch.address
  footerNote?: string;       // Default: "Narxlar o'zgarishi mumkin"
}

export interface PriceListData {
  tenant: { name: string; slug?: string };
  branch: PriceBranchInfo;
  services: PriceService[];
  branding?: PriceListBranding | null;
}

interface Props {
  data: PriceListData;
  printableId?: string;
}

// Default ranglar (mavjud loyiha brandingiga mos — orange + slate)
const DEFAULT_BRANDING: Required<Pick<PriceListBranding,
  'headerBg' | 'headerText' | 'accent' | 'tableHeaderBg' | 'tableHeaderText' | 'cardBorder' | 'totalSum'
>> = {
  headerBg: '#f97316',         // orange-500
  headerText: '#ffffff',
  accent: '#ea580c',           // orange-600
  tableHeaderBg: '#1e293b',    // slate-800
  tableHeaderText: '#ffffff',
  cardBorder: '#e2e8f0',       // slate-200
  totalSum: '#ea580c',         // orange-600
};

function resolveBranding(b?: PriceListBranding | null) {
  const headerText = b?.headerText || DEFAULT_BRANDING.headerText;
  return {
    headerBg: b?.headerBg || DEFAULT_BRANDING.headerBg,
    headerText,
    companyNameColor: b?.companyNameColor || headerText, // default: headerText'ga teng
    accent: b?.accent || DEFAULT_BRANDING.accent,
    tableHeaderBg: b?.tableHeaderBg || DEFAULT_BRANDING.tableHeaderBg,
    tableHeaderText: b?.tableHeaderText || DEFAULT_BRANDING.tableHeaderText,
    cardBorder: b?.cardBorder || DEFAULT_BRANDING.cardBorder,
    totalSum: b?.totalSum || DEFAULT_BRANDING.totalSum,
    logoBase64: b?.logoBase64,
    companyName: b?.companyName,
    headerTitle: b?.headerTitle || "Narxlar ro'yxati",
    tagline: b?.tagline,
    phone: b?.phone,
    address: b?.address,
    footerNote: b?.footerNote || "Narxlar o'zgarishi mumkin",
  };
}

function formatPrice(n: number): string {
  return Number(n || 0).toLocaleString('uz-UZ');
}

function formatDate(d = new Date()): string {
  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
                  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function sortOptions(options: PriceOption[]): PriceOption[] {
  if (!options) return [];
  return [...options].sort((a, b) => {
    const numA = parseFloat(a.value);
    const numB = parseFloat(b.value);

    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) {
        return numA - numB;
      }
      return (a.value || '').localeCompare(b.value || '');
    }
    if (isNumA && !isNumB) return -1;
    if (!isNumA && isNumB) return 1;

    return (a.value || '').localeCompare(b.value || '');
  });
}

function extractQuantity(name: string, value: string): number | null {
  const n = (name || '').toLowerCase();
  const v = (value || '').toLowerCase().trim();

  if (n.includes("o'lcham") || n.includes("olcham") || n.includes("size") || n.includes("razmer") || n.includes("format")) {
    return null;
  }
  if (/\d+(\.\d+)?\s*[xX*]\s*\d+(\.\d+)?/.test(v)) {
    return null;
  }
  if (/^[a-e][0-6]$/.test(v)) {
    return null;
  }
  const match = v.match(/^(\d+(\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }
  return null;
}

/** Sodda HEX → soyalangan rang aralashmasi (gradient uchun ozgina to'qroq variant) */
function darken(hex: string, amount = 0.12): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const PriceListView = forwardRef<HTMLDivElement, Props>(
  ({ data, printableId = 'price-list-printable' }, ref) => {
    const { tenant, branch, services } = data;
    const br = resolveBranding(data.branding);
    const phone = br.phone || branch.phone;
    const address = br.address || branch.address;

    return (
      <div
        ref={ref}
        id={printableId}
        className="bg-white text-slate-900 font-sans shadow-lg"
        style={{ width: '794px', minHeight: '1100px', margin: '0 auto' /* A4 portrait @ 96dpi */ }}
      >
        {/* Header — brending */}
        <div
          className="relative px-12 pt-10 pb-8 overflow-hidden border-b"
          style={{
            background: `linear-gradient(135deg, ${br.headerBg}, ${darken(br.headerBg, 0.12)})`,
            color: br.headerText,
            borderBottomColor: darken(br.headerBg, 0.15),
          }}
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none"
               style={{ backgroundColor: br.headerText, opacity: 0.1 }} />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full pointer-events-none"
               style={{ backgroundColor: br.headerText, opacity: 0.05 }} />

          <div className="relative flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              {br.logoBase64 && (
                <img
                  src={br.logoBase64}
                  alt="logo"
                  className="w-16 h-16 rounded-lg object-contain bg-white/95 p-1 flex-shrink-0 shadow"
                  crossOrigin="anonymous"
                />
              )}
              <div className="min-w-0">
                <h1
                  className="text-3xl font-bold tracking-tight leading-tight uppercase truncate"
                  style={{ color: br.companyNameColor }}
                >
                  {br.companyName || tenant.name}
                </h1>
                <p className="text-[12px] font-bold uppercase tracking-[0.3em] mt-1"
                   style={{ color: br.headerText, opacity: 0.8 }}>
                  {br.headerTitle}
                </p>
                {br.tagline && (
                  <p className="text-sm font-medium mt-1" style={{ color: br.headerText, opacity: 0.85 }}>
                    {br.tagline}
                  </p>
                )}
                {branch.name && (
                  <p className="text-sm font-medium mt-2 flex items-center gap-1.5"
                     style={{ color: br.headerText, opacity: 0.9 }}>
                    <Building2 size={14} /> {branch.name}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-widest"
                 style={{ color: br.headerText, opacity: 0.7 }}>Sana</p>
              <p className="text-base font-bold mt-0.5">{formatDate()}</p>
              {phone && (
                <p className="text-sm font-medium mt-3 flex items-center justify-end gap-1.5"
                   style={{ color: br.headerText }}>
                  <Phone size={13} /> {phone}
                </p>
              )}
              {address && (
                <p className="text-xs font-medium mt-1 flex items-center justify-end gap-1.5 max-w-[200px]"
                   style={{ color: br.headerText, opacity: 0.8 }}>
                  <MapPin size={12} className="flex-shrink-0" />
                  <span className="truncate">{address}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="px-12 py-8">
          {services.length === 0 ? (
            <div className="text-center py-20 text-slate-300">
              <p className="text-sm font-bold uppercase tracking-widest">Hozircha xizmatlar yo'q</p>
            </div>
          ) : (
            <div className="space-y-6">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="rounded-2xl p-5 transition-colors break-inside-avoid shadow-sm bg-white flex flex-col gap-5"
                  style={{ border: `1px solid ${br.cardBorder}` }}
                >
                  <div className="flex items-start gap-5">
                    {svc.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={svc.imageUrl}
                          alt=""
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shadow-sm"
                          style={{ border: `1px solid ${br.cardBorder}` }}
                          crossOrigin="anonymous"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-4 mb-1">
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug uppercase flex-1 min-w-0 truncate">
                          {svc.name}
                        </h3>
                        <div className="text-right flex-shrink-0">
                          <span className="text-2xl font-bold tracking-tight" style={{ color: br.accent }}>
                            {formatPrice(svc.basePrice)}
                          </span>
                          <span className="text-xs font-bold text-slate-400 ml-1">so'm</span>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            / {svc.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {svc.options && svc.options.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 overflow-hidden w-full">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Opsiyalar va yakuniy narxlar:
                      </p>
                      <div className="rounded-xl overflow-hidden shadow-sm bg-white w-full"
                           style={{ border: `1px solid ${br.cardBorder}` }}>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr
                              className="text-[12px] font-bold uppercase tracking-wider"
                              style={{ backgroundColor: br.tableHeaderBg, color: br.tableHeaderText }}
                            >
                              <th className="px-4 py-3 text-left font-bold">Opsiya</th>
                              <th className="px-4 py-3 text-center font-bold">Soni / O'lchami</th>
                              <th className="px-4 py-3 text-right font-bold">
                                {svc.unit ? svc.unit.charAt(0).toUpperCase() + svc.unit.slice(1) : 'Birlik'} narxi
                              </th>
                              <th className="px-4 py-3 text-right font-bold">Summasi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-xs">
                            {sortOptions(svc.options).map((opt) => {
                              const finalPrice = svc.basePrice + (opt.priceAdd || 0);
                              const qty = extractQuantity(opt.name, opt.value);
                              const totalSum = qty !== null ? qty * finalPrice : finalPrice;

                              return (
                                <tr
                                  key={opt.id}
                                  className="odd:bg-white even:bg-slate-50 transition-colors"
                                >
                                  <td className="px-4 py-3.5 font-bold text-slate-800 uppercase tracking-wider text-[12px]">
                                    {opt.name}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-bold text-slate-900 text-xs">
                                    {opt.value}
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 text-xs whitespace-nowrap">
                                    {formatPrice(finalPrice)} <span className="text-[11px] font-normal text-slate-400">so'm</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold text-xs whitespace-nowrap"
                                      style={{ color: br.totalSum }}>
                                    {formatPrice(totalSum)} <span className="text-[11px] font-normal" style={{ color: br.totalSum, opacity: 0.7 }}>so'm</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-12 py-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-white">
          <span>{br.companyName || tenant.name} &copy; {new Date().getFullYear()}</span>
          <span>{br.footerNote}</span>
        </div>
      </div>
    );
  },
);

PriceListView.displayName = 'PriceListView';
