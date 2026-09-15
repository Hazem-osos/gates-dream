'use client';

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';
import { isSameAppModule, normalizeAppPath } from '@/lib/navigation/app-module-root';
import { useAppTabs } from '@/app/components/AppTabsContext';

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
  const pathname = usePathname();
  const router = useRouter();
  const tabs = useAppTabs();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (!tabs || !pathname) return;

    const target = normalizeAppPath(href);
    const current = normalizeAppPath(pathname);
    if (target === current) {
      event.preventDefault();
      return;
    }
    if (isSameAppModule(current, target)) {
      event.preventDefault();
      tabs.addBackgroundTab(target);
      router.push(target);
    }
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
