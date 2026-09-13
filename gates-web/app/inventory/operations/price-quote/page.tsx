'use client';

import { Suspense } from 'react';
import { PriceQuoteForm } from '@/components/inventory/price-quote/PriceQuoteForm';

export default function PriceQuotePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح عرض السعر…</p>}>
      <PriceQuoteForm />
    </Suspense>
  );
}
