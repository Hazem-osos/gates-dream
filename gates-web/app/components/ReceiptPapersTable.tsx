'use client';

import React, { useMemo } from 'react';
import { AppTable } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

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
        emptyDescription="ستظهر أوراق القبض بعد تسجيلها."
        stickyHeader
        columns={[
          { id: 'idx', header: 'م', align: 'center', accessor: 'idx' },
          { id: 'number', header: 'رقم الورقة', accessor: 'number' },
          { id: 'amount', header: 'المبلغ', accessor: 'amount', align: 'end', numeric: true },
          { id: 'desc', header: 'الشرح', accessor: 'desc' },
          { id: 'due', header: 'تاريخ الإستحقاق', accessor: 'due', align: 'center' },
        ]}
      />
    </div>
  );
}
