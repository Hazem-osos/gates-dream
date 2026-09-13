'use client';

import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';

type Props = {
  label: string;
  gregorian: string;
  hijri?: string;
  onGregorianChange: (isoDate: string) => void;
  error?: string;
};

/** Single Gregorian date with the shared green Hijri caption. */
export function SecuritiesDateHijriField({
  label,
  gregorian,
  onGregorianChange,
  error,
}: Props) {
  return (
    <div>
      <DatePickerWithHijri
        label={label}
        value={gregorian}
        onChange={onGregorianChange}
        error={Boolean(error)}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
