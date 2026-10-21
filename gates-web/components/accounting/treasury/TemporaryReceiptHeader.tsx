'use client';

import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { DocumentHeaderBar } from '@/components/common/document-shell/DocumentHeaderBar';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';

type Props = {
  receiptNumber?: string;
  documentId?: string | null;
  isConfirmed: boolean;
  hasDocument: boolean;
  isCancelled?: boolean;
  receiptDate: string;
  onReceiptDateChange: (value: string) => void;
  dateError?: boolean;
  savePending?: boolean;
  canSave?: boolean;
  saveLabel?: string;
  onSave: () => void;
  onNew: () => void;
  onBrowseList: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onCancelReceipt: () => void;
  onTransactionSettingsSaved?: () => void;
  extraFields?: ReactNode;
};

export function TemporaryReceiptHeader({
  receiptNumber,
  documentId,
  isConfirmed,
  hasDocument,
  isCancelled,
  receiptDate,
  onReceiptDateChange,
  dateError,
  savePending,
  canSave,
  saveLabel,
  onSave,
  onNew,
  onBrowseList,
  onEdit,
  onPrint,
  onCancelReceipt,
  onTransactionSettingsSaved,
  extraFields,
}: Props) {
  return (
    <>
      <DocumentHeaderBar
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { href: '/accounting/operations/treasury', label: 'الخزينة' },
          { label: 'إيصال استلام مؤقت' },
        ]}
        title="إيصال استلام مؤقت"
        docNumber={receiptNumber || 'TEMP-REC-XXXX'}
        lifecycle={{
          documentId: documentId ?? (hasDocument ? 'saved' : null),
          isPosted: isConfirmed,
          isCancelled,
        }}
        statusTone={isConfirmed ? 'success' : undefined}
        statusLabel={isConfirmed ? 'مؤكد (Confirmed)' : undefined}
        currentId={documentId}
        onSaveDraft={onSave}
        saveLabel={saveLabel ?? 'حفظ الإيصال'}
        savePending={savePending}
        canSave={canSave}
        onBrowseList={onBrowseList}
        browseListLabel="السابق"
        printTrigger={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={`${formActionButtonClass} gap-1.5`}
            disabled={!hasDocument}
            onClick={onPrint}
            data-tour="document-print"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            طباعة الإيصال
          </Button>
        }
        favoriteHref="/accounting/operations/treasury/temp-receipt"
        favoriteLabel="إيصال استلام مؤقت"
        standardActions={{
          hasDocument,
          isPosted: isConfirmed,
          isCancelled,
          hidePostActions: true,
          onNew,
          newLabel: 'جديد',
          onEdit,
          onVoid: onCancelReceipt,
          voidLabel: 'إلغاء الإيصال',
          transactionSettingsDocumentType: 'TEMPORARY_RECEIPT',
          onTransactionSettingsSaved,
        }}
      />
      <div className="mb-3 max-w-xs rounded-xl border border-border/80 bg-card p-3 shadow-sm">
        <DatePickerWithHijri
          label="تاريخ الإيصال"
          value={receiptDate}
          onChange={onReceiptDateChange}
          error={dateError}
        />
      </div>
      {extraFields}
    </>
  );
}
