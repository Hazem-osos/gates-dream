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
  showFx?: boolean;
  headerDescription?: string;
};

export function PaymentOrderLinesTable({
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
    <div className="space-y-3">
      <PaymentLinesTable
        gridId="payment-order-lines"
        lines={lines}
        onChange={onChange}
        onAddLine={onAddLine}
        disabled={disabled}
        accountLabelFor={accountLabelFor}
        currencies={currencies}
        baseCurrency={baseCurrency}
        showFx={showFx}
        headerDescription={headerDescription}
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
