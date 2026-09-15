'use client';

import { Download } from 'lucide-react';
import { DocumentHeaderBar } from '@/components/common/document-shell/DocumentHeaderBar';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';

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
  onNew?: () => void;
  newDisabled?: boolean;
  onVoid?: () => void;
  isCancelled?: boolean;
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
  onNew,
  newDisabled,
  onVoid,
  isCancelled,
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
        standardActions={{
          hasDocument,
          isPosted,
          isCancelled: Boolean(isCancelled),
          onNew,
          newLabel: 'جديد',
          newDisabled,
          newHint: 'يوجد كشف بضاعة أول المدة بالفعل. احذفه أولاً حتى يمكن إنشاء كشف جديد.',
          onEdit,
          onPost,
          onUnpost,
          onPrint,
          printLabel: 'طباعة كشف بضاعة أول المدة',
          onVoid,
          voidLabel: 'إلغاء الكشف',
          extraItems: [
            { id: 'excel', label: 'تصدير إلى إكسيل', onClick: onExportExcel },
            {
              id: 'clear',
              label: 'تفريغ محتويات الجدول',
              onClick: onClearAll,
              disabled: isReadOnly || isPosted,
              destructive: true,
            },
          ],
        }}
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
