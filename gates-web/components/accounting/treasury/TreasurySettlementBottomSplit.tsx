'use client';

import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';

type Props = {
  documentAmount: number;
  allocatedTotal: number;
};

export function TreasurySettlementBottomSplit({ documentAmount, allocatedTotal }: Props) {
  const unallocated = Math.max(0, documentAmount - allocatedTotal);

  return (
    <ErpDocumentBottomSplit
      financialRows={[
        { label: 'مبلغ السند', value: documentAmount },
        { label: 'موزّع على فواتير', value: allocatedTotal },
        { label: 'غير موزّع', value: unallocated, show: unallocated > 0.005 },
      ]}
      netAmount={documentAmount}
      netLabel="إجمالي السند"
      showTafqeet={false}
      showJournalTab={false}
      tabs={[
        {
          id: 'hint',
          label: 'ملاحظة',
          content: (
            <p className="text-slate-600 text-sm leading-relaxed p-2">
              بعد الحفظ عبر{' '}
              <code className="text-xs bg-slate-100 px-1 rounded">/treasury/cash-transactions</code>
              ، يمكن ترحيل السند وتسجيل التسويات على الفواتير من واجهة الفاتورة أو مسار التسوية في
              M5.
            </p>
          ),
        },
      ]}
    />
  );
}
