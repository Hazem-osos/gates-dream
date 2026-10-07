'use client';

import { SalesInvoicePageHeader } from '@/components/inventory/sales-invoice/SalesInvoicePageHeader';
import type { CompanyPrintProfile } from '@/lib/print/types';
import type { StatusTone } from '@/components/ui/StatusBadge';
import type { ReactNode } from 'react';

type Props = {
  invoiceNumber: string;
  statusTone: StatusTone;
  statusLabel: string;
  savePending?: boolean;
  postPending?: boolean;
  canPost?: boolean;
  canSave?: boolean;
  onSaveDraft: () => void;
  onPost: () => void;
  onNew: () => void;
  printInvoice: Record<string, unknown> | null;
  company?: CompanyPrintProfile;
  onUnpost: () => void;
  onUnapprove?: () => void;
  isApproved?: boolean;
  onDelete: () => void;
  onOpenJournal: () => void;
  onCollectPayment: () => void;
  onLinkAdvance?: () => void;
  onPaymentHistory: () => void;
  onCreateReturn?: () => void;
  unpostPending?: boolean;
  deletePending?: boolean;
  onBrowseList?: () => void;
  currentId?: string | null;
  onNavigate?: (id: string) => void;
  onEdit?: () => void;
  journalEntryId?: string | null;
  journalNumber?: string | null;
  onPreviewJournal?: () => void;
  toolbarLeading?: ReactNode;
};

/** Sales invoice header. Purchase only changes the party-side labels. */
export function PurchaseInvoicePageHeader(props: Props) {
  return (
    <SalesInvoicePageHeader
      invoiceNumber={props.invoiceNumber}
      statusTone={props.statusTone}
      statusLabel={props.statusLabel}
      savePending={props.savePending}
      postPending={props.postPending}
      canPost={props.canPost}
      canSave={props.canSave}
      onSaveDraft={props.onSaveDraft}
      onPost={props.onPost}
      onNewInvoice={props.onNew}
      printInvoice={props.printInvoice}
      company={props.company}
      onUnpost={props.onUnpost}
      onUnapprove={props.onUnapprove}
      isApproved={props.isApproved}
      onDelete={props.onDelete}
      onOpenJournal={props.onOpenJournal}
      onCollectPayment={props.onCollectPayment}
      onLinkAdvance={props.onLinkAdvance}
      onPaymentHistory={props.onPaymentHistory}
      onCreateReturn={props.onCreateReturn}
      unpostPending={props.unpostPending}
      deletePending={props.deletePending}
      onBrowseList={props.onBrowseList}
      currentId={props.currentId}
      onNavigate={props.onNavigate}
      onEdit={props.onEdit}
      journalEntryId={props.journalEntryId}
      journalNumber={props.journalNumber}
      onPreviewJournal={props.onPreviewJournal}
      toolbarLeading={props.toolbarLeading}
      hideStandalonePost
      title="فاتورة مشتريات"
      breadcrumbLabel="فاتورة مشتريات"
      invoiceKind="PURCHASE"
      collectLabel="سداد / دفع"
      historyLabel="مدفوعات سابقة"
      deleteLabel="حذف الفاتورة"
      newDocumentLabel="فاتورة جديدة"
      postLabel="ترحيل الفاتورة"
      favoriteHref="/inventory/operations/final-purchase-invoice"
      favoriteLabel="فاتورة مشتريات"
    />
  );
}
