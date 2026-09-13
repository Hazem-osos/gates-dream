'use client';

import { cn } from '@/lib/utils';

export function FormCard({
  title,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-[#E6F0F7] bg-white shadow-sm',
        className
      )}
      dir="rtl"
    >
      {title ? (
        <div className="border-b border-[#E6F0F7] px-5 py-3">
          <h2 className="text-center text-lg font-semibold text-[#0E79AA]">{title}</h2>
        </div>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
      {footer ? (
        <div className="flex justify-end border-t border-[#E6F0F7] bg-[#F6FBFD] px-5 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
