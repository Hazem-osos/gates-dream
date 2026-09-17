'use client';

import { useEffect, useRef } from 'react';
import { toast } from '@/lib/feedback/toast';

interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

/** Bridges legacy local success state to the same sonner toast every save uses. */
export default function SuccessToast({ message, onClose, duration = 3000 }: SuccessToastProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!String(message ?? '').trim()) return;
    toast.success(String(message));
    const timer = setTimeout(() => onCloseRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  return null;
}
