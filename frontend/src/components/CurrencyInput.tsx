import React, { useState } from 'react';
import NumberInput from './NumberInput';

// ─── Types ───────────────────────────────────────────────────────────────────
type Currency = 'UZS' | 'USD' | 'EUR';

interface Rates { USD: number; EUR: number; }

const DEFAULT_RATES: Rates = { USD: 12800, EUR: 13900 };
const FX_KEY = 'pf_fx_rates';

function loadRates(): Rates {
  try {
    const raw = localStorage.getItem(FX_KEY);
    if (raw) return { ...DEFAULT_RATES, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_RATES };
}

function saveRates(r: Rates) {
  try { localStorage.setItem(FX_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

function toUzs(amount: number, currency: Currency, rates: Rates): number {
  if (currency === 'UZS') return amount;
  return Math.round(amount * rates[currency]);
}

function fromUzs(uzs: number, currency: Currency, rates: Rates): number {
  if (currency === 'UZS') return uzs;
  const rate = rates[currency];
  return rate > 0 ? Math.round(uzs / rate) : 0;
}

// ─── Component ───────────────────────────────────────────────────────────────
interface CurrencyInputProps {
  /** Controlled UZS amount from parent form state */
  value: string | number;
  /** Called with the UZS equivalent whenever user changes amount or currency */
  onChange: (uzsAmount: number) => void;
  className?: string;
  placeholder?: string;
  colorClass?: string; // e.g. "text-emerald-600" for kirim, "text-rose-600" for chiqim
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  className = 'input-minimal h-12 text-lg font-bold',
  placeholder = '0',
  colorClass = 'text-slate-800',
}) => {
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [rates, setRates] = useState<Rates>(loadRates);

  const uzsValue = typeof value === 'string' ? (parseInt(value, 10) || 0) : (value || 0);

  // What to display in the input — amount in selected currency
  const displayAmount = currency === 'UZS' ? uzsValue : fromUzs(uzsValue, currency, rates);

  // UZS equivalent for the conversion hint row
  const uzsEquivalent = currency !== 'UZS' ? uzsValue : null;

  // When user types in the input
  const handleAmountChange = (raw: number) => {
    onChange(toUzs(raw, currency, rates));
  };

  // When user changes currency pill
  const handleCurrencyChange = (c: Currency) => {
    setCurrency(c);
    // Keep the existing UZS value — just re-express in new currency (parent state unchanged)
  };

  // When user edits the exchange rate inline
  const handleRateChange = (newRate: number, key: Exclude<Currency, 'UZS'>) => {
    if (newRate <= 0) return;
    const next = { ...rates, [key]: newRate };
    setRates(next);
    saveRates(next);
    // Recalculate UZS from current display amount with new rate
    onChange(Math.round(displayAmount * newRate));
  };

  const rate = currency !== 'UZS' ? rates[currency] : 1;

  return (
    <div className="space-y-2">
      {/* Amount input */}
      <NumberInput
        value={displayAmount || ''}
        onChange={handleAmountChange}
        placeholder={placeholder}
        className={`${className} ${colorClass}`}
      />

      {/* Currency selector pills */}
      <div className="flex gap-1.5">
        {(['UZS', 'USD', 'EUR'] as Currency[]).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => handleCurrencyChange(c)}
            className={`px-3.5 py-1 text-[11px] font-bold rounded-lg border transition-all ${
              currency === c
                ? c === 'UZS'
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                  : c === 'USD'
                  ? 'bg-slate-500 text-white border-slate-500 shadow-sm shadow-slate-500/20'
                  : 'bg-slate-500 text-white border-slate-500 shadow-sm shadow-slate-500/20'
                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Exchange rate row — shown only for non-UZS */}
      {currency !== 'UZS' && (
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
            1 {currency} =
          </span>
          <NumberInput
            value={rate}
            onChange={(r) => handleRateChange(r, currency)}
            placeholder="kurs"
            className="w-28 h-7 text-xs font-bold border border-slate-200 rounded-lg px-2 bg-white text-slate-700 text-center"
          />
          <span className="text-[10px] font-bold text-slate-400">UZS</span>
          {uzsEquivalent !== null && uzsEquivalent > 0 && (
            <span className="ml-auto text-xs font-bold text-emerald-600 whitespace-nowrap">
              ≈ {uzsEquivalent.toLocaleString()} UZS
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrencyInput;
