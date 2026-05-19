import { forwardRef } from 'react';
import { Phone, MapPin, Building2 } from 'lucide-react';

// =============================================
// PriceListView — mijozga jo'natiladigan brendlangan narxlar ro'yxati.
// Toza, minimalist va odatiy professional ko'rinish (Chop etish va PNG uchun qulay)
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

export interface PriceListData {
  tenant: { name: string; slug?: string };
  branch: PriceBranchInfo;
  services: PriceService[];
}

interface Props {
  data: PriceListData;
  printableId?: string;
}

function formatPrice(n: number): string {
  return Number(n || 0).toLocaleString('uz-UZ');
}

function formatDate(d = new Date()): string {
  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
                  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function extractQuantity(name: string, value: string): number | null {
  const n = (name || '').toLowerCase();
  const v = (value || '').toLowerCase().trim();

  // 1. Agar opsiya nomi o'lchamga tegishli bo'lsa (o'lcham, razmer, format, size)
  if (n.includes("o'lcham") || n.includes("olcham") || n.includes("size") || n.includes("razmer") || n.includes("format")) {
    return null;
  }

  // 2. Agar qiymat o'zida o'lcham naqshlari bo'lsa (masalan: 10x15, 20*30, a4, a3, 3x4)
  if (/\d+(\.\d+)?\s*[xX*]\s*\d+(\.\d+)?/.test(v)) {
    return null;
  }
  if (/^[a-e][0-6]$/.test(v)) { // A3, A4, B5, etc.
    return null;
  }

  // 3. Matn ichidan sonni ajratib olish (masalan "500", "500 dona", "1000 ta", "21")
  const match = v.match(/^(\d+(\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[1]);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }

  return null;
}

export const PriceListView = forwardRef<HTMLDivElement, Props>(
  ({ data, printableId = 'price-list-printable' }, ref) => {
    const { tenant, branch, services } = data;

    return (
      <div
        ref={ref}
        id={printableId}
        className="bg-white text-slate-900 font-sans shadow-lg"
        style={{ width: '794px', minHeight: '1100px', margin: '0 auto' /* A4 portrait @ 96dpi */ }}
      >
        {/* Header — brending */}
        <div className="relative px-12 pt-10 pb-8 bg-gradient-to-br from-orange-500 to-orange-600 text-white overflow-hidden border-b border-orange-600">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />

          <div className="relative flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold tracking-tight leading-tight uppercase truncate">
                  {tenant.name}
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/80 mt-1">
                  Narxlar ro'yxati
                </p>
                {branch.name && (
                  <p className="text-sm font-medium text-white/90 mt-2 flex items-center gap-1.5">
                    <Building2 size={14} /> {branch.name}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Sana</p>
              <p className="text-base font-bold mt-0.5">{formatDate()}</p>
              {branch.phone && (
               <p className="text-sm font-medium text-white mt-3 flex items-center justify-end gap-1.5">
                 <Phone size={13} /> {branch.phone}
               </p>
             )}
             {branch.address && (
               <p className="text-xs font-medium text-white/80 mt-1 flex items-center justify-end gap-1.5 max-w-[200px]">
                 <MapPin size={12} className="flex-shrink-0" />
                 <span className="truncate">{branch.address}</span>
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
                  className="border border-slate-200 rounded-2xl p-5 hover:border-orange-200 transition-colors break-inside-avoid shadow-sm bg-white flex flex-col gap-5"
                >
                  {/* Yuqori qism: Rasm (agar bo'lsa) + Xizmat nomi va Boshlang'ich narxi */}
                  <div className="flex items-start gap-5">
                    {svc.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={svc.imageUrl}
                          alt=""
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border border-slate-200 shadow-sm"
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
                          <span className="text-2xl font-bold text-orange-600 tracking-tight">
                            {formatPrice(svc.basePrice)}
                          </span>
                          <span className="text-xs font-bold text-slate-400 ml-1">so'm</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            / {svc.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pastki qism: Opsiyalar jadvali (To'liq enida - w-full) */}
                  {svc.options && svc.options.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 overflow-hidden w-full">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Opsiyalar va yakuniy narxlar:
                      </p>
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white w-full">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                              <th className="px-4 py-3 text-left font-bold">Opsiya</th>
                              <th className="px-4 py-3 text-center font-bold">Soni / O'lchami</th>
                              <th className="px-4 py-3 text-right font-bold">
                                {svc.unit ? svc.unit.charAt(0).toUpperCase() + svc.unit.slice(1) : 'Birlik'} narxi
                              </th>
                              <th className="px-4 py-3 text-right font-bold">Summasi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-xs">
                            {svc.options.map((opt) => {
                              const finalPrice = svc.basePrice + (opt.priceAdd || 0);
                              const qty = extractQuantity(opt.name, opt.value);
                              const totalSum = qty !== null ? qty * finalPrice : finalPrice;

                              return (
                                <tr
                                  key={opt.id}
                                  className="odd:bg-white even:bg-slate-50 hover:bg-orange-50/50 transition-colors"
                                >
                                  <td className="px-4 py-3.5 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                                    {opt.name}
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-bold text-slate-900 text-xs">
                                    {opt.value}
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold text-slate-900 text-xs whitespace-nowrap">
                                    {formatPrice(finalPrice)} <span className="text-[10px] font-normal text-slate-400">so'm</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-bold text-orange-600 text-xs whitespace-nowrap">
                                    {formatPrice(totalSum)} <span className="text-[10px] font-normal text-orange-400">so'm</span>
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
        <div className="px-12 py-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white">
          <span>{tenant.name} &copy; {new Date().getFullYear()}</span>
          <span>Narxlar o'zgarishi mumkin</span>
        </div>
      </div>
    );
  },
);

PriceListView.displayName = 'PriceListView';
