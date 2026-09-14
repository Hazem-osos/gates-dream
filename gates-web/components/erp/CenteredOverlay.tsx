'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Width = 'md' | 'lg' | 'xl' | 'full';

const WIDTH: Record<Width, string> = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
  full: 'max-w-7xl',
};

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: Width;
  zClass?: string;
  labelledBy?: string;
};

/** Centered dialog — used instead of side drawers so tables and actions stay fully visible. */
export function CenteredOverlay({
  open,
  onClose,
  children,
  width = 'xl',
  zClass = 'z-[10050]',
  labelledBy,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const openedAtRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) openedAtRef.current = Date.now();
  }, [open]);

  const handleClose = () => {
    if (Date.now() - openedAtRef.current < 250) return;
    onClose();
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zClass} flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6`}
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button type="button" className="fixed inset-0 bg-black/45" aria-label="إغلاق" onClick={handleClose} />
      <div
        className={`relative my-auto flex min-h-0 max-h-[min(92dvh,calc(100dvh-2rem))] w-full ${WIDTH[width]} flex-col overflow-hidden rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
