'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { disableBrowserAutofill, stampNoAutofill } from '@/lib/forms/disable-browser-autofill';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Document page shell — fills the pane, never wider than the viewport. */
export function ErpDocumentLayout({ children, className = '' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    stampNoAutofill(root);
    const observer = new MutationObserver(() => stampNoAutofill(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${className} erp-contain isolate content-start min-h-0 bg-white p-3`.trim()}
      dir="rtl"
      data-print-root=""
      data-1p-ignore="true"
      data-lpignore="true"
      onFocusCapture={(event) => disableBrowserAutofill(event.target)}
    >
      {children}
    </div>
  );
}
