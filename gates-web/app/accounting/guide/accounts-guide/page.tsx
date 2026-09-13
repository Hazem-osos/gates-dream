'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — unified interactive COA lives at /accounting/chart-of-accounts */
export default function AccountsGuideRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/accounting/chart-of-accounts');
  }, [router]);
  return <p className="p-6 text-slate-500">جاري التوجيه إلى شجرة الحسابات…</p>;
}
