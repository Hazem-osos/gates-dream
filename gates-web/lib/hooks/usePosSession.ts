'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';

type PosTerminal = {
  id: string;
  name: string;
  warehouseId: string;
};

type PosShiftBundle = {
  shift: {
    id: string;
    status: string;
    totalCashSales?: number | string;
    totalCardSales?: number | string;
    totalMerchandise?: number | string;
    totalTaxAmount?: number | string;
    orders?: Array<{ id: string; orderNumber?: string; netAmount?: number | string }>;
  };
  zReport?: {
    totalCashSales: number;
    totalCardSales: number;
    totalMerchandise: number;
    totalTaxAmount: number;
    orderCount: number;
  };
};

export function usePosSession(warehouseId: string) {
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [openingShift, setOpeningShift] = useState(false);

  const { data: terminalsResponse } = useApiQuery<PosTerminal[]>(
    ['pos-terminals'],
    '/pos/terminals',
    {}
  );
  const terminals = useMemo(() => terminalsResponse?.data ?? [], [terminalsResponse?.data]);

  const matchedTerminal = useMemo(
    () => terminals.find((t) => t.warehouseId === warehouseId) ?? null,
    [terminals, warehouseId]
  );

  const { data: openShiftResponse, refetch: refetchOpenShift } = useApiQuery<PosShiftBundle | null>(
    ['pos-open-shift', matchedTerminal?.id],
    '/pos/shifts/open',
    { terminalId: matchedTerminal?.id },
    { enabled: !!matchedTerminal?.id }
  );

  useEffect(() => {
    if (matchedTerminal?.id) {
      setTerminalId(matchedTerminal.id);
    }
  }, [matchedTerminal?.id]);

  useEffect(() => {
    const bundle = openShiftResponse?.data;
    if (bundle?.shift?.id) {
      setShiftId(bundle.shift.id);
    } else {
      setShiftId(null);
    }
  }, [openShiftResponse?.data]);

  const ensureOpenShift = useCallback(async (): Promise<string | null> => {
    if (shiftId) return shiftId;
    if (!terminalId) return null;
    if (openingShift) return null;

    setOpeningShift(true);
    try {
      const existing = await apiClient.get<PosShiftBundle | null>('/pos/shifts/open', {
        terminalId,
      });
      if (existing.data?.shift?.id) {
        setShiftId(existing.data.shift.id);
        return existing.data.shift.id;
      }

      const opened = await apiClient.post<{ id: string }>('/pos/shifts/open', {
        terminalId,
        openingCash: 0,
      });
      const id = opened.data?.id ?? null;
      setShiftId(id);
      await refetchOpenShift();
      return id;
    } finally {
      setOpeningShift(false);
    }
  }, [shiftId, terminalId, openingShift, refetchOpenShift]);

  const shiftStats = openShiftResponse?.data?.zReport ?? null;
  const recentOrders = openShiftResponse?.data?.shift?.orders ?? [];

  return {
    terminalId,
    shiftId,
    shiftStats,
    recentOrders,
    hasTerminal: !!terminalId,
    ensureOpenShift,
    refetchOpenShift,
    openingShift,
  };
}

export async function submitPosWave2Order(params: {
  shiftId: string;
  orderNumber: string;
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT' | 'SPLIT';
  cashAmount: number;
  cardAmount: number;
  creditAmount: number;
  customerId?: string;
  lines: Array<{
    itemId: string;
    unitId: string;
    quantity: number;
    price: number;
    discountAmount?: number;
    taxPercent?: number;
    lineOrder: number;
  }>;
}) {
  const created = await apiClient.post<{ id: string }>('/pos/orders', {
    shiftId: params.shiftId,
    orderNumber: params.orderNumber,
    paymentMethod: params.paymentMethod,
    cashAmount: params.cashAmount,
    cardAmount: params.cardAmount,
    creditAmount: params.creditAmount,
    customerId: params.customerId,
    currencyCode: 'EGP',
    lines: params.lines,
  });
  const orderId = created.data?.id;
  if (!orderId) throw new Error('POS order was not created');
  await apiClient.post(`/pos/orders/${orderId}/post`, {});
  return orderId;
}
