'use client';

import { cn } from '@/lib/utils';

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Native color-picker swatch + editable hex text input, matching Gates ERP form field style. */
export function ColorField({ label, value, onChange, className }: ColorFieldProps) {
  const isValid = HEX_RE.test(value);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[#D6EAF3] shadow-sm"
          style={{ backgroundColor: isValid ? value : '#ffffff' }}
        >
          <input
            type="color"
            value={isValid ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm text-left tracking-wide',
            isValid ? 'border-[#D6EAF3]' : 'border-red-300 text-red-500'
          )}
          placeholder="#1e293b"
          maxLength={9}
        />
      </div>
    </div>
  );
}
