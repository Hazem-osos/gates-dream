'use client';

import { useState, type ReactNode } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { FinancialSummaryCard, type FinancialSummaryRow } from '@/components/erp/FinancialSummaryCard';
import { LiveJournalPreviewTable } from '@/components/erp/LiveJournalPreviewTable';

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
  journalOptions?: { id: string; label: string }[];
  onJournalIdChange?: (id: string) => void;
  showJournalTab?: boolean;
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
  journalOptions,
  onJournalIdChange,
  showJournalTab = true,
}: Props) {
  const journalPreview = (
    <div className="space-y-2">
      {journalOptions && journalOptions.length > 0 ? (
        <label className="flex items-center gap-2 text-xs font-semibold text-[#094C6B]">
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
      <LiveJournalPreviewTable journalEntryId={journalEntryId} title="" compact />
    </div>
  );
  const allTabs: ErpBottomTab[] = showJournalTab
    ? [
        {
          id: 'gl',
          label: 'معاينة القيد المحاسبي',
          content: journalPreview,
        },
        ...tabs.filter((t) => t.id !== 'gl'),
      ]
    : tabs;

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
        <FinancialSummaryCard
          rows={financialRows}
          netAmount={netAmount}
          netLabel={netLabel}
          showTafqeet={showTafqeet}
          footer={financialFooter}
        />
      </div>
    </div>
  );
}
