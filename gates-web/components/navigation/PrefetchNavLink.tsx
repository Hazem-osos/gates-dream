'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';

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
  ...rest
}: PrefetchNavLinkProps) {
  const { getPrefetchHandlers } = useInstantPrefetch();
  const prefetch = getPrefetchHandlers(href);

  return (
    <a
      href={href}
      {...rest}
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
