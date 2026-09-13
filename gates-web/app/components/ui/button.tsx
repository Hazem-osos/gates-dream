'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gatesFocusRing } from './design-tokens';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'default'
  | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'default' | 'icon';

function resolveVariant(variant: ButtonVariant): Exclude<ButtonVariant, 'default' | 'outline'> {
  if (variant === 'default') return 'primary';
  if (variant === 'outline') return 'secondary';
  return variant;
}

function resolveSize(size: ButtonSize): 'sm' | 'md' | 'lg' {
  if (size === 'default' || size === 'md') return 'md';
  if (size === 'icon') return 'sm';
  return size;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<'primary' | 'secondary' | 'danger' | 'ghost', string> = {
  primary:
    'bg-[#0E78AA] text-white shadow-sm hover:bg-[#094C6B] border border-transparent',
  secondary:
    'bg-white text-[#094C6B] border border-[#0A5F8A] shadow-sm hover:bg-[#F0F7FB]',
  danger:
    'bg-red-600 text-white border border-transparent hover:bg-red-700 shadow-sm',
  ghost:
    'bg-transparent text-[#094C6B] border border-transparent hover:bg-[#F0F7FB]',
};

const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-h-8 px-3 py-1.5 text-xs font-semibold rounded-lg',
  md: 'min-h-[42px] px-4 py-2.5 text-sm font-bold rounded-lg',
  lg: 'min-h-11 px-6 py-3 text-base font-bold rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      disabled,
      iconStart,
      iconEnd,
      fullWidth,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const busy = Boolean(isLoading || disabled);
    const v = resolveVariant(variant);
    const s = resolveSize(size);
    const iconOnly = size === 'icon';
    return (
      <button
        ref={ref}
        type={type}
        disabled={busy}
        aria-busy={isLoading || undefined}
        aria-disabled={busy || undefined}
        data-loading={isLoading || undefined}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap',
          'transition-[opacity,background-color,box-shadow,transform] duration-200 ease-out',
          gatesFocusRing,
          'disabled:pointer-events-none',
          isLoading ? 'cursor-wait opacity-80' : 'disabled:opacity-50',
          variantClasses[v],
          sizeClasses[s],
          iconOnly && 'h-9 w-9 min-h-9 px-0',
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          iconStart
        )}
        {children}
        {!isLoading && iconEnd}
      </button>
    );
  }
);
Button.displayName = 'Button';
