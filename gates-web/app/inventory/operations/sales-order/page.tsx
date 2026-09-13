'use client';

import { Suspense } from 'react';
import { SalesOrderForm } from '@/components/inventory/sales-order/SalesOrderForm';

export default function SalesOrderPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح أمر البيع…</p>}>
      <SalesOrderForm />
    </Suspense>
  );
}
