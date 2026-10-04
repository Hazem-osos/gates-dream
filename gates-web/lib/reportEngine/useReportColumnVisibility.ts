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
  const pickableKey = pickable.map((c) => c.id).join('|');

  const defaultIds = useMemo(
    () => getDefaultVisibleColumnIds(pickable),
    [pickable]
  );

  const [visibleIds, setVisibleIds] = useState<string[]>(defaultIds);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!pickable.length) {
      setHydrated(false);
      return;
    }
    const stored = loadReportColumnVisibility(reportKey);
    const allIds = pickable.map((c) => c.id);
    if (stored?.length) {
      const valid = stored.filter((id) => pickable.some((c) => c.id === id));
      const journalColumns = [
        'sourceNumber',
        'mainAccount',
        'ledgerAccount',
        'entryCurrency',
        'entryExchangeRate',
        'approvalStatus',
        'postingPosition',
        'costCenter',
      ];
      if (pickable.some((c) => c.id === 'approvalStatus' || c.id === 'sourceNumber')) {
        for (const id of journalColumns) {
          if (pickable.some((c) => c.id === id) && !valid.includes(id)) valid.push(id);
        }
      }
      if (pickable.some((c) => c.id === 'paperNumber') && !stored.includes('paperNumber')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'amountBeforeTax') && !stored.includes('amountBeforeTax')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'sourceLabel') && !stored.includes('sourceLabel')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'sourceName') && !stored.includes('sourceName')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'lineInclusiveValue') && !stored.includes('lineInclusiveValue')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'paymentAmount') && !stored.includes('paidAmount')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'paymentMethod') && !stored.includes('paymentMethod')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'previousBalance') && !stored.includes('previousBalance')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'baseDebit') && !stored.includes('baseDebit')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => /^debit_/.test(c.id) && !stored.includes(c.id))) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'pay30') && !stored.includes('pay30')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'salePrice') && !stored.includes('salePrice')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'additionsAmount') && !stored.includes('additionsAmount')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'notYetDue') && !stored.includes('notYetDue')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'profitPercentOnSales') && !stored.includes('profitPercentOnSales')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      if (pickable.some((c) => c.id === 'profitPercent') && !stored.includes('profitPercent')) {
        setVisibleIds(allIds);
        setHydrated(true);
        return;
      }
      setVisibleIds(valid.length ? valid : allIds);
    } else {
      setVisibleIds(allIds);
    }
    setHydrated(true);
  }, [reportKey, pickable, pickableKey]);

  useEffect(() => {
    if (!hydrated || !pickable.length) return;
    saveReportColumnVisibility(reportKey, visibleIds);
  }, [reportKey, visibleIds, hydrated, pickable.length]);

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
