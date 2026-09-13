'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AppTable,
  FilterToolbar,
  StatusBadge,
  Button,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import {
  journalEntryDetailPrefetch,
  useRowDetailPrefetch,
} from '@/lib/hooks/useRowDetailPrefetch';
import { JournalSourceBadge } from '@/components/accounting/JournalSourceBadge';

export type JournalEntryRow = {
  id: string;
  date: string;
  description?: string | null;
  voucherNumber?: string | null;
  legacyGlNum?: string | null;
  isPosted: boolean;
  isApproved?: boolean;
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  sourceNumber?: string | null;
  [key: string]: unknown;
};

export function JournalEntriesListSection({
  onSelectEntry,
  entryType,
  hrefBase = '/accounting/operations/journal-entry',
}: {
  onSelectEntry?: (id: string) => void;
  entryType?: string;
  hrefBase?: string;
}) {
  const router = useRouter();
  const { prefetchDetail } = useRowDetailPrefetch();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [postedFilter, setPostedFilter] = useState<'all' | 'posted' | 'draft'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filterKey = useMemo(
    () => ({ postedFilter, search, startDate, endDate, entryType }),
    [postedFilter, search, startDate, endDate, entryType]
  );

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {
      page,
      limit: pageSize,
      includeLines: false,
    };
    if (search.trim().length >= 2) p.search = search.trim();
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (postedFilter === 'posted') p.isPosted = true;
    if (postedFilter === 'draft') p.isPosted = false;
    if (entryType) p.entryType = entryType;
    return p;
  }, [page, pageSize, search, startDate, endDate, postedFilter, entryType]);

  const { data, isLoading } = useApiQuery<JournalEntryRow[]>(
    queryKeys.journalEntries(page, filterKey),
    '/accounting/journal-entries',
    queryParams,
    { staleTime: staleTimes.transactionalMs, gcTime: staleTimes.transactionalGcMs }
  );

  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? data?.meta?.total ?? rows.length;

  const exportColumns: ExportColumnDef<JournalEntryRow>[] = [
    {
      id: 'num',
      header: 'رقم',
      getValue: (r) => r.voucherNumber || r.legacyGlNum || '',
    },
    {
      id: 'date',
      header: 'التاريخ',
      getValue: (r) => (r.date ? new Date(r.date).toLocaleDateString('ar-EG') : ''),
    },
    { id: 'desc', header: 'الشرح', accessor: 'description' },
    {
      id: 'source',
      header: 'المصدر',
      getValue: (r) => r.sourceNumber || r.sourceKind || r.sourceType || '',
    },
    {
      id: 'status',
      header: 'الحالة',
      getValue: (r) => (r.isPosted ? 'مرحّل' : 'مسودة'),
    },
  ];

  return (
    <section className="space-y-3">
      <FilterToolbar
        searchPlaceholder="بحث برقم السند أو الشرح…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: 'journal-entries',
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
          printTitle: 'القيود السابقة',
        }}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setPage(1);
            setStartDate(e.target.value);
          }}
          className="rounded-lg border border-[#D6EAF3] bg-white px-2 py-2 text-sm"
          aria-label="من تاريخ"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setPage(1);
            setEndDate(e.target.value);
          }}
          className="rounded-lg border border-[#D6EAF3] bg-white px-2 py-2 text-sm"
          aria-label="إلى تاريخ"
        />
        <select
          value={postedFilter}
          onChange={(e) => {
            setPage(1);
            setPostedFilter(e.target.value as 'all' | 'posted' | 'draft');
          }}
          className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-2 text-sm"
        >
          <option value="all">كل الحالات</option>
          <option value="posted">مرحّل فقط</option>
          <option value="draft">مسودة فقط</option>
        </select>
      </FilterToolbar>

      <AppTable<JournalEntryRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد قيود"
        emptyDescription="غيّر عوامل التصفية أو أنشئ قيداً جديداً من الأسفل."
        onRowIntent={(r) => prefetchDetail(journalEntryDetailPrefetch(r.id))}
        onRowClick={(r) => {
          onSelectEntry?.(r.id);
          router.push(`${hrefBase}?id=${r.id}`);
        }}
        columns={[
          {
            id: 'num',
            header: 'رقم',
            cell: (r) => r.voucherNumber || r.legacyGlNum || '—',
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r) => (r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—'),
          },
          { id: 'desc', header: 'الشرح', accessor: 'description' },
          {
            id: 'source',
            header: 'المصدر',
            cell: (r) => (
              <JournalSourceBadge
                sourceType={r.sourceType}
                sourceKind={r.sourceKind}
                sourceId={r.sourceId}
                sourceNumber={r.sourceNumber}
              />
            ),
          },
          {
            id: 'status',
            header: 'الحالة',
            align: 'center',
            cell: (r) => (
              <StatusBadge
                compact
                variant={r.isPosted ? 'success' : 'warning'}
                label={r.isPosted ? 'مرحّل' : 'مسودة'}
              />
            ),
          },
          {
            id: 'actions',
            header: '',
            align: 'center',
            cell: (r) => (
              <Button
                variant="secondary"
                size="sm"
                onMouseEnter={() => prefetchDetail(journalEntryDetailPrefetch(r.id))}
                onFocus={() => prefetchDetail(journalEntryDetailPrefetch(r.id))}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntry?.(r.id);
                  router.push(`${hrefBase}?id=${r.id}`);
                }}
              >
                فتح
              </Button>
            ),
          },
        ]}
        pagination={{
          page,
          pageSize,
          totalItems: total,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPage(1);
            setPageSize(n);
          },
        }}
      />
    </section>
  );
}
