import React from 'react';

/** Format a raw numeric string as UZS style: 300 000 */
export const formatNum = (val: string | number): string => {
  const raw = String(val).replace(/\D/g, '');
  if (!raw) return '';
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/** Strip spaces/non-digits to get raw number string */
export const parseNum = (val: string): number => {
  return parseInt(val.replace(/\s/g, ''), 10) || 0;
};

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | number;
  onChange: (raw: number, formatted: string) => void;
  allowDecimal?: boolean;
}

/**
 * A currency/number input that:
 * - Displays values with space-separated thousands (300 000)
 * - Returns the raw number on change
 * - Works with decimal values when allowDecimal=true
 */
const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  allowDecimal = false,
  className,
  placeholder = '0',
  ...rest
}) => {
  const displayValue = React.useMemo(() => {
    if (value === '' || value === undefined || value === null) return '';
    if (allowDecimal) {
      const str = String(value);
      const parts = str.split('.');
      const intPart = parts[0].replace(/\D/g, '');
      const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return parts.length > 1 ? `${formatted}.${parts[1].replace(/\D/g, '')}` : formatted;
    }
    return formatNum(String(value));
  }, [value, allowDecimal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (allowDecimal) {
      const cleaned = raw.replace(/[^\d.\s]/g, '');
      const numString = cleaned.replace(/\s/g, '');
      const num = numString === '' ? 0 : parseFloat(numString);
      onChange(num, cleaned);
    } else {
      const digitsOnly = raw.replace(/\D/g, '');
      const num = digitsOnly === '' ? 0 : parseInt(digitsOnly, 10);
      onChange(num, formatNum(digitsOnly));
    }
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

export default NumberInput;
