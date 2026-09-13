'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getDefaultVisibleColumnIds,
  type ReportColumnDef,
} from '@/lib/reportEngine/reportColumns';
import {
  loadReportColumnVisibility,
  saveReportColumnVisibility,
} from '@/lib/reportEngine/reportColumnStorage';

export function useReportColumnVisibility(
  reportKey: string,
  columns: ReportColumnDef[]
) {
  const pickable = useMemo(
    () => columns.filter((c) => !c.technical),
    [columns]
  );

  const defaultIds = useMemo(
    () => getDefaultVisibleColumnIds(pickable),
    [pickable]
  );

  const [visibleIds, setVisibleIds] = useState<string[]>(defaultIds);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadReportColumnVisibility(reportKey);
    if (stored?.length) {
      const valid = stored.filter((id) => pickable.some((c) => c.id === id));
      if (valid.length) setVisibleIds(valid);
    }
    setHydrated(true);
  }, [reportKey, pickable]);

  useEffect(() => {
    if (!hydrated) return;
    saveReportColumnVisibility(reportKey, visibleIds);
  }, [reportKey, visibleIds, hydrated]);

  const visibleColumns = useMemo(
    () => pickable.filter((c) => visibleIds.includes(c.id)),
    [pickable, visibleIds]
  );

  const setColumnVisible = (id: string, on: boolean) => {
    setVisibleIds((prev) => {
      if (on) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const selectAll = () => setVisibleIds(pickable.map((c) => c.id));
  const selectRecommended = () => setVisibleIds(defaultIds);

  return {
    visibleColumns,
    visibleIds,
    setColumnVisible,
    selectAll,
    selectRecommended,
    pickableColumns: pickable,
  };
}
