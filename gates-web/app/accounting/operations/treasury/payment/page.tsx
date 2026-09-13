'use client';

import { FinancialVoucherEngine } from '@/components/accounting/treasury/FinancialVoucherEngine';

export default function TreasuryPaymentAliasPage() {
  return <FinancialVoucherEngine variantId="CASH_DISBURSEMENT" />;
}
