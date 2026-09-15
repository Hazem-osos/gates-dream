'use client';

import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { AuditActivityTab } from '@/components/erp/AuditActivityTab';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';

type Props = {
  debitTotal: number;
  creditTotal: number;
  journalEntryId: string | null;
  currencyCode?: string;
};

export function JournalEntryBottomSplit({ debitTotal, creditTotal, journalEntryId, currencyCode }: Props) {
  const diff = debitTotal - creditTotal;
  const balanced = Math.abs(diff) < 0.005;

  return (
    <ErpDocumentBottomSplit
      financialRows={
        balanced ? [] : [{ label: 'الفرق', value: diff }]
      }
      netAmount={debitTotal}
      netLabel={balanced ? 'القيد متوازن' : 'غير متوازن'}
      showTafqeet={false}
      financialFooter={
        <DebitCreditTotals debit={debitTotal} credit={creditTotal} currencyCode={currencyCode} />
      }
      journalEntryId={journalEntryId}
      tabs={[
        {
          id: 'audit',
          label: 'سجل النشاط',
          content: <AuditActivityTab entityType="JOURNAL_ENTRY" entityId={journalEntryId} />,
        },
      ]}
    />
  );
}
