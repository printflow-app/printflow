import React, { useState } from 'react';
import { AlertTriangle, Check, ArrowRight, Copy, Upload, ShieldCheck, Tag, Gift, Flame, Sparkles } from 'lucide-react';
import { billingApi } from '../api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { SkeletonCardGrid } from '../components/Skeleton';
import { Badge } from '../components/ui';
import { statusVariant } from '../lib/status';

const rawApiUrl = (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? '' : 'https://printflow-production-bb78.up.railway.app');
const API_URL = rawApiUrl ? (rawApiUrl.endsWith('/api') ? rawApiUrl : rawApiUrl + '/api') : '/api';

export default function Billing() {
  // RQ — billing data
  const qc = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['billingStatus'],
    queryFn: async () => (await billingApi.getStatus()).data,
    staleTime: 60_000,
  });
  const plansQuery = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/plans`, { cache: 'no-store' }).then(r => r.json());
      return Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []);
    },
    staleTime: 5 * 60_000,
  });
  const cardsQuery = useQuery({
    queryKey: ['billing-cards'],
    queryFn: async () => (await fetch(`${API_URL}/billing/settings/payment-cards`).then(r => r.json())) || [],
    staleTime: 5 * 60_000,
  });
  const promoQuery = useQuery({
    queryKey: ['billing-promo'],
    queryFn: async () => (await billingApi.getOrCreatePromoCode().catch(() => null))?.data || null,
  });
  const aiPackagesQuery = useQuery({
    queryKey: ['billing-ai-packages'],
    queryFn: async () => (await fetch(`${API_URL}/billing/settings/ai-topup-packages`).then(r => r.json())) || [],
    staleTime: 5 * 60_000,
  });
  const status = statusQuery.data as any;
  const plans = (plansQuery.data as any[]) || [];
  const cardNumbers = (cardsQuery.data as any[]) || [];
  const myPromo = promoQuery.data as any;
  const aiPackages = (aiPackagesQuery.data as any[]) || [];
  const loading = statusQuery.isLoading || plansQuery.isLoading;
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedAiPackage, setSelectedAiPackage] = useState<any>(null);
  // Obuna muddati — faqat 12 oylik. 6 oylik variant sotuvdan olib
  // tashlangan, shuning uchun tanlov ham yo'q: qiymat o'zgarmas.
  const duration = 12;
  const [sender, setSender] = useState('');
  const [step, setStep] = useState<'plans' | 'form' | 'ai-topup'>('plans');
  const [receipt, setReceipt] = useState<File | null>(null);
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [promoValidating, setPromoValidating] = useState(false);
  const [useCashback, setUseCashback] = useState(false);
  // myPromo provided by promoQuery above



  const fetchData = () => {
    qc.invalidateQueries({ queryKey: ['billingStatus'] });
    qc.invalidateQueries({ queryKey: ['billing-plans'] });
    qc.invalidateQueries({ queryKey: ['billing-cards'] });
    qc.invalidateQueries({ queryKey: ['billing-promo'] });
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoValidating(true);
    try {
      await billingApi.validatePromoCode(promoCode.trim());
      setPromoStatus('valid');
      toast.success('Promo kod tasdiqlandi! 10% chegirma beriladi');
    } catch (err: any) {
      setPromoStatus('invalid');
      toast.error(err?.response?.data?.message || 'Promo kod xato');
    } finally { setPromoValidating(false); }
  };

  const getPrice = (plan: any) => plan.price12m;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text.replace(/\s/g, ''));
    toast.success("Karta raqami nusxalandi!");
  };

  const getDiscountedPrice = (plan: any) => {
    const base = getPrice(plan);
    if (promoStatus === 'valid') return Math.round(base * 0.9);
    if (useCashback && myPromo?.cashbackBalance > 0) return Math.max(0, base - myPromo.cashbackBalance);
    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender.trim()) return toast.error('Yuboruvchi ismini kiriting');
    if (!selectedPlan) return toast.error('Tarifni tanlang');
    setSubmitting(true);
    try {
      await billingApi.submitPayment({
        planName: selectedPlan.name,
        duration,
        amount: getDiscountedPrice(selectedPlan),
        sender: sender.trim(),
        receiptUrl: receipt ? `receipt_${Date.now()}.png` : undefined,
        notes: `To'lov cheki yuklangan: ${receipt ? 'Ha' : 'Yo\'q'}`,
        promoCode: promoStatus === 'valid' ? promoCode.trim() : undefined,
        useCashback: useCashback && (myPromo?.cashbackBalance || 0) > 0,
      });
      toast.success("To'lov so'rovi muvaffaqiyatli yuborildi!");
      fetchData();
      setStep('plans');
      setPromoCode(''); setPromoStatus('idle'); setUseCashback(false);
    } catch (err) {
      toast.error("Xatolik yuz berdi");
    } finally { setSubmitting(false); }
  };

  const handleSubmitAiTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender.trim()) return toast.error('Yuboruvchi ismini kiriting');
    if (!selectedAiPackage) return toast.error('Paketni tanlang');
    setSubmitting(true);
    try {
      await billingApi.submitAiTopupPurchase({
        packageId: selectedAiPackage.id,
        sender: sender.trim(),
        receiptUrl: receipt ? `receipt_${Date.now()}.png` : undefined,
        notes: `To'lov cheki yuklangan: ${receipt ? 'Ha' : 'Yo\'q'}`,
      });
      toast.success("So'rov paketi so'rovi muvaffaqiyatli yuborildi!");
      fetchData();
      setStep('plans');
      setSelectedAiPackage(null);
      setSender(''); setReceipt(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xatolik yuz berdi");
    } finally { setSubmitting(false); }
  };

  const parseFeatures = (str: string) => { try { return JSON.parse(str); } catch { return {}; } };

  if (loading) return <SkeletonCardGrid count={3} />;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Current Status Header */}
      <div className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
           <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-control flex items-center justify-center ${status?.status === 'EXPIRED' ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-[color:var(--primary)]'}`}>
              <ShieldCheck size={20} />
           </div>
           <div>
              <p className="label-caps mb-0.5">Joriy Holat</p>
              <h2 className="page-title flex flex-wrap items-center gap-2">
                {status?.plan?.displayName || 'Tarif tanlanmagan'}
                <Badge variant={statusVariant(status?.status)}>
                   {status?.status === 'TRIAL' ? 'SINOV MUDDATI' : status?.status === 'ACTIVE' ? 'FAOLLASHTIRILGAN' : 'MUDDAT TUGAGAN'}
                </Badge>
              </h2>
              {status?.subscriptionEndsAt && (
                <p className="t-caption mt-1">Yakunlanish sanasi: <span className="font-semibold text-slate-900">{new Date(status.subscriptionEndsAt).toLocaleDateString('uz-UZ')}</span></p>
              )}
              {status?.status === 'TRIAL' && (
                <p className="text-xs font-medium text-[color:var(--primary)] mt-1">Sinov muddati: {new Date(status.trialEndsAt).toLocaleDateString('uz-UZ')} gacha</p>
              )}
           </div>
        </div>

        {status?.status !== 'ACTIVE' && (
           <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => window.location.reload()}
                className="btn-success"
                title="Admin muddatni uzaytirgan bo'lsa yangilang"
              >
                ↻ Yangilash
              </button>
              <div className="bg-slate-50 border border-slate-200 rounded-card p-3 flex items-center gap-3">
                 <div className="text-right">
                    <p className="label-caps mb-0.5">Xizmat cheklangan</p>
                    <p className="t-caption">Davom ettirish uchun to'lov qiling</p>
                 </div>
                 <ArrowRight className="text-slate-400 shrink-0" size={18} />
              </div>
           </div>
        )}
      </div>

      {step === 'plans' ? (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
          {/* Referral & Cashback Card */}
          {myPromo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
              <div className="bg-white border border-slate-200 rounded-card p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-control flex items-center justify-center shrink-0">
                  <Tag size={18} />
                </div>
                <div className="min-w-0">
                  <p className="label-caps mb-1">Sizning Referral Kodingiz</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900 font-mono">{myPromo.code}</p>
                    <button onClick={() => { navigator.clipboard.writeText(myPromo.code); toast.success('Kod nusxalandi!'); }} className="icon-btn-sm">
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="t-caption mt-0.5">Do'stlaringizga bering — ular 10% chegirma, siz cashback olasiz!</p>
                </div>
              </div>
              <div className="bg-white border border-emerald-200 rounded-card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-control flex items-center justify-center shrink-0">
                    <Gift size={16} />
                  </div>
                  <div>
                    <p className="label-caps text-emerald-700">Cashback Balansi</p>
                    <p className="text-lg font-semibold text-emerald-800 tabular-nums">{myPromo.cashbackBalance?.toLocaleString() || 0} <span className="text-xs font-medium text-emerald-600">UZS</span></p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-emerald-700">
                  <span>Jami jalb: <strong className="font-semibold">{myPromo.totalReferrals}</strong> ta</span>
                  <span>Jami topildi: <strong className="font-semibold">{myPromo.totalEarned?.toLocaleString()}</strong> UZS</span>
                </div>
                {myPromo.usages?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {myPromo.usages.slice(0, 3).map((u: any) => (
                      <div key={u.id} className="flex justify-between gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-control px-2 py-1">
                        <span className="truncate">{u.usingTenant?.name}</span>
                        <span className="tabular-nums shrink-0">+{u.cashbackEarned?.toLocaleString()} UZS</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* To'lov muddati — tanlov yo'q, obuna faqat 12 oylik.
              Bitta tugmali "tanlov" panelini qoldirmadik: u tanlash mumkindek
              ko'rinib, aslida hech narsani o'zgartirmasdi. */}
          <div className="flex flex-col items-center gap-2 w-full">
            <h3 className="label-caps text-center">To'lov muddati</h3>
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-card">
              <span className="text-sm font-semibold text-slate-900">12 OY</span>
              <span className="badge-primary">-10%</span>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 max-w-5xl mx-auto">
            {plans.map(plan => {
              const features = parseFeatures(plan.features);
              const price = getPrice(plan);

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white border rounded-card p-5 sm:p-8 flex flex-col w-full sm:w-[340px] transition-colors duration-180 ${plan.isPopular ? 'border-[color:var(--primary)]' : 'border-slate-200'}`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[color:var(--primary)] text-white label-caps text-white px-4 py-1 rounded-full flex items-center gap-1.5">
                      <Flame size={12} /> Eng ommabop
                    </div>
                  )}

                  <div className="mb-2">
                    <h3 className="card-title">{plan.displayName}</h3>
                    <p className="t-caption mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums">{price.toLocaleString().replace(/,/g, ' ')}</span>
                      <span className="text-sm font-medium text-slate-500">UZS</span>
                    </div>
                    <div className="t-caption mt-1">
                      {duration} oylik / Xodimlar: {plan.maxEmployees === 0 ? 'Cheksiz' : plan.maxEmployees}
                    </div>
                  </div>

                  <ul className="space-y-2 mb-4 sm:mb-6 flex-1">
                    {(() => {
                      const allowedMods: string[] = plan.allowedModules || [];
                      const allFeatures: Array<{ ids: string[]; label: string }> = [
                        { ids: ['kanban'], label: 'Kanban (Buyurtmalar)' },
                        { ids: ['finance'], label: 'Moliya (Sof foyda/Zarar)' },
                        { ids: ['inventory', 'warehouse'], label: 'Ombor boshqaruvi' },
                        { ids: ['attendance'], label: 'Ishga davomat (QR)' },
                        { ids: ['reports', 'kpi', 'kpiTracking'], label: 'Hisobotlar & KPI' },
                        { ids: ['customers'], label: 'Mijozlar bazasi (CRM)' },
                        { ids: ['ai_chat'], label: 'AI Copilot' },
                        { ids: ['partners'], label: 'Hamkorlar (Vendor)' },
                        { ids: ['branches', 'multi_branch', 'multiBranch'], label: 'Multi Filiallar' },
                        { ids: ['statistics'], label: 'Statistika & Grafiklar' },
                      ];

                      const isEnabled = (feat: { ids: string[] }) =>
                        feat.ids.some(id => features[id] || allowedMods.includes(id));

                      // Faqat shu planga kiritilgan imkoniyatlarni ko'rsatamiz.
                      return allFeatures.filter(isEnabled).map(feat => (
                        <li key={feat.ids[0]} className="flex items-center gap-3 text-sm font-normal text-slate-700">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-orange-50">
                            <Check size={12} className="text-[color:var(--primary)]" />
                          </div>
                          <span>{feat.label}</span>
                        </li>
                      ));
                    })()}
                  </ul>

                  <button
                    onClick={() => { setSelectedPlan(plan); setStep('form'); }}
                    className={`${plan.isPopular ? 'btn-primary' : 'btn-outline'} h-lg w-full`}
                  >
                    Boshlash →
                  </button>
                </div>
              );
            })}
          </div>

          {/* AI So'rov Paketlari — kunlik/oylik limit tugaganda qo'shimcha sotib olish */}
          {aiPackages.length > 0 && (
            <div className="max-w-5xl mx-auto w-full pt-2">
              <h3 className="label-caps text-center block mb-4">Qo'shimcha AI so'rov paketlari</h3>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                {aiPackages.map((pkg: any) => (
                  <div key={pkg.id} className="bg-white border border-slate-200 rounded-card p-4 sm:p-5 w-full sm:w-64 flex flex-col">
                    <div className="w-9 h-9 rounded-control bg-orange-50 text-[color:var(--primary)] flex items-center justify-center mb-3">
                      <Sparkles size={16} />
                    </div>
                    <p className="t-h3">{pkg.label}</p>
                    <p className="t-caption mt-0.5">+{pkg.credits} so'rov</p>
                    <p className="text-lg font-semibold text-slate-900 mt-3 tabular-nums">{Number(pkg.priceUzs || 0).toLocaleString().replace(/,/g, ' ')} <span className="text-xs text-slate-500 font-medium">UZS</span></p>
                    <button
                      onClick={() => { setSelectedAiPackage(pkg); setStep('ai-topup'); }}
                      className="btn-outline w-full mt-4"
                    >
                      Sotib olish
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : step === 'form' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8 animate-fade-in">
           {/* Payment Details */}
           <div className="bg-white border border-slate-200 rounded-card p-5 sm:p-8 space-y-6 sm:space-y-8">
              <button onClick={() => setStep('plans')} className="btn-ghost h-sm -ml-3">← Tariflarga qaytish</button>

              <div>
                 <h2 className="page-title mb-2">To'lov ma'lumotlari</h2>
                 <p className="t-body">Quyidagi karta raqamlariga summani o'tkazing va chekni yuklang</p>
              </div>

              <div className="space-y-4">
                 {cardNumbers.map((c, i) => (
                   <div key={i} className="bg-slate-50 border border-slate-200 rounded-card p-4 sm:p-5 hover:border-[color:var(--primary)] transition-colors duration-120">
                      <div className="flex items-center justify-between gap-3">
                         <div className="min-w-0">
                            <p className="label-caps mb-1">{c.name}</p>
                            <p className="text-lg font-semibold text-slate-800 font-mono break-all">{c.number}</p>
                            <p className="t-caption mt-1">{c.owner}</p>
                         </div>
                         <button onClick={() => handleCopy(c.number)} className="icon-btn bg-white border border-slate-200">
                            <Copy size={18} />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-card p-4 sm:p-5 flex items-center gap-4">
                 <div className="w-10 h-10 shrink-0 bg-white border border-slate-200 rounded-control flex items-center justify-center text-slate-600"><AlertTriangle size={20}/></div>
                 <p className="t-body leading-relaxed">To'lovni amalga oshirgandan so'ng, chekni (screenshot) yuklashni unutmang. Aks holda to'lov tasdiqlanmaydi.</p>
              </div>
           </div>

           {/* Confirmation Form */}
           <div className="bg-white border border-slate-200 rounded-card p-5 sm:p-8 flex flex-col">
              <div className="mb-6 sm:mb-10 text-center lg:text-left">
                 <p className="label-caps mb-1">Yuborish shakli</p>
                 <h2 className="page-title">Tasdiqlash so'rovi</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                 <div>
                    <label className="form-label">Yuboruvchi ism-familiyasi</label>
                    <input
                      type="text"
                      required
                      value={sender}
                      onChange={e => setSender(e.target.value)}
                      placeholder="Masalan: Sardor Rustamov"
                      className="input-minimal h-control-lg"
                    />
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-card p-4">
                       <p className="label-caps mb-1">Tarif</p>
                       <p className="text-sm font-medium text-slate-800">{selectedPlan.displayName}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-card p-4">
                       <p className="label-caps mb-1">Summa</p>
                       {getDiscountedPrice(selectedPlan) !== getPrice(selectedPlan) ? (
                         <div>
                           <p className="text-xs font-normal text-slate-500 line-through mb-0.5 tabular-nums">{getPrice(selectedPlan).toLocaleString()} UZS</p>
                           <p className="text-sm font-semibold text-emerald-700 tabular-nums">{getDiscountedPrice(selectedPlan).toLocaleString()} UZS</p>
                         </div>
                       ) : (
                         <p className="text-sm font-semibold text-emerald-700 tabular-nums">{getPrice(selectedPlan).toLocaleString()} UZS</p>
                       )}
                    </div>
                 </div>

                 {/* Promo Code Input */}
                 <div>
                    <label className="form-label">Promo Kod (Chegirma uchun)</label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoStatus('idle'); }}
                        disabled={promoStatus === 'valid' || promoValidating}
                        placeholder="KODNI KIRITING"
                        className="input-minimal flex-1 min-w-[160px] font-medium uppercase"
                      />
                      {promoStatus === 'valid' ? (
                        <div className="h-control px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-control flex items-center justify-center text-sm font-medium gap-2">
                          <Check size={16} /> TASDIQLANDI
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleValidatePromo}
                          disabled={!promoCode || promoValidating}
                          className="btn-outline"
                        >
                          {promoValidating ? '...' : 'TEKSHIRISH'}
                        </button>
                      )}
                    </div>
                    {promoStatus === 'valid' && (
                      <p className="text-xs font-medium text-emerald-700 mt-2">Tabriklaymiz! Sizga 10% chegirma taqdim etildi.</p>
                    )}
                 </div>

                 {/* Cashback Toggle */}
                 {(myPromo?.cashbackBalance || 0) > 0 && (
                   <div className="bg-white border border-emerald-200 rounded-card p-4 flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3 min-w-0">
                       <div className="w-10 h-10 shrink-0 bg-emerald-50 rounded-control flex items-center justify-center">
                         <Gift className="text-emerald-600" size={18} />
                       </div>
                       <div className="min-w-0">
                         <p className="text-sm font-medium text-emerald-800 mb-0.5">Cashback ishlatish</p>
                         <p className="text-xs font-normal text-emerald-700 tabular-nums">Sizda {myPromo.cashbackBalance.toLocaleString()} UZS mavjud</p>
                       </div>
                     </div>
                     <button
                        type="button"
                        onClick={() => setUseCashback(!useCashback)}
                        className={`relative w-11 h-6 shrink-0 rounded-full transition-colors duration-120 ${useCashback ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`absolute top-0.5 ${useCashback ? 'left-[22px]' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all`}></span>
                      </button>
                   </div>
                 )}

                 <div>
                    <label className="form-label">To'lov cheki (Image)</label>
                    <div className="relative">
                       <input
                         type="file"
                         accept="image/*"
                         onChange={e => setReceipt(e.target.files?.[0] || null)}
                         className="hidden"
                         id="receipt-upload"
                       />
                       <label
                         htmlFor="receipt-upload"
                         className={`w-full h-24 px-3 border border-dashed rounded-card flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-120 ${receipt ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-[color:var(--primary)] hover:bg-primary-50'}`}
                       >
                          {receipt ? (
                            <>
                               <Check className="text-emerald-600 mb-1" size={20} />
                               <p className="text-xs font-medium text-emerald-700 break-all">{receipt.name}</p>
                            </>
                          ) : (
                            <>
                               <Upload className="text-slate-400 mb-1" size={20} />
                               <p className="t-caption">Rasm tanlash uchun bosing</p>
                            </>
                          )}
                       </label>
                    </div>
                 </div>

                 <div className="pt-6">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary h-lg w-full"
                    >
                      {submitting ? (
                        <>
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           <span>Yuborilmoqda...</span>
                        </>
                      ) : (
                        <>
                           <span>TASDIQLASHGA YUBORISH</span>
                           <ArrowRight size={20} />
                        </>
                      )}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8 animate-fade-in">
           {/* AI Topup — Payment Details */}
           <div className="bg-white border border-slate-200 rounded-card p-5 sm:p-8 space-y-6 sm:space-y-8">
              <button onClick={() => { setStep('plans'); setSelectedAiPackage(null); }} className="btn-ghost h-sm -ml-3">← Paketlarga qaytish</button>

              <div>
                 <h2 className="page-title mb-2">To'lov ma'lumotlari</h2>
                 <p className="t-body">Quyidagi karta raqamlariga summani o'tkazing va chekni yuklang</p>
              </div>

              <div className="space-y-4">
                 {cardNumbers.map((c, i) => (
                   <div key={i} className="bg-slate-50 border border-slate-200 rounded-card p-4 sm:p-5 hover:border-[color:var(--primary)] transition-colors duration-120">
                      <div className="flex items-center justify-between gap-3">
                         <div className="min-w-0">
                            <p className="label-caps mb-1">{c.name}</p>
                            <p className="text-lg font-semibold text-slate-800 font-mono break-all">{c.number}</p>
                            <p className="t-caption mt-1">{c.owner}</p>
                         </div>
                         <button onClick={() => handleCopy(c.number)} className="icon-btn bg-white border border-slate-200">
                            <Copy size={18} />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-card p-4 sm:p-5 flex items-center gap-4">
                 <div className="w-10 h-10 shrink-0 bg-white border border-amber-200 rounded-control flex items-center justify-center text-amber-600"><AlertTriangle size={20}/></div>
                 <p className="text-sm font-normal text-amber-900 leading-relaxed">To'lovni amalga oshirgandan so'ng, chekni (screenshot) yuklashni unutmang. Tasdiqlangach qo'shimcha so'rovlar darhol qo'shiladi.</p>
              </div>
           </div>

           {/* AI Topup — Confirmation Form */}
           <div className="bg-white border border-slate-200 rounded-card p-5 sm:p-8 flex flex-col">
              <div className="mb-6 sm:mb-10 text-center lg:text-left">
                 <p className="label-caps mb-1">Yuborish shakli</p>
                 <h2 className="page-title">Paket sotib olish so'rovi</h2>
              </div>

              <form onSubmit={handleSubmitAiTopup} className="space-y-6 flex-1">
                 <div>
                    <label className="form-label">Yuboruvchi ism-familiyasi</label>
                    <input
                      type="text"
                      required
                      value={sender}
                      onChange={e => setSender(e.target.value)}
                      placeholder="Masalan: Sardor Rustamov"
                      className="input-minimal h-control-lg"
                    />
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-card p-4">
                       <p className="label-caps mb-1">Paket</p>
                       <p className="text-sm font-medium text-slate-800">{selectedAiPackage?.label} (+{selectedAiPackage?.credits} so'rov)</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-card p-4">
                       <p className="label-caps mb-1">Summa</p>
                       <p className="text-sm font-semibold text-emerald-700 tabular-nums">{Number(selectedAiPackage?.priceUzs || 0).toLocaleString()} UZS</p>
                    </div>
                 </div>

                 <div>
                    <label className="form-label">To'lov cheki (Image)</label>
                    <div className="relative">
                       <input
                         type="file"
                         accept="image/*"
                         onChange={e => setReceipt(e.target.files?.[0] || null)}
                         className="hidden"
                         id="ai-receipt-upload"
                       />
                       <label
                         htmlFor="ai-receipt-upload"
                         className={`w-full h-24 px-3 border border-dashed rounded-card flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-120 ${receipt ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-[color:var(--primary)] hover:bg-primary-50'}`}
                       >
                          {receipt ? (
                            <>
                               <Check className="text-emerald-600 mb-1" size={20} />
                               <p className="text-xs font-medium text-emerald-700 break-all">{receipt.name}</p>
                            </>
                          ) : (
                            <>
                               <Upload className="text-slate-400 mb-1" size={20} />
                               <p className="t-caption">Rasm tanlash uchun bosing</p>
                            </>
                          )}
                       </label>
                    </div>
                 </div>

                 <div className="pt-6">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary h-lg w-full"
                    >
                      {submitting ? (
                        <>
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           <span>Yuborilmoqda...</span>
                        </>
                      ) : (
                        <>
                           <span>TASDIQLASHGA YUBORISH</span>
                           <ArrowRight size={20} />
                        </>
                      )}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}