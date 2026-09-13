'use client';

type Props = {
  paperCount: number;
  totalAmount: number;
  currencyCode?: string;
  onSave: () => void;
  onCancel: () => void;
  savePending?: boolean;
  canSave?: boolean;
};

function money(value: number, currencyCode: string) {
  const formatted = value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currencyCode === 'EGP' ? `${formatted} ج.م` : `${formatted} ${currencyCode}`;
}

export function BatchReceiptStickyFooter({
  paperCount,
  totalAmount,
  currencyCode = 'EGP',
  onSave,
  onCancel,
  savePending,
  canSave = true,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="rtl">
        <div className="space-y-0.5 text-sm">
          <div className="text-muted-foreground">
            عدد الأوراق المدخلة: <span className="font-semibold text-foreground">{paperCount}</span> ورقة
          </div>
          <div>
            إجمالي القيمة:{' '}
            <span className="font-mono text-base font-bold text-primary">
              {money(totalAmount, currencyCode)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
