'use client';

import { Download } from 'lucide-react';
import { DocumentHeaderBar } from '@/components/common/document-shell/DocumentHeaderBar';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';
import { OpeningStockActionMenu } from './OpeningStockActionMenu';

type Props = {
  docNumber?: string;
  isPosted: boolean;
  isReadOnly: boolean;
  hasDocument: boolean;
  canPost?: boolean;
  date: string;
  onDateChange: (value: string) => void;
  dateError?: boolean;
  savePending?: boolean;
  canSave?: boolean;
  loadPending?: boolean;
  onSave: () => void;
  onBrowseList: () => void;
  onLoadItems: () => void;
  onPost: () => void;
  onUnpost: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onExportExcel: () => void;
  onClearAll: () => void;
};

export function OpeningStockHeader({
  docNumber,
  isPosted,
  isReadOnly,
  hasDocument,
  canPost,
  date,
  onDateChange,
  dateError,
  savePending,
  canSave,
  loadPending,
  onSave,
  onBrowseList,
  onLoadItems,
  onPost,
  onUnpost,
  onEdit,
  onPrint,
  onExportExcel,
  onClearAll,
}: Props) {
  return (
    <>
      <DocumentHeaderBar
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'العمليات' },
          { label: 'بضاعة أول المدة' },
        ]}
        title="بضاعة أول المدة"
        docNumber={docNumber || 'OS-XXXX'}
        statusTone={isPosted ? 'success' : 'warning'}
        statusLabel={isPosted ? 'مرحل ومثبت (Posted)' : 'مسودة (Draft)'}
        onSaveDraft={onSave}
        saveLabel="حفظ"
        savePending={savePending}
        canSave={canSave}
        onBrowseList={onBrowseList}
        browseListLabel="السابق"
        favoriteHref="/inventory/operations/opening-stock"
        favoriteLabel="بضاعة أول المدة"
        extraActions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            isLoading={loadPending}
            disabled={isReadOnly || isPosted || loadPending}
            onClick={onLoadItems}
          >
            <Download className="h-3.5 w-3.5" />
            تحميل كافة الأصناف
          </Button>
        }
        actionMenu={
          <OpeningStockActionMenu
            hasDocument={hasDocument}
            canPost={canPost ?? hasDocument}
            isPosted={isPosted}
            isReadOnly={isReadOnly}
            onPost={onPost}
            onUnpost={onUnpost}
            onEdit={onEdit}
            onPrint={onPrint}
            onExportExcel={onExportExcel}
            onClearAll={onClearAll}
          />
        }
      />
      <div className="mb-3 max-w-xs rounded-xl border border-border/80 bg-card p-3 shadow-sm">
        <DatePickerWithHijri
          label="تاريخ بضاعة أول المدة"
          value={date}
          onChange={onDateChange}
          disabled={isReadOnly || isPosted}
          error={dateError}
        />
      </div>
    </>
  );
}
