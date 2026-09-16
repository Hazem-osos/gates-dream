'use client';

import { useCallback, useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { isFxRateLocked } from '@/lib/accounting/fx-base';
import { bumpMasterCatalog } from '@/lib/query/master-catalog-sync';

type CurrencyRow = {
  id?: string;
  code?: string | null;
  exchangeRate?: number | string | null;
};

export type RememberArgs = {
  currencyId?: string | null;
  currencyCode?: string | null;
  companyBaseCode?: string | null;
  rate: number | string | null | undefined;
  flush?: boolean;
};

const pendingByCurrency = new Map<string, number>();
const lastSentByCurrency = new Map<string, number>();
const timersByCurrency = new Map<string, number>();
let queryClientRef: QueryClient | null = null;

function rowsFromCache(data: unknown): CurrencyRow[] | null {
  if (!data || typeof data !== 'object') return null;
  const wrap = data as { data?: unknown };
  return Array.isArray(wrap.data) ? (wrap.data as CurrencyRow[]) : null;
}

function resolveCurrencyId(
  queryClient: QueryClient,
  currencyId?: string | null,
  currencyCode?: string | null
): string | undefined {
  if (currencyId) return currencyId;
  const code = (currencyCode || '').trim().toUpperCase();
  if (!code) return undefined;
  for (const [, data] of queryClient.getQueriesData({ queryKey: ['currencies'] })) {
    const hit = rowsFromCache(data)?.find((row) => (row.code || '').trim().toUpperCase() === code);
    if (hit?.id) return hit.id;
  }
  return undefined;
}

function writeRateToCache(queryClient: QueryClient, currencyId: string, rate: number) {
  queryClient.setQueriesData({ queryKey: ['currencies'] }, (old) => {
    const rows = rowsFromCache(old);
    if (!rows || !old || typeof old !== 'object') return old;
    return {
      ...(old as object),
      data: rows.map((row) => (row.id === currencyId ? { ...row, exchangeRate: rate } : row)),
    };
  });
}

async function sendRate(currencyId: string, rate: number) {
  if (lastSentByCurrency.get(currencyId) === rate) {
    pendingByCurrency.delete(currencyId);
    return;
  }
  lastSentByCurrency.set(currencyId, rate);
  pendingByCurrency.delete(currencyId);
  if (queryClientRef) writeRateToCache(queryClientRef, currencyId, rate);
  try {
    await apiClient.patch(
      `/accounting/currencies/${currencyId}/last-rate`,
      { exchangeRate: rate },
      { skipErrorNotify: true }
    );
    bumpMasterCatalog('currencies');
    if (queryClientRef) {
      void queryClientRef.invalidateQueries({ queryKey: ['currencies'], refetchType: 'all' });
    }
  } catch {
    lastSentByCurrency.delete(currencyId);
    if (queryClientRef) {
      void queryClientRef.invalidateQueries({ queryKey: ['currencies'], refetchType: 'all' });
    }
  }
}

function flushCurrency(currencyId: string) {
  const timer = timersByCurrency.get(currencyId);
  if (timer) {
    window.clearTimeout(timer);
    timersByCurrency.delete(currencyId);
  }
  const rate = pendingByCurrency.get(currencyId);
  if (rate == null) return;
  void sendRate(currencyId, rate);
}

export function flushRememberedCurrencyRates() {
  for (const currencyId of [...pendingByCurrency.keys()]) {
    flushCurrency(currencyId);
  }
}

function queueRate(currencyId: string, rate: number, flush: boolean) {
  pendingByCurrency.set(currencyId, rate);
  if (queryClientRef) writeRateToCache(queryClientRef, currencyId, rate);
  if (flush) {
    flushCurrency(currencyId);
    return;
  }
  const prev = timersByCurrency.get(currencyId);
  if (prev) window.clearTimeout(prev);
  timersByCurrency.set(
    currencyId,
    window.setTimeout(() => {
      timersByCurrency.delete(currencyId);
      flushCurrency(currencyId);
    }, 250)
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushRememberedCurrencyRates);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushRememberedCurrencyRates();
  });
}

export function persistableTypedRate(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  const text = String(raw ?? '').trim();
  if (!text || text.endsWith('.') || text.endsWith('e') || text.endsWith('-')) return null;
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

export function rememberCurrencyRateNow(queryClient: QueryClient, args: RememberArgs) {
  queryClientRef = queryClient;
  const rate = persistableTypedRate(args.rate);
  if (rate == null) return;
  if (isFxRateLocked(args.currencyCode, args.companyBaseCode)) return;
  const currencyId = resolveCurrencyId(queryClient, args.currencyId, args.currencyCode);
  if (!currencyId) return;
  queueRate(currencyId, rate, Boolean(args.flush));
}

export function useRememberCurrencyRate() {
  const queryClient = useQueryClient();
  queryClientRef = queryClient;

  useEffect(() => {
    queryClientRef = queryClient;
    return () => {
      flushRememberedCurrencyRates();
    };
  }, [queryClient]);

  return useCallback(
    (args: RememberArgs) => {
      rememberCurrencyRateNow(queryClient, args);
    },
    [queryClient]
  );
}
