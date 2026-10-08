'use client';

import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import {
  pinCurrentWindowHref,
  rememberFreshPage,
  splitTabHref,
} from '@/lib/navigation/tab-memory';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';

type PrefetchNavLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  children: ReactNode;
};

/** Sidebar link: Next.js client navigation + draft flush; tabs sync from pathname. */
export function PrefetchNavLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  onClick,
  ...rest
}: PrefetchNavLinkProps) {
  const pathname = usePathname();
  const { getPrefetchHandlers } = useInstantPrefetch();
  const prefetch = getPrefetchHandlers(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    flushPageDrafts();
    pinCurrentWindowHref();
    const { path } = splitTabHref(href);
    if (normalizeAppPath(pathname) === path) {
      rememberFreshPage(path);
    }
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
