'use client';

import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';

type Props = {
  customerId?: string;
  warehouseId?: string;
  disabled?: boolean;
  onOpen: () => void;
};

export function CustomerItemReservationButton({
  customerId,
  warehouseId,
  disabled,
  onOpen,
}: Props) {
  const probeParams = useMemo(
    () => ({
      customerId: customerId || undefined,
      warehouseId: warehouseId || undefined,
      status: 'OPEN',
      limit: 1,
    }),
    [customerId, warehouseId]
  );

  const probeQuery = useApiQuery<unknown[]>(
    queryKeys.itemReservations(probeParams),
    '/inventory/item-reservations',
    probeParams,
    {
      enabled: Boolean(customerId?.trim()),
      staleTime: 15_000,
      skipErrorNotify: true,
    }
  );

  const total = probeQuery.data?.pagination?.total ?? 0;
  if (!customerId?.trim() || total <= 0) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#0E78AA]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#0E78AA] hover:bg-[#EAF6FB] disabled:opacity-50"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
      حجز
      <span className="tabular-nums text-[#094C6B]">({total.toLocaleString('ar-EG')})</span>
    </button>
  );
}
