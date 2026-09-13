'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** Avoid hydration mismatches on form inputs (extensions often inject attributes before React hydrates). */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

export function ClientMountGate({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const mounted = useClientMounted();
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
