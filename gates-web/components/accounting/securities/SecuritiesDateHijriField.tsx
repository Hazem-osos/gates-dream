'use client';

import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';

type Props = {
  label: string;
  gregorian: string;
  hijri?: string;
  onGregorianChange: (isoDate: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
};

/** Single Gregorian date with the shared green Hijri caption. */
export function SecuritiesDateHijriField({
  label,
  gregorian,
  onGregorianChange,
  error,
  required,
  disabled,
  min,
}: Props) {
  return (
    <div>
      <DatePickerWithHijri
        label={label}
        value={gregorian}
        onChange={onGregorianChange}
        error={Boolean(error)}
        required={required}
        disabled={disabled}
        min={min}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
