'use client';

import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOptionalI18n } from '@/lib/i18n';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const i18n = useOptionalI18n();
  const resolvedTitle = title ?? i18n?.t('common.empty') ?? 'لا توجد بيانات';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-4 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--info-soft)] text-primary">
        <Inbox className="h-7 w-7" aria-hidden />
      </div>
      <p className="text-base font-semibold text-foreground">{resolvedTitle}</p>
      {description ? (
        <p className="max-w-md text-sm text-foreground-muted">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
