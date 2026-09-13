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
  showJournalTab = true,
}: Props) {
  const allTabs: ErpBottomTab[] = showJournalTab
    ? [
        {
          id: 'gl',
          label: 'معاينة القيد المحاسبي',
          content: <LiveJournalPreviewTable journalEntryId={journalEntryId} title="" />,
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
  const active = allTabs.find((t) => t.id === tab) ?? allTabs[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <FinancialSummaryCard
        rows={financialRows}
        netAmount={netAmount}
        netLabel={netLabel}
        showTafqeet={showTafqeet}
        footer={financialFooter}
      />

      <Card className="border-slate-200 shadow-sm rounded-xl overflow-hidden min-h-[240px] flex flex-col">
        <div className="flex flex-wrap gap-1.5 border-b border-[#E8F1F6] bg-white p-2">
          {allTabs.map((t) => (
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
          ))}
        </div>
        <CardContent className="p-3 flex-1 overflow-auto max-h-[300px] text-sm">{active?.content}</CardContent>
      </Card>
    </div>
  );
}
