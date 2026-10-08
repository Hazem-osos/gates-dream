'use client';

import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import { pinCurrentWindowHref, splitTabHref } from '@/lib/navigation/tab-memory';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';

type PrefetchNavLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  children: ReactNode;
};

/**
 * Sidebar: Next.js Link performs client navigation; tab state is primed on click.
 * Same-route clicks use openFreshPage (blank document) with preventDefault.
 */
export function PrefetchNavLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  onClick,
  ...rest
}: PrefetchNavLinkProps) {
  const pathname = usePathname();
  const tabs = useAppTabs();
  const { getPrefetchHandlers } = useInstantPrefetch();
  const prefetch = getPrefetchHandlers(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!tabs) return;

    flushPageDrafts();
    pinCurrentWindowHref();
    const { path } = splitTabHref(href);
    const samePath = normalizeAppPath(pathname) === path;
    if (samePath) {
      event.preventDefault();
      tabs.openFreshPage(href);
      return;
    }
    tabs.primeTabNavigation(href);
  };

  return (
    <Link
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
    </Link>
  );
}
