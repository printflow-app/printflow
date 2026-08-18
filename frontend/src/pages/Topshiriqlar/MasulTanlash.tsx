import React, { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, Check, X, Users } from 'lucide-react';

// =============================================
// MAS'UL TANLASH — ko'p tanlovli, qidiruvli.
//
// Ilgari har bir xodim uchun alohida tugma chiqarilardi: 20 xodimli
// tashkilotda bu 20 ta tugmali devor bo'lib, xizmat qatorini bosib
// ketardi va kerakli odamni ko'z bilan qidirishga majbur qilardi.
//
// Endi yopiq holatda faqat TANLANGANLAR ko'rinadi, ochilganda qidiruv
// bilan ro'yxat chiqadi. Xodim soni qancha bo'lsa ham balandlik o'zgarmaydi.
// =============================================

export interface MasulOdam {
  id: string;
  fullName: string;
  roleName?: string;
  band?: boolean;
}

const MasulTanlash: React.FC<{
  odamlar: MasulOdam[];
  tanlangan: string[];
  onChange: (ids: string[]) => void;
  /** Hech kim tanlanmaganda ko'rsatiladigan matn. */
  placeholder?: string;
}> = ({ odamlar, tanlangan, onChange, placeholder = 'Mas\'ul tanlang' }) => {
  const [ochiq, setOchiq] = useState(false);
  const [qidiruv, setQidiruv] = useState('');
  const idishRef = useRef<HTMLDivElement>(null);

  // Tashqariga bosilganda yopiladi. Modal ichida ishlagani uchun
  // `mousedown` — `click` modalning o'z listenerlariga ilashib qolardi.
  useEffect(() => {
    if (!ochiq) return;
    const onDown = (e: MouseEvent) => {
      if (idishRef.current && !idishRef.current.contains(e.target as Node)) {
        setOchiq(false);
        setQidiruv('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ochiq]);

  const tanlanganOdamlar = odamlar.filter((o) => tanlangan.includes(o.id));
  const korinadigan = odamlar.filter((o) => {
    const q = qidiruv.trim().toLowerCase();
    if (!q) return true;
    return o.fullName.toLowerCase().includes(q) || (o.roleName || '').toLowerCase().includes(q);
  });

  const almashtir = (id: string) => {
    onChange(tanlangan.includes(id) ? tanlangan.filter((x) => x !== id) : [...tanlangan, id]);
  };

  return (
    <div ref={idishRef} className="relative">
      <button
        type="button"
        onClick={() => setOchiq((v) => !v)}
        className="w-full min-h-[36px] flex items-center gap-2 bg-white border border-slate-200 rounded-control px-2.5 py-1.5 text-left hover:border-slate-300 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all duration-120"
      >
        <Users size={16} className="text-slate-400 shrink-0" />
        <span className="flex-1 flex flex-wrap gap-1 min-w-0">
          {tanlanganOdamlar.length === 0 ? (
            <span className="t-caption">{placeholder}</span>
          ) : (
            tanlanganOdamlar.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 border border-primary-300 rounded-control px-1.5 py-0.5 text-xs font-medium"
              >
                {o.fullName}
                {/* Chipdagi × — ichma-ich tugma bo'lmasligi uchun span */}
                <span
                  role="button"
                  tabIndex={-1}
                  title="Olib tashlash"
                  onClick={(e) => { e.stopPropagation(); almashtir(o.id); }}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X size={12} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform duration-180 ${ochiq ? 'rotate-180' : ''}`} />
      </button>

      {ochiq && (
        <div className="absolute z-dropdown left-0 right-0 mt-1 bg-white rounded-overlay border border-slate-200 shadow-lg overflow-hidden animate-slide-up">
          <div className="relative border-b border-slate-100">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={qidiruv}
              onChange={(e) => setQidiruv(e.target.value)}
              placeholder="Qidirish..."
              className="w-full h-9 pl-9 pr-2.5 text-xs bg-transparent outline-none"
            />
          </div>
          <div className="max-h-[180px] overflow-y-auto custom-scroll py-1">
            {korinadigan.length === 0 && (
              <p className="px-3 py-4 t-caption text-center">Topilmadi</p>
            )}
            {korinadigan.map((o) => {
              const on = tanlangan.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => almashtir(o.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-120 ${on ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${on ? 'bg-[color:var(--primary)] border-[color:var(--primary)] text-white' : 'border-slate-300'}`}>
                    {on && <Check size={12} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-slate-800 truncate">{o.fullName}</span>
                    {o.roleName && <span className="block t-caption truncate">{o.roleName}</span>}
                  </span>
                  {/* Band xodimni yashirmaymiz — birga ishlash mumkin,
                      lekin yuklamani bilib turgani ma'qul. */}
                  {o.band && (
                    <span className="badge-warning shrink-0">
                      band
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MasulTanlash;
