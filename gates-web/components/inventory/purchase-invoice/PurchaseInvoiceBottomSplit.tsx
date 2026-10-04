'use client';

import type { ReactNode } from 'react';
import { SalesInvoiceBottomSplit } from '@/components/inventory/sales-invoice/SalesInvoiceBottomSplit';
import type { InvoiceFinancialSummary as SummaryModel, InvoiceSummaryLine } from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { InvoicePaymentMethod } from '@/components/invoices/InvoiceCashPaidControls';
import type {
  InvoiceCashSettlement,
  InvoiceChequeSettlement,
  InvoiceInstallmentSource,
  InvoiceInstallmentView,
} from '@/lib/invoices/invoice-settlements';

type Props = {
  summary: SummaryModel;
  applyTax: boolean;
  lines: (InvoiceSummaryLine & { itemId?: string })[];
  savedLines?: (InvoiceSummaryLine & { itemId?: string })[];
  warehouseId?: string;
  journalEntryId?: string | null;
  selectedInvoiceId: string | null;
  isPosted: boolean;
  auditExtra?: ReactNode;
  pricingCalculationBasis?: string;
  settlements?: InvoiceCashSettlement[];
  cheques?: InvoiceChequeSettlement[];
  installments?: InvoiceInstallmentSource[];
  paidAmount?: number;
  remainingAmount?: number;
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
  onCollectInstallment?: (row: InvoiceInstallmentView) => void;
  /** Purchases add stock. Purchase returns remove it. */
  stockSign?: 1 | -1;
  settlementDirection?: 'RECEIPT' | 'PAYMENT';
  cashPayment?: {
    paidAmount: number;
    method: InvoicePaymentMethod;
    disabled?: boolean;
    onPaidChange?: (amount: number | null) => void;
    onOpenSplit?: () => void;
    splitLocked?: boolean;
    onOpenInstallments?: () => void;
    installmentCount?: number;
    onLinkAdvance?: () => void;
    linkHint?: string;
    splitSummary?: string;
  };
};

/** Same invoice footer as sales. Only the stock sign and money direction change. */
export function PurchaseInvoiceBottomSplit({
  stockSign = 1,
  settlementDirection = 'PAYMENT',
  ...props
}: Props) {
  return (
    <SalesInvoiceBottomSplit
      {...props}
      stockSign={stockSign}
      settlementDirection={settlementDirection}
      showEta={false}
    />
  );
}
