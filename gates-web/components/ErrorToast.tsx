'use client';

import { useEffect, useMemo } from 'react';
import { localizeApiErrorMessage } from '@/lib/api/localize-api-error-message';
import { toast } from '@/lib/feedback/toast';

interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

/** Bridges legacy local error state to the root sonner toaster (z-index 50000). */
export default function ErrorToast({ message, onClose, duration = 5000 }: ErrorToastProps) {
  const displayMessage = useMemo(() => localizeApiErrorMessage(message), [message]);

  useEffect(() => {
    if (!String(displayMessage ?? '').trim()) return;
    toast.error(displayMessage, {
      id: 'gates-form-error',
      duration,
    });
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [displayMessage, duration]); // onClose is setError('') from the page — do not retrigger on each render

  return null;
}
