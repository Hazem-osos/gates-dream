'use client';

import { ChequePortfolioEngine } from '@/components/accounting/cheques/ChequePortfolioEngine';

export default function IncomingChequesPage() {
  return <ChequePortfolioEngine direction="INWARD" />;
}
