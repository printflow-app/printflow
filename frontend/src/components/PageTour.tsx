import { useEffect, useMemo, useState } from 'react';
import { PAGE_TOURS, PageTourStep } from './pageTours';

// =============================================
// PageTour — bitta sahifaning qisqa qo'llanmasi.
//
// OnboardingTour dan farqi ataylab: u ro'yxatdan o'tgandan keyingi
// bir martalik SOZLASH oqimi (sahifalar orasida yurgizadi, qadamni
// localStorage'da eslaydi, tugagach boshqa chiqmaydi). Bu esa istalgan
// payt ochiladigan MA'LUMOTNOMA — holat saqlanmaydi, har safar boshidan
// boshlanadi va foydalanuvchini sahifadan olib chiqmaydi.
//
// DOM'da yo'q target'li qadamlar tashlab ketiladi. Sabab: tugmalar
// ruxsatga qarab ko'rinadi (`p.canAddIncome && <button…>`), ya'ni
// sotuvchiga "Chiqim tugmasini bosing" deb ko'rsatish — mavjud bo'lmagan
// joyga halqa chizish demak edi.
// =============================================

const TOOLTIP_W = 360;
const TOOLTIP_H = 240;
const GAP = 16;

const STYLE_ID = 'pf-page-tour-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .pf-page-tour-target {
      position: relative;
      z-index: 50;
      outline: 3px solid #f97316;
      outline-offset: 4px;
      border-radius: 12px;
      animation: pf-page-tour-pulse 1.6s ease-in-out infinite;
    }
    @keyframes pf-page-tour-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
      50%      { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
    }
    @keyframes pf-page-tour-in {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}

/** Target yonida bo'sh joy topadi: o'ng → chap → past → tepa. */
function computePos(target: HTMLElement): { top: number; left: number } {
  const r = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
  const centeredLeft = clamp(r.left + r.width / 2 - TOOLTIP_W / 2, GAP, vw - TOOLTIP_W - GAP);

  if (r.right + GAP + TOOLTIP_W <= vw - GAP) {
    return { top: clamp(r.top, GAP, vh - TOOLTIP_H - GAP), left: r.right + GAP };
  }
  if (r.left - GAP - TOOLTIP_W >= GAP) {
    return { top: clamp(r.top, GAP, vh - TOOLTIP_H - GAP), left: r.left - GAP - TOOLTIP_W };
  }
  if (r.bottom + GAP + TOOLTIP_H <= vh - GAP) {
    return { top: r.bottom + GAP, left: centeredLeft };
  }
  return { top: Math.max(GAP, r.top - TOOLTIP_H - GAP), left: centeredLeft };
}

// Sidebar nav-item'lari yopiladigan guruhlar ichida turadi. Guruh yopiq
// bo'lsa element DOM'da yo'q — avval uni ochib qo'yamiz, aks holda qadam
// "target topilmadi" deb tashlab ketilardi. (Dashboard.tsx navGroups.)
const NAV_PARENT_GROUP: Record<string, string> = {
  kassa: 'operatsiya',
  topshiriqlar: 'operatsiya',
  mijozlar: 'operatsiya',
  ombor: 'operatsiya',
  davomat: 'operatsiya',
  moliya: 'tahlil',
  hisobotlar: 'tahlil',
  hodimlar: 'boshqaruv',
  admins: 'boshqaruv',
  hamkorlar: 'boshqaruv',
  sozlamalar: 'boshqaruv',
};

function ensureParentGroupOpen(selector: string) {
  const m = selector.match(/nav-([a-z-]+)/);
  if (!m) return;
  const parent = NAV_PARENT_GROUP[m[1]];
  if (!parent) return;
  const header = document.querySelector(`[data-tour-group="${parent}"]`) as HTMLElement | null;
  if (header && header.getAttribute('data-tour-open') === '0') header.click();
}

interface Props {
  /** Qaysi sahifaning qo'llanmasi (Dashboard'dagi activeTab). */
  tab: string;
  onClose: () => void;
}

export function PageTour({ tab, onClose }: Props) {
  // Qadamlar ro'yxati ochilish paytida BIR MARTA filtrlanadi. Har renderda
  // qayta hisoblansa, ochilgan modal target'ni DOM'dan olib qo'yganda
  // qadamlar o'rtada siljib ketardi.
  const [steps] = useState<PageTourStep[]>(() => {
    const all = PAGE_TOURS[tab] || [];
    return all.filter((s) => {
      if (!s.target) return true;
      ensureParentGroupOpen(s.target);
      return !!document.querySelector(s.target);
    });
  });

  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const current = steps[idx];
  const oxirgi = idx >= steps.length - 1;

  useEffect(() => { injectStyles(); }, []);

  // Esc — yopadi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Target'ni yoritish va kartochkani uning yoniga qo'yish.
  useEffect(() => {
    if (!current?.target) { setPos(null); return; }
    ensureParentGroupOpen(current.target);
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) { setPos(null); return; }

    el.classList.add('pf-page-tour-target');
    // 'auto' — smooth skrol tugamasdan rect o'qilsa, kartochka target
    // ustiga tushib qolardi.
    el.scrollIntoView({ block: 'center', behavior: 'auto' });

    const update = () => setPos(computePos(el));
    requestAnimationFrame(() => requestAnimationFrame(update));
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      el.classList.remove('pf-page-tour-target');
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [current]);

  const joylashuv = useMemo(
    () => pos ?? {
      top: Math.max(GAP, (window.innerHeight - TOOLTIP_H) / 2),
      left: Math.max(GAP, window.innerWidth - TOOLTIP_W - GAP),
    },
    [pos],
  );

  if (!current) return null;

  return (
    <div
      className="fixed z-tour bg-white rounded-overlay shadow-2xl border border-slate-200 overflow-hidden"
      style={{
        top: joylashuv.top,
        left: joylashuv.left,
        width: TOOLTIP_W,
        maxWidth: `calc(100vw - ${GAP * 2}px)`,
        animation: 'pf-page-tour-in 0.25s ease-out',
      }}
    >
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-[color:var(--primary)] transition-all duration-300"
          style={{ width: `${((idx + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="label-caps text-primary-700">
            Qadam {idx + 1} / {steps.length}
          </span>
          <button
            onClick={onClose}
            className="btn-ghost h-sm"
          >
            Yopish
          </button>
        </div>
        <h3 className="text-sm font-bold text-slate-900 mb-2 leading-snug">{current.title}</h3>
        <div
          className="text-sm text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: current.description }}
        />
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:text-slate-300 disabled:cursor-not-allowed transition"
        >
          ← Orqaga
        </button>
        <button
          onClick={() => (oxirgi ? onClose() : setIdx((i) => i + 1))}
          className="btn-primary h-sm"
        >
          {oxirgi ? 'Tugatish' : 'Davom →'}
        </button>
      </div>
    </div>
  );
}

export default PageTour;
