'use client';

import { Button } from '@/components/ui';

type Props = {
  open: boolean;
  count: number;
  sourceLabel: string;
  destinationLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function MovementTransferConfirmModal({
  open,
  count,
  sourceLabel,
  destinationLabel,
  pending,
  onClose,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="mb-3 text-base font-bold text-foreground">تأكيد نقل الحركات</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          هل أنت متأكد من نقل [{count}] حركة محاسبية من [{sourceLabel}] إلى [{destinationLabel}]؟ هذا الإجراء
          سيحدث القيود والتقارير المالية المرتبطة فورياً.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="danger" size="sm" isLoading={pending} onClick={onConfirm}>
            تنفيذ النقل
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClose}>
            رجوع
          </Button>
        </div>
      </div>
    </div>
  );
}
