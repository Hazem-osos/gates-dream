'use client';

import React, { useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';

interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function SuccessToast({ message, onClose, duration = 3000 }: SuccessToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 text-green-800 px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px]"
      style={{ direction: 'rtl' }}
    >
      <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
      <div className="flex-1">
        <div className="font-semibold mb-1">نجح</div>
        <div className="text-sm">{message}</div>
      </div>
      <button
        onClick={onClose}
        className="text-green-600 hover:text-green-800 transition-colors"
        aria-label="إغلاق"
      >
        <X size={20} />
      </button>
    </div>
  );
}

