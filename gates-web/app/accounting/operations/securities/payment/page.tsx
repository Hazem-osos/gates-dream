'use client';

import { Suspense } from 'react';
import { SecuritiesPaperEngine } from '@/components/accounting/securities/SecuritiesPaperEngine';

export default function SecurityPaymentPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح ورقة المدفوعات…</p>}>
      <SecuritiesPaperEngine kind="payment" />
    </Suspense>
  );
}
