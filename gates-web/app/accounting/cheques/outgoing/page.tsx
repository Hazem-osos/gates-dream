'use client';

import { ChequePortfolioEngine } from '@/components/accounting/cheques/ChequePortfolioEngine';

export default function OutgoingChequesPage() {
  return <ChequePortfolioEngine direction="OUTWARD" />;
}
