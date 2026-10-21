'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { savedDocumentRowStatus } from '@/lib/documents/document-status-labels';
import {
  LINKED_JOURNAL_EMPTY_SAVED,
  resolveLinkedJournalId,
} from '@/lib/documents/linked-journal-preview';

type JournalLine = {
  lineOrder?: number;
  debit?: number | string;
  credit?: number | string;
  description?: string | null;
  descriptionAr?: string | null;
  exchangeRate?: number | string;
  account?: { code?: string; arabicName?: string };
  costCenter?: { code?: string; arabicName?: string } | null;
};

type JournalEntryPayload = {
  currencyCode?: string;
  isPosted?: boolean;
  isCancelled?: boolean;
  lines?: JournalLine[];
};

function fmtAmount(v: number | string | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return '—';
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export type InvoiceJournalEntryLinesTableProps = {
  journalEntryId: string | null | undefined;
  /** Source document id — keeps معاينة القيد after unpost/cancel even if the FK is missing. */
  sourceDocumentId?: string | null;
  title?: string;
  compact?: boolean;
  emptyTitle?: string;
};

export function InvoiceJournalEntryLinesTable({
  journalEntryId,
  sourceDocumentId,
  title = 'القيد',
  compact = false,
  emptyTitle = LINKED_JOURNAL_EMPTY_SAVED,
}: InvoiceJournalEntryLinesTableProps) {
  const sourceId = sourceDocumentId?.trim() || null;
  const { data: sourceResponse } = useApiQuery<Array<{ id?: string | null }>>(
    ['journal-entries-by-source', sourceId],
    '/accounting/journal-entries',
    { sourceId, limit: 5, sortBy: 'createdAt', sortDir: 'desc' },
    { enabled: Boolean(sourceId), retry: false, skipErrorNotify: true }
  );
  const validId = resolveLinkedJournalId(journalEntryId, sourceResponse?.data);
  const { data: response, isLoading } = useApiQuery<JournalEntryPayload>(
    ['journal-entry', validId],
    `/accounting/journal-entries/${validId}`,
    {},
    { enabled: Boolean(validId), retry: false, skipErrorNotify: true }
  );

  const lines = response?.data?.lines ?? [];
  const currency = response?.data?.currencyCode ?? '—';
  const journalStatus = response?.data ? savedDocumentRowStatus(response.data) : null;

  const cell = compact ? 'py-1.5 px-1.5 text-[11px]' : 'py-3 px-2';

  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white">
      {title ? (
        <div className={`text-[#0E78AA] font-bold border-b border-[#D6EAF3] bg-white ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}>
          {title}
        </div>
      ) : null}
      {journalStatus ? (
        <div className="flex items-center gap-2 border-b border-[#D6EAF3] px-3 py-1.5 text-xs text-[#094C6B]">
          <span className="font-semibold">حالة القيد</span>
          <StatusBadge variant={journalStatus.tone} label={journalStatus.label} compact />
        </div>
      ) : null}
      <table className={`w-full text-center border-separate border-spacing-0 ${compact ? 'text-[11px]' : ''}`}>
        <thead>
          <tr>
            <th className={`${cell} font-bold`}>م</th>
            <th className={`${cell} font-bold`}>الحساب</th>
            <th className={`${cell} font-bold`}>الشرح</th>
            <th className={`${cell} font-bold`}>مدين</th>
            <th className={`${cell} font-bold`}>دائن</th>
            <th className={`${cell} font-bold`}>مركز التكلفة</th>
            <th className={`${cell} font-bold`}>العملة</th>
            <th className={`${cell} font-bold`}>سعر الصرف</th>
          </tr>
        </thead>
        <tbody>
          {!validId ? (
            <tr>
              <td colSpan={8} className="py-6">
                <EmptyState title={emptyTitle} />
              </td>
            </tr>
          ) : isLoading ? (
            <tr>
              <td colSpan={8} className="py-4">
                <TableSkeleton columns={8} rows={3} />
              </td>
            </tr>
          ) : lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-6">
                <EmptyState title="القيد لا يحتوي على بنود." />
              </td>
            </tr>
          ) : (
            lines.map((line, i) => {
              const accountLabel = line.account
                ? `${line.account.code ?? ''} ${line.account.arabicName ?? ''}`.trim()
                : '—';
              const cc = line.costCenter
                ? `${line.costCenter.code ?? ''} ${line.costCenter.arabicName ?? ''}`.trim()
                : '—';
              const desc = line.descriptionAr || line.description || '—';
              return (
                <tr key={line.lineOrder ?? i} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{line.lineOrder ?? i + 1}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{accountLabel}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{desc}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{fmtAmount(line.debit)}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{fmtAmount(line.credit)}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{cc}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>{currency}</td>
                  <td className={`${cell} border-x border-[#D6EAF3]`}>
                    {fmtAmount(line.exchangeRate)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
