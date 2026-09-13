'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';

type Props = {
  count: number;
  onRestore: () => void;
  onDismiss: () => void;
};

export function OpeningStockDraftBanner({ count, onRestore, onDismiss }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/40">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <span>
          يوجد مسودة غير محفوظة محفوظة محلياً على هذا الجهاز من جلسة سابقة
          {count > 0 ? ` تحتوي على ${count} صنف` : ''}.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          تجاهل ومسح
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-amber-600 text-white hover:bg-amber-700"
          onClick={onRestore}
        >
          استعادة المسودة
        </Button>
      </div>
    </div>
  );
}
