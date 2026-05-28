import { useState, useEffect } from 'react';
import { X, ShieldAlert, Trash2, Plus } from 'lucide-react';
import { tenantsApi, settingsApi } from '../api';
import { useUI } from '../ui';
import { usePendingPayments, useAllPayments, useInvalidate } from '../hooks/queries';

export default function Payments() {
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const pendingQuery = usePendingPayments();
  const allQuery = useAllPayments();
  const payments = (tab === 'pending' ? pendingQuery.data : allQuery.data) || [];
  const invalidate = useInvalidate();
  const [cards, setCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [savingCards, setSavingCards] = useState(false);

  const loadPayments = () => invalidate.payments();

  const loadCards = () => {
    settingsApi.get('PAYMENT_CARDS')
      .then(r => { setCards(r.data.value || []); })
      .catch(() => { setCards([]); })
      .finally(() => setCardsLoading(false));
  };

  useEffect(() => { loadCards(); }, []);

  const approve = async (id: string) => {
    const ok = await confirm({ title: "To'lovni tasdiqlash", message: 'Ushbu to\'lovni tasdiqlaysizmi?', confirmText: 'Tasdiqlash' });
    if (!ok) return;
    try {
      await tenantsApi.approvePayment(id);
      toast("To'lov tasdiqlandi", 'success');
      loadPayments();
    } catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const reject = async (id: string) => {
    const ok = await confirm({ title: "To'lovni rad etish", message: 'Ushbu to\'lovni rad etasizmi?', confirmText: 'Rad etish', danger: true });
    if (!ok) return;
    try {
      await tenantsApi.rejectPayment(id);
      toast("To'lov rad etildi", 'success');
      loadPayments();
    } catch (e: any) { toast(e?.response?.data?.message || 'Xatolik', 'error'); }
  };

  const handleSaveCards = async () => {
    setSavingCards(true);
    try {
      await settingsApi.update('PAYMENT_CARDS', cards);
      toast('Kartalar saqlandi!', 'success');
    } catch { toast('Xatolik!', 'error'); }
    finally { setSavingCards(false); }
  };

  const addCard = () => setCards([...cards, { name: '', number: '', owner: '' }]);
  const removeCard = (idx: number) => setCards(cards.filter((_, i) => i !== idx));
  const updateCard = (idx: number, field: string, val: string) => {
    const newCards = [...cards];
    newCards[idx][field] = val;
    setCards(newCards);
  };

  const statusBadge = (s: string) => {
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Tasdiqlangan
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Rad etilgan
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Kutilmoqda
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. Payments Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">To'lovlar</h2>
            <p className="text-xs text-slate-500">Obuna rejalari uchun kelib tushgan to'lovlar tarixi</p>
          </div>

          <div className="bg-white border border-slate-200 p-0.5 rounded-lg flex items-center gap-1 shadow-sm">
            <button
              className={`h-8 px-4 rounded-md text-xs font-bold transition-all ${
                tab === 'pending' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
              onClick={() => setTab('pending')}
            >
              Kutilayotgan
            </button>
            <button
              className={`h-8 px-4 rounded-md text-xs font-bold transition-all ${
                tab === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
              onClick={() => setTab('all')}
            >
              Barchasi
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Sana</th>
                  <th className="py-3 px-4">Workspace</th>
                  <th className="py-3 px-4">Tarif</th>
                  <th className="py-3 px-4">Muddat</th>
                  <th className="py-3 px-4">Summa</th>
                  <th className="py-3 px-4">Yuboruvchi</th>
                  <th className="py-3 px-4">Holat</th>
                  <th className="py-3 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-medium font-mono">
                      {new Date(p.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.tenant?.name || '—'}
                    </td>
                    <td className="py-3.5 px-4">{p.planName}</td>
                    <td className="py-3.5 px-4 text-slate-500">{p.duration} oy</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {p.amount?.toLocaleString()} UZS
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{p.sender}</td>
                    <td className="py-3.5 px-4">{statusBadge(p.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      {p.status === 'PENDING' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="h-7 px-3 text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-all flex items-center gap-1 shadow-sm"
                            onClick={() => approve(p.id)}
                          >
                            Tasdiqlash
                          </button>
                          <button
                            className="h-7 w-7 flex items-center justify-center bg-white hover:bg-rose-50 text-rose-500 border border-slate-200 hover:border-rose-200 rounded-md transition-all"
                            onClick={() => reject(p.id)}
                            title="Rad etish"
                          >
                            <X size={13} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 px-4 text-center text-slate-500 font-medium">
                      To'lov tranzaksiyalari topilmadi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Card Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">To'lov Kartalari</h3>
            <p className="text-xs text-slate-500">Mijozlar to'lov qilish sahifasida ko'radigan faol kartalar ro'yxati</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addCard}
              className="h-8 px-3 text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-all flex items-center gap-1"
            >
              <Plus size={13} /> Karta Qo'shish
            </button>
            <button
              onClick={handleSaveCards}
              disabled={savingCards}
              className="h-8 px-4 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all disabled:bg-slate-300"
            >
              {savingCards ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>

        {cardsLoading ? (
          <div className="py-6 text-center text-slate-500 text-xs">Yuklanmoqda...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.length === 0 && (
              <div className="col-span-full border border-dashed border-slate-200 rounded-lg p-8 text-center bg-slate-50">
                <ShieldAlert size={20} className="mx-auto mb-2 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">
                  Kartalar mavjud emas. To'lov tizimi ishlashi uchun karta ma'lumotlarini qo'shing.
                </p>
              </div>
            )}

            {cards.map((c, i) => (
              <div
                key={i}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Karta #{i + 1}</span>
                  <button
                    onClick={() => removeCard(i)}
                    className="h-6 w-6 rounded-md bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 flex items-center justify-center transition-all"
                    title="O'chirish"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Karta turi</label>
                    <input
                      type="text"
                      value={c.name}
                      onChange={e => updateCard(i, 'name', e.target.value)}
                      placeholder="Masalan: UZCARD yoki HUMO"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 text-slate-900 focus:border-orange-500 rounded-lg outline-none font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Karta raqami</label>
                    <input
                      type="text"
                      value={c.number}
                      onChange={e => updateCard(i, 'number', e.target.value)}
                      placeholder="0000 0000 0000 0000"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 text-slate-900 focus:border-orange-500 rounded-lg outline-none font-mono tracking-wider transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Karta egasi</label>
                    <input
                      type="text"
                      value={c.owner}
                      onChange={e => updateCard(i, 'owner', e.target.value)}
                      placeholder="Ism Familiya"
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 text-slate-900 focus:border-orange-500 rounded-lg outline-none font-medium transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
