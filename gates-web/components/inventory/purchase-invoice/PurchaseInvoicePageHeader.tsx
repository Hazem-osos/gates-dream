'use client';

import { useMemo, useState } from 'react';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import dynamic from 'next/dynamic';
import { buildInvoicePrintModelFromApi } from '@/lib/print/buildInvoicePrintModel';
import type { CompanyPrintProfile } from '@/lib/print/types';
import type { StatusTone } from '@/components/ui/StatusBadge';
import { WhatsAppShareButton } from '@/components/share/WhatsAppShareButton';

const InvoicePrintActions = dynamic(
  () =>
    import('@/app/components/print/InvoicePrintActions').then((m) => ({
      default: m.InvoicePrintActions,
    })),
  { ssr: false }
);

const ThermalPrintModal = dynamic(
  () =>
    import('@/components/printer/ThermalPrintModal').then((m) => ({
      default: m.ThermalPrintModal,
    })),
  { ssr: false }
);

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
  /** H4 fix: the sanctioned correction path for a posted (incl. approved)
   * purchase invoice — creates a PURCHASE_RETURN referencing its lines. */
  onCreateReturn?: () => void;
  unpostPending?: boolean;
  deletePending?: boolean;
  onBrowseList?: () => void;
  currentId?: string | null;
  onNavigate?: (id: string) => void;
  onEdit?: () => void;
};

export function PurchaseInvoicePageHeader({
  invoiceNumber,
  statusTone,
  statusLabel,
  savePending,
  postPending,
  canPost = true,
  canSave = true,
  onSaveDraft,
  onPost,
  onNew,
  printInvoice,
  company,
  onUnpost,
  onUnapprove,
  isApproved,
  onDelete,
  onOpenJournal,
  onCollectPayment,
  onLinkAdvance,
  onPaymentHistory,
  onCreateReturn,
  unpostPending,
  deletePending,
  onBrowseList,
  currentId,
  onNavigate,
  onEdit,
}: Props) {
  const printModel = useMemo(() => {
    if (!printInvoice) return null;
    return buildInvoicePrintModelFromApi(printInvoice, company);
  }, [printInvoice, company]);
  const canThermal = printModel != null && printModel.lines.length > 0;
  const [thermalOpen, setThermalOpen] = useState(false);

  return (
    <>
    <ErpDocumentPageHeader
      breadcrumbs={[
        { href: '/inventory', label: 'المخزون' },
        { label: 'العمليات' },
        { label: 'فاتورة مشتريات' },
      ]}
      title="فاتورة مشتريات"
      docNumber={invoiceNumber}
      statusTone={statusTone}
      statusLabel={statusLabel}
      savePending={savePending}
      postPending={postPending}
      canPost={canPost}
      canSave={canSave}
      onSaveDraft={onSaveDraft}
      onPost={onPost}
      postLabel="ترحيل الفاتورة"
      onBrowseList={onBrowseList}
      browseListLabel="السابق"
      hideStandalonePost
      navEntity="invoice"
      invoiceKind="PURCHASE"
      currentId={currentId}
      onNavigate={onNavigate}
      extraActions={
        <>
          <InvoicePrintActions invoice={printInvoice} company={company} />
          {currentId ? <WhatsAppShareButton kind="invoice" invoiceId={currentId} /> : null}
        </>
      }
      standardActions={{
        hasDocument: Boolean(currentId),
        isPosted: statusTone === 'success',
        onNew,
        newLabel: 'جديد',
        onEdit,
        onPost,
        isApproved,
        onUnapprove,
        onUnpost,
        onThermalPrint: canThermal ? () => setThermalOpen(true) : undefined,
        onVoid: onDelete,
        postPending,
        unpostPending,
        voidPending: deletePending,
        extraItems: [
          { id: 'collect', label: 'سداد / دفع', onClick: onCollectPayment },
          { id: 'link-advance', label: 'ربط دفعة مقدمة', onClick: onLinkAdvance ?? (() => {}) },
          { id: 'history', label: 'مدفوعات سابقة', onClick: onPaymentHistory },
          { id: 'journal', label: 'فتح القيد', onClick: onOpenJournal },
          ...(onCreateReturn
            ? [{ id: 'return', label: 'إنشاء مرتجع', onClick: onCreateReturn }]
            : []),
        ],
      }}
      favoriteHref="/inventory/operations/final-purchase-invoice"
      favoriteLabel="فاتورة مشتريات"
    />
    <ThermalPrintModal
      open={thermalOpen}
      onClose={() => setThermalOpen(false)}
      company={company}
      invoice={printModel}
    />
    </>
  );
}
