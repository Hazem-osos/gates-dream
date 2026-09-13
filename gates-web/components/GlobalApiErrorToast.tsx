'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from '@/lib/feedback/toast';
import { isBusinessSupportError, subscribeApiErrors } from '@/lib/api/api-error-notify';
import { isVersionConflictError } from '@/lib/concurrency/version-conflict';

export default function GlobalApiErrorToast() {
  const pathname = usePathname();

  useEffect(() => {
    return subscribeApiErrors((payload) => {
      if (!payload.message) return;
      if (pathname === '/' || pathname === '/login' || pathname.startsWith('/login')) return;
      if (isBusinessSupportError(payload)) return;
      if (isVersionConflictError(payload)) return;
      toast.error(payload.message, {
        id: `api-err:${payload.httpStatus ?? ''}:${payload.message}`,
      });
    });
  }, [pathname]);

  return null;
}
