'use client';

import { useEffect } from 'react';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';

type NextNumberResponse = { automatic: boolean; number: string };

export function treasuryCashNextNumberQueryKey(input: {
  transactionKind: 'RECEIPT' | 'PAYMENT';
  documentRole: 'ORDER' | 'VOUCHER';
  bankAccountId?: string | null;
  forceBank?: boolean;
  date?: string | null;
}) {
  return [
    'treasury-cash-next-number',
    input.transactionKind,
    input.documentRole,
    input.bankAccountId ?? '',
    input.forceBank ? 'bank' : 'cash',
    input.date ?? '',
  ] as const;
}

/** Preview next سند/أمر number from transaction-settings (automatic vs manual). */
export function useTreasuryCashSerial(input: {
  transactionKind: 'RECEIPT' | 'PAYMENT';
  documentRole: 'ORDER' | 'VOUCHER';
  bankAccountId?: string | null;
  forceBank?: boolean;
  date?: string | null;
  enabled: boolean;
  setVoucherNumber: (value: string) => void;
}) {
  const date = input.date?.trim() || '';
  const queryKey = treasuryCashNextNumberQueryKey({
    transactionKind: input.transactionKind,
    documentRole: input.documentRole,
    bankAccountId: input.bankAccountId,
    forceBank: input.forceBank,
    date,
  });

  const params: Record<string, string> = {
    transactionKind: input.transactionKind,
    documentRole: input.documentRole,
  };
  if (input.bankAccountId) params.bankAccountId = input.bankAccountId;
  if (input.forceBank) params.forceBank = '1';
  if (date) params.date = date;

  const { data: response, isFetching } = useApiQuery<NextNumberResponse>(
    queryKey,
    '/treasury/cash-transactions/next-number',
    params,
    { enabled: input.enabled, staleTime: 0 }
  );

  const automatic = response?.data?.automatic === true;
  const nextNumber = response?.data?.number?.trim() || '';

  useEffect(() => {
    if (!input.enabled || !automatic || !nextNumber) return;
    input.setVoucherNumber(nextNumber);
  }, [automatic, input.enabled, input.setVoucherNumber, nextNumber]);

  const invalidateQuery = useInvalidateQuery();

  return {
    serialAutomatic: automatic,
    nextNumber,
    serialLoading: isFetching,
    invalidateNextSerial: () => invalidateQuery(queryKey),
  };
}
