'use client';

import { useEffect } from 'react';
import { toast } from '@/lib/feedback/toast';

interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

/** Bridges legacy local success state to the same sonner toast every save uses. */
export default function SuccessToast({ message, onClose, duration = 3000 }: SuccessToastProps) {
  useEffect(() => {
    if (String(message ?? '').trim()) toast.success(String(message));
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, message, onClose]);

  return null;
}
