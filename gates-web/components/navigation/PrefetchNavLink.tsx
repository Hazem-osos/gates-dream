'use client';

import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';
import { flushPageDrafts } from '@/lib/drafts/page-drafts';
import { pinCurrentWindowHref } from '@/lib/navigation/tab-memory';

type PrefetchNavLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  children: ReactNode;
};

/** Sidebar link with hover+focus prefetch; Next.js Link owns navigation. */
export function PrefetchNavLink({
  href,
  children,
  onClick,
  onMouseEnter,
  onFocus,
  ...rest
}: PrefetchNavLinkProps) {
  const { getPrefetchHandlers } = useInstantPrefetch();
  const prefetch = getPrefetchHandlers(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    flushPageDrafts();
    pinCurrentWindowHref();
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
