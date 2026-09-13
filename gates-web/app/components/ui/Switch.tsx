'use client';

import { cn } from '@/lib/utils';
import { gatesFocusRing } from './design-tokens';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/** Small reusable toggle switch matching Gates ERP design tokens. */
export function Switch({ checked, onCheckedChange, label, description, disabled, className }: SwitchProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-3 py-1',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      {(label || description) && (
        <span className="flex-1 text-right">
          {label ? <span className="block text-sm font-medium text-slate-700">{label}</span> : null}
          {description ? <span className="block text-xs text-slate-400 mt-0.5">{description}</span> : null}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          checked ? 'bg-[#0E78AA] justify-start' : 'bg-slate-200 justify-end',
          gatesFocusRing
        )}
        style={{ display: 'inline-flex' }}
      >
        <span className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" />
      </button>
    </label>
  );
}
