'use client';

import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { useApiQuery } from '@/lib/hooks/useApi';

export type DocumentNavEntity =
  | 'invoice'
  | 'journal-entry'
  | 'cash-transaction'
  | 'issue'
  | 'transfer';

export type DocumentAdjacentResult = {
  previousId: string | null;
  nextId: string | null;
  totalCount: number;
  currentIndex: number | null;
};

type Props = {
  onOpenList: () => void;
  label?: string;
  entity?: DocumentNavEntity;
  currentId?: string | null;
  invoiceKind?: string;
  transactionKind?: string;
  fundType?: 'CASHBOX' | 'BANK_ACCOUNT';
  onNavigate?: (id: string) => void;
};

export function DocumentPreviousBrowser({
  onOpenList,
  label = 'السابق',
  entity,
  currentId,
  invoiceKind,
  transactionKind,
  fundType,
  onNavigate,
}: Props) {
  const { data } = useApiQuery<DocumentAdjacentResult>(
    ['document-adjacent', entity, currentId, invoiceKind, transactionKind, fundType],
    '/documents/navigation/adjacent',
    {
      entity,
      currentId: currentId || undefined,
      invoiceKind,
      transactionKind,
      fundType,
    },
    { enabled: Boolean(entity && currentId) }
  );

  const adjacent = data?.data;
  const canPrev = Boolean(adjacent?.previousId && onNavigate);
  const canNext = Boolean(adjacent?.nextId && onNavigate);

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={`${formActionButtonClass} gap-1.5`}
        onClick={onOpenList}
        data-tour="previous-records-btn"
      >
        <List className="h-3.5 w-3.5" />
        {label}
        {adjacent?.totalCount ? (
          <span className="mr-0.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E79AA]/15 px-1 text-[10px] text-[#094C6B]">
            {adjacent.totalCount}
          </span>
        ) : null}
      </Button>
      {currentId && onNavigate ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            disabled={!canPrev}
            title="المستند السابق"
            onClick={() => adjacent?.previousId && onNavigate(adjacent.previousId)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            disabled={!canNext}
            title="المستند التالي"
            onClick={() => adjacent?.nextId && onNavigate(adjacent.nextId)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </>
      ) : null}
    </div>
  );
}
