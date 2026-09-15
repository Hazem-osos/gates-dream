'use client';

import { currencyDisplayLabel } from '@/lib/accounting/fx-base';

type Props = {
  totalAmount: number;
  currencyCode?: string;
  createdAt?: string | null;
  createdByName?: string | null;
  onSave: () => void;
  onCancel: () => void;
  savePending?: boolean;
  canSave?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
};

export function OrderStickyFooter({
  totalAmount,
  currencyCode = 'EGP',
  createdAt,
  createdByName,
  onSave,
  onCancel,
  savePending,
  canSave = true,
  saveLabel = 'حفظ الأمر',
  cancelLabel = 'إلغاء الأمر / إغلاق',
}: Props) {
  const formatted = totalAmount.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const createdLabel = createdAt
    ? new Date(createdAt).toLocaleString('ar-EG')
    : null;

  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="ltr">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" dir="rtl">
          {createdLabel ? (
            <>
              <span className="rounded border border-border bg-muted px-2 py-0.5">
                تاريخ الإنشاء: {createdLabel}
              </span>
              <span className="rounded border border-border bg-muted px-2 py-0.5">
                تم الإنشاء بواسطة: {createdByName || '—'}
              </span>
            </>
          ) : (
            <span className="rounded border border-border bg-muted px-2 py-0.5 italic">
              أمر إداري — يُحفظ بدون قيد محاسبي
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3" dir="rtl">
          <div className="text-sm">
            <span className="text-muted-foreground">إجمالي الأمر: </span>
            <span className="text-lg font-bold text-slate-900">
              {formatted} {currencyDisplayLabel(currencyCode)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
