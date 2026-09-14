'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { buildInvoicePrintModelFromApi } from '@/lib/print/buildInvoicePrintModel';
import type { CompanyPrintProfile } from '@/lib/print/types';
import type { StatusTone } from '@/components/ui/StatusBadge';
import type { ReactNode } from 'react';
import { WhatsAppShareButton } from '@/components/share/WhatsAppShareButton';
import type { WhatsAppInvoicePayload } from '@/lib/whatsapp-share';

const PrintHubModal = dynamic(
  () => import('@/components/print/PrintHubModal').then((m) => ({ default: m.PrintHubModal })),
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
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  onNewInvoice: () => void;
  printInvoice: Record<string, unknown> | null;
  company?: CompanyPrintProfile;
  printOptions?: {
    english: boolean;
    onEnglishChange: (v: boolean) => void;
    skipEmptyLines: boolean;
    onSkipEmptyLinesChange: (v: boolean) => void;
    onBarcodeLabels: () => void;
  };
  onUnpost: () => void;
  onDelete: () => void;
  onOpenJournal: () => void;
  onCollectPayment: () => void;
  onPaymentHistory: () => void;
  onCreateReturn?: () => void;
  onDuplicate?: () => void;
  duplicatePending?: boolean;
  favoriteHref?: string;
  favoriteLabel?: string;
  unpostPending?: boolean;
  deletePending?: boolean;
  autoSaveIndicator?: ReactNode;
  onBrowseList?: () => void;
  currentId?: string | null;
  onNavigate?: (id: string) => void;
  onEdit?: () => void;
  hideStandalonePost?: boolean;
  isCancelled?: boolean;
  whatsAppShare?: WhatsAppInvoicePayload | null;
};

export function SalesInvoicePageHeader(props: Props) {
  const {
    invoiceNumber,
    statusTone,
    statusLabel,
    savePending,
    postPending,
    canPost,
    canSave,
    onSaveDraft,
    onPost,
    onCancel,
    saveLabel = 'حفظ الفاتورة',
    cancelLabel = 'إلغاء',
    onNewInvoice,
    printInvoice,
    company,
    printOptions,
    onUnpost,
    onDelete,
    onOpenJournal,
    onCollectPayment,
    onPaymentHistory,
    onCreateReturn,
    onDuplicate,
    duplicatePending,
    favoriteHref,
    favoriteLabel,
    unpostPending,
    deletePending,
    autoSaveIndicator,
    onBrowseList,
    currentId,
    onNavigate,
    onEdit,
    hideStandalonePost,
    isCancelled,
  } = props;

  const printModel = useMemo(() => {
    if (!printInvoice) return null;
    return buildInvoicePrintModelFromApi(printInvoice, company);
  }, [printInvoice, company]);

  const canPrint = printModel != null && printModel.lines.length > 0;
  const [printHubOpen, setPrintHubOpen] = useState(false);
  const [thermalOpen, setThermalOpen] = useState(false);
  const [thermalAutoStart, setThermalAutoStart] = useState(false);

  useEffect(() => {
    const openPrint = () => setPrintHubOpen(true);
    const openThermal = () => {
      setThermalAutoStart(true);
      setThermalOpen(true);
    };
    window.addEventListener('gates:auto-print-invoice', openPrint);
    window.addEventListener('gates:auto-print-thermal', openThermal);
    return () => {
      window.removeEventListener('gates:auto-print-invoice', openPrint);
      window.removeEventListener('gates:auto-print-thermal', openThermal);
    };
  }, []);

  const printItems = [
    {
      id: 'hub',
      label: 'معاينة وطباعة الفاتورة',
      disabled: !canPrint,
      onClick: () => setPrintHubOpen(true),
    },
    {
      id: 'thermal',
      label: 'طباعة إيصال حراري (بلوتوث)',
      disabled: !canPrint,
      onClick: () => {
        setThermalAutoStart(false);
        setThermalOpen(true);
      },
    },
    {
      id: 'barcode',
      label: 'باركود الأصناف',
      onClick: () => printOptions?.onBarcodeLabels(),
    },
    {
      id: 'design',
      label: 'تصميم نموذج الطباعة…',
      onClick: () => {
        window.location.assign('/accounting-settings/company-settings/document-layout');
      },
    },
  ];

  const moreItems = [
    { id: 'new', label: 'فاتورة جديدة', onClick: onNewInvoice },
    {
      id: 'duplicate',
      label: duplicatePending ? 'جاري التكرار…' : 'تكرار المستند',
      onClick: onDuplicate ?? (() => {}),
      disabled: !onDuplicate || duplicatePending,
    },
    { id: 'collect', label: 'تحصيل / قبض', onClick: onCollectPayment },
    { id: 'history', label: 'تحصيلات سابقة', onClick: onPaymentHistory },
    { id: 'journal', label: 'فتح القيد المحاسبي', onClick: onOpenJournal },
    {
      id: 'unpost',
      label: unpostPending ? 'جاري فك الترحيل…' : 'إلغاء الترحيل',
      onClick: onUnpost,
      disabled: unpostPending,
    },
    {
      id: 'return',
      label: 'إنشاء مرتجع',
      onClick: onCreateReturn ?? (() => {}),
      disabled: !onCreateReturn,
    },
    {
      id: 'delete',
      label: deletePending ? 'جاري الحذف…' : 'حذف الفاتورة',
      onClick: onDelete,
      destructive: true,
      disabled: deletePending,
    },
  ];

  return (
    <>
    <div data-tour="invoice-save-print">
    <ErpDocumentPageHeader
      breadcrumbs={[
        { href: '/inventory', label: 'المخزون' },
        { label: 'العمليات' },
        { label: 'فاتورة مبيعات' },
      ]}
      title="فاتورة مبيعات"
      docNumber={invoiceNumber}
      statusTone={statusTone}
      statusLabel={statusLabel}
      savePending={savePending}
      postPending={postPending}
      canPost={canPost}
      canSave={canSave}
      onSaveDraft={onSaveDraft}
      onPost={onPost}
      onCancel={onCancel}
      saveLabel={saveLabel}
      cancelLabel={cancelLabel}
      postLabel="ترحيل الفاتورة"
      printMenuItems={printItems}
      printTrigger={
        <Button variant="secondary" size="sm" className="gap-1.5">
          <Printer className="h-3.5 w-3.5" />
          طباعة
        </Button>
      }
      hideStandalonePost={hideStandalonePost}
      navEntity="invoice"
      invoiceKind="SALE"
      currentId={currentId}
      onNavigate={onNavigate}
      standardActions={{
        hasDocument: Boolean(currentId),
        isPosted: statusTone === 'success',
        isCancelled,
        onNew: onNewInvoice,
        newLabel: 'جديد',
        onEdit,
        onPost,
        onUnpost,
        onPrint: canPrint ? () => setPrintHubOpen(true) : undefined,
        onThermalPrint: canPrint
          ? () => {
              setThermalAutoStart(false);
              setThermalOpen(true);
            }
          : undefined,
        onDuplicate,
        onVoid: onDelete,
        postPending,
        unpostPending,
        duplicatePending,
        voidPending: deletePending,
        whatsAppShare: props.whatsAppShare,
        extraItems: moreItems.filter((item) => !['new', 'unpost', 'delete', 'duplicate'].includes(item.id)),
      }}
      extraActions={currentId ? <WhatsAppShareButton kind="invoice" invoiceId={currentId} /> : undefined}
      moreTrigger={
        <Button variant="ghost" size="sm" aria-label="المزيد">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      }
      favoriteHref={favoriteHref ?? '/inventory/operations/sales-invoice'}
      favoriteLabel={favoriteLabel ?? 'فاتورة مبيعات'}
      autoSaveIndicator={autoSaveIndicator}
      onBrowseList={onBrowseList}
      browseListLabel="السابق"
    />
    </div>
    <PrintHubModal
      open={printHubOpen}
      onClose={() => setPrintHubOpen(false)}
      company={company}
      invoice={printModel}
      skipEmptyLines={printOptions?.skipEmptyLines}
    />
    <ThermalPrintModal
      open={thermalOpen}
      onClose={() => {
        setThermalOpen(false);
        setThermalAutoStart(false);
      }}
      company={company}
      invoice={printModel}
      autoStartBluetooth={thermalAutoStart}
    />
    </>
  );
}
