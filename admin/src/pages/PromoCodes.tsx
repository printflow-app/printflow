import React, { useEffect, useState } from 'react';
import { tenantsApi } from '../api';
import { Key } from 'lucide-react';

export default function PromoCodes() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tenantsApi.getPromoCodes()
      .then(r => setPromos(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-10 text-center text-slate-500 text-xs">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Promo Kodlar & Cashback</h2>
        <p className="text-xs text-slate-500">Hamkorlik promo kodlari va ulardan kelib tushgan cashback balanslari</p>
      </div>

      {/* Promocodes Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Kod</th>
                <th className="py-3 px-4">Hamkor (Workspace)</th>
                <th className="py-3 px-4">Jalb qildi</th>
                <th className="py-3 px-4">Jami Topdi</th>
                <th className="py-3 px-4">Joriy Balans</th>
                <th className="py-3 px-4">Holati</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-700">
              {promos.map(p => (
                <React.Fragment key={p.id}>
                  {/* Promo Code Row */}
                  <tr className="hover:bg-slate-50 border-b border-slate-100 font-semibold">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-orange-600">
                        <Key size={13} className="text-orange-500" />
                        <span className="font-mono text-xs tracking-wider select-all">{p.code}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="text-slate-900">{p.tenant?.name || '—'}</p>
                        <p className="text-[10px] text-slate-500 font-normal">@{p.tenant?.slug}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-700">{p.totalReferrals} ta</span>
                    </td>
                    <td className="py-3.5 px-4 text-emerald-600 font-bold">
                      {(p.totalEarned || 0).toLocaleString()} UZS
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {(p.cashbackBalance || 0).toLocaleString()} UZS
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className={p.isActive ? 'text-emerald-700' : 'text-slate-500'}>{p.isActive ? 'Faol' : 'Nofaol'}</span>
                      </span>
                    </td>
                  </tr>

                  {/* Referral usages detail row */}
                  {p.usages && p.usages.length > 0 && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 p-0 border-b border-slate-100">
                        <div className="py-3 px-6 space-y-2">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tarix va komissiyalar:</p>
                          <div className="space-y-1.5">
                            {p.usages.map((u: any) => (
                              <div
                                key={u.id}
                                className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-[11px]"
                              >
                                <div className="flex items-center gap-4">
                                  <span className="font-bold text-slate-900">{u.usingTenant?.name}</span>
                                  <span className="text-slate-500 font-mono text-[10px]">Tarif: {u.planName}</span>
                                  <span className="text-slate-500">To'lov: {u.paymentAmount?.toLocaleString()} UZS</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-rose-600 font-medium">Chegirma: -{u.discount?.toLocaleString()} UZS</span>
                                  <span className="text-emerald-600 font-bold">Cashback: +{u.cashbackEarned?.toLocaleString()} UZS</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {promos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">
                    Promo kodlar mavjud emas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
