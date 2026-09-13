'use client';

import { Button } from '@/components/ui';

type Props = {
  selectedCount: number;
  bulkPostPending?: boolean;
  onBulkPost?: () => void;
  onBulkPrint?: () => void;
  onBulkExport?: () => void;
  onClearSelection?: () => void;
};

export function BulkActionsToolbar({
  selectedCount,
  bulkPostPending,
  onBulkPost,
  onBulkPrint,
  onBulkExport,
  onClearSelection,
}: Props) {
  if (selectedCount <= 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-wrap items-center gap-2 rounded-2xl border border-[#0E78AA]/30 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md"
      dir="rtl"
    >
      <span className="text-sm font-semibold text-[#094C6B] px-2">{selectedCount} محدّد</span>
      {onBulkPost ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          isLoading={bulkPostPending}
          onClick={onBulkPost}
        >
          ترحيل مجمع
        </Button>
      ) : null}
      {onBulkPrint ? (
        <Button type="button" size="sm" variant="secondary" onClick={onBulkPrint}>
          طباعة مجمعة
        </Button>
      ) : null}
      {onBulkExport ? (
        <Button type="button" size="sm" variant="outline" onClick={onBulkExport}>
          تصدير Excel
        </Button>
      ) : null}
      {onClearSelection ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClearSelection}>
          إلغاء
        </Button>
      ) : null}
    </div>
  );
}
