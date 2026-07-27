// =============================================
// PLATFORMA YANGILANISHLARI
//
// Har relizda nima o'zgargani shu yerda yoziladi. Foydalanuvchi hali
// ko'rmagan reliz bo'lsa, tizimda ogohlantirish chiqadi va u "tour"
// ko'rinishida bosqichma-bosqich o'qib chiqadi.
//
// Yangi reliz qo'shish: massiv BOSHIGA yangi obyekt qo'shiladi (eng yangisi
// birinchi turadi). `version` — solishtirish uchun, shuning uchun sana
// formatida (YYYY.MM.DD) bo'lishi shart, aks holda tartib buziladi.
// =============================================

export interface ReleaseItem {
  /** Qisqa sarlavha */
  title: string;
  /** Nima o'zgargani — 1-2 jumla, oddiy tilda */
  text: string;
  /** Qaysi bo'limda ko'rish mumkin — tugma shu tabga olib boradi */
  tab?: string;
  /** Tugma matni (tab berilganda) */
  cta?: string;
}

export interface Release {
  version: string; // YYYY.MM.DD
  date: string; // odam o'qiydigan sana
  title: string;
  items: ReleaseItem[];
}

export const RELEASES: Release[] = [
  {
    version: '2026.07.25',
    date: '25-iyul, 2026',
    title: 'AI nazorati va avtomatik maosh',
    items: [
      {
        title: 'Dashboard — hammasi bir ekranda',
        text: "Moliya, buyurtmalar, davomat, qarzdorlar, ombor, hamkorlar va xodimlar bo'yicha kartalar hamda grafiklar bir joyga yig'ildi. Qaysi kartalar ko'rinishini o'zingiz tanlaysiz.",
        tab: 'boshsahifa',
        cta: 'Dashboard ni ochish',
      },
      {
        title: 'AI butun tizimni kuzatib turadi',
        text: "AI modullarni o'zaro solishtiradi va alohida qaraganda ko'rinmaydigan muammolarni topadi: muddati o'tgan buyurtmalar, bo'sh ofis, qimirlamay qolgan ishlar, eskirgan qarzlar, tugab qolgan material. Ogohlantirishlar Dashboard'ning eng yuqorisida karta bo'lib chiqadi.",
        tab: 'boshsahifa',
        cta: 'Xavflarni ko\'rish',
      },
      {
        title: 'Maosh endi avtomatik hisoblanadi',
        text: "Har lavozim uchun oylik qanday hisoblanishini bir marta belgilaysiz — fiksa, KPI va jarima. Fiksaning o'zi shartli qismlardan iborat bo'lishi mumkin (to'liq davomatga, vaqtida kelishga). Keyin har oy o'zi hisoblanadi, siz faqat tekshirib to'laysiz.",
        tab: 'hodimlar',
        cta: 'Maosh sxemasini ochish',
      },
      {
        title: 'AI yordamchi sahifa ichida',
        text: "Chat endi sahifa ustiga chiqmaydi — o'ng tomonda ochiladi va kontent bilan bir chiziqda turadi. Ishlab turib ochiq qoldirsangiz ham xalaqit bermaydi.",
      },
      {
        title: "AI savollarga qo'llanmadan javob beradi",
        text: "\"Xodimni qayerdan qo'shaman?\" kabi savollarga javob bir zumda keladi va so'rov limitingizdan hisoblanmaydi. Takrorlangan savollar ham bepul.",
      },
      {
        title: 'Xodimni tahrirlash',
        text: "Xodimlar sahifasida qatordagi qalam tugmasi orqali ism, telefon, lavozim, filial va maoshni o'zgartirasiz.",
        tab: 'hodimlar',
        cta: 'Xodimlarni ochish',
      },
      {
        title: 'Narxlar ro\'yxatida qidiruv',
        text: "Buyurtma taklifini tuzayotganda mahsulot nomini yozib tez topasiz — opsiya qiymatlari ichidan ham qidiradi.",
      },
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];

const SEEN_KEY = (tenantId: string) => `pf_release_seen_${tenantId}`;

/** Foydalanuvchi oxirgi ko'rgan reliz versiyasi. */
export function getSeenRelease(tenantId?: string): string | null {
  if (!tenantId) return null;
  try {
    return localStorage.getItem(SEEN_KEY(tenantId));
  } catch {
    return null;
  }
}

export function markReleaseSeen(tenantId: string, version: string): void {
  try {
    localStorage.setItem(SEEN_KEY(tenantId), version);
  } catch {
    // localStorage yopiq bo'lsa ham ilova ishlashda davom etsin
  }
}

/**
 * Ko'rilmagan reliz bormi.
 *
 * Birinchi marta kirgan (hech narsa saqlanmagan) foydalanuvchiga ham
 * ko'rsatamiz — u yangi mijoz bo'lsa ham "tizimda nimalar bor" degan
 * qisqacha tanishtiruv bo'lib xizmat qiladi.
 */
export function hasUnseenRelease(tenantId?: string): boolean {
  if (!tenantId) return false;
  return getSeenRelease(tenantId) !== LATEST_RELEASE.version;
}
