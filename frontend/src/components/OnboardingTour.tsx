import { useEffect, useState, useMemo } from 'react';

// =============================================
// OnboardingTour — to'liq custom (driver.js'siz).
//
// Asosiy xususiyatlar:
//  - Welcome va Done — markaziy modal (overlay bilan)
//  - Action qadamlar — overlay YO'Q, faqat target element atrofida orange ring + bottom-right kichik card
//  - Tashqariga bosish tour'ni yopmaydi — faqat "Yopish" tugmasi (tasdiqlash bilan)
//  - LocalStorage'da current step saqlanadi — refresh'dan keyin davom etadi
//  - Auto-rewind — agar qadam requiredTab ko'rsatsa va foydalanuvchi boshqa joyda bo'lsa,
//    rewindToId qadamiga qaytariladi ("u yerga qayting" deb ko'rsatadi)
// =============================================

const TOUR_KEY = (t: string) => `pf_tour_${t}`;
const STEP_KEY = (t: string) => `pf_tour_step_${t}`;

export function isTourComplete(t: string | undefined): boolean {
  if (!t) return true;
  return localStorage.getItem(TOUR_KEY(t)) === '1';
}

export function markTourComplete(t: string): void {
  localStorage.setItem(TOUR_KEY(t), '1');
  localStorage.removeItem(STEP_KEY(t));
}

type StepKind = 'welcome' | 'done' | 'nav' | 'manual';

type Step = {
  id: string;
  kind: StepKind;
  /** CSS selector — element atrofida orange ring chiqaradi va shu element bosilsa tour avtomatik o'tadi */
  target?: string;
  /** Foydalanuvchi qaysi tab'da turishi kerak. Boshqa joyda bo'lsa rewind ishlaydi */
  requiredTab?: string;
  /** requiredTab mos kelmasa shu qadamga qaytariladi */
  rewindToId?: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    id: 'welcome',
    kind: 'welcome',
    title: "PrintFlow'ga xush kelibsiz!",
    description: `Tabriklaymiz — siz muvaffaqiyatli ro'yxatdan o'tdingiz!<br><br>
      Endi sizga 6 ta amaliy qadamda PrintFlow'ni sozlashni ko'rsataman.
      Har qadamda men sizga aniq qayerga borishni va nima qilishni aytaman.<br><br>
      <b>Tour shu yerda turaveradi</b> — tashqariga bosishingiz uni yopmaydi.
      O'zingiz amaliy harakat qiling, men kuzatib boraman. Tayyormisiz?`,
  },

  // ===== 1. FILIAL (Ma'muriyat → Filiallar sub-tab) =====
  {
    id: 'nav-admins',
    kind: 'nav',
    target: '[data-tour-id="nav-admins"]',
    title: "1️⃣ Qadam: Ma'muriyat sahifasiga o'tamiz",
    description: `Avval filialingizni sozlaymiz. Filiallar Ma'muriyat sahifasi ichida joylashgan.<br><br>
Chap menyudan <b>"Ma'muriyat"</b> tugmasini bosing
      (atrofida turtinayotgan orange chiziq).`,
  },
  {
    id: 'tab-filiallar',
    kind: 'nav',
    target: '[data-tour-id="admin-tab-branches"]',
    requiredTab: 'admins',
    rewindToId: 'nav-admins',
    title: "Endi 'Filiallar' tabini oching",
    description: `Yuqorida ikkita tab bor: <b>"Ma'murlar"</b> va <b>"Filiallar"</b>.<br><br>
<b>"Filiallar"</b> tabini bosing (atrofida orange chiziq turtinmoqda).`,
  },
  {
    id: 'do-filiallar',
    kind: 'manual',
    target: '[data-tour-id="filial-add"]',
    requiredTab: 'admins',
    rewindToId: 'tab-filiallar',
    title: "Filiallar tabidasiz",
    description: `Bu yerda <b>asosiy filialingiz</b> avtomatik yaratilganini ko'rasiz.<br><br>
      Yangi filial qo'shish kerak bo'lsa, orange ring atrofidagi <b>"+ Yangi filial"</b> tugmasini bosing.<br><br>
      Hozir 1 ta filial kifoya — <b>"Davom →"</b> bosing.`,
  },

  // ===== 2. SOZLAMALAR (one long page — Lavozim, To'lov turlari, Xizmatlar Katalogi) =====
  {
    id: 'nav-sozlamalar',
    kind: 'nav',
    target: '[data-tour-id="nav-sozlamalar"]',
    title: "2️⃣ Qadam: Sozlamalar sahifasiga o'tamiz",
    description: `Endi Sozlamalar'da uchta narsa qilamiz: lavozim, to'lov turi va xizmat qo'shamiz.<br><br>
Chap menyudan <b>"Tizim Sozlamalari"</b> tugmasini bosing.`,
  },
  {
    id: 'do-lavozim',
    kind: 'manual',
    target: '[data-tour-id="lavozim-add"]',
    requiredTab: 'sozlamalar',
    rewindToId: 'nav-sozlamalar',
    title: "Lavozim qo'shing",
    description: `Yuqorida <b>Lavozimlar & Ruxsatlar</b> bo'limi. Orange ring'dagi
      <b>"+ Yangi Lavozim"</b> tugmasini bosing — modal ochiladi:<br><br>
      • Lavozim nomi: <b>"Operator"</b> / <b>"Menejer"</b> / <b>"Dizayner"</b><br>
      • Ruxsatlarni checkbox'lar bilan belgilang<br>
      • <b>"Saqlash"</b> bosing<br><br>
      Yaratdingizmi? <b>"Davom →"</b> bosing.`,
  },
  {
    id: 'do-payment-types',
    kind: 'manual',
    target: '[data-tour-id="payment-type-form"]',
    requiredTab: 'sozlamalar',
    rewindToId: 'nav-sozlamalar',
    title: "3️⃣ To'lov turlari",
    description: `Pastga aylantiring — <b>To'lov turlari</b> bo'limini toping.
      Orange ring ichida katta input va <b>QO'SHISH</b> tugmasi bor.<br><br>
      Input'ga nom yozib (masalan: <b>Naqd</b>, <b>Karta</b>, <b>Click</b>),
      <b>QO'SHISH</b> bosing — avtomatik qo'shiladi. Bir nechta usul qo'shing.<br><br>
      Bu turlar Kassa'da buyurtma yaratganda dropdown'da chiqadi.<br><br>
      Tugatdingizmi? <b>"Davom →"</b> bosing.`,
  },
  {
    id: 'do-services',
    kind: 'manual',
    target: '[data-tour-id="xizmat-add"]',
    requiredTab: 'sozlamalar',
    rewindToId: 'nav-sozlamalar',
    title: "4️⃣ Xizmatlar katalogi",
    description: `Yana pastroqqa aylantiring — <b>Xizmatlar Katalogi</b> bo'limi.
      Orange ring'dagi <b>"+ Yangi Xizmat"</b> tugmasini bosing — modal ochiladi:<br><br>
      • Nomi: <b>"Banner Bosma"</b><br>
      • Asosiy narx: <b>50000</b><br>
      • Birlik: dona / m² / metr<br>
      • (Ixtiyoriy) opsiyalar: qog'oz turi, rang, lak<br>
      • <b>"Saqlash"</b> bosing<br><br>
      Qo'shdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== 5. XODIM =====
  {
    id: 'nav-hodimlar',
    kind: 'nav',
    target: '[data-tour-id="nav-hodimlar"]',
    title: "5️⃣ Qadam: Birinchi xodim",
    description: `Lavozim tayyor — endi xodim qo'shamiz.<br><br>
Chap menyudan <b>"Xodimlar"</b> tugmasini bosing.`,
  },
  {
    id: 'do-hodimlar',
    kind: 'manual',
    target: '[data-tour-id="hodim-add"]',
    requiredTab: 'hodimlar',
    rewindToId: 'nav-hodimlar',
    title: "Yangi xodim qo'shing",
    description: `Orange ring'dagi <b>"Yangi Xodim"</b> tugmasini bosing — modal ochiladi:<br><br>
      • Ism, telefon, lavozim (oldin yaratgan lavozimingiz dropdown'da bor)<br>
      • <b>"Saqlash"</b> bosing<br><br>
      Tizim avtomatik <b>login va parol</b> yaratadi — xodimga uzating, u shu ma'lumotlar bilan kira oladi.<br><br>
      Qo'shdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== 6. KANBAN =====
  {
    id: 'nav-kanban',
    kind: 'nav',
    target: '[data-tour-id="nav-topshiriqlar"]',
    title: "6️⃣ Qadam: Kanban bosqichlari",
    description: `Oxirgi qadam — buyurtma jarayonining bosqichlari.<br><br>
Chap menyudan <b>"Xizmatlar (Kanban)"</b> tugmasini bosing.`,
  },
  {
    id: 'do-kanban',
    kind: 'manual',
    target: '[data-tour-id="kanban-add-column"]',
    requiredTab: 'topshiriqlar',
    rewindToId: 'nav-kanban',
    title: "Bosqichlarni yarating",
    description: `Yuqorida orange ring'dagi <b>+ BOSQICH</b> tugmasini bir necha marta bosing —
      har bosishda yangi ustun qo'shiladi:<br><br>
      • <b>Yangi buyurtma</b><br>
      • <b>Dizayn</b> → <b>Bosma</b> → <b>Tayyor</b> → <b>Yetkazildi</b><br><br>
      Buyurtmalar shu ustunlar bo'ylab drag-and-drop bilan harakatlanadi.<br><br>
      Yaratdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== DONE =====
  {
    id: 'done',
    kind: 'done',
    title: 'Tabriklaymiz — sozlash tugadi!',
    description: `Asosiy sozlamalar tugadi. Endi biznesingizni boshqarish mumkin:<br><br>
      • <b>Kassa</b>'da kirim/chiqimlarni yozing<br>
      • <b>Mijozlar</b>'da kontaktlar saqlang<br>
      • <b>Hisobotlar</b>'da KPI tahlilini ko'ring<br>
      • <b>Ctrl + K</b> — tezkor qidiruv<br><br>
      Bu qo'llanmani <b>"Qo'llanma"</b> sahifasidan istalgan vaqtda
      qaytadan ishga tushira olasiz.`,
  },
];

// CSS injection — bir marta
const STYLE_ID = 'pf-tour-styles';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    /* Ring atrofida pulse */
    .pf-tour-target {
      position: relative;
      z-index: 50;
      outline: 3px solid #f97316;
      outline-offset: 4px;
      border-radius: 12px;
      animation: pf-tour-pulse 1.6s ease-in-out infinite;
      transition: outline 0.2s;
    }
    @keyframes pf-tour-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55); }
      50%      { box-shadow: 0 0 0 12px rgba(249, 115, 22, 0); }
    }
    /* Floating card animation */
    @keyframes pf-tour-slide-in {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(s);
}

interface Props {
  tenantId: string;
  activeTab: string;
  onComplete: () => void;
}

// Tooltip o'lchamlari — pozitsiya hisoblash uchun
const TOOLTIP_W = 360;
const TOOLTIP_H = 240;
const GAP = 16;

// Target elementning yonida bo'sh joy topib, tooltip joylashtiradi.
// Tartib: o'ng → chap → past → tepa. Below/above tushganda target markaziga to'g'rilaymiz.
function computeTooltipPos(target: HTMLElement): { top: number; left: number } {
  const r = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
  const centeredLeft = clamp(r.left + r.width / 2 - TOOLTIP_W / 2, GAP, vw - TOOLTIP_W - GAP);

  // Right
  if (r.right + GAP + TOOLTIP_W <= vw - GAP) {
    return { top: clamp(r.top, GAP, vh - TOOLTIP_H - GAP), left: r.right + GAP };
  }
  // Left
  if (r.left - GAP - TOOLTIP_W >= GAP) {
    return { top: clamp(r.top, GAP, vh - TOOLTIP_H - GAP), left: r.left - GAP - TOOLTIP_W };
  }
  // Below — keng target'lar uchun gorizontal markazga to'g'rilaymiz
  if (r.bottom + GAP + TOOLTIP_H <= vh - GAP) {
    return { top: r.bottom + GAP, left: centeredLeft };
  }
  // Above
  return { top: Math.max(GAP, r.top - TOOLTIP_H - GAP), left: centeredLeft };
}

export function OnboardingTour({ tenantId, activeTab, onComplete }: Props) {
  const [stepId, setStepId] = useState<string>(() => {
    return localStorage.getItem(STEP_KEY(tenantId)) || 'welcome';
  });
  const [confirmClose, setConfirmClose] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  const current = useMemo(() => STEPS.find((s) => s.id === stepId), [stepId]);
  const stepIndex = useMemo(() => STEPS.findIndex((s) => s.id === stepId), [stepId]);
  const totalActionSteps = STEPS.filter((s) => s.kind !== 'welcome' && s.kind !== 'done').length;
  const currentActionIndex = STEPS.slice(0, stepIndex + 1).filter(
    (s) => s.kind !== 'welcome' && s.kind !== 'done',
  ).length;

  useEffect(() => {
    injectStyles();
  }, []);

  // Step holatini saqlash
  useEffect(() => {
    localStorage.setItem(STEP_KEY(tenantId), stepId);
  }, [stepId, tenantId]);

  // Auto-rewind: agar qadam requiredTab so'rasa va activeTab mos kelmasa, rewind
  useEffect(() => {
    if (!current?.requiredTab || !current?.rewindToId) return;
    if (current.requiredTab !== activeTab) {
      setStepId(current.rewindToId);
    }
  }, [activeTab, current]);

  // Sidebar nav-item → uning kollapsiruvchi parent guruhi.
  // Dashboard.tsx navGroups labellariga mos (lowercase).
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

  // Agar target sidebar nav-item bo'lsa va uning parent guruhi yopiq bo'lsa,
  // headerni dasturiy bosib ochamiz. Aks holda element DOM'da bo'lmaydi va
  // tour orange ring chiqara olmaydi (driver.js'siz custom implementation).
  function ensureParentGroupOpen(selector: string) {
    const m = selector.match(/nav-([a-z-]+)/);
    if (!m) return;
    const parent = NAV_PARENT_GROUP[m[1]];
    if (!parent) return;
    const header = document.querySelector(
      `[data-tour-group="${parent}"]`,
    ) as HTMLElement | null;
    if (header && header.getAttribute('data-tour-open') === '0') {
      header.click();
    }
  }

  // Target elementni topish — lazy-rendered saxifalar uchun polling.
  // Admins.tsx React.lazy bilan yuklanadi, shuning uchun click'dan keyin
  // darhol querySelector qaytaradi null. ~3 soniya davomida kutamiz.
  function waitForTarget(selector: string, timeoutMs = 3000): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) return resolve(el);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // Nav qadami: target bosilganda avtomatik advance + ring + tooltip pozitsiya
  useEffect(() => {
    if (!current?.target) { setTooltipPos(null); return; }
    if (current.kind === 'welcome' || current.kind === 'done') return;

    let el: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;
    let cancelled = false;

    // Sidebar nav-* target bo'lsa, parent guruhini ochib qo'yamiz —
    // aks holda element render qilinmaydi va target topilmaydi.
    ensureParentGroupOpen(current.target);

    waitForTarget(current.target).then((found) => {
      if (cancelled || !found) return;
      el = found;
      el.classList.add('pf-tour-target');
      // Instant scroll + center — smooth + 'nearest' eski rect bilan pozitsiya
      // hisoblanishiga olib kelardi, target tooltipni qoplab qo'yardi.
      el.scrollIntoView({ block: 'center', behavior: 'auto' });

      const update = () => el && setTooltipPos(computeTooltipPos(el));
      // Skrol tugagach (2 ta rAF kifoya) qayta hisoblaymiz — rect aniq joyida bo'ladi.
      requestAnimationFrame(() => requestAnimationFrame(update));
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);

      const onClick = () => { setTimeout(() => advance(), 400); };
      if (current.kind === 'nav') el.addEventListener('click', onClick);

      cleanup = () => {
        el?.classList.remove('pf-tour-target');
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
        if (current.kind === 'nav') el?.removeEventListener('click', onClick);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, activeTab]);

  function advance() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    if (idx >= STEPS.length - 1) {
      finish();
      return;
    }
    setStepId(STEPS[idx + 1].id);
  }

  function back() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx > 0) setStepId(STEPS[idx - 1].id);
  }

  function finish() {
    markTourComplete(tenantId);
    onComplete();
  }

  if (!current) return null;

  // -------------------- Welcome & Done — markaziy modal --------------------
  if (current.kind === 'welcome' || current.kind === 'done') {
    return (
      <div className="fixed inset-0 z-tour bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          className="bg-white rounded-overlay shadow-2xl max-w-lg w-full overflow-hidden animate-slide-up"
          style={{ animation: 'pf-tour-slide-in 0.3s ease-out' }}
        >
          <div className="px-7 pt-7 pb-5">
            <h2 className="text-xl font-bold text-slate-900 mb-3 leading-tight">
              {current.title}
            </h2>
            <div
              className="text-sm text-slate-600 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: current.description }}
            />
          </div>
          <div className="px-7 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            {current.kind === 'welcome' ? (
              <button
                onClick={advance}
                className="btn-primary"
              >
                Boshlash →
              </button>
            ) : (
              <button
                onClick={finish}
                className="btn-primary"
              >
                Tugatish
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------- Action qadamlar — target yonidagi floating card --------------------
  // Agar target topilmasa (yoki hali rect hisoblanmagan) — o'ng yon, vertikal markazda.
  const pos = tooltipPos ?? {
    top: Math.max(GAP, (window.innerHeight - TOOLTIP_H) / 2),
    left: window.innerWidth - TOOLTIP_W - GAP,
  };
  return (
    <>
      <div
        className="fixed z-tour bg-white rounded-overlay shadow-2xl border border-slate-200 overflow-hidden"
        style={{
          top: pos.top,
          left: pos.left,
          width: TOOLTIP_W,
          maxWidth: `calc(100vw - ${GAP * 2}px)`,
          animation: 'pf-tour-slide-in 0.3s ease-out',
        }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-500 transition-all duration-300"
            style={{ width: `${(currentActionIndex / totalActionSteps) * 100}%` }}
          />
        </div>

        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps text-primary-700">
              Qadam {currentActionIndex} / {totalActionSteps}
            </span>
            <button
              onClick={() => setConfirmClose(true)}
              className="btn-ghost h-sm"
            >
              Yopish
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 leading-snug">
            {current.title}
          </h3>
          <div
            className="text-sm text-slate-600 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: current.description }}
          />
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={back}
            disabled={stepIndex <= 1}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:text-slate-300 disabled:cursor-not-allowed transition"
          >
            ← Orqaga
          </button>
          {current.kind === 'manual' && (
            <button
              onClick={advance}
              className="btn-primary h-sm"
            >
              Davom →
            </button>
          )}
          {current.kind === 'nav' && (
            <span className="text-xs font-bold text-primary-500 italic">
              Orange chiziq ichidagi tugmani bosing
            </span>
          )}
        </div>
      </div>

      {/* Close confirmation modal */}
      {confirmClose && (
        <div
          className="fixed inset-0 z-tour bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmClose(false)}
        >
          <div
            className="bg-white rounded-overlay shadow-2xl max-w-md w-full p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Qo'llanmani yopmoqchimisiz?
            </h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Tour to'xtatiladi. Keyinroq <b>"Qo'llanma"</b> sahifasidan
              qaytadan ishga tushira olasiz.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmClose(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Davom etish
              </button>
              <button
                onClick={() => {
                  setConfirmClose(false);
                  finish();
                }}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition"
              >
                Ha, yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
