import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Printer, Building2, AlertCircle, Search, X } from 'lucide-react';
import axios from 'axios';
import { PriceListView, PriceListData } from '../components/PriceListView';
import { EmptyState } from '../components/ui';

// =============================================
// Public price list — /price/:slug
// Mijozga ko'rinadigan narxlar varaqasi. Buyurtma takliflari sotuvchi admin
// modalidan (Xizmatlar Katalogi > Price list > Buyurtma taklifi tab) tuziladi.
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
  const [query, setQuery] = useState('');

  // Qidiruv — xizmat nomi yoki uning opsiyalari (nom/qiymat) bo'yicha filtrlaydi.
  // Bosma artefakt (PriceListView) faqat filtrlangan xizmatlarni ko'rsatadi.
  const filteredData = useMemo<PriceListData | null>(() => {
    if (!data) return null;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    const services = data.services.filter((svc) => {
      if ((svc.name || '').toLowerCase().includes(q)) return true;
      return (svc.options || []).some(
        (o) =>
          (o.name || '').toLowerCase().includes(q) ||
          (o.value || '').toLowerCase().includes(q),
      );
    });
    return { ...data, services };
  }, [data, query]);

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
          branding: r.data.branding || null,
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
        <Loader2 size={20} className="text-[color:var(--primary)] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-card p-8">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto mb-3">
            <AlertCircle size={20} />
          </div>
          <h1 className="page-title mb-1">
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
      <div className="bg-white border-b border-slate-200 sticky top-0 z-sticky print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-shrink-0">
            <p className="label-caps">Narxlar</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{data.tenant.name}</p>
          </div>

          {/* Qidiruv — xizmat yoki opsiya nomi bo'yicha */}
          <div className="relative flex-1 max-w-xs min-w-[140px]">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Xizmat qidirish..."
              className="input-minimal pl-9 pr-8"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Tozalash"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {branches.length > 1 && (
              <div className="relative">
                <Building2 size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={data.branch.id}
                  onChange={e => {
                    const next = new URLSearchParams(searchParams);
                    next.set('branch', e.target.value);
                    setSearchParams(next);
                  }}
                  className="select-minimal w-auto pl-9"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => window.print()}
              className="btn-primary"
            >
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Qidiruv natijasi bo'sh bo'lsa — aniq xabar (print'da yashirin) */}
      {query && filteredData && filteredData.services.length === 0 ? (
        <div className="max-w-md mx-auto py-12 px-6 print:hidden">
          <EmptyState
            icon={Search}
            title={`"${query}" bo'yicha xizmat topilmadi`}
            action={{ label: 'Qidiruvni tozalash', onClick: () => setQuery('') }}
          />
        </div>
      ) : (
        /* Price list — markazda, A4 enida */
        <div className="py-4 sm:py-8 px-2 sm:px-6 flex justify-center">
          <div className="shadow-lg max-w-full overflow-x-auto">
            <PriceListView data={filteredData || data} />
          </div>
        </div>
      )}
    </div>
  );
}
