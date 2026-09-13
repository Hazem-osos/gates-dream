'use client';

import { Clock } from 'lucide-react';

type Props = {
  isConfirmed: boolean;
  totalAmount: number;
  currencyCode?: string;
  isSubmitting?: boolean;
  onSave: () => void;
  onCancel: () => void;
  canSave?: boolean;
};

export function TemporaryReceiptStickyFooter({
  isConfirmed,
  totalAmount,
  currencyCode = 'EGP',
  isSubmitting,
  onSave,
  onCancel,
  canSave = true,
}: Props) {
  const amountLabel = totalAmount.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const currency = currencyCode === 'EGP' ? 'ج.م' : currencyCode;

  return (
    <div className="sticky bottom-0 z-30 mt-auto flex w-full items-center justify-between gap-4 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" dir="rtl">
        <div className="flex items-center gap-1 font-medium">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>حالة الإيصال: {isConfirmed ? 'تم التأكيد' : 'مسودة قيد المراجعة'}</span>
        </div>
      </div>
      <div className="flex items-center gap-4" dir="rtl">
        <div className="text-end">
          <span className="block text-[11px] text-muted-foreground">إجمالي مبلغ الإيصال</span>
          <span className="font-mono text-lg font-bold text-foreground">
            {amountLabel} {currency}
          </span>
        </div>
      </div>
    </div>
  );
}
