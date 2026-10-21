'use client';

import { PaymentLinesTable, type PaymentLineCurrency } from '@/components/accounting/vouchers/PaymentLinesTable';
import type { PaymentVoucherLine } from '@/lib/treasury/payment-voucher-line';

type Props = {
  lines: PaymentVoucherLine[];
  onChange: (lines: PaymentVoucherLine[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  accountLabelFor?: (accountId: string) => string | undefined;
  currencies: PaymentLineCurrency[];
  baseCurrency?: string;
  showFx?: boolean;
  headerDescription?: string;
};

export function ReceiptOrderLinesTable({
  lines,
  onChange,
  onAddLine,
  disabled,
  accountLabelFor,
  currencies,
  baseCurrency = 'EGP',
  showFx = true,
  headerDescription = '',
}: Props) {
  return (
    <PaymentLinesTable
      gridId="receipt-order-lines"
      lines={lines}
      onChange={onChange}
      onAddLine={onAddLine}
      disabled={disabled}
      accountLabelFor={accountLabelFor}
      currencies={currencies}
      baseCurrency={baseCurrency}
      showFx={showFx}
      accountColumnLabel="الحساب / العميل"
      invoiceKind="SALE"
      partyEmptyHint="اختر العميل أولاً"
      headerDescription={headerDescription}
      addLabel="إضافة بند جديد (Enter)"
    />
  );
}
