'use client';

import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

const ErpApp = dynamic(() => import('./ErpApp').then((mod) => ({ default: mod.ErpApp })), {
  ssr: false,
});

function isMarketingPath(pathname: string | null) {
  return pathname === '/';
}

function isPublicAppPath(pathname: string | null) {
  if (!pathname) return false;
  return ['/login', '/register', '/forgot-password', '/logout', '/share', '/onboarding'].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function LightQuery({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function RootFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isMarketingPath(pathname)) {
    return <main className="min-h-screen bg-white">{children}</main>;
  }

  if (isPublicAppPath(pathname)) {
    return (
      <LightQuery>
        <main className="min-h-screen bg-white">{children}</main>
      </LightQuery>
    );
  }

  return <ErpApp>{children}</ErpApp>;
}
