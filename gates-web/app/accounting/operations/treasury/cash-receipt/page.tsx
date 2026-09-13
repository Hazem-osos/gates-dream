'use client';

import { TreasuryOrderEngine } from '@/components/accounting/orders/TreasuryOrderEngine';

export default function CashReceiptPage() {
  return <TreasuryOrderEngine variantId="RECEIPT_ORDER" />;
}
