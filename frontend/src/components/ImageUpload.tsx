import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { resizeImage } from '../utils/resizeImage';

// =============================================
// ImageUpload — kichik thumbnail file picker.
// Fayl tanlangach canvas orqali ~600px JPEG'ga ixchamlanadi va
// base64 data URL sifatida onChange'ga uzatiladi (DB'da @db.Text).
// =============================================

interface Props {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  /** Thumbnail balandligi/eni. Default: 'md' (96px). */
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZES = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
};

export function ImageUpload({ value, onChange, size = 'md', label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    // 10MB asl chegara — odatda telefon kamerasi 3–5MB. Buni kompressiyadan oldin tekshirish.
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Rasm juda katta (max 10 MB)');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, { maxSize: 600, quality: 0.82 });
      onChange(dataUrl);
    } catch (e: any) {
      toast.error(e?.message || 'Rasmni qayta ishlashda xatolik');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={`${SIZES[size]} relative rounded-xl border-2 border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 flex items-center justify-center overflow-hidden transition-colors group flex-shrink-0`}
        >
          {busy ? (
            <Loader2 size={20} className="text-orange-500 animate-spin" />
          ) : value ? (
            <>
              <img src={value} alt="" className="w-full h-full object-cover" />
              <div
                onClick={handleRemove}
                role="button"
                tabIndex={0}
                className="absolute top-1 right-1 w-6 h-6 rounded-md bg-rose-500 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <Trash2 size={12} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ImagePlus size={20} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Rasm</span>
            </div>
          )}
        </button>

        {!value && !busy && (
          <p className="text-xs text-slate-400 font-medium flex-1 leading-tight">
            JPG / PNG, ~600px gacha avtomat<br />
            ixchamlanadi
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
