'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { buildInvoicePrintModelFromApi } from '@/lib/print/buildInvoicePrintModel';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';
import type { StatusTone } from '@/components/ui/StatusBadge';
import type { ReactNode } from 'react';
import { WhatsAppShareButton } from '@/components/share/WhatsAppShareButton';
import type { WhatsAppInvoicePayload } from '@/lib/whatsapp-share';
import { JournalEntryBadge } from '@/components/inventory/commercial/JournalEntryBadge';
import type { DocumentLifecycleInput } from '@/lib/documents/document-status-labels';
import type { TransactionDocumentType } from '@/lib/transaction-settings/types';

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
  statusTone?: StatusTone;
  statusLabel?: string;
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
  onUnapprove?: () => void;
  isApproved?: boolean;
  onDelete: () => void;
  onOpenJournal: () => void;
  onCollectPayment: () => void;
  onLinkAdvance?: () => void;
  onPaymentHistory: () => void;
  onCreateReturn?: () => void;
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
  isPosted?: boolean;
  onRestore?: () => void;
  restorePending?: boolean;
  whatsAppShare?: WhatsAppInvoicePayload | null;
  journalEntryId?: string | null;
  journalNumber?: string | null;
  journalOptions?: { id: string; label: string }[];
  onJournalIdChange?: (id: string) => void;
  lifecycle?: DocumentLifecycleInput;
  onPreviewJournal?: () => void;
  title?: string;
  breadcrumbLabel?: string;
  invoiceKind?: string;
  collectLabel?: string;
  historyLabel?: string;
  /** Hide «تحصيل» and «تحصيلات سابقة» from the ⋯ menu (use bottom «التحصيلات» tab / payment area). */
  hideCollectMenuItems?: boolean;
  linkAdvanceLabel?: string;
  deleteLabel?: string;
  newDocumentLabel?: string;
  postLabel?: string;
  extraMenuItems?: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean }>;
  /** Visible follow-up actions (e.g. إنشاء إذن صرف) beside journal / WhatsApp. */
  followUpActions?: ReactNode;
  transactionSettingsDocumentType?: TransactionDocumentType;
  onTransactionSettingsSaved?: () => void;
  /** @deprecated القسم والرقم تُعرض أسفل حقول المستند. */
  sourceActions?: ReactNode;
  /** @deprecated use sourceActions */
  toolbarLeading?: ReactNode;
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
    onUnapprove,
    isApproved,
    onDelete,
    onOpenJournal,
    onCollectPayment,
    onLinkAdvance,
    onPaymentHistory,
    onCreateReturn,
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
    isPosted = false,
    onRestore,
    restorePending,
    title = 'فاتورة مبيعات',
    breadcrumbLabel = 'فاتورة مبيعات',
    invoiceKind = 'SALE',
    collectLabel = 'تحصيل / قبض',
    historyLabel = 'تحصيلات سابقة',
    hideCollectMenuItems = false,
    linkAdvanceLabel = 'ربط دفعة مقدمة',
    deleteLabel = 'حذف الفاتورة',
    newDocumentLabel = 'فاتورة جديدة',
    postLabel = 'ترحيل الفاتورة',
    extraMenuItems = [],
    followUpActions,
    sourceActions: sourceActionsProp,
    toolbarLeading,
  } = props;
  const sourceActions = sourceActionsProp ?? toolbarLeading;

  const printModel = useMemo(() => {
    if (!printInvoice) return null;
    return buildInvoicePrintModelFromApi(printInvoice, company);
  }, [printInvoice, company]);

  const canPrint = printModel != null && printModel.lines.length > 0;
  const [printHubOpen, setPrintHubOpen] = useState(false);
  const [frozenPrintModel, setFrozenPrintModel] = useState<InvoicePrintModel | null>(null);
  const [thermalOpen, setThermalOpen] = useState(false);
  const [thermalAutoStart, setThermalAutoStart] = useState(false);

  const openPrintHub = (model = printModel) => {
    if (!model || model.lines.length === 0) return;
    setFrozenPrintModel(model);
    setPrintHubOpen(true);
  };

  useEffect(() => {
    const openPrint = () => openPrintHub();
    const openThermal = () => {
      if (printModel && printModel.lines.length > 0) setFrozenPrintModel(printModel);
      setThermalAutoStart(true);
      setThermalOpen(true);
    };
    window.addEventListener('gates:auto-print-invoice', openPrint);
    window.addEventListener('gates:auto-print-thermal', openThermal);
    return () => {
      window.removeEventListener('gates:auto-print-invoice', openPrint);
      window.removeEventListener('gates:auto-print-thermal', openThermal);
    };
  }, [printModel]);

  const moreItems = [
    { id: 'new', label: newDocumentLabel, onClick: onNewInvoice },
    ...(hideCollectMenuItems
      ? []
      : [{ id: 'collect', label: collectLabel, onClick: onCollectPayment }]),
    { id: 'link-advance', label: linkAdvanceLabel, onClick: onLinkAdvance ?? (() => {}) },
    ...(hideCollectMenuItems
      ? []
      : [{ id: 'history', label: historyLabel, onClick: onPaymentHistory }]),
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
      label: deletePending ? 'جاري الحذف…' : deleteLabel,
      onClick: onDelete,
      destructive: true,
      disabled: deletePending,
    },
    ...extraMenuItems,
  ];

  return (
    <>
    <div data-tour="invoice-save-print">
    <ErpDocumentPageHeader
      breadcrumbs={[
        { href: '/inventory', label: 'المخزون' },
        { label: 'العمليات' },
        { label: breadcrumbLabel },
      ]}
      title={title}
      docNumber={invoiceNumber}
      statusTone={statusTone}
      statusLabel={statusLabel}
      lifecycle={props.lifecycle}
      savePending={savePending}
      postPending={postPending}
      canPost={canPost}
      canSave={canSave}
      onSaveDraft={onSaveDraft}
      onPost={onPost}
      saveLabel={saveLabel}
      cancelLabel={cancelLabel}
      postLabel={postLabel}
      hideStandalonePost={hideStandalonePost}
      navEntity="invoice"
      invoiceKind={invoiceKind}
      currentId={currentId}
      onNavigate={onNavigate}
      standardActions={{
        hasDocument: Boolean(currentId),
        isPosted,
        isCancelled,
        onNew: onNewInvoice,
        newLabel: 'جديد',
        onEdit,
        onPost,
        isApproved,
        onUnapprove,
        onUnpost,
        onPrint: canPrint ? () => openPrintHub() : undefined,
        printLabel: 'طباعة',
        onVoid: onDelete,
        onRestore,
        restoreLabel: 'استعادة',
        restorePending,
        postPending,
        unpostPending,
        voidPending: deletePending,
        whatsAppShare: props.whatsAppShare,
        transactionSettingsDocumentType: props.transactionSettingsDocumentType,
        onTransactionSettingsSaved: props.onTransactionSettingsSaved,
        extraItems: [
          ...moreItems.filter((item) => !['new', 'unpost', 'delete'].includes(item.id)),
          ...(canPrint
            ? [
                {
                  id: 'thermal',
                  label: 'طباعة إيصال حراري (بلوتوث)',
                  onClick: () => {
                    setThermalAutoStart(false);
                    setThermalOpen(true);
                  },
                },
              ]
            : []),
          ...(printOptions?.onBarcodeLabels
            ? [{ id: 'barcode', label: 'باركود الأصناف', onClick: () => printOptions.onBarcodeLabels() }]
            : []),
          {
            id: 'print-design',
            label: 'تصميم نموذج الطباعة…',
            onClick: () => {
              window.location.assign('/accounting-settings/company-settings/document-layout');
            },
          },
        ],
      }}
      sourceActions={sourceActions}
      extraActions={
        props.onPreviewJournal
          ? (
            <>
              {followUpActions}
              {currentId ? <WhatsAppShareButton kind="invoice" invoiceId={currentId} /> : null}
            </>
          )
          : (
            <>
              {followUpActions}
              {props.journalOptions && props.journalOptions.length > 1 ? (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#094C6B]">
                  <select
                    className="h-8 max-w-[11rem] rounded-md border border-[#D6EAF3] bg-white px-2 text-xs"
                    value={props.journalEntryId || props.journalOptions[0]?.id || ''}
                    onChange={(e) => props.onJournalIdChange?.(e.target.value)}
                    aria-label="اختيار القيد المحاسبي"
                  >
                    {props.journalOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <JournalEntryBadge
                journalEntryId={props.journalEntryId}
                journalNumber={props.journalNumber}
                pendingLabel="معاينة القيد المحاسبي"
                onPreview={props.onPreviewJournal}
              />
              {currentId ? <WhatsAppShareButton kind="invoice" invoiceId={currentId} /> : null}
            </>
          )
      }
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
      onClose={() => {
        setPrintHubOpen(false);
        setFrozenPrintModel(null);
      }}
      company={company}
      invoice={frozenPrintModel ?? printModel}
      skipEmptyLines={printOptions?.skipEmptyLines}
    />
    <ThermalPrintModal
      open={thermalOpen}
      onClose={() => {
        setThermalOpen(false);
        setThermalAutoStart(false);
      }}
      company={company}
      invoice={frozenPrintModel ?? printModel}
      autoStartBluetooth={thermalAutoStart}
    />
    </>
  );
}
