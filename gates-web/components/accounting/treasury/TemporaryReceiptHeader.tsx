'use client';

import type { ReactNode } from 'react';
import { DocumentHeaderBar } from '@/components/common/document-shell/DocumentHeaderBar';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { TemporaryReceiptActionMenu } from './TemporaryReceiptActionMenu';

type Props = {
  receiptNumber?: string;
  isConfirmed: boolean;
  hasDocument: boolean;
  isReadOnly: boolean;
  isCancelled?: boolean;
  receiptDate: string;
  onReceiptDateChange: (value: string) => void;
  dateError?: boolean;
  savePending?: boolean;
  canSave?: boolean;
  onSave: () => void;
  onBrowseList: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onDuplicate: () => void;
  onCancelReceipt: () => void;
  extraFields?: ReactNode;
};

export function TemporaryReceiptHeader({
  receiptNumber,
  isConfirmed,
  hasDocument,
  isReadOnly,
  isCancelled,
  receiptDate,
  onReceiptDateChange,
  dateError,
  savePending,
  canSave,
  onSave,
  onBrowseList,
  onEdit,
  onPrint,
  onDuplicate,
  onCancelReceipt,
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
        statusTone={isConfirmed ? 'success' : 'warning'}
        statusLabel={isConfirmed ? 'مؤكد (Confirmed)' : 'مسودة (Draft)'}
        onSaveDraft={onSave}
        saveLabel="حفظ الإيصال"
        savePending={savePending}
        canSave={canSave}
        onBrowseList={onBrowseList}
        browseListLabel="السابق"
        favoriteHref="/accounting/operations/treasury/temp-receipt"
        favoriteLabel="إيصال استلام مؤقت"
        actionMenu={
          <TemporaryReceiptActionMenu
            hasDocument={hasDocument}
            isReadOnly={isReadOnly}
            isCancelled={isCancelled}
            onEdit={onEdit}
            onPrint={onPrint}
            onDuplicate={onDuplicate}
            onCancel={onCancelReceipt}
          />
        }
      />
      <div className="mb-3 max-w-xs rounded-xl border border-border/80 bg-card p-3 shadow-sm">
        <DatePickerWithHijri
          label="تاريخ الإيصال"
          value={receiptDate}
          onChange={onReceiptDateChange}
          disabled={isReadOnly}
          error={dateError}
        />
      </div>
      {extraFields}
    </>
  );
}
