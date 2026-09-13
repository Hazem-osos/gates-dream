'use client';

export type OrderExecutionStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type TreasuryOrderType = 'PAYMENT_ORDER' | 'RECEIPT_ORDER';

interface OrderStatusBadgeProps {
  orderType: TreasuryOrderType;
  status: OrderExecutionStatus;
}

export function OrderStatusBadge({ orderType, status }: OrderStatusBadgeProps) {
  if (status === 'COMPLETED') {
    const label = orderType === 'PAYMENT_ORDER' ? 'تم الصرف' : 'تم التوريد';
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <span>{label}</span>
      </div>
    );
  }

  if (status === 'PENDING') {
    const label = orderType === 'PAYMENT_ORDER' ? 'لم يتم الصرف' : 'لم يتم التوريد';
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
      ملغي
    </div>
  );
}
