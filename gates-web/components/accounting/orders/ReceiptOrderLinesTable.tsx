'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
};

export function ReceiptOrderLinesTable({
  lines,
  onChange,
  onAddLine,
  disabled,
  accountLabelFor,
  currencies,
  baseCurrency = 'EGP',
}: Props) {
  return (
    <div className="space-y-3">
      <PaymentLinesTable
        gridId="receipt-order-lines"
        lines={lines}
        onChange={onChange}
        onAddLine={onAddLine}
        disabled={disabled}
        accountLabelFor={accountLabelFor}
        currencies={currencies}
        baseCurrency={baseCurrency}
        showFx
        accountColumnLabel="الحساب / العميل"
        invoiceKind="SALE"
        partyEmptyHint="اختر العميل أولاً"
      />
      {disabled ? null : (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onAddLine}>
          <Plus className="h-3.5 w-3.5" />
          إضافة بند جديد (Enter)
        </Button>
      )}
    </div>
  );
}
