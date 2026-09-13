'use client';

import { TreasuryOrderEngine } from '@/components/accounting/orders/TreasuryOrderEngine';

export default function CashPaymentPage() {
  return <TreasuryOrderEngine variantId="PAYMENT_ORDER" />;
}
