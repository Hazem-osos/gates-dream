'use client';

import { useCallback, useEffect, useState } from 'react';

const DRAFT_KEY = (companyId: string, fiscalYearId: string) =>
  `gates_opening_stock_draft_${companyId || 'company'}_${fiscalYearId || 'year'}`;

type DraftPayload<T> = {
  lines: T[];
  updatedAt: string;
};

function hasEnteredLines<T>(lines: T[]): boolean {
  return lines.some((line) => {
    if (!line || typeof line !== 'object') return false;
    const row = line as Record<string, unknown>;
    const qty = Number(row.quantity ?? 0);
    const cost = Number(row.unitCost ?? row.unitPrice ?? 0);
    return Boolean(row.itemId || row.itemCode || qty > 0 || cost > 0);
  });
}

export function useOpeningStockDraft<T>(
  companyId: string,
  fiscalYearId: string,
  initialData: T[],
  options?: { enabled?: boolean }
) {
  const [data, setData] = useState<T[]>(initialData);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftLineCount, setDraftLineCount] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const enabled = options?.enabled !== false;
  const storageKey = DRAFT_KEY(companyId, fiscalYearId);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as DraftPayload<T>;
        if (Array.isArray(parsed.lines) && hasEnteredLines(parsed.lines)) {
          setHasDraft(true);
          setDraftLineCount(parsed.lines.filter((line) => hasEnteredLines([line])).length);
        } else {
          setHasDraft(false);
          setDraftLineCount(0);
        }
      }
    } catch (e) {
      console.error('Failed to read opening stock draft', e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !hasEnteredLines(data)) return;

    const timer = setTimeout(() => {
      try {
        const payload: DraftPayload<T> = { lines: data, updatedAt: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setLastSaved(new Date());
      } catch (e) {
        console.warn('Storage quota exceeded, consider IndexedDB for massive sets', e);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [data, storageKey, enabled]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as DraftPayload<T>;
        if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
          setData(parsed.lines);
        }
        setHasDraft(false);
        setDraftLineCount(0);
      }
    } catch (e) {
      console.error('Failed to restore draft', e);
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setDraftLineCount(0);
    setLastSaved(null);
  }, [storageKey]);

  return { data, setData, hasDraft, draftLineCount, restoreDraft, clearDraft, lastSaved };
}
