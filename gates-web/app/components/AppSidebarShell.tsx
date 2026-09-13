'use client';

import type { CSSProperties, RefObject, ReactNode } from 'react';
import { sidebarTotalWidthPx } from '@/lib/navigation/sidebar-layout';

type AppSidebarShellProps = {
  navExpanded: boolean;
  shellRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/** Module navigation panel (right edge). */
export function AppSidebarShell({ navExpanded, shellRef, children }: AppSidebarShellProps) {
  const totalW = sidebarTotalWidthPx(navExpanded);

  return (
    <div
      ref={shellRef}
      className="fixed top-0 right-0 z-40 flex h-full overflow-hidden bg-[#F9FAFB] shadow-[0_0_24px_rgba(0,0,0,0.06)] transition-[width] duration-300 ease-out"
      style={{ width: totalW }}
    >
      <div className="h-full w-full shrink-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function mainContentOffsetStyle(navExpanded: boolean): CSSProperties {
  const inset = sidebarTotalWidthPx(navExpanded);
  return {
    paddingRight: inset,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
  };
}
