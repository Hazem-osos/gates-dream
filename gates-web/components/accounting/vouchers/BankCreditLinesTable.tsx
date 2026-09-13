'use client';

import { PaymentLinesTable, type PaymentLineCurrency } from './PaymentLinesTable';
import type { PaymentVoucherLine } from '@/lib/treasury/payment-voucher-line';

type Props = {
  gridId: string;
  lines: PaymentVoucherLine[];
  onChange: (lines: PaymentVoucherLine[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  accountLabelFor?: (accountId: string) => string | undefined;
  currencies: PaymentLineCurrency[];
  baseCurrency?: string;
  showFx?: boolean;
  accountColumnLabel?: string;
};

export function BankCreditLinesTable({
  accountColumnLabel = 'الحساب / العميل',
  ...props
}: Props) {
  return (
    <PaymentLinesTable
      {...props}
      accountColumnLabel={accountColumnLabel}
      invoiceKind="SALE"
      partyEmptyHint="اختر العميل أولاً"
    />
  );
}
