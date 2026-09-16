'use client';

import { useMemo, useState } from 'react';
import {
  AppTable,
  FilterToolbar,
  StatusBadge,
  Button,
} from '@/components/ui';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import { useCancelDraftInvoice } from '@/lib/hooks/useCancelDraftInvoice';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import {
  invoiceDetailPrefetch,
  useRowDetailPrefetch,
} from '@/lib/hooks/useRowDetailPrefetch';
import type { ExportColumnDef } from '@/lib/export/export-utils';
import { BulkActionsToolbar } from '@/components/inventory/BulkActionsToolbar';
import { SmartFilterTabs } from '@/components/filters/SmartFilterTabs';
import { useSavedViews } from '@/lib/hooks/useSavedViews';
import { exportRowsToExcel, rowsToExportMatrix } from '@/lib/export/export-utils';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import type { DocumentBaseType } from '@/lib/document-profiles/types';
import {
  rowMatchesDateRange,
  rowMatchesPostedStatus,
  rowMatchesSearch,
} from '@/lib/browse/browse-list-match';

export type InvoiceListRow = {
  id: string;
  invoiceNumber?: string | null;
  date?: string;
  totalAmount?: number | string | null;
  netAmount?: number | string | null;
  isPosted?: boolean;
  customer?: { arabicName?: string };
  supplier?: { arabicName?: string };
  [key: string]: unknown;
};

export function InventoryInvoicesListSection({
  title,
  invoiceKind,
  partyColumnHeader,
  getPartyName,
  selectedInvoiceId,
  onSelectInvoice,
  enableBulkActions = false,
  compact = false,
}: {
  title?: string;
  invoiceKind: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
  partyColumnHeader: string;
  getPartyName: (row: InvoiceListRow) => string;
  selectedInvoiceId: string | null;
  onSelectInvoice: (id: string | null) => void;
  enableBulkActions?: boolean;
  /** Browse-picker: search + table + export — no saved views or bulk. */
  compact?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [postedFilter, setPostedFilter] = useState<'all' | 'posted' | 'draft'>('all');
  const [profileId, setProfileId] = useState('');
  const profileBaseType: DocumentBaseType | undefined =
    invoiceKind === 'SALE' ? 'SALES_INVOICE' : invoiceKind === 'PURCHASE' ? 'PURCHASE_INVOICE' : undefined;
  const { data: profilesRes } = useDocumentProfiles({
    baseType: profileBaseType,
    enabled: Boolean(profileBaseType),
  });
  const profiles = profilesRes?.data ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState('');
  const screenKey = `invoices:${invoiceKind}`;
  const { views, saveView, removeView } = useSavedViews(screenKey);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const { prefetchDetail } = useRowDetailPrefetch();

  const applySavedView = (view: typeof views[0] | null) => {
    setActiveViewId(view?.id ?? null);
    if (!view) return;
    const f = view.filters;
    if (typeof f.search === 'string') setSearch(f.search);
    if (typeof f.startDate === 'string') setStartDate(f.startDate);
    if (typeof f.endDate === 'string') setEndDate(f.endDate);
    if (f.postedFilter === 'all' || f.postedFilter === 'posted' || f.postedFilter === 'draft') {
      setPostedFilter(f.postedFilter);
    }
    setPage(1);
  };

  const filterKey = useMemo(
    () => ({ invoiceKind, search, postedFilter, startDate, endDate, profileId }),
    [invoiceKind, search, postedFilter, startDate, endDate, profileId]
  );

  const hasLocalFilters = Boolean(
    search.trim() || startDate || endDate || postedFilter !== 'all' || profileId
  );

  const queryParams = useMemo(() => {
    const p: Record<string, string | number | boolean> = {
      page: hasLocalFilters ? 1 : page,
      limit: hasLocalFilters ? 200 : pageSize,
      invoiceKind,
    };
    if (search.trim()) p.search = search.trim();
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (postedFilter === 'posted') p.isPosted = true;
    if (postedFilter === 'draft') p.isPosted = false;
    if (profileId) p.profileId = profileId;
    return p;
  }, [page, pageSize, invoiceKind, search, startDate, endDate, postedFilter, profileId, hasLocalFilters]);

  const { data, isLoading } = useApiQuery<InvoiceListRow[]>(
    queryKeys.invoices({ page, ...filterKey }),
    '/invoices',
    queryParams,
    { staleTime: staleTimes.transactionalMs, gcTime: staleTimes.transactionalGcMs }
  );

  const fetchedRows = data?.data ?? [];
  const filteredRows = useMemo(() => {
    if (!hasLocalFilters) return fetchedRows;
    return fetchedRows.filter((row) => {
      if (!rowMatchesSearch(row, search)) return false;
      if (!rowMatchesDateRange(row, startDate, endDate)) return false;
      if (!rowMatchesPostedStatus(row, postedFilter)) return false;
      if (profileId && String(row.profileId ?? '') !== profileId) return false;
      return true;
    });
  }, [fetchedRows, hasLocalFilters, search, startDate, endDate, postedFilter, profileId]);
  const rows = hasLocalFilters
    ? filteredRows.slice((page - 1) * pageSize, page * pageSize)
    : fetchedRows;
  const total = hasLocalFilters
    ? filteredRows.length
    : data?.pagination?.total ?? data?.meta?.total ?? fetchedRows.length;

  const cancelDraftMutation = useCancelDraftInvoice<InvoiceListRow>({
    onOptimisticSideEffect: (invoiceId) => {
      const selectedWasOn = selectedIds.has(invoiceId);
      if (selectedWasOn) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(invoiceId);
          return next;
        });
      }
      return () => {
        if (selectedWasOn) {
          setSelectedIds((prev) => new Set(prev).add(invoiceId));
        }
      };
    },
  });

  const bulkPostMutation = useApiMutation<
    { results: Array<{ id: string; ok: boolean; message?: string }> },
    { ids: string[] }
  >('/invoices/bulk/post', 'POST');

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    const pageIds = rows.map((r) => r.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedRows = rows.filter((r) => selectedIds.has(r.id));

  const exportColumns = useMemo((): ExportColumnDef<InvoiceListRow>[] => {
    return [
      { id: 'num', header: 'رقم الفاتورة', getValue: (r) => r.invoiceNumber || r.id },
      {
        id: 'date',
        header: 'التاريخ',
        getValue: (r) => (r.date ? new Date(r.date).toLocaleDateString('ar-EG') : ''),
      },
      { id: 'party', header: partyColumnHeader, getValue: (r) => getPartyName(r) },
      {
        id: 'total',
        header: 'المجموع',
        numeric: true,
        getValue: (r) => Number(r.totalAmount ?? r.netAmount ?? 0),
      },
      {
        id: 'status',
        header: 'الترحيل',
        getValue: (r) => (r.isPosted ? 'مرحّل' : 'مسودة'),
      },
    ];
  }, [partyColumnHeader, getPartyName]);

  const showBulk = enableBulkActions && !compact;

  if (compact) {
    return (
      <section className="space-y-3">
        <FilterToolbar
          searchPlaceholder="بحث برقم الفاتورة أو الاسم…"
          onSearchChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          exportConfig={{
            fileName: `invoices-${invoiceKind.toLowerCase()}`,
            columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
            rows: rows as Record<string, unknown>[],
            printTitle: title ?? 'المستندات السابقة',
          }}
        >
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setPage(1);
              setStartDate(e.target.value);
            }}
            className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm"
            aria-label="من تاريخ"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setPage(1);
              setEndDate(e.target.value);
            }}
            className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm"
            aria-label="إلى تاريخ"
          />
          <select
            value={postedFilter}
            onChange={(e) => {
              setPage(1);
              setPostedFilter(e.target.value as 'all' | 'posted' | 'draft');
            }}
            className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-3 text-sm"
          >
            <option value="all">كل الحالات</option>
            <option value="posted">مرحّل</option>
            <option value="draft">مسودة</option>
          </select>
          {profiles.length ? (
            <select
              value={profileId}
              onChange={(e) => {
                setPage(1);
                setProfileId(e.target.value);
              }}
              className="h-10 rounded-lg border border-[#D6EAF3] bg-white px-3 text-sm"
              aria-label="نمط الفاتورة"
            >
              <option value="">كل الأنماط</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
          ) : null}
        </FilterToolbar>
        <AppTable<InvoiceListRow>
          isLoading={isLoading}
          data={rows}
          getRowKey={(r) => r.id}
          emptyTitle="لا توجد مستندات سابقة"
          emptyDescription="غيّر البحث أو أنشئ مستنداً جديداً من الشاشة."
          stickyHeader
          onRowIntent={(r) => prefetchDetail(invoiceDetailPrefetch(r.id))}
          onRowClick={(r) => onSelectInvoice(r.id)}
          rowClassName={(r) =>
            selectedInvoiceId === r.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined
          }
          columns={[
            { id: 'num', header: 'الرقم', cell: (r) => r.invoiceNumber || r.id, sortValue: (r) => r.invoiceNumber || r.id },
            {
              id: 'date',
              header: 'التاريخ',
              cell: (r) => (r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—'),
              sortValue: (r) => (r.date ? Date.parse(String(r.date)) : 0),
            },
            { id: 'party', header: partyColumnHeader, cell: (r) => getPartyName(r) },
            {
              id: 'total',
              header: 'المبلغ',
              align: 'end',
              numeric: true,
              cell: (r) => Number(r.totalAmount ?? r.netAmount ?? 0),
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
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onMouseEnter={() => prefetchDetail(invoiceDetailPrefetch(r.id))}
                    onFocus={() => prefetchDetail(invoiceDetailPrefetch(r.id))}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectInvoice(r.id);
                    }}
                  >
                    فتح
                  </Button>
                  {!r.isPosted ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={cancelDraftMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedInvoiceId === r.id) onSelectInvoice(null);
                        cancelDraftMutation.mutate(r.id);
                      }}
                    >
                      حذف المسودة
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          defaultSort={{ id: 'num', dir: 'asc' }}
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

  return (
    <section className="mb-8 space-y-4">
      {title ? (
        <h2 className="text-lg font-semibold text-[#0E78AA]">{title}</h2>
      ) : null}
      {bulkMessage ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{bulkMessage}</p>
      ) : null}
      <SmartFilterTabs
        views={views}
        activeViewId={activeViewId}
        onSelectView={applySavedView}
        onSaveCurrent={(name) =>
          saveView(name, {
            search,
            startDate,
            endDate,
            postedFilter,
          })
        }
        onRemoveView={removeView}
      />
      <FilterToolbar
        searchPlaceholder="بحث برقم الفاتورة…"
        onSearchChange={(v) => {
          setPage(1);
          setSearch(v);
        }}
        exportConfig={{
          fileName: `invoices-${invoiceKind.toLowerCase()}`,
          columns: exportColumns as ExportColumnDef<Record<string, unknown>>[],
          rows: rows as Record<string, unknown>[],
          printTitle: title,
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
          <option value="posted">مرحّل</option>
          <option value="draft">مسودة</option>
        </select>
      </FilterToolbar>

      <AppTable<InvoiceListRow>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد فواتير"
        stickyHeader
        onRowIntent={(r) => prefetchDetail(invoiceDetailPrefetch(r.id))}
        columns={[
          ...(showBulk
            ? [
                {
                  id: 'sel',
                  header: (
                    <input
                      type="checkbox"
                      aria-label="تحديد الصفحة"
                      checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                      onChange={toggleAllOnPage}
                    />
                  ),
                  align: 'center' as const,
                  cell: (r: InvoiceListRow) => (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      aria-label="تحديد"
                    />
                  ),
                },
              ]
            : []),
          {
            id: 'num',
            header: 'رقم الفاتورة',
            cell: (r) => r.invoiceNumber || r.id,
            sortValue: (r) => r.invoiceNumber || r.id,
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r) =>
              r.date ? new Date(r.date).toLocaleDateString('ar-EG') : '—',
            sortValue: (r) => (r.date ? Date.parse(String(r.date)) : 0),
          },
          {
            id: 'party',
            header: partyColumnHeader,
            cell: (r) => getPartyName(r),
          },
          {
            id: 'total',
            header: 'المجموع',
            align: 'end',
            numeric: true,
            cell: (r) => Number(r.totalAmount ?? r.netAmount ?? 0),
          },
          {
            id: 'status',
            header: 'الترحيل',
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
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onMouseEnter={() => prefetchDetail(invoiceDetailPrefetch(r.id))}
                  onFocus={() => prefetchDetail(invoiceDetailPrefetch(r.id))}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectInvoice(r.id);
                  }}
                >
                  فتح
                </Button>
                {!r.isPosted ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={cancelDraftMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelDraftMutation.mutate(r.id);
                    }}
                  >
                    حذف المسودة
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
        defaultSort={{ id: 'num', dir: 'asc' }}
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
      {showBulk ? (
        <BulkActionsToolbar
          selectedCount={selectedIds.size}
          bulkPostPending={bulkPostMutation.isPending}
          onClearSelection={() => setSelectedIds(new Set())}
          onBulkPost={() => {
            const draftIds = [...selectedIds].filter((id) => {
              const row = rows.find((r) => r.id === id);
              return row && !row.isPosted;
            });
            if (draftIds.length === 0) {
              setBulkMessage('لا توجد مسودات مرحّلة ضمن التحديد');
              return;
            }
            bulkPostMutation.mutate(
              { ids: draftIds },
              {
                onSuccess: (res) => {
                  const ok = res.data?.results?.filter((r) => r.ok).length ?? 0;
                  setBulkMessage(`تم ترحيل ${ok} من ${draftIds.length} فاتورة`);
                  setSelectedIds(new Set());
                },
                onError: (e) => setBulkMessage(e.message || 'فشل الترحيل المجمع'),
              }
            );
          }}
          onBulkExport={() => {
            const toExport = selectedRows.length ? selectedRows : rows;
            const { headers, rows: exportRows } = rowsToExportMatrix(
              exportColumns as ExportColumnDef<Record<string, unknown>>[],
              toExport as Record<string, unknown>[]
            );
            void exportRowsToExcel(`invoices-${invoiceKind.toLowerCase()}-bulk`, headers, exportRows);
          }}
          onBulkPrint={() => {
            setBulkMessage(`تم تجهيز ${selectedIds.size} مستند للطباعة — افتح كل فاتورة من القائمة للطباعة التفصيلية`);
          }}
        />
      ) : null}
    </section>
  );
}
