// =============================================
// resizeImage — File'ni canvas orqali max enga olib kelib JPEG sifatida
// base64 data URL'iga aylantiradi. Tashqi kutubxonasiz.
//
// Maqsad: foydalanuvchining 5MB telefon rasmlarini ~50–150KB JPEG'ga ixchamlash —
// DB'ga base64 saqlash maqbul bo'lishi uchun.
// =============================================

export interface ResizeOptions {
  /** Eng katta tomon (px). Aspect ratio saqlanadi. Default: 600 */
  maxSize?: number;
  /** JPEG sifat 0–1. Default: 0.82 */
  quality?: number;
  /** Output MIME — JPEG kichikroq, PNG transparency uchun. Default: 'image/jpeg' */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export async function resizeImage(
  file: File,
  options: ResizeOptions = {},
): Promise<string> {
  const { maxSize = 600, quality = 0.82, mimeType = 'image/jpeg' } = options;

  if (!file.type.startsWith('image/')) {
    throw new Error('Tanlangan fayl rasm emas');
  }

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const { width, height } = scaleToFit(img.naturalWidth, img.naturalHeight, maxSize);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas qo\'llab-quvvatlanmaydi');

  // JPEG fonni oq qilamiz — transparent PNG bo'lsa qora bo'lib qolmasligi uchun.
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL(mimeType, quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Faylni o\'qishda xatolik'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Rasm yuklab bo\'lmadi'));
    img.src = src;
  });
}

function scaleToFit(w: number, h: number, maxSize: number): { width: number; height: number } {
  if (w <= maxSize && h <= maxSize) return { width: w, height: h };
  const ratio = w > h ? maxSize / w : maxSize / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}
