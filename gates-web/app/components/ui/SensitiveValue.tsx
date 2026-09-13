'use client';

import { cn } from '@/lib/utils';

export function SensitiveValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('gates-sensitive inline-block transition-all duration-300', className)}>
      {children}
    </span>
  );
}
