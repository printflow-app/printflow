import { forwardRef } from 'react';
import { Phone, MapPin, Building2 } from 'lucide-react';
import { PriceListBranding, PriceBranchInfo } from './PriceListView';

// =============================================
// QuoteView — mijoz tanlagan mahsulotlar bo'yicha PNG/PDF eksport uchun
// chiroyli "Buyurtma taklifi" layout. A4 portrait, branding bilan.
// =============================================

export interface QuoteLine {
  id: string;
  serviceName: string;
  optionLabel?: string;  // "Sotni: 50" yoki "O'lcham: A4" — agar opsiya tanlangan bo'lsa
  quantity: number;
  unit: string;
  unitPrice: number;     // basePrice + option.priceAdd
  total: number;         // unitPrice * quantity
}

export interface QuoteData {
  tenant: { name: string };
  branch: PriceBranchInfo;
  lines: QuoteLine[];
  branding?: PriceListBranding | null;
}

interface Props {
  data: QuoteData;
  printableId?: string;
}

const DEFAULT_BRANDING = {
  headerBg: '#f97316',
  headerText: '#ffffff',
  accent: '#ea580c',
  tableHeaderBg: '#1e293b',
  tableHeaderText: '#ffffff',
  cardBorder: '#e2e8f0',
  totalSum: '#ea580c',
};

function resolveBranding(b?: PriceListBranding | null) {
  const headerText = b?.headerText || DEFAULT_BRANDING.headerText;
  return {
    headerBg: b?.headerBg || DEFAULT_BRANDING.headerBg,
    headerText,
    companyNameColor: b?.companyNameColor || headerText,
    accent: b?.accent || DEFAULT_BRANDING.accent,
    tableHeaderBg: b?.tableHeaderBg || DEFAULT_BRANDING.tableHeaderBg,
    tableHeaderText: b?.tableHeaderText || DEFAULT_BRANDING.tableHeaderText,
    cardBorder: b?.cardBorder || DEFAULT_BRANDING.cardBorder,
    totalSum: b?.totalSum || DEFAULT_BRANDING.totalSum,
    logoBase64: b?.logoBase64,
    companyName: b?.companyName,
    headerTitle: b?.headerTitle || 'Buyurtma taklifi',
    tagline: b?.tagline,
    phone: b?.phone,
    address: b?.address,
    footerNote: b?.footerNote || "Narxlar o'zgarishi mumkin. Taklifning amal qilish muddati cheklangan.",
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

function darken(hex: string, amount = 0.12): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export const QuoteView = forwardRef<HTMLDivElement, Props>(
  ({ data, printableId = 'quote-printable' }, ref) => {
    const { tenant, branch, lines } = data;
    const br = resolveBranding(data.branding);
    const phone = br.phone || branch.phone;
    const address = br.address || branch.address;

    const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);

    return (
      <div
        ref={ref}
        id={printableId}
        className="bg-white text-slate-900 font-sans shadow-lg"
        style={{ width: '794px', minHeight: '1100px', margin: '0 auto' }}
      >
        {/* Header */}
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
                  className="text-3xl font-semibold tracking-tight leading-tight truncate"
                  style={{ color: br.companyNameColor }}
                >
                  {br.companyName || tenant.name}
                </h1>
                <p className="label-caps mt-1"
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
                    <Building2 size={16} /> {branch.name}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="label-caps"
                 style={{ color: br.headerText, opacity: 0.7 }}>Sana</p>
              <p className="text-base font-semibold mt-0.5">{formatDate()}</p>
              {phone && (
                <p className="text-sm font-medium mt-3 flex items-center justify-end gap-1.5"
                   style={{ color: br.headerText }}>
                  <Phone size={16} /> {phone}
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

        {/* Lines table */}
        <div className="px-12 py-8">
          {lines.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <p className="text-sm font-semibold">Hech qaysi pozitsiya tanlanmagan</p>
            </div>
          ) : (
            <div className="rounded-card border overflow-x-auto" style={{ borderColor: br.cardBorder }}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: br.tableHeaderBg, color: br.tableHeaderText }}
                  >
                    <th className="px-4 py-3 text-center font-semibold w-10">#</th>
                    <th className="px-4 py-3 text-left font-semibold">Mahsulot</th>
                    <th className="px-4 py-3 text-center font-semibold">Soni</th>
                    <th className="px-4 py-3 text-right font-semibold">Dona narxi</th>
                    <th className="px-4 py-3 text-right font-semibold">Summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {lines.map((line, idx) => (
                    <tr key={line.id} className="odd:bg-white even:bg-slate-50">
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-500 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900 text-sm">{line.serviceName}</p>
                        {line.optionLabel && (
                          <p className="text-xs text-slate-500 mt-0.5">{line.optionLabel}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-900 text-sm tabular-nums">
                        {formatPrice(line.quantity)} <span className="text-xs font-normal text-slate-500">{line.unit}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900 text-xs whitespace-nowrap tabular-nums">
                        {formatPrice(line.unitPrice)} <span className="text-xs font-normal text-slate-500">so'm</span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-sm whitespace-nowrap tabular-nums"
                          style={{ color: br.totalSum }}>
                        {formatPrice(line.total)} <span className="text-xs font-normal" style={{ color: br.totalSum, opacity: 0.7 }}>so'm</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: br.accent + '12', borderTop: `2px solid ${br.accent}` }}>
                    <td colSpan={4} className="px-4 py-4 text-right text-sm font-semibold" style={{ color: br.accent }}>
                      Jami:
                    </td>
                    <td className="px-4 py-4 text-right text-base font-semibold whitespace-nowrap tabular-nums" style={{ color: br.accent }}>
                      {formatPrice(grandTotal)} <span className="text-xs font-normal">so'm</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-12 py-6 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500 bg-white">
          <span>{br.companyName || tenant.name} &copy; {new Date().getFullYear()}</span>
          <span className="text-right max-w-[60%]">{br.footerNote}</span>
        </div>
      </div>
    );
  },
);

QuoteView.displayName = 'QuoteView';
