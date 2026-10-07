'use client';

import { Suspense } from 'react';
import { ManufacturingSalesOrderForm } from '@/components/manufacturing/ManufacturingSalesOrderForm';

export default function ManufacturingSalesOrderPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح أمر البيع…</p>}>
      <ManufacturingSalesOrderForm />
    </Suspense>
  );
}
