'use client';

import { useEffect, useRef, useState } from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { cn } from '@/lib/utils';

type AlternativeRow = {
  id: string;
  quantity: number;
  alternativeItem: {
    id: string;
    arabicName: string;
    serial: string | null;
    barcode: string | null;
  };
};

type Props = {
  itemId?: string;
  className?: string;
};

function formatQty(value: number) {
  return value.toLocaleString('ar-EG', { maximumFractionDigits: 4 });
}

export function ItemAlternativesPeek({ itemId, className }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: countData } = useApiQuery<Record<string, number>>(
    ['item-alternatives-counts', itemId ?? ''],
    '/manufacturing/item-alternatives/counts',
    { itemIds: itemId ?? '' },
    { enabled: Boolean(itemId), staleTime: 60_000 }
  );
  const altCount = itemId ? countData?.data?.[itemId] ?? 0 : 0;

  const { data, isLoading, isFetching } = useApiQuery<AlternativeRow[]>(
    ['item-alternatives', itemId ?? ''],
    itemId ? `/manufacturing/item-alternatives/by-item/${itemId}` : '',
    undefined,
    { enabled: Boolean(itemId && open) }
  );

  const rows = data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!itemId || altCount <= 0) return null;

  return (
    <div ref={wrapRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        title="بدائل الصنف"
        aria-label="عرض بدائل الصنف"
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#0E78AA]/30 bg-[#0E78AA]/10 text-[#0E78AA] shadow-sm transition hover:bg-[#0E78AA]/15',
          open && 'border-[#0E78AA]/50 bg-[#0E78AA]/20'
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {open && (isLoading || isFetching) ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GitBranch className="h-4 w-4" />
        )}
      </button>
      {open ? (
        <div
          className="absolute end-0 top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          role="dialog"
          aria-label="بدائل الصنف"
        >
          <p className="mb-2 text-xs font-semibold text-slate-700">بدائل الصنف ({altCount})</p>
          {isLoading || isFetching ? (
            <p className="text-xs text-muted-foreground">جاري التحميل…</p>
          ) : (
            <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5"
                >
                  <span className="min-w-0 text-slate-800">
                    {row.alternativeItem.arabicName}
                    {row.alternativeItem.serial ? (
                      <span className="text-muted-foreground"> · {row.alternativeItem.serial}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-[#094C6B]">
                    {formatQty(Number(row.quantity) || 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            الكمية لكل وحدة من الصنف الأصلي —{' '}
            <a
              href="/manufacturing/creations/item-alternatives"
              className="text-[#0E78AA] underline-offset-2 hover:underline"
              onClick={() => setOpen(false)}
            >
              تعريف البدائل
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
