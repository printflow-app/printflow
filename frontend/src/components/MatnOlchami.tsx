import React, { useEffect, useState } from 'react';
import { Minus, Plus, Type } from 'lucide-react';

// =============================================
// MATN O'LCHAMI — butun platforma bo'ylab kattalashtirish/kichraytirish.
//
// NEGA `zoom`, `font-size` EMAS:
// Odatda bunday sozlama ildizdagi `font-size` ni o'zgartirib qilinadi va
// qolgan hamma o'lcham `rem` da yoziladi. Bu loyihada esa matn o'lchamlari
// ko'p joyda piksel bilan qattiq yozilgan (`text-[13px]`, `text-[11px]`)
// — ular `rem` ga bog'liq emas. Ildiz font-size'ini o'zgartirsak, matnning
// bir qismi kattalashib, bir qismi joyida qolardi: ekran buzilardi.
// Buni to'g'rilash minglab klassni qayta yozishni talab qiladi.
//
// `zoom` esa hamma narsani (matn, tugma, oraliq) bir xil koeffitsientda
// kattalashtiradi — natija butun va bashorat qilinadigan bo'ladi.
//
// Nega `<html>` ga qo'llanadi: modal oynalar `document.body` ga portal
// qilinadi (Modal.tsx), ya'ni ichki idishga qo'yilgan zoom ularga
// yetmasdi — sahifa kattalashib, oynalar eski o'lchamda qolardi.
//
// Qiymat brauzerda saqlanadi: bu qurilma sozlamasi, hisobniki emas —
// bitta hisobga umumiy planshetdan ham, telefondan ham kiriladi.
// =============================================

const KALIT = 'pf_matn_olchami';
const DARAJALAR = [0.9, 1, 1.1, 1.25] as const;
const SUKUT_INDEKS = 1; // 100%

function oqi(): number {
  const xom = Number(localStorage.getItem(KALIT));
  const i = DARAJALAR.indexOf(xom as any);
  return i >= 0 ? i : SUKUT_INDEKS;
}

/** Saqlangan o'lchamni sahifa ochilishida qo'llaydi (App boshida chaqiriladi). */
export function matnOlchaminiTikla(): void {
  const daraja = DARAJALAR[oqi()];
  (document.documentElement.style as any).zoom = daraja === 1 ? '' : String(daraja);
}

const MatnOlchami: React.FC = () => {
  const [indeks, setIndeks] = useState<number>(oqi);

  useEffect(() => {
    const daraja = DARAJALAR[indeks];
    // 100% da xususiyatni umuman qo'ymaymiz — keraksiz zoom qatlami
    // ba'zi brauzerlarda matnni bir piksel siljitadi.
    (document.documentElement.style as any).zoom = daraja === 1 ? '' : String(daraja);
    localStorage.setItem(KALIT, String(daraja));
  }, [indeks]);

  const foiz = Math.round(DARAJALAR[indeks] * 100);

  return (
    <div className="flex items-center gap-1 bg-slate-50 border border-[color:var(--border)] rounded-lg px-1.5 py-1">
      <Type size={12} className="text-slate-400 shrink-0" />
      <button
        type="button"
        onClick={() => setIndeks(i => Math.max(0, i - 1))}
        disabled={indeks === 0}
        title="Matnni kichraytirish"
        aria-label="Matnni kichraytirish"
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus size={12} strokeWidth={2.5} />
      </button>
      <span className="text-[11px] font-semibold text-slate-500 tabular-nums w-9 text-center select-none">
        {foiz}%
      </span>
      <button
        type="button"
        onClick={() => setIndeks(i => Math.min(DARAJALAR.length - 1, i + 1))}
        disabled={indeks === DARAJALAR.length - 1}
        title="Matnni kattalashtirish"
        aria-label="Matnni kattalashtirish"
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default MatnOlchami;
