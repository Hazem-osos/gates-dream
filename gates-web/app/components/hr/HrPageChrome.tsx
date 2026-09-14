'use client';

import type { ReactNode } from 'react';
import { CommandCenter, type HudShortcut } from '@/components/dashboard-primitives';

export const HR_SHORTCUTS: HudShortcut[] = [
  { key: 'F2', label: 'مسير', href: '/hr/monthly-salaries' },
  { key: 'F4', label: 'موظف', href: '/hr/employee-data' },
  { key: 'F8', label: 'التشغيل', href: '/hr' },
];

export function HrPageChrome({
  title,
  module = 'HR',
  shortcuts = HR_SHORTCUTS,
  filters,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  module?: string;
  shortcuts?: HudShortcut[];
  filters?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  return (
    <CommandCenter
      title={title}
      module={module}
      shortcuts={shortcuts}
      filters={filters}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <div data-print-root="">{children}</div>
    </CommandCenter>
  );
}
