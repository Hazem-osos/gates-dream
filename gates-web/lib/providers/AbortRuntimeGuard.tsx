'use client';

import { registerAbortNoiseGuard } from '@/lib/providers/register-abort-noise-guard';

/**
 * Dev/navigation can abort in-flight fetches (React Query cancel, Next.js RSC).
 * Those rejections must not surface as an uncaught runtime overlay.
 */
export function AbortRuntimeGuard({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    registerAbortNoiseGuard();
  }

  return <>{children}</>;
}
