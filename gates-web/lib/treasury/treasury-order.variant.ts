import type { TreasuryOrderType } from '@/components/accounting/orders/OrderStatusBadge';

export type TreasuryOrderVariantId = 'PAYMENT_ORDER' | 'RECEIPT_ORDER';

export type TreasuryOrderVariant = {
  id: TreasuryOrderVariantId;
  orderType: TreasuryOrderType;
  transactionKind: 'PAYMENT' | 'RECEIPT';
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  fundLabel: string;
  confirmLabel: string;
  favoriteHref: string;
  favoriteLabel: string;
  printKind: 'PAYMENT' | 'RECEIPT';
  browseTitle: string;
  togglePath: (id: string) => string;
};

export const TREASURY_ORDER_VARIANTS: Record<TreasuryOrderVariantId, TreasuryOrderVariant> = {
  PAYMENT_ORDER: {
    id: 'PAYMENT_ORDER',
    orderType: 'PAYMENT_ORDER',
    transactionKind: 'PAYMENT',
    title: 'أمر صرف نقدية',
    breadcrumbs: [
      { label: 'المحاسبة', href: '/accounting' },
      { label: 'الخزينة' },
      { label: 'أمر صرف نقدية' },
    ],
    fundLabel: 'الخزينة',
    confirmLabel: 'تأكيد إتمام الصرف',
    favoriteHref: '/accounting/orders/payment-order',
    favoriteLabel: 'أمر صرف',
    printKind: 'PAYMENT',
    browseTitle: 'أوامر الصرف السابقة',
    togglePath: (id) => `/orders/payment-orders/${id}/toggle-execution`,
  },
  RECEIPT_ORDER: {
    id: 'RECEIPT_ORDER',
    orderType: 'RECEIPT_ORDER',
    transactionKind: 'RECEIPT',
    title: 'أمر توريد نقدية',
    breadcrumbs: [
      { label: 'المحاسبة', href: '/accounting' },
      { label: 'الخزينة' },
      { label: 'أمر توريد نقدية' },
    ],
    fundLabel: 'الخزينة',
    confirmLabel: 'تأكيد إتمام التوريد',
    favoriteHref: '/accounting/orders/receipt-order',
    favoriteLabel: 'أمر توريد',
    printKind: 'RECEIPT',
    browseTitle: 'أوامر التوريد السابقة',
    togglePath: (id) => `/orders/receipt-orders/${id}/toggle-execution`,
  },
};
