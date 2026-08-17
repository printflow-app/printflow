import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Building2, User, X, Plus, ChevronDown } from 'lucide-react';

// =============================================
// MIJOZ VA VAKIL TANLASH — bitta qidiruvda.
//
// Mijoz = TASHKILOT, vakil = shu tashkilotdagi aloqa shaxsi. Ilgari
// bu yerda faqat tashkilot tanlanardi va "qaysi odam aytdi" degan
// savolga javob qolmasdi; "yangi mijoz" maydoniga odam ismi yozilsa
// esa odam yana mijoz bo'lib qolardi — mijozlar bazasini tashkilotga
// o'tkazish ishining o'zi behuda ketardi.
//
// KAM BOSISH QOIDASI: qidiruvda tashkilot ham, vakillar ham birga
// chiqadi. Vakil bosilsa — tashkilot va vakil BIR BOSISHDA tanlanadi,
// chunki amalda odam ko'pincha aynan tanish odamni qidiradi
// ("Ilhom aka"), tashkilot nomini emas.
//
// Yangi tashkilot yoki yangi vakil shu yerda yoziladi — ular buyurtma
// saqlanganda serverda yaratiladi (createBulk). Alohida oyna ochib,
// avval mijoz yaratib, keyin qaytib kelish kerak emas.
// =============================================

export interface MijozTanlov {
  customerId: string;
  customerName: string;
  customerPhone: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  /** Vakilning lavozimi ("Direktor", "Menejer"). Mijoz kartasida saqlanadi. */
  contactRole: string;
}

interface Vakil { id: string; name: string; phone?: string | null; role?: string | null }
interface Mijoz { id: string; name: string; phone?: string | null; contacts?: Vakil[] }

const raqam = (s?: string | null) => (s || '').replace(/\D/g, '');

const MijozTanlash: React.FC<{
  mijozlar: Mijoz[];
  qiymat: MijozTanlov;
  onChange: (v: MijozTanlov) => void;
}> = ({ mijozlar, qiymat, onChange }) => {
  const [ochiq, setOchiq] = useState(false);
  const [qidiruv, setQidiruv] = useState('');
  const [vakilQoshish, setVakilQoshish] = useState(false);
  // Yangi tashkilot yozilayotgan holat. Alohida bayroq kerak, chunki nom hali
  // bo'sh bo'lishi mumkin — faqat `customerName` ga qarab bo'lmaydi, aks holda
  // "yangi tashkilot" bosilgach ekran yana bo'sh qidiruv tugmasiga qaytardi.
  const [yangiRejim, setYangiRejim] = useState(false);
  const idishRef = useRef<HTMLDivElement>(null);

  const tanlangan = !!qiymat.customerId || !!qiymat.customerName || yangiRejim;
  const tanlanganMijoz = mijozlar.find((m) => m.id === qiymat.customerId);

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

  // Qidiruv natijalari — tashkilot va vakil qatorlari aralash.
  const natijalar = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    const qRaqam = raqam(qidiruv);
    const rows: Array<
      | { tur: 'mijoz'; mijoz: Mijoz }
      | { tur: 'vakil'; mijoz: Mijoz; vakil: Vakil }
    > = [];

    for (const m of mijozlar) {
      const mosMijoz =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (qRaqam.length >= 3 && raqam(m.phone).includes(qRaqam));
      const mosVakillar = (m.contacts || []).filter(
        (v) =>
          !q ||
          v.name.toLowerCase().includes(q) ||
          (qRaqam.length >= 3 && raqam(v.phone).includes(qRaqam)),
      );

      if (mosMijoz) rows.push({ tur: 'mijoz', mijoz: m });
      // Tashkilot nomi mos kelganda ham vakillari ko'rsatiladi — shunda
      // "Boburshox" deb yozib, darhol kerakli odamni bosish mumkin.
      for (const v of mosMijoz ? m.contacts || [] : mosVakillar) {
        rows.push({ tur: 'vakil', mijoz: m, vakil: v });
      }
    }
    return rows.slice(0, 40);
  }, [mijozlar, qidiruv]);

  const bosh: MijozTanlov = {
    customerId: '', customerName: '', customerPhone: '',
    contactId: '', contactName: '', contactPhone: '', contactRole: '',
  };

  const mijozTanla = (m: Mijoz) => {
    onChange({ ...bosh, customerId: m.id, customerName: m.name, customerPhone: m.phone || '' });
    setOchiq(false); setQidiruv(''); setVakilQoshish(false); setYangiRejim(false);
  };

  const vakilTanla = (m: Mijoz, v: Vakil) => {
    onChange({
      ...bosh,
      customerId: m.id, customerName: m.name, customerPhone: m.phone || '',
      contactId: v.id, contactName: v.name, contactPhone: v.phone || '',
      contactRole: v.role || '',
    });
    setOchiq(false); setQidiruv(''); setVakilQoshish(false); setYangiRejim(false);
  };

  const yangiTashkilot = () => {
    onChange({ ...bosh, customerName: qidiruv.trim() });
    setOchiq(false); setQidiruv('');
    setYangiRejim(true);
    // Yangi tashkilotda vakil deyarli har doim kerak — maydonlarni
    // darhol ochamiz, foydalanuvchi yana bir tugma bosmasin.
    setVakilQoshish(true);
  };

  const tozala = () => { onChange(bosh); setVakilQoshish(false); setYangiRejim(false); };

  // Yangi vakil kiritish rejimi. Faqat `vakilQoshish` bayrog'iga tayanib
  // bo'lmaydi: ism yozila boshlagach maydonlar ko'rinishi shartini buzmasligi
  // uchun yozilgan (lekin hali id'siz) vakil ham shu rejimda hisoblanadi.
  const yangiVakilRejimi = !qiymat.contactId && (vakilQoshish || !!qiymat.contactName);

  const vakilBekor = () => {
    setVakilQoshish(false);
    onChange({ ...qiymat, contactId: '', contactName: '', contactPhone: '', contactRole: '' });
  };

  // Qidiruvga AYNAN mos tashkilot bormi — bo'lsa "yangi" taklifi ortiqcha
  // (o'sha nomda ikkinchi nusxa yaratilib qolmasin).
  const aynanBor =
    !!qidiruv.trim() &&
    mijozlar.some((m) => m.name.trim().toLowerCase() === qidiruv.trim().toLowerCase());

  return (
    <div ref={idishRef} className="relative">
      {/* Yulduzcha — mijoz majburiy. Buyurtma mijozga bog'lanmasa Mijozlar
          sahifasida ham, qarz hisobida ham ko'rinmaydi. */}
      <label className="form-label px-1">
        Mijoz (tashkilot) va vakili <span className="text-red-500">*</span>
      </label>

      {!tanlangan ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setOchiq(true); }}
            className="flex-1 h-12 flex items-center gap-2 bg-white border-2 border-[color:var(--border)] rounded-lg px-3 text-left hover:border-slate-300 transition-colors"
          >
            <Search size={15} className="text-slate-400 shrink-0" />
            <span className="flex-1 text-sm text-slate-400">
              Tashkilot yoki vakil ismini yozing...
            </span>
            <ChevronDown size={15} className="text-slate-400 shrink-0" />
          </button>
          {/* Yangi tashkilot — qidiruvni ochmasdan ham ko'rinib turishi kerak.
              Avval bu imkoniyat faqat qidiruv natijalari ostida chiqardi va
              ro'yxat uzun bo'lganda ko'rinmay qolardi. */}
          <button
            type="button"
            onClick={() => { onChange(bosh); setYangiRejim(true); setVakilQoshish(true); }}
            className="h-12 px-3 shrink-0 flex items-center gap-1.5 bg-white border-2 border-dashed border-orange-300 rounded-lg text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
          >
            <Plus size={14} /> Yangi tashkilot
          </button>
        </div>
      ) : (
        // TANLANGAN HOLAT — IKKI ANIQ BO'LIM: TASHKILOT va VAKIL.
        //
        // Ilgari hammasi bitta qatorga siqilgan edi va tushunarsiz chiqardi:
        // tashkilot nomi oddiy matndek ko'rinar (uni tahrirlash mumkinligi
        // bilinmasdi), uning tagida esa "Yangi vakil — bekor qilish" degan
        // qator turardi — bu xabarmi, tugmami, nimani bekor qiladi, ayon
        // emasdi. Maydonlar faqat placeholder bilan belgilangani uchun
        // to'ldirilgach nima ekani ham yo'qolardi: amalda vakil TELEFONI
        // maydoniga "Menejer" deb lavozim yozib yuborilgan.
        //
        // Endi har maydonning tepasida doimiy yorlig'i bor va ikki bo'lim
        // chiziq bilan ajratilgan.
        <div className="w-full bg-white border-2 border-[color:var(--border)] rounded-lg overflow-hidden">
          {/* ————— 1. TASHKILOT ————— */}
          <div className="px-3 pt-2.5 pb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 size={11} /> Tashkilot
                {!qiymat.customerId && (
                  <span className="text-[9px] text-orange-600 bg-orange-50 border border-orange-200 rounded px-1 py-0.5">
                    yangi
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { setOchiq(true); setQidiruv(''); }}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1"
                >
                  Boshqasini tanlash
                </button>
                <button type="button" onClick={tozala} title="Tozalash" className="icon-btn">
                  <X size={14} />
                </button>
              </div>
            </div>

            {qiymat.customerId ? (
              <p className="text-sm font-semibold text-slate-800 truncate">{qiymat.customerName}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Nomi</span>
                  <input
                    autoFocus={!qiymat.customerName}
                    placeholder="Masalan: KIA"
                    value={qiymat.customerName}
                    onChange={(e) => onChange({ ...qiymat, customerName: e.target.value })}
                    className="input-minimal"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Telefoni <span className="font-normal text-slate-400">— ixtiyoriy</span>
                  </span>
                  <input
                    inputMode="tel"
                    placeholder="+998 90 123 45 67"
                    value={qiymat.customerPhone}
                    onChange={(e) => onChange({ ...qiymat, customerPhone: e.target.value })}
                    className="input-minimal"
                  />
                </label>
              </div>
            )}

            {/* JISMONIY SHAXS. Bosmaxonaga buyurtmaning katta qismi tashkilotdan
                emas, odamning o'zidan keladi — soxta tashkilot nomi o'ylab
                topish shart emasligini aytib qo'yamiz. */}
            {!qiymat.customerId && !qiymat.customerName.trim() && (
              <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                Bo'sh qolsa — pastdagi vakil ismi mijoz bo'lib saqlanadi (jismoniy shaxs).
              </p>
            )}
          </div>

          {/* ————— 2. VAKIL ————— */}
          <div className="px-3 pt-2.5 pb-3 border-t border-slate-100 bg-slate-50/70">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User size={11} /> Vakil
                <span className="normal-case font-medium text-slate-400">— kim buyurtma berdi</span>
              </span>
              {(qiymat.contactId || yangiVakilRejimi) && (
                <button
                  type="button"
                  onClick={vakilBekor}
                  className="text-[11px] font-bold text-slate-400 hover:text-rose-600 px-2 py-1 shrink-0"
                >
                  Olib tashlash
                </button>
              )}
            </div>

            {qiymat.contactId ? (
              <p className="text-sm font-semibold text-slate-700 truncate">
                {qiymat.contactName}
                {qiymat.contactRole && (
                  <span className="font-medium text-slate-400"> · {qiymat.contactRole}</span>
                )}
                {qiymat.contactPhone && (
                  <span className="font-medium text-slate-400"> · {qiymat.contactPhone}</span>
                )}
              </p>
            ) : yangiVakilRejimi ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Ismi</span>
                  <input
                    autoFocus
                    placeholder="Masalan: Zafarbek"
                    value={qiymat.contactName}
                    onChange={(e) => onChange({ ...qiymat, contactId: '', contactName: e.target.value })}
                    className="input-minimal"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">Telefoni</span>
                  <input
                    inputMode="tel"
                    placeholder="+998 90 123 45 67"
                    value={qiymat.contactPhone}
                    onChange={(e) => onChange({ ...qiymat, contactPhone: e.target.value })}
                    className="input-minimal"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Lavozimi <span className="font-normal text-slate-400">— ixtiyoriy</span>
                  </span>
                  <input
                    placeholder="Masalan: Menejer"
                    value={qiymat.contactRole}
                    onChange={(e) => onChange({ ...qiymat, contactRole: e.target.value })}
                    className="input-minimal"
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Tanlangan tashkilotning mavjud vakillari — bir bosishda */}
                {(tanlanganMijoz?.contacts || []).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => vakilTanla(tanlanganMijoz!, v)}
                    className="inline-flex items-center gap-1.5 bg-white border border-[color:var(--border)] rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-orange-400 hover:text-orange-600 transition-colors"
                  >
                    <User size={11} /> {v.name}
                    {v.role && <span className="text-slate-400">· {v.role}</span>}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVakilQoshish(true)}
                  className="inline-flex items-center gap-1 bg-white border border-dashed border-orange-300 rounded-lg px-2.5 py-1 text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors"
                >
                  <Plus size={11} /> Yangi vakil
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {ochiq && (
        <div className="absolute z-[110] left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-slide-up">
          <div className="relative border-b border-slate-100">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={qidiruv}
              onChange={(e) => setQidiruv(e.target.value)}
              placeholder="Tashkilot yoki vakil ismi, telefon..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-transparent outline-none"
            />
          </div>

          {/* YANGI TASHKILOT — ro'yxatning TEPASIDA va har doim ko'rinadi.
              Pastda turganida uzun ro'yxat ostida qolib ketardi va "kompaniya
              qo'shish imkoni yo'q" degan taassurot tug'dirardi. */}
          {!aynanBor && (
            <button
              type="button"
              onClick={yangiTashkilot}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-slate-100 bg-orange-50/40 hover:bg-orange-50 transition-colors"
            >
              <Plus size={14} className="text-orange-500 shrink-0" />
              <span className="text-sm font-semibold text-orange-600 truncate">
                {qidiruv.trim()
                  ? `«${qidiruv.trim()}» nomli yangi tashkilot`
                  : 'Yangi tashkilot qo\'shish'}
              </span>
            </button>
          )}

          <div className="max-h-[260px] overflow-y-auto custom-scroll py-1">
            {natijalar.map((r, i) =>
              r.tur === 'mijoz' ? (
                <button
                  key={`m-${r.mijoz.id}-${i}`}
                  type="button"
                  onClick={() => mijozTanla(r.mijoz)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <Building2 size={14} className="text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 truncate">{r.mijoz.name}</span>
                    <span className="block text-xs text-slate-400 truncate">
                      {r.mijoz.phone || 'Telefonsiz'}
                      {(r.mijoz.contacts || []).length > 0 && ` · ${(r.mijoz.contacts || []).length} vakil`}
                    </span>
                  </span>
                </button>
              ) : (
                <button
                  key={`v-${r.vakil.id}-${i}`}
                  type="button"
                  onClick={() => vakilTanla(r.mijoz, r.vakil)}
                  className="w-full flex items-center gap-2.5 pl-8 pr-3 py-2 text-left hover:bg-orange-50/60 transition-colors"
                >
                  <User size={13} className="text-slate-400 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-700 truncate">
                      {r.vakil.name}
                      {r.vakil.role ? <span className="text-slate-400"> · {r.vakil.role}</span> : null}
                    </span>
                    <span className="block text-xs text-slate-400 truncate">
                      {r.mijoz.name}{r.vakil.phone ? ` · ${r.vakil.phone}` : ''}
                    </span>
                  </span>
                </button>
              ),
            )}

            {natijalar.length === 0 && (
              <p className="px-3 py-6 text-xs text-slate-400 text-center">
                {qidiruv.trim() ? 'Topilmadi' : "Mijoz yo'q"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MijozTanlash;
