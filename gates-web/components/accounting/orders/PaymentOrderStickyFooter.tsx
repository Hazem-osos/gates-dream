'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { currencyDisplayLabel } from '@/lib/accounting/fx-base';
import { OrderStatusBadge, type OrderExecutionStatus } from '@/components/accounting/orders/OrderStatusBadge';

type Props = {
  totalAmount: number;
  currencyCode?: string;
  executionStatus: OrderExecutionStatus;
  executedAt?: string | null;
  executedByName?: string | null;
  canConfirm?: boolean;
  confirmPending?: boolean;
  onConfirm?: () => void;
  onSave: () => void;
  onCancel: () => void;
  savePending?: boolean;
  canSave?: boolean;
  saveLabel?: string;
};

function money(value: number, currencyCode: string) {
  return `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyDisplayLabel(currencyCode)}`;
}

export function PaymentOrderStickyFooter({
  totalAmount,
  currencyCode = 'EGP',
  executionStatus,
  executedAt,
  executedByName,
  canConfirm,
  confirmPending,
  onConfirm,
  onSave,
  onCancel,
  savePending,
  canSave = true,
  saveLabel = 'حفظ أمر الصرف',
}: Props) {
  const executedLabel = executedAt ? new Date(executedAt).toLocaleString('ar-EG') : null;

  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="ltr">
        <div className="flex flex-wrap items-center gap-2" dir="rtl">
          <OrderStatusBadge orderType="PAYMENT_ORDER" status={executionStatus} />
          {executionStatus === 'PENDING' && canConfirm && onConfirm ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={confirmPending}
              onClick={onConfirm}
            >
              <Check className="h-3.5 w-3.5" />
              {confirmPending ? 'جاري التأكيد…' : 'تأكيد إتمام الصرف'}
            </Button>
          ) : null}
          {executionStatus === 'COMPLETED' ? (
            <span className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {executedLabel ? `في ${executedLabel}` : 'تم الصرف'}
              {executedByName ? ` — ${executedByName}` : ''}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3" dir="rtl">
          <div className="text-sm">
            <span className="text-muted-foreground">إجمالي أمر الصرف: </span>
            <span className="font-mono text-lg font-bold text-slate-900">{money(totalAmount, currencyCode)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
