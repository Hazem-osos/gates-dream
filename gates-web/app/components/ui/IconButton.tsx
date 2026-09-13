'use client';

import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gatesFocusRing } from './design-tokens';

export type IconButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: IconButtonVariant;
  isLoading?: boolean;
  size?: 'sm' | 'md';
}

const variantClasses: Record<IconButtonVariant, string> = {
  primary: 'bg-[#0E78AA] text-white hover:bg-[#094C6B]',
  secondary: 'bg-white text-[#094C6B] border border-[#D6EAF3] hover:bg-[#F6FBFD]',
  danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  ghost: 'text-[#094C6B] hover:bg-[#F0F7FB]',
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  isLoading,
  size = 'md',
  className,
  disabled,
  ...props
}: IconButtonProps) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        gatesFocusRing,
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        dim,
        className
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
