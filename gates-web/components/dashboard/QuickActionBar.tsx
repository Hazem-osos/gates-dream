'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { QuickActionItem } from './types';

export function QuickActionBar({
  actions,
  className,
}: {
  actions: QuickActionItem[];
  className?: string;
}) {
  return (
    <nav
      className={cn('mb-5 flex flex-wrap gap-2', className)}
      dir="rtl"
      aria-label="إجراءات سريعة"
    >
      {actions.map((action, index) => {
        const Icon = action.icon;
        const primary = index === 0;
        return (
          <Link
            key={action.href + action.label}
            href={action.href}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors',
              primary
                ? 'bg-[#0E79AA] text-white shadow-[0_1px_2px_rgba(14,121,170,0.28)] hover:bg-[#0B6188]'
                : 'border border-slate-200 bg-white text-slate-800 hover:border-[#0E79AA]/40 hover:text-[#0E79AA]'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
            <span>{action.label}</span>
            {action.hotkey ? (
              <kbd
                className={cn(
                  'rounded border px-1.5 py-0.5 font-mono text-[10px]',
                  primary
                    ? 'border-white/20 bg-white/15 text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-600'
                )}
              >
                {action.hotkey}
              </kbd>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
