'use client';

import { useEffect, useRef } from 'react';

/**
 * When تعريف العملات / بطاقة العملة updates the catalog rate, apply it to a
 * document field that is still showing the previous catalog value.
 * Saved documents that already diverged keep their own rate.
 */
export function useFollowCurrencyCardRate(
  catalogRate: number,
  currentRate: number,
  enabled: boolean,
  onApply: (rate: number) => void
) {
  const prevCatalogRef = useRef(catalogRate);
  const currentRef = useRef(currentRate);
  const onApplyRef = useRef(onApply);
  currentRef.current = currentRate;
  onApplyRef.current = onApply;

  useEffect(() => {
    if (!enabled) {
      prevCatalogRef.current = catalogRate;
      return;
    }
    const previous = prevCatalogRef.current;
    if (previous === catalogRate) return;
    if (currentRef.current === previous) {
      onApplyRef.current(catalogRate);
    }
    prevCatalogRef.current = catalogRate;
  }, [catalogRate, enabled]);
}
