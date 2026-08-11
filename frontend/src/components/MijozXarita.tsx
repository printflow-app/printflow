import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// =============================================
// MIJOZLAR XARITASI — barcha nuqtalar bitta ekranda.
//
// Leaflet + OpenStreetMap: API kalit ham, to'lov ham kerak emas.
//
// NIMA UCHUN divIcon:
// Leaflet'ning standart belgisi rasm fayllariga tayanadi
// (marker-icon.png, marker-shadow.png) va ularning yo'li kutubxona ichida
// qattiq yozilgan. Vite build paytida fayl nomlariga hash qo'shadi, natijada
// yo'l buziladi va xaritada belgilar UMUMAN ko'rinmaydi — bu Leaflet'ning
// eng mashhur "nega ishlamayapti" muammosi. `divIcon` sof HTML bo'lgani
// uchun hech qanday faylga bog'liq emas va rangini ham o'zimiz beramiz.
// =============================================

export type XaritaNuqta = {
  id: string;
  nom: string;
  telefon?: string | null;
  manzil?: string | null;
  lat: number;
  lng: number;
  /** Qoldiq qarz — nuqta rangi shunga qarab tanlanadi. */
  qarz?: number;
};

// Namangan markazi — nuqtasi yo'q bo'lganda xarita shu yerdan boshlanadi.
const SUKUT_MARKAZ: [number, number] = [40.9983, 71.6726];
const SUKUT_ZOOM = 12;

const belgi = (rang: string) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50% 50% 50% 0;
      background:${rang};border:2px solid #fff;
      transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });

const QARZDOR = belgi('#e11d48');
const YOPILGAN = belgi('#059669');

const fmtPul = (n: number) =>
  new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)).replace(/,/g, ' ');

/** XSS himoyasi: mijoz nomi popup HTML'iga qo'yiladi. */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

const MijozXarita: React.FC<{
  nuqtalar: XaritaNuqta[];
  /** Nuqta bosilganda — masalan mijoz kartasini ochish uchun. */
  onTanlash?: (id: string) => void;
  balandlik?: string;
}> = ({ nuqtalar, onTanlash, balandlik = '520px' }) => {
  const idishRef = useRef<HTMLDivElement>(null);
  const xaritaRef = useRef<L.Map | null>(null);
  const qatlamRef = useRef<L.LayerGroup | null>(null);

  // Xaritani BIR MARTA yaratamiz. Har renderda qayta yaratilsa,
  // foydalanuvchining zoom/surish holati yo'qolib turardi.
  useEffect(() => {
    if (!idishRef.current || xaritaRef.current) return;
    const xarita = L.map(idishRef.current, {
      center: SUKUT_MARKAZ,
      zoom: SUKUT_ZOOM,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      // Atribut — OpenStreetMap litsenziyasi talabi, olib tashlanmaydi.
      attribution: '&copy; OpenStreetMap',
    }).addTo(xarita);
    xaritaRef.current = xarita;
    qatlamRef.current = L.layerGroup().addTo(xarita);

    return () => {
      xarita.remove();
      xaritaRef.current = null;
      qatlamRef.current = null;
    };
  }, []);

  // Nuqtalar o'zgarganda faqat qatlam yangilanadi.
  useEffect(() => {
    const xarita = xaritaRef.current;
    const qatlam = qatlamRef.current;
    if (!xarita || !qatlam) return;

    qatlam.clearLayers();
    for (const n of nuqtalar) {
      const m = L.marker([n.lat, n.lng], {
        icon: (n.qarz || 0) >= 1 ? QARZDOR : YOPILGAN,
        title: n.nom,
      });
      m.bindPopup(
        `<div style="min-width:170px;font-family:inherit">
           <div style="font-weight:700;font-size:13px;color:#0f172a">${esc(n.nom)}</div>
           ${n.telefon ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${esc(n.telefon)}</div>` : ''}
           ${n.manzil ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${esc(n.manzil)}</div>` : ''}
           <div style="font-size:12px;font-weight:700;margin-top:5px;color:${(n.qarz || 0) >= 1 ? '#e11d48' : '#059669'}">
             ${(n.qarz || 0) >= 1 ? `Qarz: ${fmtPul(n.qarz || 0)} so'm` : 'Hisobi yopilgan'}
           </div>
         </div>`,
      );
      if (onTanlash) m.on('click', () => onTanlash(n.id));
      m.addTo(qatlam);
    }

    // Barcha nuqta ko'rinadigan qilib moslashtiramiz. Bitta nuqta bo'lsa
    // fitBounds cheksiz yaqinlashtirib yuboradi — shuning uchun cheklaymiz.
    if (nuqtalar.length > 0) {
      const chegara = L.latLngBounds(nuqtalar.map((n) => [n.lat, n.lng] as [number, number]));
      xarita.fitBounds(chegara, { padding: [40, 40], maxZoom: 16 });
    }
  }, [nuqtalar, onTanlash]);

  return (
    <div className="relative">
      <div
        ref={idishRef}
        style={{ height: balandlik }}
        className="w-full rounded-2xl border border-slate-200 overflow-hidden z-0"
      />
      <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" /> Qarzdor
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Yopilgan
        </span>
      </div>
    </div>
  );
};

export default MijozXarita;
