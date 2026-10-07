'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get('id')?.trim();
    if (id) {
      router.replace(
        `/manufacturing/operations/production-planning?id=${encodeURIComponent(id)}`
      );
      return;
    }
    router.replace('/manufacturing/operations/production-planning');
  }, [router, searchParams]);

  return <p className="p-6 text-sm text-muted-foreground">جاري فتح أمر الشغل…</p>;
}

export default function WorkOrderRedirectPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري التحويل…</p>}>
      <RedirectInner />
    </Suspense>
  );
}
