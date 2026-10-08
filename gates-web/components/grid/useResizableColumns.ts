'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const MIN_WIDTH = 56;
const DEFAULT_WIDTH = 120;

function loadStoredWidths(storageKey: string | undefined, columnIds: string[]): Record<string, number> {
  if (!storageKey || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const id of columnIds) {
      const w = parsed[id];
      if (typeof w === 'number' && Number.isFinite(w) && w >= MIN_WIDTH) out[id] = w;
    }
    return out;
  } catch {
    return {};
  }
}

export function useResizableColumns(
  columnIds: string[],
  options?: { storageKey?: string; minWidth?: number; defaultWidth?: number; enabled?: boolean }
) {
  const enabled = options?.enabled !== false;
  const minWidth = options?.minWidth ?? MIN_WIDTH;
  const defaultWidth = options?.defaultWidth ?? DEFAULT_WIDTH;
  const storageKey = options?.storageKey;
  const idsKey = columnIds.join('\0');

  const [widths, setWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!enabled) return;
    // Derive ids from the stable key so a new `columnIds` array reference on
    // every render does not retrigger this effect (which would setState in a
    // loop and throw "Maximum update depth exceeded").
    const ids = idsKey ? idsKey.split('\0') : [];
    const stored = loadStoredWidths(storageKey, ids);
    const next: Record<string, number> = {};
    for (const id of ids) {
      next[id] = stored[id] ?? defaultWidth;
    }
    setWidths((prev) => {
      if (ids.length === Object.keys(prev).length) {
        let same = true;
        for (const id of ids) {
          if (prev[id] !== next[id]) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [defaultWidth, enabled, idsKey, storageKey]);

  const persist = useCallback(
    (snapshot: Record<string, number>) => {
      if (!storageKey) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        /* quota */
      }
    },
    [storageKey]
  );

  const getWidth = useCallback(
    (id: string) => (enabled ? widths[id] ?? defaultWidth : undefined),
    [defaultWidth, enabled, widths]
  );

  const startResize = useCallback(
    (columnId: string, event: React.MouseEvent) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = widths[columnId] ?? defaultWidth;
      const onMove = (e: MouseEvent) => {
        const delta = startX - e.clientX;
        const nextW = Math.max(minWidth, Math.round(startWidth + delta));
        setWidths((prev) => ({ ...prev, [columnId]: nextW }));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setWidths((prev) => {
          persist(prev);
          return prev;
        });
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [defaultWidth, enabled, minWidth, persist, widths]
  );

  const colGroup = useMemo(() => {
    if (!enabled) return null;
    return columnIds.map((id) => ({ id, width: widths[id] ?? defaultWidth }));
  }, [columnIds, defaultWidth, enabled, widths]);

  return { enabled, getWidth, startResize, colGroup };
}
