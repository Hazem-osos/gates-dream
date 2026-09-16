'use client';

import { Button } from '@/components/ui';

type Props = {
  message?: string;
  onRestore: () => void;
  onDismiss: () => void;
};

export function PageDraftRestoreBanner({
  message = 'يوجد مسودة غير محفوظة من قبل ما خرجت من الصفحة.',
  onRestore,
  onDismiss,
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>{message}</span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="primary" onClick={onRestore}>
          استعادة
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          تجاهل
        </Button>
      </div>
    </div>
  );
}
