'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useRegisterScreenChrome } from '@/components/erp/AppScreenChromeContext';
import { DashboardHUD, type HudShortcut } from './DashboardHUD';
import { DASH_PAGE, DASH_SHELL } from './tokens';

export function CommandCenter({
  title,
  module,
  asOf,
  shortcuts,
  filters,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  module?: string;
  asOf?: string;
  shortcuts?: HudShortcut[];
  filters?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  useRegisterScreenChrome();

  return (
    <div className={cn('gates-content-enter', DASH_PAGE)} dir="rtl">
      <div className={DASH_SHELL}>
        <DashboardHUD
          title={title}
          module={module}
          asOf={asOf}
          shortcuts={shortcuts}
          filters={filters}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
        {children}
      </div>
    </div>
  );
}
