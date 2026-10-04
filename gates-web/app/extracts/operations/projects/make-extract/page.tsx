'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy make-extract redirect — greenfield work uses ContractingProject workspace.
 */
export default function MakeExtractRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/contracting/projects');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-600">
      جاري التحويل إلى مساحة المشروع (Enterprise)…
    </div>
  );
}
