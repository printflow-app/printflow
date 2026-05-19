import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Printer, Building2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { PriceListView, PriceListData } from '../components/PriceListView';

// =============================================
// Public price list — /price/:slug
// Auth talab qilmaydi. Backend /api/services/public/:slug ga so'rov yuboradi.
// Bir tenant'da bir nechta filial bo'lsa, ?branch=<id> bilan tanlash mumkin.
// Mijoz uchun foydalanish: link nusxalash → Telegram / WhatsApp / SMS.
// =============================================

const PUBLIC_API = (() => {
  const raw = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
  return raw ? (raw.endsWith('/api') ? raw : raw + '/api') : '/api';
})();

export default function PublicPriceList() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const branchId = searchParams.get('branch') || undefined;

  const [data, setData] = useState<PriceListData | null>(null);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    const url = `${PUBLIC_API}/services/public/${encodeURIComponent(slug)}` +
                (branchId ? `?branchId=${encodeURIComponent(branchId)}` : '');
    axios.get(url)
      .then(r => {
        setData({
          tenant: r.data.tenant,
          branch: r.data.branch,
          services: r.data.services || [],
        });
        setBranches(r.data.branches || []);
      })
      .catch(err => {
        const msg = err?.response?.data?.message;
        setError(typeof msg === 'string' ? msg : 'Narxlar topilmadi');
      })
      .finally(() => setLoading(false));
  }, [slug, branchId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={32} className="text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <AlertCircle size={40} className="text-rose-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-800 uppercase tracking-tight mb-1">
            Topilmadi
          </h1>
          <p className="text-sm text-slate-500">{error || 'Bu workspace mavjud emas yoki faol emas.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top bar — faqat ekranda, print'da yashirin */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Narxlar</p>
            <p className="text-sm font-bold text-slate-800 truncate">{data.tenant.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {branches.length > 1 && (
              <div className="relative">
                <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={data.branch.id}
                  onChange={e => {
                    const next = new URLSearchParams(searchParams);
                    next.set('branch', e.target.value);
                    setSearchParams(next);
                  }}
                  className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-400"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => window.print()}
              className="h-9 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Price list — markazda, A4 enida */}
      <div className="py-4 sm:py-8 px-2 sm:px-6 flex justify-center">
        <div className="shadow-xl shadow-slate-300/30 max-w-full overflow-x-auto">
          <PriceListView data={data} />
        </div>
      </div>
    </div>
  );
}
