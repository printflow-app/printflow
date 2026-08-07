import React from 'react';

/**
 * Foydalanuvchi yozgan matndagi havolalarni bosiladigan qiladi.
 *
 * Matn foydalanuvchidan kelgani uchun `dangerouslySetInnerHTML` ISHLATILMAYDI —
 * matn bo'laklarga bo'linib React elementlari sifatida qaytariladi, ya'ni
 * izohga <script> yozib qo'yish bilan hech narsa qilib bo'lmaydi.
 */
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

// Havolaning oxiriga tinish belgisi yopishib qolmasin:
// "sayt: example.com/narsa." dagi nuqta manzilning bir qismi emas.
const OXIRGI_TINISH = /[.,;:!?)\]}]+$/;

const LinkliMatn: React.FC<{ matn?: string | null; className?: string }> = ({ matn, className }) => {
  if (!matn) return null;

  const bolaklar: React.ReactNode[] = [];
  let oxirgi = 0;

  for (const m of matn.matchAll(URL_RE)) {
    const boshi = m.index ?? 0;
    if (boshi > oxirgi) bolaklar.push(matn.slice(oxirgi, boshi));

    let url = m[0];
    const tinish = url.match(OXIRGI_TINISH)?.[0] || '';
    if (tinish) url = url.slice(0, -tinish.length);

    if (url) {
      bolaklar.push(
        <a
          key={`${boshi}-${url}`}
          href={url.startsWith('http') ? url : `https://${url}`}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="text-slate-600 underline underline-offset-2 hover:text-slate-800 break-all"
        >
          {url}
        </a>,
      );
    }
    if (tinish) bolaklar.push(tinish);
    oxirgi = boshi + m[0].length;
  }

  if (oxirgi < matn.length) bolaklar.push(matn.slice(oxirgi));

  return <span className={className}>{bolaklar}</span>;
};

export default LinkliMatn;
