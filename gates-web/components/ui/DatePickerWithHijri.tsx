'use client';

import { Calendar } from 'lucide-react';
import { toHijriDate } from '@/lib/hijri-date';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';

export function HijriCaption({ value }: { value?: string | null }) {
  const hijriString = value ? toHijriDate(value) : '';
  if (!hijriString) return null;
  return (
    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      <Calendar className="h-3 w-3 shrink-0" aria-hidden />
      <span>الموافق: {hijriString}</span>
    </div>
  );
}

export type DatePickerWithHijriProps = {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  name?: string;
  required?: boolean;
  className?: string;
  hideHijri?: boolean;
};

export function DatePickerWithHijri({
  value,
  onChange,
  label = 'التاريخ',
  disabled,
  error,
  name,
  required,
  className,
  hideHijri,
}: DatePickerWithHijriProps) {
  return (
    <div className="space-y-1" data-hijri-unified="1">
      {label ? (
        <label className={erpLabelClass}>
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      <input
        type="date"
        name={name}
        required={required}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`${erpInputClass} ${error ? 'border-red-400 focus:ring-red-200' : ''} ${className ?? ''}`}
      />
      {!hideHijri ? <HijriCaption value={value} /> : null}
    </div>
  );
}
