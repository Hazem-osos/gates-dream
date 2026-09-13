'use client';

import React, { useMemo, useState } from 'react';
import { AppTable, Button } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import { lazyDefaultModal } from '@/components/ui/lazyModal';

const DistributionAmountsModal = lazyDefaultModal(
  () => import('./DistributionAmountsModal'),
  'جاري تحميل توزيع المبالغ…'
);

type SecuritiesReceiptRow = {
  id: string;
  receiptNumber?: string | null;
  securityNumber?: string | null;
  amount: number | string;
  description?: string | null;
  dueDate?: string | null;
  [key: string]: unknown;
};

export default function ReceiptPapersTable() {
  const [showAmountsModal, setShowAmountsModal] = useState(false);

  const { data, isLoading } = useApiQuery<SecuritiesReceiptRow[]>(
    ['securities-receipts', 'list'],
    '/accounting/securities-receipts',
    { limit: 50, page: 1 },
    { staleTime: 30_000 }
  );

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    return list.map((r, i) => ({
      id: r.id,
      idx: i + 1,
      number: r.securityNumber || r.receiptNumber || '—',
      amount: Number(r.amount).toLocaleString('ar-EG'),
      desc: r.description || '—',
      due: r.dueDate ? new Date(String(r.dueDate)).toLocaleDateString('ar-EG') : '—',
    }));
  }, [data?.data]);

  return (
    <div className="mt-6">
      <AppTable<(typeof rows)[number]>
        isLoading={isLoading}
        data={rows}
        getRowKey={(r) => r.id}
        emptyTitle="لا توجد أوراق قبض"
        emptyDescription="ستظهر الشيكات وأوراق القبض بعد تسجيلها أو تشغيل بيانات العرض."
        stickyHeader
        columns={[
          { id: 'idx', header: 'م', align: 'center', accessor: 'idx' },
          { id: 'number', header: 'رقم الورقة', accessor: 'number' },
          { id: 'amount', header: 'المبلغ', accessor: 'amount', align: 'end', numeric: true },
          { id: 'desc', header: 'الشرح', accessor: 'desc' },
          { id: 'due', header: 'تاريخ الإستحقاق', accessor: 'due', align: 'center' },
        ]}
      />
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={() => setShowAmountsModal(true)}>
          توزيع مبالغ
        </Button>
      </div>
      {showAmountsModal ? (
        <DistributionAmountsModal isOpen onClose={() => setShowAmountsModal(false)} />
      ) : null}
    </div>
  );
}
