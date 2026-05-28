import { useState } from 'react';
import { Building2, Plus, X, AlertTriangle, Calendar, Trash2, Search } from 'lucide-react';
import { tenantsApi } from '../api';
import { useUI } from '../ui';
import { useTenants, usePlans, useInvalidate } from '../hooks/queries';
import { getAttPct, getActiveModules } from '../shared/constants';
import TenantDetailsModal from './TenantDetailsModal';

const CUSTOM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Faol',
  TRIAL: 'Trial',
  EXPIRED: 'Tugagan',
  PENDING_PAYMENT: "To'lov",
};

export default function Tenants() {
  const { toast, confirm } = useUI();
  const { data: tenants = [] } = useTenants();
  const { data: plans = [] } = usePlans();
  const invalidate = useInvalidate();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const load = () => invalidate.tenants();
  const generateRandomPassword = () => Math.random().toString(36).slice(-8);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pwd = generateRandomPassword();
      await tenantsApi.create({ name, slug, planId: selectedPlanId || undefined, adminEmail: 'admin', adminPassword: pwd });
      setGeneratedCreds({ slug, login: 'admin', pass: pwd }); setName(''); load();
    } catch (err: any) { toast(err.response?.data?.message || 'Xatolik', 'error'); }
    finally { setLoading(false); }
  };

  const openDetails = async (id: string) => {
    try { const res = await tenantsApi.findOne(id); setSelectedTenant(res.data); }
    catch (err) { console.error(err); }
  };

  const toggleStatus = async (id: string, cur: boolean) => {
    const ok = await confirm({ title: 'Holatini o\'zgartirish', message: cur ? 'Workspace bloklansinmi?' : 'Workspace faollashtirilsinmi?', danger: cur });
    if (!ok) return;
    try { await tenantsApi.update(id, { isActive: !cur }); toast('Holat yangilandi', 'success'); load(); }
    catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [
    { key: 'ALL', label: 'Barchasi' },
    { key: 'ACTIVE', label: 'Faol' },
    { key: 'TRIAL', label: 'Trial' },
    { key: 'EXPIRED', label: 'Tugagan' },
    { key: 'PENDING_PAYMENT', label: "To'lov" },
  ];

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Workspacelar</h2>
          <p className="text-xs text-slate-500">
            {tenants.length} ta workspace · {tenants.filter(t => t.status === 'ACTIVE').length} faol
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              placeholder="Workspace nomi yoki slug..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder-slate-400 w-52 focus:border-orange-500 transition-all outline-none shadow-sm"
            />
          </div>
          <button
            className="h-9 px-3 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-orange-500/20"
            onClick={() => setShowModal(true)}
          >
            <Plus size={14} /> Yangi Workspace
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {statuses.map(s => {
          const isActive = statusFilter === s.key;
          const count = s.key === 'ALL' ? tenants.length : tenants.filter(t => t.status === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`h-8 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>{s.label}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                isActive ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid of Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(t => {
          const label = CUSTOM_STATUS_LABELS[t.status] || t.status;
          const attPct = getAttPct(t);
          const modules = getActiveModules(t);
          const expDate = t.status === 'TRIAL' ? t.trialEndsAt : t.subscriptionEndsAt;
          const isExpiringSoon = expDate && (new Date(expDate).getTime() - Date.now()) < 7 * 24 * 3600 * 1000 && new Date(expDate) > new Date();

          const dotColor =
            t.status === 'ACTIVE' ? 'bg-emerald-500' :
            t.status === 'TRIAL' ? 'bg-blue-500' :
            t.status === 'EXPIRED' ? 'bg-rose-500' : 'bg-amber-500';

          return (
            <div
              key={t.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Header */}
                <div className="p-4 flex justify-between items-start">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      @{t.slug} · <span className="text-slate-700 font-semibold">{t.plan?.displayName || 'Tarifisiz'}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 flex-shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {label}
                  </span>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-4 border-t border-b border-slate-100 bg-slate-50">
                  {[
                    { label: 'Xodim', value: t._count?.employees ?? 0 },
                    { label: 'Buyurtma', value: t.activeTasksCount ?? t._count?.tasks ?? 0 },
                    { label: 'Davomat', value: `${attPct}%` },
                    { label: 'Modullar', value: `${modules}/4` },
                  ].map((m, idx) => (
                    <div key={idx} className={`text-center py-2.5 ${idx < 3 ? 'border-r border-slate-100' : ''}`}>
                      <p className="text-xs font-bold text-slate-800 leading-none">{m.value}</p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase mt-1.5">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                {(t._count?.employees || 0) > 0 && (
                  <div className="px-4 pt-3.5">
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          attPct >= 80 ? 'bg-emerald-500' : attPct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${attPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="p-4 pt-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  {expDate ? (
                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${isExpiringSoon ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                      {isExpiringSoon ? <AlertTriangle size={11} /> : <Calendar size={11} />}
                      <span className="truncate">{t.status === 'TRIAL' ? 'Trial: ' : ''}{new Date(expDate).toLocaleDateString('uz-UZ')}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                      <Calendar size={11} />
                      <span className="truncate">{new Date(t.createdAt).toLocaleDateString('uz-UZ')}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => openDetails(t.id)}
                    className="h-7 px-2.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-all"
                  >
                    Tafsilot
                  </button>
                  <button
                    onClick={() => toggleStatus(t.id, t.isActive)}
                    className={`h-7 px-2.5 text-[10px] font-bold border rounded-lg transition-all ${
                      t.isActive
                        ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 text-rose-600'
                        : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {t.isActive ? 'Bloklash' : 'Faollashtirish'}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({ title: 'Workspace o\'chirish', message: `"${t.name}" workspace butunlay o'chirilsinmi?`, confirmText: 'Ha, o\'chirilsin', danger: true });
                      if (!ok) return;
                      try { await tenantsApi.delete(t.id); toast('Workspace o\'chirildi', 'success'); load(); }
                      catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
                    }}
                    className="h-7 w-7 flex items-center justify-center bg-slate-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 border border-slate-200 rounded-lg transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-bold text-slate-500">
            {search ? 'Natija topilmadi' : 'Workspacelar mavjud emas'}
          </p>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showModal && !generatedCreds && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm bg-white border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Yangi Workspace</h2>
              <button className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Workspace Nomi</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Masalan: Ideal Print"
                  autoFocus
                  className="w-full h-9 text-xs border border-slate-200 bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Tarif Rejasi (ixtiyoriy)</label>
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="w-full h-9 border border-slate-200 bg-white rounded-lg px-2 text-xs text-slate-700 outline-none focus:border-orange-500"
                >
                  <option value="">Tanlanmagan (7 kunlik trial)</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                </select>
              </div>
              <button
                type="submit"
                className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all mt-2 disabled:bg-slate-300"
                disabled={loading}
              >
                {loading ? 'Yaratilmoqda...' : 'Workspace Yaratish'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Generated Credentials Modal */}
      {generatedCreds && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm bg-white border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Workspace Yaratildi!</h2>
              <button className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" onClick={() => setGeneratedCreds(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <p><span className="text-slate-500">Workspace URL:</span> <span className="text-slate-900 select-all font-semibold">/t/{generatedCreds.slug}</span></p>
                <p><span className="text-slate-500">Login:</span> <span className="text-slate-900 select-all font-semibold">{generatedCreds.login}</span></p>
                <p><span className="text-slate-500">Parol:</span> <span className="text-slate-900 select-all font-semibold">{generatedCreds.pass}</span></p>
              </div>

              <button
                className="w-full h-9 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all mt-2"
                onClick={() => setGeneratedCreds(null)}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTenant && (
        <TenantDetailsModal
          tenant={selectedTenant}
          plans={plans}
          onClose={() => setSelectedTenant(null)}
          onSaved={() => { load(); openDetails(selectedTenant.id); }}
          toast={toast}
        />
      )}
    </div>
  );
}
