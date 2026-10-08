'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';

type PrefetchNavLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

/** Sidebar / palette anchor with hover+focus route and API prefetch. */
export function PrefetchNavLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  onClick,
  ...rest
}: PrefetchNavLinkProps) {
  const { getPrefetchHandlers } = useInstantPrefetch();
  const prefetch = getPrefetchHandlers(href);
  const tabs = useAppTabs();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!tabs) return;

    event.preventDefault();
    flushPageDrafts();
    tabs.openFreshPage(href);
  };

  return (
    <a
      href={href}
      {...rest}
      onClick={handleClick}
      onMouseEnter={(e) => {
        prefetch.onMouseEnter();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch.onFocus();
        onFocus?.(e);
      }}
    >
      {children}
    </a>
  );
}
