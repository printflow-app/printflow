import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, X, Building2, Package, UserPlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { branchesApi, servicesApi, employeesApi, rolesApi } from '../api';
import { toast } from 'react-toastify';

// =============================================
// Onboarding Wizard — 3 qadam ekrani.
// Yangi tenant register qilganda ko'rsatiladi.
// LocalStorage'da `pf_onboarded_<tenantId>` flag bilan tugatilganini eslab qoladi.
// =============================================

export const ONBOARDING_KEY = (tenantId: string) => `pf_onboarded_${tenantId}`;

export function isOnboardingComplete(tenantId: string | undefined): boolean {
  if (!tenantId) return true; // no tenant, no wizard
  return localStorage.getItem(ONBOARDING_KEY(tenantId)) === '1';
}

export function markOnboardingComplete(tenantId: string) {
  localStorage.setItem(ONBOARDING_KEY(tenantId), '1');
}

interface Props {
  tenantId: string;
  branchId: string | undefined; // active branch (likely "Bosh Ofis (Asosiy)")
  onComplete: () => void;
}

export function OnboardingWizard({ tenantId, branchId, onComplete }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Branch
  const [branchName, setBranchName] = useState('Bosh Ofis (Asosiy)');

  // Step 2: Service
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceUnit, setServiceUnit] = useState('dona');

  // Step 3: Employee (optional)
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');

  const skipAll = () => {
    markOnboardingComplete(tenantId);
    onComplete();
  };

  const handleStep1 = async () => {
    if (!branchName.trim()) { toast.error('Filial nomi kiritilishi shart'); return; }
    setSubmitting(true);
    try {
      // If branch already exists with this name, the API will 4xx — that's fine for the wizard,
      // because the register flow already created "Bosh Ofis (Asosiy)". We treat this as "kept as is".
      if (branchName.trim() !== 'Bosh Ofis (Asosiy)') {
        await branchesApi.create({ name: branchName.trim() });
        qc.invalidateQueries({ queryKey: ['branches'] });
      }
      setStep(2);
    } catch (err: any) {
      // Likely duplicate name — proceed anyway
      console.warn('Branch create skipped:', err?.response?.data?.message);
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep2 = async () => {
    if (!serviceName.trim() || !servicePrice) {
      // Allow skipping service
      setStep(3);
      return;
    }
    if (!branchId) { toast.error('Aktiv filial yo\'q'); return; }
    setSubmitting(true);
    try {
      await servicesApi.create({
        name: serviceName.trim(),
        basePrice: Number(servicePrice),
        unit: serviceUnit,
        branchId,
      });
      qc.invalidateQueries({ queryKey: ['services'] });
      toast.success('Birinchi xizmat qo\'shildi!');
      setStep(3);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Xizmat qo\'shilmadi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep3 = async () => {
    if (!empName.trim()) {
      // Allow skipping employee
      finish();
      return;
    }
    setSubmitting(true);
    try {
      // Need a role to create employee. Fetch first available role (Admin role created with tenant).
      const rolesRes = await rolesApi.findAll(branchId);
      const roles = rolesRes.data || [];
      // Pick non-admin role if available, else any role
      const targetRole = roles.find((r: any) => r.name?.toLowerCase() !== 'admin') || roles[0];
      if (!targetRole) {
        toast.error('Rol topilmadi. Avval rol yarating.');
        return;
      }
      await employeesApi.create({
        fullName: empName.trim(),
        phone: empPhone.trim() || undefined,
        roleId: targetRole.id,
        branchId,
        baseSalary: 0,
      });
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Birinchi xodim qo\'shildi!');
      finish();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Xodim qo\'shilmadi');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    markOnboardingComplete(tenantId);
    onComplete();
  };

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map(n => (
        <React.Fragment key={n}>
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= n ? 'bg-orange-500' : 'bg-slate-200'}`} />
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative">
          <button
            onClick={skipAll}
            className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            title="O'tkazib yuborish"
          >
            <X size={18} />
          </button>
          <div className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-1">
            Qadam {step} / 3
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            PrintFlow'ga <span className="text-orange-400">xush kelibsiz</span>
          </h2>
          <p className="text-sm text-slate-300 mt-1">3 qadamda biznes uchun tayyorlanamiz</p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <StepIndicator />

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Filialingiz nomi</h3>
                  <p className="text-xs text-slate-500">Asosiy filial avtomatik yaratildi. Nomini o'zgartirishingiz mumkin.</p>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">Filial nomi</label>
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  placeholder="Ideal Print — Toshkent"
                />
                <p className="text-[12px] text-slate-400 mt-2">Keyinroq Filiallar bo'limidan qo'shimcha filiallarni qo'shishingiz mumkin.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Birinchi xizmat</h3>
                  <p className="text-xs text-slate-500">Mijozlarga sotadigan asosiy xizmatingiz nima? Yo'q bo'lsa o'tkazing.</p>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">Xizmat nomi</label>
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  placeholder="Banner Bosma"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">Asosiy narx (UZS)</label>
                  <input
                    type="number"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">Birlik</label>
                  <select
                    value={serviceUnit}
                    onChange={(e) => setServiceUnit(e.target.value)}
                    className="select-minimal mt-1 h-11 font-bold"
                  >
                    <option value="dona">dona</option>
                    <option value="m2">m²</option>
                    <option value="metr">metr</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Birinchi xodim</h3>
                  <p className="text-xs text-slate-500">Jamoangizning birinchi a'zosini qo'shing. Yolg'iz ishlasangiz o'tkazing.</p>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">Ism Familiya</label>
                <input
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  placeholder="Sardor Karimov"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-500 tracking-widest">Telefon (ixtiyoriy)</label>
                <input
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-sm font-bold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none"
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            onClick={skipAll}
            disabled={submitting}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            O'tkazib yuborish
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                disabled={submitting}
                className="h-11 px-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl"
              >
                Orqaga
              </button>
            )}
            <button
              onClick={step === 1 ? handleStep1 : step === 2 ? handleStep2 : handleStep3}
              disabled={submitting}
              className="h-11 px-6 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl flex items-center gap-2"
            >
              {submitting ? 'Saqlanmoqda...' : step < 3 ? (
                <>Davom etish <ChevronRight size={16} /></>
              ) : (
                <>Tugatish <CheckCircle2 size={16} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
