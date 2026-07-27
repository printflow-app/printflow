// =============================================
// Dashboard'dagi "Bartaraf etish" tugmasi bilan AI chati o'rtasidagi kelishuv.
//
// Muammo: ilgari tugma bosilganda chatga foydalanuvchi nomidan tayyor jumla
// yozilardi ("...maslahat bera olasizmi, kerak bo'lsa o'zing bajar"). Bu
// noto'g'ri edi — foydalanuvchi bunday demagan, tizim uning og'ziga so'z
// solgan bo'lardi.
//
// Yechim: xavf matni shu prefiks bilan yuboriladi. Model uni odatdagidek
// o'qiydi, lekin CHAT OYNASIDA u foydalanuvchi xabari sifatida emas,
// alohida "xavf konteksti" kartasi ko'rinishida chiziladi.
// =============================================

const RISK_TAG = '[XAVF_KARTASI';

/**
 * Xavf xabarini quradi. Xavf TURI ham qo'shiladi — backend shu turga qarab
 * tayyor variantlarni beradi (modelga o'ylab topishga qo'ymaydi).
 */
export function buildRiskMessage(type: string, title: string, message: string): string {
  return `${RISK_TAG}:${type}] ${title} — ${message}`;
}

/** Xabar dashboard'dagi xavf kartasidan kelganmi? */
export function isRiskMessage(text: string): boolean {
  return text.startsWith(RISK_TAG);
}

/** Prefiksni olib tashlab, sof xavf matnini qaytaradi. */
export function stripRiskPrefix(text: string): string {
  const close = text.indexOf('] ');
  return isRiskMessage(text) && close !== -1 ? text.slice(close + 2) : text;
}
