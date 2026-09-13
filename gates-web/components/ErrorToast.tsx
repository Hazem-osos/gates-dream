'use client';

import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { localizeApiErrorMessage } from '@/lib/api/localize-api-error-message';

interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function ErrorToast({ message, onClose, duration = 5000 }: ErrorToastProps) {
  const displayMessage = useMemo(() => localizeApiErrorMessage(message), [message]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]"
      style={{ direction: 'rtl' }}
    >
      <div className="flex-1">
        <div className="font-semibold mb-1">خطأ</div>
        <div className="text-sm">{displayMessage}</div>
      </div>
      <button
        onClick={onClose}
        className="text-red-600 hover:text-red-800 transition-colors"
        aria-label="إغلاق"
      >
        <X size={20} />
      </button>
    </div>
  );
}

