import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, ArrowRight, Copy, Upload, ShieldCheck } from 'lucide-react';
import { billingApi } from '../api';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = ((import.meta as any).env.VITE_API_URL || 'http://localhost:4000') + '/api';

export default function Billing() {
  const [status, setStatus] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [cardNumbers, setCardNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [duration, setDuration] = useState(3);
  const [sender, setSender] = useState('');
  const [step, setStep] = useState<'plans' | 'form'>('plans');
  const [receipt, setReceipt] = useState<File | null>(null);



  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, plansResRaw, cardsRes] = await Promise.all([
        billingApi.getStatus(),
        fetch(`${API_URL}/plans`).then(r => r.json()),
        fetch(`${API_URL}/billing/settings/payment-cards`).then(r => r.json())
      ]);
      setStatus(statusRes.data);
      const list = Array.isArray(plansResRaw) ? plansResRaw : (Array.isArray(plansResRaw?.data) ? plansResRaw.data : []);
      setPlans(list);
      setCardNumbers(cardsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getPrice = (plan: any) => {
    if (duration === 3) return plan.price3m;
    if (duration === 6) return plan.price6m;
    return plan.price12m;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text.replace(/\s/g, ''));
    toast.success("Karta raqami nusxalandi!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender.trim()) return toast.error('Yuboruvchi ismini kiriting');
    if (!selectedPlan) return toast.error('Tarifni tanlang');
    
    setSubmitting(true);
    try {
      // In a real app, you would upload the file to S3 first and get a URL
      // Here we just simulate it by sending a fake URL if file is present
      await billingApi.submitPayment({
        planName: selectedPlan.name,
        duration,
        amount: getPrice(selectedPlan),
        sender: sender.trim(),
        receiptUrl: receipt ? `receipt_${Date.now()}.png` : undefined,
        notes: `To'lov cheki yuklangan: ${receipt ? 'Ha' : 'Yo\'q'}`
      });
      toast.success("To'lov so'rovi muvaffaqiyatli yuborildi!");
      fetchData();
      setStep('plans');
    } catch (err) {
      toast.error("Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const parseFeatures = (str: string) => { try { return JSON.parse(str); } catch { return {}; } };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto p-4 md:p-6">
      {/* Current Status Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
           <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${status?.status === 'EXPIRED' ? 'bg-rose-100 text-rose-600 shadow-rose-200/50' : 'bg-orange-100 text-[#FF6B00] shadow-orange-200/50'}`}>
              <ShieldCheck size={32} />
           </div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Joriy Holat</p>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {status?.plan?.displayName || 'Tarif tanlanmagan'} 
                <span className={`ml-3 text-[10px] px-3 py-1 rounded-full border ${status?.status === 'TRIAL' ? 'bg-orange-50 text-orange-600 border-orange-200' : status?.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                   {status?.status === 'TRIAL' ? 'SINOV MUDDATI' : status?.status === 'ACTIVE' ? 'FAOLLASHTIRILGAN' : 'MUDDAT TUGAGAN'}
                </span>
              </h2>
              {status?.subscriptionEndsAt && (
                <p className="text-xs font-bold text-slate-500 mt-1">Yakunlanish sanasi: <span className="text-slate-900">{new Date(status.subscriptionEndsAt).toLocaleDateString('uz-UZ')}</span></p>
              )}
              {status?.status === 'TRIAL' && (
                <p className="text-xs font-bold text-orange-600 mt-1 italic">Sinov muddati: {new Date(status.trialEndsAt).toLocaleDateString('uz-UZ')} gacha</p>
              )}
           </div>
        </div>
        
        {status?.status !== 'ACTIVE' && (
           <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Xizmat cheklangan</p>
                 <p className="text-xs font-bold text-slate-600">Davom ettirish uchun to'lov qiling</p>
              </div>
              <ArrowRight className="text-slate-300 animate-pulse-slow" size={20} />
           </div>
        )}
      </div>

      {step === 'plans' ? (
        <div className="space-y-8 animate-fade-in">
          {/* Duration Switcher */}
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">To'lov muddatini tanlang</h3>
            <div className="flex bg-slate-100 p-1 rounded-2xl shadow-inner">
               {[3, 6, 12].map(m => (
                 <button 
                    key={m} 
                    onClick={() => setDuration(m)}
                    className={`px-8 py-3 text-xs font-black rounded-xl transition-all ${duration === m ? 'bg-white shadow-md text-[#FF6B00]' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   {m} OY {m === 6 ? '(-10%)' : m === 12 ? '(-25%)' : ''}
                 </button>
               ))}
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map(plan => {
              const features = parseFeatures(plan.features);
              const price = getPrice(plan);
              
              return (
                <div 
                  key={plan.id} 
                  className={`relative bg-white border rounded-2xl p-8 flex flex-col transition-all duration-300 hover:shadow-xl ${plan.isPopular ? 'border-[#FF6B00] shadow-xl shadow-orange-500/10' : 'border-slate-200 shadow-sm'}`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF6B00] text-white text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                      🔥 Eng ommabop
                    </div>
                  )}
                  
                  <div className="mb-2">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{plan.displayName}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900 tabular-nums">{price.toLocaleString().replace(/,/g, ' ')}</span>
                      <span className="text-sm font-black text-slate-400">UZS</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-tight">
                      {duration} oylik / Xodimlar: {plan.maxEmployees === 0 ? 'Cheksiz' : plan.maxEmployees}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {(() => {
                      const allFeatures: Array<{ ids: string[]; label: string }> = [
                        { ids: ['kanban'], label: 'Kanban (Buyurtmalar)' },
                        { ids: ['warehouse'], label: 'Ombor boshqaruvi' },
                        { ids: ['telegram_bot', 'telegramBot'], label: 'Telegram Bot (Xabarlar)' },
                        { ids: ['attendance'], label: 'Ishga davomat (QR)' },
                        { ids: ['finance'], label: 'Moliya (Sof foyda/Zarar)' },
                        { ids: ['tasks', 'taskManagement'], label: 'Task Management' },
                        { ids: ['kpi', 'kpiTracking'], label: 'Xodimlar KPI tahlili' },
                        { ids: ['debtors', 'debtorReminders'], label: 'Qarzdorlarga avto-xabar' },
                        { ids: ['multi_branch', 'multiBranch'], label: 'Multi Filiallar (Tez kunda)' }
                      ];

                      // Sort: active features first
                      const sortedFeatures = [...allFeatures].sort((a, b) => {
                        const valA = a.ids.some(id => features[id]) ? 1 : 0;
                        const valB = b.ids.some(id => features[id]) ? 1 : 0;
                        return valB - valA;
                      });

                      return sortedFeatures.map(feat => {
                        const val = feat.ids.some(id => features[id]);
                        return (
                          <li key={feat.ids[0]} className={`flex items-center gap-3 text-[11px] font-bold ${val ? 'text-slate-700' : 'text-slate-400 opacity-60'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${val ? 'bg-orange-50' : 'bg-slate-100'}`}>
                              {val ? <Check size={12} className="text-[#FF6B00]" strokeWidth={4} /> : <div className="w-3 h-0.5 bg-slate-300" />}
                            </div>
                            <span style={{ textDecoration: val ? 'none' : 'line-through' }}>{feat.label}</span>
                          </li>
                        );
                      });
                    })()}
                  </ul>

                  <button 
                    onClick={() => { setSelectedPlan(plan); setStep('form'); }}
                    className={`w-full py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-lg ${plan.isPopular ? 'bg-[#FF6B00] text-white hover:bg-[#E65A00] shadow-orange-500/30' : 'bg-[#0f172a] text-white hover:bg-black shadow-slate-900/20'}`}
                  >
                    Boshlash →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
           {/* Payment Details */}
           <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-sm space-y-8">
              <button onClick={() => setStep('plans')} className="text-[10px] font-black text-[#FF6B00] uppercase tracking-widest hover:translate-x-[-4px] transition-transform flex items-center gap-2 mb-4">← Tariflarga qaytish</button>
              
              <div>
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">To'lov ma'lumotlari</h2>
                 <p className="text-sm font-bold text-slate-500">Quyidagi karta raqamlariga summani o'tkazing va chekni yuklang</p>
              </div>

              <div className="space-y-4">
                 {cardNumbers.map((c, i) => (
                   <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 group hover:border-[#FF6B00] transition-colors relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100 opacity-20 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-125"></div>
                      <div className="relative flex items-center justify-between">
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{c.name}</p>
                            <p className="text-lg font-black text-slate-800 tracking-wider font-mono">{c.number}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">{c.owner}</p>
                         </div>
                         <button onClick={() => handleCopy(c.number)} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#FF6B00] hover:border-[#FF6B00] transition-all shadow-sm">
                            <Copy size={18} />
                         </button>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-center gap-4">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm"><AlertTriangle size={20}/></div>
                 <p className="text-[11px] font-bold text-indigo-900 leading-relaxed">To'lovni amalga oshirgandan so'ng, chekni (screenshot) yuklashni unutmang. Aks holda to'lov tasdiqlanmaydi.</p>
              </div>
           </div>

           {/* Confirmation Form */}
           <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-sm flex flex-col">
              <div className="mb-10 text-center lg:text-left">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Yuborish shakli</p>
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight">Tasdiqlash so'rovi</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                 <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Yuboruvchi ism-familiyasi</label>
                    <input 
                      type="text" 
                      required 
                      value={sender} 
                      onChange={e => setSender(e.target.value)} 
                      placeholder="Masalan: Sardor Rustamov"
                      className="input-minimal !h-14 font-black tracking-tight !text-base"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarif</p>
                       <p className="text-xs font-black text-slate-800">{selectedPlan.displayName}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Summa</p>
                       <p className="text-xs font-black text-emerald-600">{getPrice(selectedPlan).toLocaleString()} UZS</p>
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">To'lov cheki (Image)</label>
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
                         className={`w-full h-24 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${receipt ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-[#FF6B00] hover:bg-orange-50/50'}`}
                       >
                          {receipt ? (
                            <>
                               <Check className="text-emerald-500 mb-1" size={24} strokeWidth={3} />
                               <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{receipt.name}</p>
                            </>
                          ) : (
                            <>
                               <Upload className="text-slate-400 mb-1" size={24} />
                               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Rasm tanlash uchun bosing</p>
                            </>
                          )}
                       </label>
                    </div>
                 </div>

                 <div className="pt-6">
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="w-full h-16 bg-[#FF6B00] hover:bg-[#E65A00] text-white font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-xl shadow-orange-500/30 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                      {submitting ? (
                        <>
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           <span>Yuborilmoqda...</span>
                        </>
                      ) : (
                        <>
                           <span>TASDIQLASHGA YUBORISH</span>
                           <ArrowRight size={20} strokeWidth={3} />
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

