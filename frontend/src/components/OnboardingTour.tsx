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
    title: "🎉 PrintFlow'ga xush kelibsiz!",
    description: `Tabriklaymiz — siz muvaffaqiyatli ro'yxatdan o'tdingiz!<br><br>
      Endi sizga 6 ta amaliy qadamda PrintFlow'ni sozlashni ko'rsataman.
      Har qadamda men sizga aniq qayerga borishni va nima qilishni aytaman.<br><br>
      <b>Tour shu yerda turaveradi</b> — tashqariga bosishingiz uni yopmaydi.
      O'zingiz amaliy harakat qiling, men kuzatib boraman. Tayyormisiz?`,
  },

  // ===== 1. FILIAL =====
  {
    id: 'nav-filiallar',
    kind: 'nav',
    target: '[data-tour-id="nav-filiallar"]',
    title: "1️⃣ Qadam: Filiallar sahifasiga o'tamiz",
    description: `Avval filialingizni sozlaymiz.<br><br>
      👉 Chap menyudan <b>"Filiallar"</b> tugmasini bosing
      (atrofida turtinayotgan orange chiziq).`,
  },
  {
    id: 'do-filiallar',
    kind: 'manual',
    requiredTab: 'filiallar',
    rewindToId: 'nav-filiallar',
    title: "Filiallar sahifasidasiz",
    description: `Bu yerda <b>"Bosh Ofis (Asosiy)"</b> filiali avtomatik
      yaratilganini ko'rasiz.<br><br>
      Hozir sizda <b>1 ta filial</b> kifoya — agar kelajakda yangi filial
      kerak bo'lsa, <b>"+ Yangi filial"</b> tugmasi orqali qo'shishingiz mumkin.<br><br>
      Tushundingizmi? Pastdagi <b>"Davom →"</b> tugmasini bosing.`,
  },

  // ===== 2. LAVOZIM =====
  {
    id: 'nav-sozlamalar-role',
    kind: 'nav',
    target: '[data-tour-id="nav-sozlamalar"]',
    title: "2️⃣ Qadam: Lavozim yaratish",
    description: `Xodim qo'shishdan oldin lavozim (role) yaratish kerak.<br><br>
      👉 Chap menyudan <b>"Sozlamalar"</b> tugmasini bosing.`,
  },
  {
    id: 'do-lavozim',
    kind: 'manual',
    requiredTab: 'sozlamalar',
    rewindToId: 'nav-sozlamalar-role',
    title: "Lavozim qo'shing",
    description: `Hozir Sozlamalar sahifasidasiz. Quyidagilarni qiling:<br><br>
      1. <b>"Lavozimlar"</b> bo'limini toping (yuqorida tab/qism shaklida)<br>
      2. <b>"+ Yangi lavozim"</b> tugmasini bosing<br>
      3. Lavozim nomini kiriting — masalan: <b>"Operator"</b>, <b>"Menejer"</b>, <b>"Dizayner"</b><br>
      4. Bu lavozim qaysi sahifani ko'ra olishi va nima qila olishini <b>checkbox</b>'lar bilan belgilang<br>
      5. <b>"Saqlash"</b> tugmasini bosing<br><br>
      Tugatdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== 3. TO'LOV TURLARI =====
  {
    id: 'do-payment-types',
    kind: 'manual',
    requiredTab: 'sozlamalar',
    rewindToId: 'nav-sozlamalar-role',
    title: "3️⃣ Qadam: To'lov turlari",
    description: `Hozir ham Sozlamalar sahifasidasiz. Endi to'lov turlarini qo'shamiz.<br><br>
      1. <b>"To'lov turlari"</b> bo'limini toping<br>
      2. <b>"+ Yangi to'lov turi"</b> tugmasini bosing<br>
      3. Biznesingizdagi to'lov usullarini kiriting:<br>
      &nbsp;&nbsp;• <b>Naqd</b><br>
      &nbsp;&nbsp;• <b>Karta</b><br>
      &nbsp;&nbsp;• <b>Click / Payme</b><br><br>
      Bu turlar keyinchalik Kassa'da buyurtma yaratganda <b>dropdown'da paydo bo'ladi</b>.<br><br>
      Qo'shdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== 4. XIZMATLAR KATALOGI =====
  {
    id: 'nav-services',
    kind: 'nav',
    target: '[data-tour-id="nav-xizmatlar-katalog"]',
    title: '4️⃣ Qadam: Xizmatlar katalogi',
    description: `Endi mahsulot/xizmatlaringizni kiritamiz.<br><br>
      👉 Chap menyudan <b>"Xizmatlar katalogi"</b> tabini bosing
      (Operatsiya guruhida).`,
  },
  {
    id: 'do-services',
    kind: 'manual',
    requiredTab: 'xizmatlar-katalog',
    rewindToId: 'nav-services',
    title: "Yangi xizmat qo'shing",
    description: `Quyidagilarni qiling:<br><br>
      1. <b>"+ Yangi xizmat"</b> tugmasini bosing<br>
      2. Xizmat nomini kiriting — masalan: <b>"Banner Bosma"</b><br>
      3. <b>Asosiy narx</b> kiriting — masalan: <b>50000</b><br>
      4. <b>Birlik</b> tanlang — dona / m² / metr<br>
      5. Agar kerak bo'lsa <b>opsiyalar</b> qo'shing (qog'oz turi, rang, lak) —
         har biri narxga foiz qo'shadi<br>
      6. <b>"Saqlash"</b> tugmasini bosing<br><br>
      Qo'shdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== 5. XODIM =====
  {
    id: 'nav-hodimlar',
    kind: 'nav',
    target: '[data-tour-id="nav-hodimlar"]',
    title: "5️⃣ Qadam: Birinchi xodim",
    description: `Lavozim tayyor — endi xodim qo'shamiz.<br><br>
      👉 Chap menyudan <b>"Xodimlar"</b> tabini bosing.`,
  },
  {
    id: 'do-hodimlar',
    kind: 'manual',
    requiredTab: 'hodimlar',
    rewindToId: 'nav-hodimlar',
    title: "Yangi xodim qo'shing",
    description: `Quyidagilarni qiling:<br><br>
      1. <b>"+ Yangi xodim"</b> tugmasini bosing<br>
      2. <b>Ism, telefon, lavozim</b>'ni tanlang (oldin yaratgan lavozimingiz dropdown'da bor)<br>
      3. <b>"Saqlash"</b> bosing<br><br>
      Tizim avtomatik <b>login va parol</b> yaratadi — uni xodimga uzating,
      u shu ma'lumotlar bilan PrintFlow'ga kira oladi.<br><br>
      Qo'shdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== 6. KANBAN =====
  {
    id: 'nav-kanban',
    kind: 'nav',
    target: '[data-tour-id="nav-topshiriqlar"]',
    title: "6️⃣ Qadam: Kanban ustunlari",
    description: `Oxirgi qadam — buyurtma jarayonining bosqichlari.<br><br>
      👉 Chap menyudan <b>"Xizmatlar (Kanban)"</b> tabini bosing.`,
  },
  {
    id: 'do-kanban',
    kind: 'manual',
    requiredTab: 'topshiriqlar',
    rewindToId: 'nav-kanban',
    title: "Bosqichlarni yarating",
    description: `Buyurtmalar shu ustunlar bo'ylab drag-and-drop bilan harakatlanadi.<br><br>
      <b>"+ BOSQICH"</b> tugmasi orqali ustunlar qo'shing — masalan:<br>
      • <b>Yangi buyurtma</b><br>
      • <b>Dizayn</b><br>
      • <b>Bosma</b><br>
      • <b>Tayyor</b><br>
      • <b>Yetkazildi</b><br><br>
      Yaratdingizmi? <b>"Davom →"</b> bosing.`,
  },

  // ===== DONE =====
  {
    id: 'done',
    kind: 'done',
    title: '✅ Tabriklaymiz — sozlash tugadi!',
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

export function OnboardingTour({ tenantId, activeTab, onComplete }: Props) {
  const [stepId, setStepId] = useState<string>(() => {
    return localStorage.getItem(STEP_KEY(tenantId)) || 'welcome';
  });
  const [confirmClose, setConfirmClose] = useState(false);

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

  // Nav qadami: target bosilganda avtomatik advance
  useEffect(() => {
    if (!current || current.kind !== 'nav' || !current.target) return;
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) return;

    const onClick = () => {
      setTimeout(() => advance(), 400);
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, activeTab]);

  // Target atrofida ring qo'shish/olib tashlash
  useEffect(() => {
    if (!current?.target) return;
    if (current.kind === 'welcome' || current.kind === 'done') return;
    const el = document.querySelector(current.target) as HTMLElement | null;
    if (!el) return;
    el.classList.add('pf-tour-target');
    return () => el.classList.remove('pf-tour-target');
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
      <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
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
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md shadow-orange-500/30 transition"
              >
                Boshlash →
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-md shadow-orange-500/30 transition"
              >
                Tugatish 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------- Action qadamlar — bottom-right floating card --------------------
  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-[9999] w-[380px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        style={{ animation: 'pf-tour-slide-in 0.3s ease-out' }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-300"
            style={{ width: `${(currentActionIndex / totalActionSteps) * 100}%` }}
          />
        </div>

        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
              Qadam {currentActionIndex} / {totalActionSteps}
            </span>
            <button
              onClick={() => setConfirmClose(true)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-widest transition"
            >
              Yopish
            </button>
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 leading-snug">
            {current.title}
          </h3>
          <div
            className="text-[13px] text-slate-600 leading-relaxed"
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
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg shadow-md shadow-orange-500/30 transition"
            >
              Davom →
            </button>
          )}
          {current.kind === 'nav' && (
            <span className="text-[11px] font-bold text-orange-500 italic">
              ☝️ Orange chiziq ichidagi tugmani bosing
            </span>
          )}
        </div>
      </div>

      {/* Close confirmation modal */}
      {confirmClose && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmClose(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
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
