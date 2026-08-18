import React, { useState } from 'react';
import { Sparkles, X, ChevronLeft, ChevronRight, ArrowUpRight, Check } from 'lucide-react';
import { LATEST_RELEASE, markReleaseSeen, ReleaseItem } from '../data/releases';

// =============================================
// YANGILANISH E'LONI
//
// Ikki qismdan iborat:
//   1. Banner — "yangilanish hali ko'rilmagan" ogohlantirishi (sahifa tepasida)
//   2. Tour — bosqichma-bosqich "nima o'zgardi" oynasi
//
// Onboarding tour bilan bir xil andoza: localStorage'da tenant bo'yicha
// oxirgi ko'rilgan reliz saqlanadi, shuning uchun ko'rib bo'lgandan keyin
// boshqa bezovta qilmaydi.
// =============================================

export const ReleaseBanner: React.FC<{ onOpen: () => void; onDismiss: () => void }> = ({
  onOpen,
  onDismiss,
}) => (
  <div className="bg-white border border-primary-200 rounded-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
    <div className="w-9 h-9 rounded-control bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center flex-shrink-0">
      <Sparkles size={17} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900">
        {LATEST_RELEASE.date}dagi yangilanishni hali ko'rmadingiz
      </p>
      <p className="text-xs text-slate-500 mt-0.5">
        {LATEST_RELEASE.title} — {LATEST_RELEASE.items.length} ta yangilik qo'shildi
      </p>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={onDismiss}
        className="btn-ghost h-sm"
      >
        Keyinroq
      </button>
      <button
        onClick={onOpen}
        className="btn-primary h-sm"
      >
        Nima o'zgardi
      </button>
    </div>
  </div>
);

export const ReleaseTour: React.FC<{
  tenantId: string;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}> = ({ tenantId, onClose, onNavigate }) => {
  const [step, setStep] = useState(0);
  const items: ReleaseItem[] = LATEST_RELEASE.items;
  const last = step === items.length - 1;
  const item = items[step];

  const finish = () => {
    markReleaseSeen(tenantId, LATEST_RELEASE.version);
    onClose();
  };

  const goTo = (tab: string) => {
    markReleaseSeen(tenantId, LATEST_RELEASE.version);
    onNavigate(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-overlay shadow-2xl overflow-hidden animate-pop">
        {/* Sarlavha */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-control bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center flex-shrink-0">
            <Sparkles size={19} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="label-caps text-primary-700">
              Yangilanish · {LATEST_RELEASE.date}
            </p>
            <h3 className="t-h2">
              {LATEST_RELEASE.title}
            </h3>
          </div>
          <button
            onClick={finish}
            className="icon-btn-sm flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Qadam mazmuni */}
        <div className="px-6 py-6 min-h-[190px]">
          <p className="label-caps mb-2">
            {step + 1} / {items.length}
          </p>
          <h4 className="t-h1 mb-2">{item.title}</h4>
          <p className="t-body leading-relaxed">{item.text}</p>

          {item.tab && (
            <button
              onClick={() => goTo(item.tab!)}
              className="btn-outline h-sm mt-4"
            >
              {item.cta || 'Ochish'} <ArrowUpRight size={13} />
            </button>
          )}
        </div>

        {/* Navigatsiya */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`${i + 1}-qadam`}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-5 bg-[color:var(--primary)]' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="icon-btn disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            {last ? (
              <button
                onClick={finish}
                className="btn-primary h-sm"
              >
                <Check size={13} /> Tushunarli
              </button>
            ) : (
              <button
                onClick={() => setStep(s => Math.min(items.length - 1, s + 1))}
                className="btn-primary h-sm"
              >
                Keyingisi <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
