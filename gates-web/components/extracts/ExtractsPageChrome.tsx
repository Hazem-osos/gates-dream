'use client';

import type { ReactNode } from 'react';
import { CommandCenter, type HudShortcut } from '@/components/dashboard-primitives';

export const EXTRACTS_SHORTCUTS: HudShortcut[] = [
  { key: 'F2', label: 'مستخلص', href: '/extracts/operations/projects/make-extract' },
  { key: 'F4', label: 'سداد', href: '/extracts/operations/extract-payment' },
  { key: 'F8', label: 'التشغيل', href: '/extracts' },
];

export function ExtractsPageChrome({
  title,
  module = 'EXTRACTS',
  shortcuts = EXTRACTS_SHORTCUTS,
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
      {children}
    </CommandCenter>
  );
}
