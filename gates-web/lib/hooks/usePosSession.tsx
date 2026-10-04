'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';

const TERMINAL_STORAGE_KEY = 'gates.pos.terminalId';

export type PosTerminal = {
  id: string;
  name: string;
  warehouseId: string;
  defaultCustomerId?: string | null;
  safeId?: string;
  bankAccountId?: string | null;
  offlineEnabled?: boolean;
  receiptFooter?: string | null;
  isActive?: boolean;
  deviceCode?: string | null;
  branchId?: string;
  shifts?: Array<{ id: string; openedAt: string; userId: string }>;
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

export function usePosSession() {
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [choiceReady, setChoiceReady] = useState(false);
  const [openingShift, setOpeningShift] = useState(false);

  const terminalsQuery = useApiQuery<PosTerminal[]>(['pos-terminals'], '/pos/terminals', {});
  const terminals = useMemo(() => terminalsQuery.data?.data ?? [], [terminalsQuery.data?.data]);

  useEffect(() => {
    if (!terminalsQuery.isSuccess) return;
    const saved = window.localStorage.getItem(TERMINAL_STORAGE_KEY);
    const savedTerminal = saved ? terminals.find((terminal) => terminal.id === saved) : undefined;
    if (savedTerminal) {
      setTerminalId(savedTerminal.id);
    } else if (terminals.length === 1) {
      setTerminalId(terminals[0].id);
      window.localStorage.setItem(TERMINAL_STORAGE_KEY, terminals[0].id);
    } else {
      setTerminalId(null);
      if (saved) window.localStorage.removeItem(TERMINAL_STORAGE_KEY);
    }
    setChoiceReady(true);
  }, [terminals, terminalsQuery.isSuccess]);

  const terminal = useMemo(
    () => terminals.find((row) => row.id === terminalId) ?? null,
    [terminals, terminalId]
  );

  const selectTerminal = useCallback((id: string) => {
    if (!terminals.some((row) => row.id === id)) return;
    window.localStorage.setItem(TERMINAL_STORAGE_KEY, id);
    setTerminalId(id);
    setShiftId(null);
  }, [terminals]);

  const { data: openShiftResponse, refetch: refetchOpenShift } = useApiQuery<PosShiftBundle | null>(
    ['pos-open-shift', terminal?.id],
    '/pos/shifts/open',
    { terminalId: terminal?.id },
    { enabled: !!terminal?.id }
  );

  useEffect(() => {
    const bundle = openShiftResponse?.data;
    if (!terminal?.id) {
      setShiftId(null);
      return;
    }
    setShiftId(bundle?.shift?.id ?? null);
  }, [openShiftResponse?.data, terminal?.id]);

  const ensureOpenShift = useCallback(async (openingCash: number): Promise<string | null> => {
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
        openingCash,
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
    terminals,
    terminalId,
    terminal,
    warehouseId: terminal?.warehouseId ?? '',
    selectTerminal,
    terminalsLoading: !terminalsQuery.isFetched && !terminalsQuery.isError,
    terminalsError: terminalsQuery.isError,
    choiceReady,
    shiftId,
    shiftStats,
    recentOrders,
    hasTerminal: !!terminalId,
    ensureOpenShift,
    refetchOpenShift,
    openingShift,
    closeShift: async (closingCashDeclared: number) => {
      if (!shiftId) throw new Error('لا توجد وردية مفتوحة');
      await apiClient.post(`/pos/shifts/${shiftId}/close`, { closingCashDeclared });
      setShiftId(null);
      await refetchOpenShift();
    },
  };
}

export function PosTerminalPicker({
  terminals,
  terminalId,
  onSelect,
  loading,
  error,
}: {
  terminals: PosTerminal[];
  terminalId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-slate-500">جاري تحميل أجهزة نقطة البيع…</p>;
  }
  if (error) {
    return <p className="text-sm text-rose-700">تعذر تحميل أجهزة نقطة البيع.</p>;
  }
  if (terminals.length === 0) {
    return <p className="text-sm text-rose-700">لا يوجد جهاز نقطة بيع. أضف جهازاً قبل فتح الوردية.</p>;
  }
  const selected = terminals.find((terminal) => terminal.id === terminalId);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-semibold text-slate-700">الجهاز</span>
      <select
        value={terminalId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        className="h-10 min-w-40 rounded-lg border border-slate-200 bg-white px-2"
        aria-label="جهاز نقطة البيع"
      >
        <option value="" disabled>
          اختر الجهاز
        </option>
        {terminals.map((terminal) => (
          <option key={terminal.id} value={terminal.id}>
            {terminal.name}
          </option>
        ))}
      </select>
      {selected ? <span className="text-xs text-slate-500">{selected.name}</span> : null}
    </label>
  );
}
