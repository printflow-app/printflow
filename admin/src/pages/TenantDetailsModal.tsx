import { useState } from 'react';
import {
  Check, X, XCircle, User, Building2, Phone, Send,
  CalendarDays, Wallet, Users, UserSquare2, Layers, ShieldCheck,
} from 'lucide-react';
import { tenantsApi } from '../api';
import { ALLOWED_MODULES, getAttPct } from '../shared/constants';

const CUSTOM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Faol',
  TRIAL: 'Trial',
  EXPIRED: 'Tugagan',
  PENDING_PAYMENT: "To'lov",
};

const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  ALLOWED_MODULES.map(m => [m.key, m.label]),
);

export default function TenantDetailsModal({ tenant, plans, onClose, onSaved, toast }: {
  tenant: any; plans: any[]; onClose: () => void; onSaved: () => void; toast: (msg: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const statusLabel = CUSTOM_STATUS_LABELS[tenant.status] || tenant.status;
  const curExpDate = tenant.status === 'TRIAL'
    ? (tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toISOString().slice(0, 10) : '')
    : (tenant.subscriptionEndsAt ? new Date(tenant.subscriptionEndsAt).toISOString().slice(0, 10) : '');

  const [newEndDate, setNewEndDate] = useState(curExpDate);
  const [newStatus, setNewStatus] = useState<string>(() => {
    if (tenant.status === 'EXPIRED' && curExpDate && new Date(curExpDate) > new Date()) {
      return 'ACTIVE';
    }
    return tenant.status;
  });
  const [newPlanId, setNewPlanId] = useState(tenant.planId || '');
  const [saving, setSaving] = useState(false);

  const addMonths = (months: number) => {
    const base = newEndDate ? new Date(newEndDate) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + months);
    setNewEndDate(base.toISOString().slice(0, 10));
    if (newStatus !== 'ACTIVE') setNewStatus('ACTIVE');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const effectiveStatus =
        newStatus === 'EXPIRED' && newEndDate && new Date(newEndDate) > new Date()
          ? 'ACTIVE'
          : newStatus;
      const updateData: any = { status: effectiveStatus, planId: newPlanId || null };
      if (effectiveStatus === 'TRIAL') {
        updateData.trialEndsAt = newEndDate ? new Date(newEndDate).toISOString() : null;
      } else {
        updateData.subscriptionEndsAt = newEndDate ? new Date(newEndDate).toISOString() : null;
      }
      await tenantsApi.update(tenant.id, updateData);
      toast('Workspace yangilandi!', 'success');
      onSaved();
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Xatolik yuz berdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusDot =
    tenant.status === 'ACTIVE' ? 'bg-emerald-500' :
    tenant.status === 'TRIAL' ? 'bg-blue-500' :
    tenant.status === 'EXPIRED' ? 'bg-rose-500' : 'bg-amber-500';

  const admins: any[] = tenant.admins || [];
  const branches: any[] = tenant.branches || [];
  const planModules: string[] = tenant.planAllowedModules || [];
  const attPct = getAttPct({ ...tenant, attendanceTodayCount: tenant.attendanceToday });

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-2xl max-h-[88vh] overflow-y-auto p-6 bg-white border border-slate-200 text-slate-900">
        {/* Header */}
        <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-100">
          <div className="min-w-0 pr-3">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight truncate">{tenant.name}</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">@{tenant.slug}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
            <button className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "To'langan", value: `${(tenant.totalPaid || 0).toLocaleString()} UZS`, icon: Wallet },
            { label: 'Xodimlar', value: tenant._count?.employees ?? '—', icon: Users },
            { label: 'Mijozlar', value: tenant._count?.customers ?? '—', icon: UserSquare2 },
            { label: 'Yaratilgan', value: new Date(tenant.createdAt).toLocaleDateString('uz-UZ'), icon: CalendarDays },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className="text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="font-bold text-xs text-slate-900 truncate">{item.value}</p>
              </div>
            );
          })}
        </div>

        {/* Activity row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Bugungi davomat</p>
            <p className="text-sm font-bold text-emerald-700 mt-1">{tenant.attendanceToday ?? 0} ta · {attPct}%</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700">Faol topshiriqlar</p>
            <p className="text-sm font-bold text-blue-700 mt-1">{tenant.activeTasks ?? 0} ta</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Tranzaksiyalar</p>
            <p className="text-sm font-bold text-amber-700 mt-1">{tenant._count?.transactions ?? 0} ta</p>
          </div>
        </div>

        {/* Admins (workspace owners) */}
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <ShieldCheck size={12} /> Workspace egasi
          </p>
          {admins.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 italic">Admin topilmadi</p>
          ) : (
            <div className="space-y-1.5">
              {admins.map(a => (
                <div key={a.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center flex-shrink-0">
                      <User size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{a.fullName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{a.login}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-shrink-0">
                    {a.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={10} /> {a.phone}
                      </span>
                    )}
                    {a.telegramId && (
                      <span className="inline-flex items-center gap-1 text-blue-600">
                        <Send size={10} /> {a.telegramId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branches */}
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Building2 size={12} /> Filiallar ({branches.length} ta)
          </p>
          {branches.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 italic">Filiallar topilmadi</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {branches.map(b => (
                <div key={b.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 truncate pr-2">{b.name}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    b.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {b.isActive ? 'Faol' : 'Nofaol'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active modules */}
        <div className="mb-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Layers size={12} /> Faol modullar ({planModules.length} ta)
          </p>
          {planModules.length === 0 ? (
            <p className="text-xs font-medium text-slate-500 italic">
              {tenant.plan ? 'Bu tarifda modul yo\'q' : 'Tarif tanlanmagan'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {planModules.map(key => (
                <span key={key} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-700">
                  {MODULE_LABEL[key] || key}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Subscription controls */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 space-y-4 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Obuna Sozlamalari</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full h-9 text-xs border border-slate-200 bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500 transition-colors">
                <option value="ACTIVE">Faol (ACTIVE)</option>
                <option value="TRIAL">Trial</option>
                <option value="EXPIRED">Muddati tugagan</option>
                <option value="PENDING_PAYMENT">To'lov kutilmoqda</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Tarif Rejasi</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)} className="w-full h-9 text-xs border border-slate-200 bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500 transition-colors">
                <option value="">— Tarifisiz —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              {newStatus === 'TRIAL' ? 'Trial tugash sanasi' : 'Obuna tugash sanasi'}
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={e => {
                setNewEndDate(e.target.value);
                if (e.target.value && new Date(e.target.value) > new Date() && newStatus !== 'ACTIVE') {
                  setNewStatus('ACTIVE');
                }
              }}
              className="w-full h-9 text-xs border border-slate-200 bg-white text-slate-900 rounded-lg px-2.5 outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tezkor uzaytirish</p>
            <div className="flex flex-wrap gap-1.5">
              {[{ label: '+1 oy', months: 1 }, { label: '+3 oy', months: 3 }, { label: '+6 oy', months: 6 }, { label: '+12 oy', months: 12 }].map(btn => (
                <button
                  key={btn.months}
                  type="button"
                  onClick={() => addMonths(btn.months)}
                  className="h-7 px-3 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-all"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all mt-2 disabled:bg-slate-300"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>

        {/* Payments History */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To'lovlar Tarixi</p>
          {tenant.payments?.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {tenant.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-800 truncate">{p.planName} · {p.duration} oy</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div>
                      <p className="font-bold text-slate-900 truncate">{(p.amount || 0).toLocaleString()} UZS</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{p.sender || '—'}</p>
                    </div>
                    <div>
                      {p.status === 'APPROVED' ? (
                        <span className="w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      ) : p.status === 'REJECTED' ? (
                        <span className="w-5 h-5 rounded-md bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                          <XCircle size={11} strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Kutilmoqda
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500 italic py-2">To'lovlar tarixi mavjud emas</p>
          )}
        </div>
      </div>
    </div>
  );
}
