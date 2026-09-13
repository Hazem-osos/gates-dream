'use client';

import { FinancialVoucherEngine } from '@/components/accounting/treasury/FinancialVoucherEngine';

export default function BankDiscountPage() {
  return <FinancialVoucherEngine variantId="BANK_DEBIT_ADVICE" />;
}
