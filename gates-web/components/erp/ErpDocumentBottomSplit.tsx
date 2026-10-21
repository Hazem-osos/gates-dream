'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { FinancialSummaryCard, type FinancialSummaryRow } from '@/components/erp/FinancialSummaryCard';
import { GeneratedJournalTab } from '@/components/erp/GeneratedJournalTab';
import { LiveJournalPreviewTable } from '@/components/erp/LiveJournalPreviewTable';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import type { DocumentEntityType } from '@/app/components/accounting/DocumentActivityLog';
import { useApiQuery } from '@/lib/hooks/useApi';
import { resolveLinkedJournalId } from '@/lib/documents/linked-journal-preview';

export type ErpBottomTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type Props = {
  financialRows: FinancialSummaryRow[];
  netAmount: number;
  netLabel?: string;
  showTafqeet?: boolean;
  financialFooter?: ReactNode;
  tabs: ErpBottomTab[];
  defaultTabId?: string;
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
  journalEntryId?: string | null;
  sourceDocumentId?: string | null;
  journalOptions?: { id: string; label: string }[];
  onJournalIdChange?: (id: string) => void;
  showJournalTab?: boolean;
  journalEmptyTitle?: string;
  currencyCode?: string | null;
  highlightHeader?: ReactNode;
  besideNet?: ReactNode;
  /** Hide journal/stock tabs — show financial summary only (orders & quotes). */
  hideLeftPanel?: boolean;
  netOnly?: boolean;
  /** Appends «سجل النشاط» when not already in `tabs`. */
  auditLog?: {
    entityType: DocumentEntityType;
    entityId: string | null;
  };
};

export function ErpDocumentBottomSplit({
  financialRows,
  netAmount,
  netLabel,
  showTafqeet = true,
  financialFooter,
  tabs,
  defaultTabId,
  activeTabId,
  onActiveTabChange,
  journalEntryId,
  sourceDocumentId,
  journalOptions,
  onJournalIdChange,
  showJournalTab = true,
  journalEmptyTitle,
  currencyCode,
  highlightHeader,
  besideNet,
  hideLeftPanel = false,
  netOnly = false,
  auditLog,
}: Props) {
  const activeJournalOption = journalOptions?.find((option) => option.id === journalEntryId) ?? journalOptions?.[0];
  const sourceId = sourceDocumentId?.trim() || null;
  const { data: sourceJournals } = useApiQuery<Array<{ id?: string | null }>>(
    ['journal-entries-by-source', sourceId],
    '/accounting/journal-entries',
    { sourceId, limit: 5, sortBy: 'createdAt', sortDir: 'desc' },
    { enabled: Boolean(sourceId), retry: false, skipErrorNotify: true }
  );
  const previewJournalEntryId =
    resolveLinkedJournalId(
      journalEntryId || activeJournalOption?.id || null,
      sourceJournals?.data
    );
  const journalPreview = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {journalOptions && journalOptions.length > 0 ? (
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-[#094C6B]">
            <span className="shrink-0">القيد</span>
            <select
              className="h-8 min-w-0 flex-1 rounded-md border border-[#D6EAF3] bg-white px-2 text-xs"
              value={journalEntryId || journalOptions[0]?.id || ''}
              onChange={(e) => onJournalIdChange?.(e.target.value)}
            >
              {journalOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <GeneratedJournalTab
          journalEntryId={previewJournalEntryId}
          journalNumber={activeJournalOption?.label}
        />
      </div>
      <LiveJournalPreviewTable
        journalEntryId={previewJournalEntryId}
        sourceDocumentId={sourceDocumentId}
        title=""
        compact
        emptyTitle={journalEmptyTitle}
      />
    </div>
  );
  const extraTabs = useMemo(() => {
    const base = tabs.filter((t) => t.id !== 'gl' && t.id !== 'audit');
    if (!auditLog || tabs.some((t) => t.id === 'audit')) return base;
    return [
      ...base,
      {
        id: 'audit',
        label: 'سجل النشاط',
        content: (
          <AuditActivityTab entityType={auditLog.entityType} entityId={auditLog.entityId} />
        ),
      },
    ];
  }, [auditLog, tabs]);

  const allTabs: ErpBottomTab[] = showJournalTab
    ? [
        {
          id: 'gl',
          label: 'معاينة القيد المحاسبي',
          content: journalPreview,
        },
        ...extraTabs,
      ]
    : extraTabs;

  const [internalTab, setInternalTab] = useState(defaultTabId ?? allTabs[0]?.id ?? 'gl');
  const isControlled = activeTabId !== undefined;
  const tab = isControlled ? activeTabId : internalTab;
  const setTab = (id: string) => {
    if (onActiveTabChange) onActiveTabChange(id);
    if (!isControlled) setInternalTab(id);
  };
  const journalTab = allTabs.find((t) => t.id === 'gl');
  const otherTabs = allTabs.filter((t) => t.id !== 'gl');
  const active = allTabs.find((t) => t.id === tab) ?? allTabs[0];

  const tabButton = (t: ErpBottomTab) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setTab(t.id)}
      className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-colors ${
        tab === t.id
          ? 'bg-[#0E78AA] text-white font-semibold shadow-sm'
          : 'text-slate-600 hover:bg-white hover:text-slate-900'
      }`}
    >
      {t.label}
    </button>
  );

  const summaryCard = (
    <FinancialSummaryCard
      rows={financialRows}
      netAmount={netAmount}
      netLabel={netLabel}
      currencyCode={currencyCode}
      showTafqeet={showTafqeet}
      footer={financialFooter}
      highlightHeader={highlightHeader}
      besideNet={besideNet}
      netOnly={netOnly}
    />
  );

  if (hideLeftPanel) {
    return (
      <div className="erp-keep-cols mt-4 flex justify-end" dir="rtl">
        <div className="min-w-0 w-full max-w-md">{summaryCard}</div>
      </div>
    );
  }

  return (
    <div className="erp-keep-cols mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" dir="ltr">
      <Card className="flex min-h-[220px] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E8F1F6] bg-white p-2">
          {journalTab ? tabButton(journalTab) : null}
          <div className="flex flex-1 flex-wrap justify-end gap-1.5" dir="rtl">
            {otherTabs.map(tabButton)}
          </div>
        </div>
        <CardContent className="max-h-[240px] min-w-0 flex-1 overflow-auto p-2 text-sm" dir="rtl">
          {active?.content}
        </CardContent>
      </Card>

      <div className="min-w-0" dir="rtl">
        {summaryCard}
      </div>
    </div>
  );
}
