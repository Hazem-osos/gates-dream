'use client';

import { useEffect, type RefObject } from 'react';

type Options = {
  enabled?: boolean;
  onPaste: (text: string) => void;
};

export function useClipboardTablePaste(
  containerRef: RefObject<HTMLElement | null>,
  { enabled = true, onPaste }: Options
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const handler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text.includes('\t') && !text.includes('\n')) return;
      const rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (rows.length === 0) return;
      const looksLikeTable = rows.some((r) => r.includes('\t')) || rows.length > 1;
      if (!looksLikeTable) return;
      e.preventDefault();
      onPaste(text);
    };

    el.addEventListener('paste', handler);
    return () => el.removeEventListener('paste', handler);
  }, [containerRef, enabled, onPaste]);
}
