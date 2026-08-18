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
          <div className={`flex-1 h-1.5 rounded-full transition-colors duration-120 ${step >= n ? 'bg-[color:var(--primary)]' : 'bg-slate-200'}`} />
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-tour bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-overlay shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-slide-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 relative">
          <button
            onClick={skipAll}
            className="icon-btn absolute top-3 right-3"
            title="O'tkazib yuborish"
          >
            <X size={18} />
          </button>
          <div className="label-caps text-primary-700 mb-1">
            Qadam {step} / 3
          </div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
            PrintFlow'ga <span className="text-[color:var(--primary)]">xush kelibsiz</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">3 qadamda biznes uchun tayyorlanamiz</p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <StepIndicator />

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-control bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="t-h2">Filialingiz nomi</h3>
                  <p className="text-xs text-slate-500">Asosiy filial avtomatik yaratildi. Nomini o'zgartirishingiz mumkin.</p>
                </div>
              </div>
              <div>
                <label className="form-label">Filial nomi</label>
                <input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="input-minimal mt-1"
                  placeholder="Ideal Print — Toshkent"
                />
                <p className="text-xs text-slate-400 mt-2">Keyinroq Filiallar bo'limidan qo'shimcha filiallarni qo'shishingiz mumkin.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-control bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="t-h2">Birinchi xizmat</h3>
                  <p className="text-xs text-slate-500">Mijozlarga sotadigan asosiy xizmatingiz nima? Yo'q bo'lsa o'tkazing.</p>
                </div>
              </div>
              <div>
                <label className="form-label">Xizmat nomi</label>
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="input-minimal mt-1"
                  placeholder="Banner Bosma"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Asosiy narx (UZS)</label>
                  <input
                    type="number"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    className="input-minimal mt-1"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="form-label">Birlik</label>
                  <select
                    value={serviceUnit}
                    onChange={(e) => setServiceUnit(e.target.value)}
                    className="select-minimal mt-1"
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
                <div className="w-10 h-10 rounded-control bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="t-h2">Birinchi xodim</h3>
                  <p className="text-xs text-slate-500">Jamoangizning birinchi a'zosini qo'shing. Yolg'iz ishlasangiz o'tkazing.</p>
                </div>
              </div>
              <div>
                <label className="form-label">Ism Familiya</label>
                <input
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="input-minimal mt-1"
                  placeholder="Sardor Karimov"
                />
              </div>
              <div>
                <label className="form-label">Telefon (ixtiyoriy)</label>
                <input
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  className="input-minimal mt-1"
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
            className="btn-ghost h-sm"
          >
            O'tkazib yuborish
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                disabled={submitting}
                className="btn-outline"
              >
                Orqaga
              </button>
            )}
            <button
              onClick={step === 1 ? handleStep1 : step === 2 ? handleStep2 : handleStep3}
              disabled={submitting}
              className="btn-primary"
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
