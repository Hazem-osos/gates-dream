'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/feedback/toast';
import { subscribeApiSuccess } from '@/lib/api/api-success-notify';

export default function GlobalApiSuccessToast() {
  useEffect(() => {
    return subscribeApiSuccess((message) => {
      toast.success(message);
    });
  }, []);

  return null;
}
