'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Width = 'md' | 'lg' | 'xl' | 'full';

const PANEL_WIDTH: Record<Width, string> = {
  md: 'min(32rem, calc(100vw - 2rem))',
  lg: 'min(52rem, calc(100vw - 2rem))',
  xl: 'min(72rem, calc(100vw - 2rem))',
  full: 'min(80rem, calc(100vw - 2rem))',
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
      className={`fixed inset-0 ${zClass} overflow-y-auto p-4 sm:p-6`}
      style={{ direction: 'rtl' }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="إغلاق"
        onClick={handleClose}
      />
      <div className="relative flex min-h-full items-center justify-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          data-erp-overlay-panel=""
          className="relative flex max-h-[min(92dvh,calc(100dvh-2rem))] flex-col overflow-hidden rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl"
          style={{
            width: PANEL_WIDTH[width],
            maxWidth: 'calc(100vw - 2rem)',
            flexShrink: 0,
            ['--erp-field-max' as string]: '100%',
            ['--erp-field-desc-max' as string]: '100%',
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
