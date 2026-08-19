import React, { useState, useEffect } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  hasError?: boolean;
}

/**
 * Format 9 digits as "XX XXX XX XX"
 */
function formatLocalNumber(digits: string): string {
  const clean = digits.replace(/\D/g, '').slice(0, 9);
  const parts: string[] = [];

  if (clean.length > 0) parts.push(clean.slice(0, 2));
  if (clean.length > 2) parts.push(clean.slice(2, 5));
  if (clean.length > 5) parts.push(clean.slice(5, 7));
  if (clean.length > 7) parts.push(clean.slice(7, 9));

  return parts.join(' ');
}

/**
 * Extract 9 local digits from full string (+998...)
 */
function extractLocalDigits(fullVal: string): string {
  if (!fullVal) return '';
  let clean = fullVal.replace(/\D/g, '');
  if (clean.startsWith('998') && clean.length > 3) {
    clean = clean.slice(3);
  }
  return clean.slice(0, 9);
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  id,
  name,
  required = false,
  hasError = false,
}) => {
  const [displayVal, setDisplayVal] = useState(() => formatLocalNumber(extractLocalDigits(value || '')));

  useEffect(() => {
    const nextLocal = extractLocalDigits(value || '');
    const formatted = formatLocalNumber(nextLocal);
    if (formatted !== displayVal) {
      setDisplayVal(formatted);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    const formatted = formatLocalNumber(digits);
    setDisplayVal(formatted);

    // emit standard full international format "+998 90 123 45 67" or "+998901234567"
    if (digits.length === 0) {
      onChange('');
    } else {
      onChange(`+998 ${formatted}`);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const local = extractLocalDigits(pasted);
    const formatted = formatLocalNumber(local);
    setDisplayVal(formatted);
    if (local.length === 0) {
      onChange('');
    } else {
      onChange(`+998 ${formatted}`);
    }
  };

  return (
    <div
      className={`relative flex items-center w-full h-control bg-white border rounded-control transition-all duration-120 ${
        hasError
          ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
          : 'border-slate-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20'
      } ${disabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : ''} ${className}`}
    >
      <span className="pl-3 pr-1 text-slate-500 font-medium text-sm select-none border-r border-slate-200 mr-2 py-0.5">
        +998
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        required={required}
        value={displayVal}
        onChange={handleInputChange}
        onPaste={handlePaste}
        placeholder="90 123 45 67"
        className="w-full h-full bg-transparent pr-3 text-slate-900 text-sm font-normal focus:outline-none placeholder-slate-400 tabular-nums"
      />
    </div>
  );
};

export default PhoneInput;
