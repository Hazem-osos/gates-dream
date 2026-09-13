'use client';

import { useCallback, useRef } from 'react';

const SCAN_GAP_MS = 80;
const MIN_SCAN_LENGTH = 4;

/**
 * Detects hardware barcode scanners (rapid key sequence ending with Enter).
 */
export function useBarcodeScanner(onScan: (code: string) => void) {
  const bufferRef = useRef('');
  const lastKeyAtRef = useRef(0);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now();
      if (now - lastKeyAtRef.current > SCAN_GAP_MS) {
        bufferRef.current = '';
      }
      lastKeyAtRef.current = now;

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= MIN_SCAN_LENGTH) {
          e.preventDefault();
          e.stopPropagation();
          onScan(code);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    },
    [onScan]
  );

  return { onKeyDown };
}
