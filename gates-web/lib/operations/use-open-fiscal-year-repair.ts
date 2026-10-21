'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';

type FiscalYearRow = {
  id: string;
  startDate: string;
  endDate: string;
  status?: string;
  code?: string;
};

function isoDateOnly(value: string | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

/** Open fiscal year bounds for inventory repair screens (closed years excluded). */
export function useOpenFiscalYearRepair(cacheKey: string) {
  const { data: fiscalYearsRes } = useApiQuery<FiscalYearRow[]>(
    ['company-fiscal-years', cacheKey],
    '/company/fiscal-years',
    { page: 1, limit: 50 },
    { requireFullTenant: false, skipErrorNotify: true }
  );

  const openFiscalYear = useMemo(() => {
    const rows = Array.isArray(fiscalYearsRes?.data) ? fiscalYearsRes.data : [];
    const openRows = rows.filter((y) => (y.status ?? '').toLowerCase() !== 'close');
    const today = new Date().toISOString().slice(0, 10);
    const covering = openRows.find((y) => {
      const from = isoDateOnly(y.startDate);
      const to = isoDateOnly(y.endDate);
      return from && to && from <= today && to >= today;
    });
    if (covering) return covering;
    return openRows.sort((a, b) => isoDateOnly(b.startDate).localeCompare(isoDateOnly(a.startDate)))[0];
  }, [fiscalYearsRes?.data]);

  const openFrom = isoDateOnly(openFiscalYear?.startDate);
  const openTo = isoDateOnly(openFiscalYear?.endDate);

  const [recalculateFromDate, setRecalculateFromDate] = useState('');
  const [recalculateToDate, setRecalculateToDate] = useState('');

  useEffect(() => {
    if (openFrom && !recalculateFromDate) setRecalculateFromDate(openFrom);
    if (openTo && !recalculateToDate) setRecalculateToDate(openTo);
  }, [openFrom, openTo, recalculateFromDate, recalculateToDate]);

  return {
    openFiscalYear,
    openFrom,
    openTo,
    recalculateFromDate,
    setRecalculateFromDate,
    recalculateToDate,
    setRecalculateToDate,
  };
}
