'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams();
    const profile = searchParams.get('profile');
    const invoiceId = searchParams.get('invoiceId');
    if (profile) next.set('profile', profile);
    if (invoiceId) next.set('invoiceId', invoiceId);
    const qs = next.toString() ? `?${next.toString()}` : '';
    router.replace(`/inventory/operations/sales-invoice${qs}`);
  }, [router, searchParams]);

  return <p className="p-6 text-sm text-slate-500">جاري فتح شاشة الفاتورة…</p>;
}

export default function SalesInvoiceProfileRedirectPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">جاري فتح شاشة الفاتورة…</p>}>
      <RedirectInner />
    </Suspense>
  );
}
