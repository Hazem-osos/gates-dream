'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/feedback/toast';
import { isBusinessSupportError, subscribeApiErrors } from '@/lib/api/api-error-notify';
import { isVersionConflictError } from '@/lib/concurrency/version-conflict';

export default function GlobalApiErrorToast() {
  useEffect(() => {
    return subscribeApiErrors((payload) => {
      if (!payload.message) return;
      if (isBusinessSupportError(payload)) return;
      if (isVersionConflictError(payload)) return;
      toast.error(payload.message, {
        id: `api-err:${payload.httpStatus ?? ''}:${payload.message}`,
      });
    });
  }, []);

  return null;
}
