import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Loader2, X, MapPin } from 'lucide-react';

// =============================================
// JOY TANLAGICH — mijozning xaritadagi nuqtasini belgilash.
//
// IKKI YO'L, ataylab shu tartibda:
//   1. XARITANI BOSISH (asosiy) — har doim ishlaydi.
//   2. Manzil bo'yicha qidirish (yordamchi) — Nominatim/OpenStreetMap.
//
// Nega qidiruv ASOSIY EMAS: O'zbekiston ko'chalari OSM'da to'liq emas.
// "Namangan, Uychi ko'chasi 12" ko'pincha topilmaydi yoki shahar
// markazini qaytaradi, mijozlarning bir qismi esa rasmiy manzili yo'q
// joyda ("choyxona yonida"). Shuning uchun qidiruv faqat xaritani kerakli
// tomonga OLIB BORADI — nuqtani baribir foydalanuvchi tasdiqlaydi.
//
// Nominatim qoidalari: soniyasiga 1 ta so'rov. Biz faqat tugma bosilganda
// murojaat qilamiz, ya'ni yozayotganda so'rov ketmaydi.
// =============================================

const SUKUT_MARKAZ: [number, number] = [40.9983, 71.6726]; // Namangan
const SUKUT_ZOOM = 12;

// Rasm fayllariga bog'lanmaslik uchun divIcon — sabab MijozXarita.tsx da.
const BELGI = L.divIcon({
  className: '',
  html: `<div style="
    width:24px;height:24px;border-radius:50% 50% 50% 0;
    background:#f97316;border:2px solid #fff;
    transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

type Joy = { lat: number; lng: number } | null;

const JoyTanlagich: React.FC<{
  qiymat: Joy;
  onChange: (joy: Joy) => void;
  /** Qidiruv maydoniga uzatiladigan manzil matni (mijoz formasidan). */
  manzil?: string;
  /** Xarita balandligi (px) — oynaga sig'dirish uchun sozlanadi. */
  balandlik?: number;
}> = ({ qiymat, onChange, manzil, balandlik = 260 }) => {
  const idishRef = useRef<HTMLDivElement>(null);
  const xaritaRef = useRef<L.Map | null>(null);
  const belgiRef = useRef<L.Marker | null>(null);
  // onChange har renderda yangi funksiya bo'lishi mumkin — xarita
  // effektini qayta ishga tushirmaslik uchun ref orqali o'qiymiz.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [qidirilmoqda, setQidirilmoqda] = useState(false);
  const [xato, setXato] = useState('');

  useEffect(() => {
    if (!idishRef.current || xaritaRef.current) return;
    const xarita = L.map(idishRef.current, {
      center: qiymat ? [qiymat.lat, qiymat.lng] : SUKUT_MARKAZ,
      zoom: qiymat ? 16 : SUKUT_ZOOM,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(xarita);

    xarita.on('click', (e: L.LeafletMouseEvent) => {
      onChangeRef.current({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    });

    xaritaRef.current = xarita;
    return () => {
      xarita.remove();
      xaritaRef.current = null;
      belgiRef.current = null;
    };
    // Faqat bir marta — qiymat o'zgarishi pastdagi effektda ushlanadi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Belgini qiymatga moslash. Sudrab ham surish mumkin — qidiruv noaniq
  // joyga tushirgan bo'lsa, uni qo'lda to'g'rilash shu yerda bo'ladi.
  useEffect(() => {
    const xarita = xaritaRef.current;
    if (!xarita) return;

    if (!qiymat) {
      belgiRef.current?.remove();
      belgiRef.current = null;
      return;
    }
    if (belgiRef.current) {
      belgiRef.current.setLatLng([qiymat.lat, qiymat.lng]);
    } else {
      const m = L.marker([qiymat.lat, qiymat.lng], { icon: BELGI, draggable: true });
      m.on('dragend', () => {
        const p = m.getLatLng();
        onChangeRef.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
      m.addTo(xarita);
      belgiRef.current = m;
    }
  }, [qiymat]);

  const qidir = async () => {
    const so = (manzil || '').trim();
    if (!so) { setXato('Avval manzilni yozing'); return; }
    setQidirilmoqda(true);
    setXato('');
    try {
      // countrycodes=uz — qidiruvni O'zbekiston bilan cheklaymiz, aks holda
      // "Namangan" boshqa davlatdagi o'xshash nomni qaytarishi mumkin.
      const url =
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=uz&q=' +
        encodeURIComponent(so);
      const javob = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!javob.ok) throw new Error('network');
      const natija = await javob.json();
      if (!Array.isArray(natija) || natija.length === 0) {
        setXato("Bu manzil topilmadi — xaritadan qo'lda belgilang");
        return;
      }
      const joy = { lat: +Number(natija[0].lat).toFixed(6), lng: +Number(natija[0].lon).toFixed(6) };
      onChange(joy);
      xaritaRef.current?.setView([joy.lat, joy.lng], 16);
    } catch {
      setXato("Qidiruv ishlamadi — xaritadan qo'lda belgilang");
    } finally {
      setQidirilmoqda(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={qidir}
          disabled={qidirilmoqda}
          className="btn-outline h-sm"
        >
          {qidirilmoqda ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          Manzildan topish
        </button>
        {qiymat && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="btn-danger h-sm"
          >
            <X size={13} /> Nuqtani olib tashlash
          </button>
        )}
      </div>

      {xato && <p className="text-xs font-bold text-amber-600">{xato}</p>}

      <div
        ref={idishRef}
        style={{ height: balandlik }}
        className="w-full rounded-card border border-slate-200 overflow-hidden z-0"
      />

      <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
        <MapPin size={11} className="shrink-0" />
        {qiymat
          ? `Belgilangan: ${qiymat.lat}, ${qiymat.lng} — nuqtani sudrab to'g'rilash mumkin`
          : "Mijozning joyini xaritadan bosib belgilang"}
      </p>
    </div>
  );
};

export default JoyTanlagich;
