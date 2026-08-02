import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, CheckCircle2, AlertCircle } from 'lucide-react';
import { financeApi } from '../api';

// =============================================
// ZARARSIZLIK NUQTASI (break-even)
//
// "Shu oy nolga chiqish uchun yana qancha ish kerak?" — bitta savolga
// bitta javob beradigan karta. Progress bar to'lganda kompaniya shu oygi
// xarajatini qoplagan bo'ladi; undan keyingisi — sof foyda.
//
// Barcha raqamlar backend'da TARIXDAN hisoblanadi (taxmin yo'q) — bu yer
// faqat ko'rsatadi.
// =============================================

const fmt = (n: any) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })
    .format(Number(n) || 0)
    .replace(/,/g, ' ');

const BreakEvenCard: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['break-even'],
    queryFn: async () => (await financeApi.getBreakEven()).data,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-slate-200 p-5 h-40 animate-pulse" />;
  }
  if (!data) return null;

  const done = !!data.nolga_chiqdi;
  const pct = Math.max(0, Math.min(100, Number(data.foiz) || 0));

  // Tarix yetarli bo'lmasa ham ko'rsatamiz, lekin ochiq aytamiz — jim
  // turgan noto'g'ri raqamdan ko'ra ogohlantirilgan taxmin afzal.
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${done ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
              <Target size={16} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-800">Zararsizlik nuqtasi</p>
              <p className="text-[10px] font-semibold text-slate-400">{data.oy} · shu oy xarajatini qoplash</p>
            </div>
          </div>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-lg">
            <CheckCircle2 size={11} /> Nolga chiqildi
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
            {pct}%
          </span>
        )}
      </div>

      {/* PROGRESS BAR — to'lgani = xarajat qoplangani */}
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-emerald-500' : 'bg-orange-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] font-bold">
        <span className="text-slate-500">{fmt(data.bugungi_tushum)} so'm tushdi</span>
        <span className="text-slate-400">{fmt(data.kerakli_qoplama)} so'm kerak</span>
      </div>

      {!done && (
        <p className="text-xs font-bold text-slate-700 mt-3">
          Nolga chiqishga <span className="text-orange-600">{fmt(data.qolgan_summa)} so'm</span> qoldi
        </p>
      )}

      {/* Qolgan summa nechta ishga teng — raqamdan ko'ra tushunarli */}
      {!done && data.xizmatlar?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bu nimaga teng</p>
          {data.xizmatlar.slice(0, 3).map((x: any) => (
            <div key={x.nom} className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold truncate pr-2">{x.nom}</span>
              <span className="font-bold text-slate-700 shrink-0">
                yana {x.yana_kerak} ta
                <span className="text-[10px] font-semibold text-slate-400 ml-1">
                  (~{fmt(x.ortacha_summa)})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Xarajat tarkibi — rahbar raqam qayerdan kelganini ko'rishi kerak */}
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Doimiy</p>
          <p className="text-xs font-bold text-slate-700">{fmt(data.doimiy_xarajat)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Vaqti-vaqti bilan</p>
          <p className="text-xs font-bold text-slate-700">{fmt(data.vaqtinchalik_ulush)}</p>
        </div>
      </div>

      {!data.malumot_yetarli && (
        <p className="mt-3 text-[10px] font-semibold text-amber-600 flex items-start gap-1.5 leading-relaxed">
          <AlertCircle size={11} className="mt-0.5 shrink-0" /> {data.izoh}
        </p>
      )}
    </div>
  );
};

export default BreakEvenCard;
