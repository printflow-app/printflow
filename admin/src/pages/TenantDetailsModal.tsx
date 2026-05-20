import { useState } from 'react';
import { Check, X, XCircle } from 'lucide-react';
import { tenantsApi } from '../api';

const CUSTOM_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Faol',
  TRIAL: 'Trial',
  EXPIRED: 'Tugagan',
  PENDING_PAYMENT: "To'lov",
};

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

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg max-h-[85vh] overflow-y-auto p-6 flex flex-col justify-between bg-slate-900 border border-slate-800 text-white">
        {/* Header */}
        <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-850">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">{tenant.name}</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">@{tenant.slug}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
            <button className="modal-close p-1" onClick={onClose}><X size={18} className="text-slate-400" /></button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "To'langan", value: `${(tenant.totalPaid || 0).toLocaleString()} UZS` },
            { label: 'Xodimlar', value: tenant._count?.employees ?? '—' },
            { label: 'Mijozlar', value: tenant._count?.customers ?? '—' },
            { label: 'Yaratilgan', value: new Date(tenant.createdAt).toLocaleDateString('uz-UZ') },
          ].map((item, i) => (
            <div key={i} className="bg-slate-950 border border-slate-850 rounded-lg p-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">{item.label}</span>
              <p className="font-bold text-xs text-white mt-1 truncate">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Subscription controls */}
        <div className="border border-slate-800 rounded-xl p-4 mb-5 space-y-4 text-xs bg-slate-950/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Obuna Sozlamalari</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="text-slate-400">Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full h-8 text-xs border border-slate-850 bg-slate-950 text-white rounded-lg px-2 outline-none focus:border-orange-500">
                <option value="ACTIVE">Faol (ACTIVE)</option>
                <option value="TRIAL">Trial</option>
                <option value="EXPIRED">Muddati tugagan</option>
                <option value="PENDING_PAYMENT">To'lov kutilmoqda</option>
              </select>
            </div>

            <div className="form-group">
              <label className="text-slate-400">Tarif Rejasi</label>
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)} className="w-full h-8 text-xs border border-slate-850 bg-slate-950 text-white rounded-lg px-2 outline-none focus:border-orange-500">
                <option value="">— Tarifisiz —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="text-slate-400">{newStatus === 'TRIAL' ? 'Trial tugash sanasi' : 'Obuna tugash sanasi'}</label>
            <input 
              type="date" 
              value={newEndDate} 
              onChange={e => {
                setNewEndDate(e.target.value);
                if (e.target.value && new Date(e.target.value) > new Date() && newStatus !== 'ACTIVE') {
                  setNewStatus('ACTIVE');
                }
              }} 
              className="w-full h-8 text-xs border border-slate-850 bg-slate-950 text-white rounded-lg px-2.5 outline-none focus:border-orange-500"
            />
          </div>

          {/* Quick Extend Buttons */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tezkor uzaytirish</p>
            <div className="flex flex-wrap gap-1.5">
              {[{ label: '+1 oy', months: 1 }, { label: '+3 oy', months: 3 }, { label: '+6 oy', months: 6 }, { label: '+12 oy', months: 12 }].map(btn => (
                <button 
                  key={btn.months} 
                  type="button"
                  onClick={() => addMonths(btn.months)}
                  className="h-7 px-3 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg transition-all"
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
            className="w-full h-9 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all mt-2"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>

        {/* Payments History */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To'lovlar Tarixi</p>
          {tenant.payments?.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {tenant.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-200 truncate">{p.planName} · {p.duration} oy</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{new Date(p.createdAt).toLocaleDateString('uz-UZ')}</p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-right">
                    <div>
                      <p className="font-bold text-white truncate">{(p.amount || 0).toLocaleString()} UZS</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">{p.sender || '—'}</p>
                    </div>
                    <div>
                      {p.status === 'APPROVED' ? (
                        <span className="w-5 h-5 rounded-md bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-center text-emerald-400">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      ) : p.status === 'REJECTED' ? (
                        <span className="w-5 h-5 rounded-md bg-rose-950/20 border border-rose-900/30 flex items-center justify-center text-rose-400">
                          <XCircle size={11} strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
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
