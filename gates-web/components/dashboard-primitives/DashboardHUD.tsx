'use client';

import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeUpdatedLabel } from '@/components/dashboard/period';
import { DASH_LABEL, DASH_PANEL, HUD_BTN_GHOST, HUD_BTN_PRIMARY, HUD_KBD_ON_GHOST, HUD_KBD_ON_PRIMARY } from './tokens';

export type HudShortcut = { key: string; label: string; href?: string; onClick?: () => void };

export function DashboardHUD({
  title,
  module,
  asOf,
  shortcuts,
  filters,
  refreshing,
  onRefresh,
}: {
  title: string;
  module?: string;
  asOf?: string;
  shortcuts?: HudShortcut[];
  filters?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className={cn(DASH_PANEL, 'sticky top-0 z-20 mb-5 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3')} dir="rtl">
      <div className="min-w-0">
        <p className={DASH_LABEL}>{module ?? 'GATES ERP'}</p>
        <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <p className="mt-0.5 text-[11px] text-slate-500">{relativeUpdatedLabel(asOf)}</p>
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {filters}
        {shortcuts?.map((s, index) => {
          const primary = index === 0;
          const body = (
            <>
              <kbd className={primary ? HUD_KBD_ON_PRIMARY : HUD_KBD_ON_GHOST}>{s.key}</kbd>
              {s.label}
            </>
          );
          const cls = primary ? HUD_BTN_PRIMARY : HUD_BTN_GHOST;
          return s.href ? (
            <a key={s.key} href={s.href} className={cls}>
              {body}
            </a>
          ) : (
            <button key={s.key} type="button" onClick={s.onClick} className={cls}>
              {body}
            </button>
          );
        })}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className={cn(HUD_BTN_GHOST, refreshing && 'opacity-60')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            تحديث
          </button>
        ) : null}
      </div>
    </header>
  );
}
